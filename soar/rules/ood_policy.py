"""
Live OOD / confidence policy (SOAR task 4).

Universal layer: when the frozen CIC XGBoost says Benign but the flow looks
out-of-distribution for live traffic (auth ports, unusual TCP window, SYN
activity, burst velocity), escalate to a policy label for response.

Does NOT retrain the model. Preserves ml_attack_type / ml_confidence on DetectionResult.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional, Tuple

from core.schemas import FlowEvent


@dataclass
class OODDecision:
    override: bool = False
    attack_type: str = "Benign"
    confidence: float = 0.0
    reason: str = ""
    signals: List[str] = field(default_factory=list)


class OODPolicy:
    """Config-driven live trust layer (loaded from policies.yaml → ood_policy)."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.enabled: bool = bool(cfg.get("enabled", True))
        self.apply_when_ml_benign: bool = bool(cfg.get("apply_when_ml_benign", True))
        self.auth_ports = {int(p) for p in cfg.get("auth_ports", [21, 22, 3389, 445])}
        self.port_label_map = {
            int(k): str(v) for k, v in (cfg.get("port_label_map") or {
                22: "SSH-Bruteforce",
                21: "FTP-BruteForce",
                3389: "BruteForce",
                445: "BruteForce",
            }).items()
        }
        self.min_fwd_pkts = int(cfg.get("min_fwd_pkts", 2))
        self.min_syn_flags = int(cfg.get("min_syn_flags", 1))
        self.min_signals = int(cfg.get("min_signals", 2))
        self.override_confidence = float(cfg.get("override_confidence", 0.78))
        # CIC SSH training only saw these init windows; modern stacks often use 64240 etc.
        self.known_cic_init_windows = {
            int(x) for x in cfg.get("known_cic_init_windows", [241, 26883, 8192, 65535, 29200, 0])
        }
        self.unusual_init_win_min = int(cfg.get("unusual_init_win_min", 40000))
        self.velocity_window_s = float(cfg.get("velocity_window_seconds", 60))
        self.velocity_min_hits = int(cfg.get("velocity_min_hits", 3))
        self.max_ml_benign_confidence_to_trust = float(
            cfg.get("max_ml_benign_confidence_to_trust", 0.9999)
        )
        # src_ip -> deque of timestamps for auth-port hits while ML benign
        self._velocity: Dict[str, Deque[float]] = defaultdict(deque)

    @staticmethod
    def _is_benign(label: str) -> bool:
        return str(label).strip().lower() in ("benign", "benign traffic", "")

    def _raw(self, flow: FlowEvent) -> Dict[str, Any]:
        return dict(flow.raw_features or {})

    def _init_win(self, flow: FlowEvent) -> int:
        raw = self._raw(flow)
        for key in ("Init Fwd Win Byts", "init_fwd_win_byts", "Init_Win_bytes_forward"):
            if key in raw and raw[key] is not None:
                try:
                    return int(float(raw[key]))
                except (TypeError, ValueError):
                    pass
        return 0

    def _syn_count(self, flow: FlowEvent) -> int:
        raw = self._raw(flow)
        for key in ("SYN Flag Cnt", "syn_flag_cnt", "syn_flag_count"):
            if key in raw and raw[key] is not None:
                try:
                    return int(float(raw[key]))
                except (TypeError, ValueError):
                    pass
        return int(flow.syn_flag_count or 0)

    def _fwd_pkts(self, flow: FlowEvent) -> int:
        raw = self._raw(flow)
        for key in ("Tot Fwd Pkts", "tot_fwd_pkts"):
            if key in raw and raw[key] is not None:
                try:
                    return int(float(raw[key]))
                except (TypeError, ValueError):
                    pass
        return int(flow.tot_fwd_pkts or 0)

    def _note_velocity(self, flow: FlowEvent, now: float) -> int:
        key = flow.src_ip
        q = self._velocity[key]
        q.append(now)
        cutoff = now - self.velocity_window_s
        while q and q[0] < cutoff:
            q.popleft()
        return len(q)

    def evaluate(
        self,
        flow: FlowEvent,
        ml_label: str,
        ml_confidence: float,
        probabilities: Optional[Dict[str, float]] = None,
    ) -> OODDecision:
        if not self.enabled:
            return OODDecision(override=False, attack_type=ml_label, confidence=ml_confidence)

        if self.apply_when_ml_benign and not self._is_benign(ml_label):
            return OODDecision(override=False, attack_type=ml_label, confidence=ml_confidence)

        signals: List[str] = []
        dst_port = int(flow.dst_port or 0)
        syn = self._syn_count(flow)
        fwd = self._fwd_pkts(flow)
        init_win = self._init_win(flow)
        now = float(flow.timestamp or time.time())

        if dst_port in self.auth_ports:
            signals.append(f"auth_port:{dst_port}")

        if dst_port in self.auth_ports and syn >= self.min_syn_flags:
            signals.append(f"syn_on_auth:{syn}")

        if dst_port in self.auth_ports and fwd >= self.min_fwd_pkts:
            signals.append(f"fwd_pkts_on_auth:{fwd}")

        if (
            dst_port in self.auth_ports
            and init_win >= self.unusual_init_win_min
            and init_win not in self.known_cic_init_windows
        ):
            signals.append(f"ood_init_win:{init_win}")

        # Extreme Benign confidence on auth traffic is itself a live-vs-CIC smell
        if (
            dst_port in self.auth_ports
            and self._is_benign(ml_label)
            and ml_confidence >= self.max_ml_benign_confidence_to_trust
            and (syn >= self.min_syn_flags or fwd >= self.min_fwd_pkts)
        ):
            signals.append(f"ml_benign_overconfident:{ml_confidence:.4f}")

        hits = 0
        if dst_port in self.auth_ports and (
            syn >= self.min_syn_flags or fwd >= self.min_fwd_pkts
        ):
            hits = self._note_velocity(flow, now)
            if hits >= self.velocity_min_hits:
                signals.append(f"auth_velocity:{hits}/{self.velocity_window_s:.0f}s")

        # Need enough independent signals (auth_port alone is not enough)
        strong = [s for s in signals if not s.startswith("auth_port:")]
        if len(strong) < self.min_signals and not any(s.startswith("auth_velocity:") for s in signals):
            return OODDecision(
                override=False,
                attack_type=ml_label,
                confidence=ml_confidence,
                signals=signals,
                reason="insufficient_ood_signals",
            )

        if dst_port not in self.auth_ports:
            return OODDecision(
                override=False,
                attack_type=ml_label,
                confidence=ml_confidence,
                signals=signals,
                reason="not_auth_port",
            )

        label = self.port_label_map.get(dst_port, "AnomalousTraffic")
        reason = (
            f"OOD policy override: ML={ml_label} ({ml_confidence:.4f}) but live signals "
            f"[{', '.join(signals)}] -> {label}"
        )
        return OODDecision(
            override=True,
            attack_type=label,
            confidence=self.override_confidence,
            reason=reason,
            signals=signals,
        )
