# SentinelAI — Hybrid NIDS + HIDS + Multi-Agent SOAR

CSE-CIC-**IDS2018**-style network detection (**frozen** 6-class XGBoost v2, 77 flow features, no `Dst Port`, hybrid `dst_port` policy)
plus a multi-agent SOAR pipeline, with HIDS and dashboard stubs for later phases.

**ML package:** see `docs/ML_Package_v2.md` (do not retrain unless live demo forces a `v3`).

## Layout

```text
Capstone/
├── config/           # Shared paths (models, data, packages)
├── data/             # Local datasets only (gitignored)
├── docs/             # Reports, feature contract, gameplan, ML freeze
├── ml/               # Offline EDA / train / experiments
├── models/           # sentinel_xgb_v2.pkl, label_encoder_v2.pkl, feature_columns_v2.pkl
├── nids/             # Live capture + feature bridge + predict
├── hids/             # Host monitoring stubs (Phase 5)
├── soar/             # Multi-agent SOAR (Detection → Response → Report)
├── dashboard/        # React UI placeholder (Phase 6)
└── README.md
```

## Quick start

```powershell
cd c:\Capstone
pip install -r requirements.txt
pip install -r soar\requirements.txt

# Frozen v2 model on one CSV row
python -m nids.live_predict --row 0

# Real model through full SOAR pipeline
python soar\demo_real_model.py

# Agent golden demo (heuristics if CSV rows not attached)
cd soar
python demo_runner.py
```

## Dataset citation

Working flow CSV matches **CSE-CIC-IDS2018** multiclass labels
(`Benign`, `Botnet`, `DDoS`, `DoS`, `FTP-BruteForce`, `SSH-Bruteforce`).

## Integration rule

`nids/` and `hids/` emit evidence. **`soar/` owns response** (risk, firewall dry-run, alerts, SQLite, PDF).

See `docs/Project_Gameplan_Blueprint.md` for the full roadmap. Next priority: **live lab feature bridge**, not more offline training.
