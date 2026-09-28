# SentinelAI — NIDS ML Package v2 (Frozen)

**Status date:** September 2026  
**Status:** **CLOSED / FROZEN** CIC offline baseline.  
**Active live package:** **v3** — see `docs/ML_Package_v3.md` (lab-adapted; `config/paths.py` points at `*_v3.pkl`).

This note closes the offline NIDS package after the multiclass upgrade. Historical 3-class work remains in `docs/Phase1_Progress_Report.md` (archived baseline story only).

---

## Canonical artefacts

| File | Role |
|------|------|
| `models/sentinel_xgb_v2.pkl` | 6-class XGBoost classifier |
| `models/label_encoder_v2.pkl` | Class id ↔ label name |
| `models/feature_columns_v2.pkl` | Ordered **77** CIC feature names |

Paths are also declared in `config/paths.py`.  
SOAR loads them only through `soar/adapters/cic_xgb_adapter.py`.

**Removed / obsolete:** `sentinel_xgb.pkl`, `label_encoder.pkl`, `feature_columns.pkl`, sample `model.pkl` / `scaler.pkl` contracts.

---

## Classes

| Label | Notes |
|-------|--------|
| Benign | Normal traffic |
| Botnet | Botnet-style C2 / activity in training days |
| DDoS | Distributed denial of service |
| DoS | Denial of service |
| FTP-BruteForce | FTP credential stuffing |
| SSH-Bruteforce | SSH credential stuffing |

Dataset: CSE-CIC-**IDS2018**-style multiclass clean CSV (`data/processed/cic_multiclass_clean.csv`).  
Training script: `ml/train_xgb_v2.py` (rebuild dataset via `ml/build_multiclass_dataset.py` only if regenerating data).

---

## Feature contract

- **77** flow features — **no** `Dst Port` in the model vector.
- Canonical names / order: `docs/features_list.md` (pickle wins if markdown disagrees).
- Live / Member-2 mappers: `nids/feature_extractor.py`.

---

## Deployed hybrid policy (not a training feature)

After XGBoost predicts, `CicXgbAdapter.apply_port_override` may adjust **only** when the ML label is already in `{DoS, FTP-BruteForce, SSH-Bruteforce}`:

| Condition | Result |
|-----------|--------|
| pred ∈ {DoS, FTP-BruteForce} and `dst_port == 21` | FTP-BruteForce |
| pred ∈ {DoS, SSH-Bruteforce} and `dst_port == 22` | SSH-Bruteforce |
| otherwise | keep model label |

Benign / Botnet / DDoS are never rewritten by port.  
Detection Agent passes `flow.dst_port` into `adapter.predict(...)`.

**Why:** offline eval showed DoS ↔ FTP confusion without port; putting `Dst Port` back into X would reintroduce port leakage. Hybrid is the intentional deploy-time fix.

---

## Offline eval honesty (for viva)

| View | Rough takeaway |
|------|----------------|
| Full test (no port in X) | Strong overall; main errors DoS ↔ FTP |
| Unseen unique rows | Very high for classes present; **FTP unseen support can be 0** due to duplicate flows |
| Deployed policy | Hybrid port override on top of the frozen model |

Do **not** quote Phase-1 3-class 99.99% numbers as the current product score.

---

## Freeze rules

1. Do **not** add `Dst Port` to training features.
2. Do **not** expand classes further until the **live** feature bridge works.
3. Do **not** chase offline accuracy; next work is lab capture → 77 cols → SOAR.
4. Retrain only if artefacts are missing/corrupt or a documented live failure requires it — then bump to `v3` and update this file.

**Live SOAR (task 4):** Frozen ML may still say Benign on modern lab traffic. DetectionAgent applies `ood_policy` from `soar/rules/policies.yaml` so effective labels can escalate for response while `ml_attack_type` is preserved. That is **not** a model retrain.


---

## Verify package loads

```powershell
cd c:\Capstone
python -m nids.live_predict --row 0
python soar\demo_real_model.py
```

---

*Source of truth for “what model ships today.” Update this file when the freeze is intentionally broken.*
