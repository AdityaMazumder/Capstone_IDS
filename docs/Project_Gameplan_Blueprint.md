# SentinelAI — Project Gameplan & Blueprint

**Status date:** September 2026 (ML package v2 frozen)  
**Vision:** Hybrid **NIDS + HIDS + multi-agent SOAR + explainable alerts** for Windows  
**Repo:** `AvaneshJ/Capstone_IDS` (SSH: `git@github-personal:…`)

This document is the working blueprint from **today’s codebase** to the full platform in the new problem statement. It replaces the old “NIDS-only offline CSV” end goal without throwing away Phase 1 or the multi-agent work already on GitHub.

**ML packages:** CIC offline baseline frozen at **v2** (`docs/ML_Package_v2.md`). **Active package is v3** — CIC + lab merge (`docs/ML_Package_v3.md`).

---

## 1. One-sentence mission

Detect **network attacks** and **host malware behaviour** on Windows, explain them in plain language (MITRE + user-facing text), then **orchestrate a response** (alert → optional block → log → PDF), all through specialized agents.

---

## 2. What you already have (do not rebuild)

| Area | Location | Reality check |
|------|----------|----------------|
| Offline NIDS ML (**v2, 6-class, FROZEN**) | `ml/`, `models/`, `docs/ML_Package_v2.md` | XGBoost + encoder + **77 features (no `Dst Port`)** on CSE-CIC-**IDS2018**-style multiclass: Benign / Botnet / DDoS / DoS / FTP / SSH. Hybrid `dst_port` override in adapter. Cite **2018**, not 2017. |
| Phase-1 robustness story (3-class archive) | `docs/Phase1_Progress_Report.md` | Experiments A–C, port-rule baseline; historical only |
| Feature contract | `docs/features_list.md`, `models/feature_columns_v2.pkl` | Canonical 77-column order for live inference |
| Multi-agent SOAR + real model | `soar/` | Packet → Detection (CicXgbAdapter) → Threat → Risk → Decision → Firewall → Alert → Logging → Report (+ LLM) |
| Policies / SQLite / FastAPI stub | `soar/rules/`, `soar/database/`, `soar/api/` | Wired to v2 model on CSV/demo; need **live** inputs |
| Demo path | `soar/demo_real_model.py`, `soar/demo_runner.py`, `soar/main.py` | Supervisor walkthrough of agent pipeline |

### Critical gap (integration) — updated

Legacy short contracts (`model.pkl`, `scaler.pkl`, `feature_names.json`) are **obsolete**.  
Shipping artefacts: `sentinel_xgb_v2.pkl`, `label_encoder_v2.pkl`, `feature_columns_v2.pkl` via `soar/adapters/cic_xgb_adapter.py`.

**Remaining gap:** live packets/flows → 77 CIC keys + `dst_port` → orchestrator (not offline CSV).

---

## 3. Target architecture (end state)

```text
                    ┌─────────────────────┐
   Kali / lab VM    │  Attack generator   │  (Hydra, Nmap — own VMs only)
                    └──────────┬──────────┘
                               │ packets
┌──────────────────────────────┼──────────────────────────────┐
│ Windows laptop (victim + SentinelAI)                        │
│                                                              │
│  A. NIDS                         B. HIDS                     │
│  Packet/flow capture             Process / file / cookie     │
│  Feature extractor → 77 cols     Host feature vector         │
│  XGBoost (network)               XGB / Isolation Forest      │
│           \                         /                        │
│            \                       /                         │
│             ▼                     ▼                          │
│           Evidence events (common schema)                    │
│             │                                                │
│             ▼                                                │
│   Multi-agent SOAR (already sketched in repo)                │
│   Threat(MITRE) → Risk → Decision(YAML) → Firewall/Alert     │
│   → SQLite → PDF → Dashboard (React + WebSocket)             │
└──────────────────────────────────────────────────────────────┘
```

**User-facing promise:** never show “SYN anomaly”; show plain language via Alert/LLM agents.

---

## 4. Honest scope ladder (what to promise when)

Do **not** claim all attack types on day one. Expand labels only when you have data + live features.

| Tier | Capability | When |
|------|------------|------|
| **T0 — Done** | Offline **6-class** NIDS v2 + SOAR demo on CSV / synthetic flows | Frozen (`ML_Package_v2.md`) |
| **T1 — Next** | Lab PCAP/live flows → feature bridge → real XGBoost predict + log | Immediate priority |
| **T2** | SOAR on live NIDS hits (dry-run firewall → approved block) | After T1 stable |
| **T3** | Minimal HIDS (process + sensitive file/cookie path access) + second model | Parallel after T1 starts |
| **T4** | Correlation (host + network same incident) + React dashboard | After T2/T3 evidence exists |
| **T5** | Extra NIDS classes (e.g. Port Scan) via more CIC days / retrain | Only after T1 works; DDoS/DoS/Botnet already in v2 |

Supervisor CVE note: if required, **anchor HIDS** to one Windows CVE as a **case study** (mitigation + behavioural simulation). Platform stays the same; case study changes. Prefer network-visible or behaviour-demo CVEs — not “we wrote an RCE exploit.”

---

## 5. Blueprint: folder evolution

Keep current repos layout working; grow toward the plan’s `sentinelAI/` shape **without** a big-bang rewrite.

```text
Capstone/
├── docs/                          # Plans, Phase 1 report, this blueprint
├── data/                          # Local only (gitignored)
├── ml/                            # Offline train / EDA / experiments
├── models/                        # sentinel_xgb_v2.pkl + encoder_v2 + feature_columns_v2
│
├── nids/                          # NEW — live path (Member 2)
│   ├── capture.py                 # scapy / exporter wrapper
│   ├── feature_extractor.py       # packets/flows → 77 columns
│   └── live_predict.py            # load models/ + predict_proba
│
├── hids/                          # NEW — host path (later)
│   ├── process_monitor.py
│   ├── file_monitor.py
│   └── hids_model.pkl
│
├── soar/                          # Multi-agent SOAR brain (was Multi-Model Architecture)
│   ├── adapters/                  # CIC XGBoost adapter → Detection Agent
│   ├── agents/ ...
│   ├── core/ ...
│   ├── api/ ...
│   └── ...
│
└── dashboard/                     # React (Member 4), later
```

**Integration rule:** `nids/` and `hids/` emit events; they do not own firewall/PDF logic. Agents own response.

---

## 6. Development roadmap (revised from the pasted plan)

### Phase 1 — Offline NIDS baseline — **DONE**
- EDA, clean CSV, DT / RF / XGBoost, robustness A–C (3-class archive)  
- Docs: `Phase1_Progress_Report.md`

### Phase 1b / Package v2 — Multiclass + hybrid — **DONE / FROZEN**
- 6-class dataset + `train_xgb_v2.py` → `*_v2.pkl`  
- Hybrid port override in adapter + Detection Agent  
- Docs: `ML_Package_v2.md`, `features_list.md`, contracts  

### Phase 2 — Wire real ML into agents — **DONE**
1. Adapter: Detection Agent loads `sentinel_xgb_v2.pkl` + `feature_columns_v2.pkl` + `label_encoder_v2.pkl`  
2. Flow schema mapper: `nids/feature_extractor.py` + PacketAgent  
3. Golden demo: `soar/demo_real_model.py` on multiclass CSV rows  

**Exit criteria met:** real XGBoost labels + confidence through SOAR on CSV paths.

### Phase 3 — Live NIDS lab + feature bridge — **CRITICAL PATH (NEXT)**
1. VirtualBox + Kali host-only network  
2. Capture (Scapy and/or CICFlowMeter) on Windows  
3. Feature extractor → **77 columns, training order**  
4. Ground-truth lab log: what you ran vs what model said  
5. Feed live flow dict into orchestrator queue  

**Exit criteria:** Hydra SSH against **your** lab target → model often says SSH-Bruteforce; browsing → mostly Benign (expect some drift).

### Phase 4 — SOAR hardening (NIDS-triggered)
1. Policies in `policies.yaml` (thresholds, whitelist, cooldown)  
2. Firewall agent **dry-run first**, then optional `netsh` with user approval  
3. SQLite incident trail + PDF report on real incidents  
4. Plain-language alert text (LLM agent or templates)

**Exit criteria:** One end-to-end NIDS incident: detect → risk → decision → (dry) block → DB → PDF.

### Phase 5 — HIDS module
1. `psutil` + `watchdog`: process create, path touches under Chrome/Discord/Steam cookie/token locations  
2. Small labelled behavioural dataset (benign vs simulated stealer-like access patterns in **lab**)  
3. Isolation Forest and/or second XGBoost  
4. Host Agent → same event bus / incident schema  

**Exit criteria:** Simulated “cookie DB read + sudden outbound” story produces host incident + user-readable alert (quarantine/kill **only** for processes you launched in lab).

### Phase 6 — Correlation + Dashboard
1. Correlate host + network windows (same time / same outbound IP)  
2. React + WebSocket live alerts, timeline, Recharts  
3. FastAPI already in repo — extend for dashboard contract  

**Exit criteria:** User sees story-style alerts, not raw flags.

### Phase 7 — Expand NIDS classes (optional)
- Add CIC days for Port Scan / DDoS only after live bridge works  
- Retrain; update MITRE map (`T1046`, `T1498`, etc.)

---

## 7. How to test that predictions are right (lab doctrine)

You **never** judge the model on random public Wi‑Fi first. You generate labelled traffic.

| Step | Action | Success signal |
|------|--------|----------------|
| 1 | Host-only lab: Windows + Kali | Ping visible in sniffer |
| 2 | Benign: browse / download on Windows | Mostly Benign |
| 3 | Attack **own** VM/service: Hydra SSH/FTP, Nmap | Expected class (or known gap if class not in model yet) |
| 4 | Packets → flows → **77 features** | Row shape `(1, 77)` matches `feature_columns_v2.pkl` |
| 5 | `predict` + `predict_proba` | Label + confidence |
| 6 | Scorecard | Confusion table: Actual (what you ran) vs Predicted |

**Current model truth table (honest):**

| You generate | Model can output today |
|--------------|-------------------------|
| Web / ping / most benign | Benign |
| SSH Hydra | SSH-Bruteforce (hybrid helps if DoS/SSH ambiguous on port 22) |
| FTP Hydra | FTP-BruteForce (hybrid helps if DoS/FTP ambiguous on port 21) |
| DoS / DDoS lab floods | DoS / DDoS (trained in v2; live feature quality may still drift) |
| Botnet-like C2 (if lab matches training) | Botnet |
| Nmap / Port Scan | **Not a dedicated class** — expect Benign or wrong; do not claim until retrain |

Keep a simple CSV: `timestamp, scenario, expected, predicted, confidence, notes`.

---

## 8. Immediate gameplan (next 2–3 weeks)

Ordered; do not skip ahead to React.

### Week A — Integration + honesty in demos — **DONE**
1. Feature contract + v2 artefacts documented (`ML_Package_v2.md`).  
2. Mapper + Detection Agent → real `models/*_v2.pkl`.  
3. Offline CSV through SOAR (`demo_real_model.py`).  
4. Supervisor wording: **CSE-CIC-IDS2018** multiclass; 77 features without `Dst Port`; hybrid deploy policy.

### Week B — Lab plumbing — **NEXT**
1. VirtualBox + Kali OVA; host-only adapter; note IPs.  
2. OpenSSH (and/or FTP) **on a disposable lab VM**, not production.  
3. Scapy sniff proof: Kali `ping` → Windows prints packets.  
4. Choose exporter path: CICFlowMeter **or** reduced feature set + retrain (decide explicitly). Do **not** break the v2 freeze unless you choose retrain.

### Week C — First live scorecard
1. Feature extractor MVP (even partial columns: document gaps).  
2. 20+ labelled trials (benign + SSH; FTP / DoS if ready).  
3. One page results for supervisor: live accuracy ≠ CIC offline accuracy.  
4. Only then: dry-run firewall on high-confidence SSH hits.

### Parallel (light)
- Sketch HIDS feature list (process name, signed/unsigned, path category, outbound count).  
- No full stealer simulation until NIDS live path exists.

---

## 9. Team split (matches repo + new vision)

| Member | Owns | Near-term deliverable |
|--------|------|------------------------|
| **1 — AIML** | `ml/`, `models/`, HIDS model later, live eval scorecard | Package **frozen** at v2; support live scorecard only |
| **2 — Capture / security** | `nids/` capture + extractor, lab attacks | PCAP/live → flow dict (**next bottleneck**) |
| **3 — SOAR** | `soar/` | Policies + dry-run response on live hits |
| **4 — Dashboard** | `dashboard/` + API consumer | Wait for stable incident JSON; then React + WS |

---

## 10. Tech checklist (from the plan — prioritized)

**Now:** Python, joblib, XGBoost, pandas, scikit-learn, PyYAML, SQLite (existing), Scapy  
**Soon:** psutil, watchdog, netsh (dry-run), FastAPI/WebSocket polish  
**Later:** React, Recharts, Tailwind  

Skip buying commercial IDS. Stay in isolated VMs for attacks.

---

## 11. 45-second pitch (corrected)

> SentinelAI is a hybrid AI Windows defence platform. Our NIDS uses a frozen 6-class XGBoost model on CSE-CIC-IDS2018-style flow features (Benign, Botnet, DDoS, DoS, FTP and SSH brute force), with a hybrid port policy for DoS/FTP/SSH ambiguity, and we are bridging live lab traffic into that model. A multi-agent SOAR layer already maps MITRE techniques, scores risk, can drive firewall actions, logs to SQLite, and builds PDF reports. Next we prove live detection in the lab, then add a Windows HIDS for behavioural threats such as session-cookie theft, then a user-friendly dashboard. Goal: detect on both network and host, explain, and respond.

---

## 12. Definition of done (project)

Minimum shippable Capstone story:

1. Live or lab-captured **NIDS** path with documented feature bridge and scorecard.  
2. Multi-agent **SOAR** on those detections (alert + log + report; firewall at least dry-run).  
3. **HIDS** MVP with at least one behavioural scenario (e.g. sensitive browser DB access pattern) and MITRE tag (e.g. T1539).  
4. Dashboard **or** strong CLI/API demo if UI slips — prefer thin React if time allows.  
5. Clear limitations: not all CVEs, not encrypted payload inspection, live accuracy ≠ CIC CSV scores.

---

## 13. What to do next (after ML freeze)

1. Confirm `python soar\demo_real_model.py` still runs on this machine.  
2. Install/verify VirtualBox; download Kali OVA if not present.  
3. Start Week B lab plumbing — do **not** retrain v2.  
4. Do **not** start the React app yet.

---

*This blueprint is the source of truth for sequencing. Update it when a phase’s exit criteria are met.*
