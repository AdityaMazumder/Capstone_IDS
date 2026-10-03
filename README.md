# SentinelAI — Hybrid NIDS + HIDS + Multi-Agent SOAR

CSE-CIC-**IDS2018**-style network detection (**frozen** 6-class XGBoost v2, 77 flow features, no `Dst Port`, hybrid `dst_port` policy)
plus a multi-agent SOAR pipeline, with HIDS and dashboard stubs for later phases.

**ML package:** see `docs/ML_Package_v2.md` (do not retrain unless live demo forces a `v3`).

## Layout

```text
Capstone/
├── config/           # Shared paths (single source of truth: config/paths.py)
├── data/             # Local datasets only (gitignored)
├── docs/             # Reports, feature contract, gameplan, ML freeze
├── ml/               # Offline dataset building / train / eval  (+ tests/)
├── models/           # Frozen XGBoost v2/v3 artefacts (model, encoder, feature columns)
├── nids/             # Live capture + feature bridge + predict  (+ tests/)
├── hids/             # Host sensors, Isolation Forest scoring, SOAR bridge (+ tests/)
│   └── dataset/      # Member 2: stealer simulator, feature engineering, dataset builder
├── soar/             # Multi-agent SOAR (Detection → Response → Report)  (+ tests/)
├── dashboard/        # React UI placeholder (Phase 6)
├── requirements.txt  # Single dependency list for the whole project
└── README.md
```

## Quick start

```powershell
cd c:\Capstone
pip install -r requirements.txt          # one list covers NIDS, ML, SOAR, HIDS

# Frozen v2 model on one CSV row
python -m nids.live_predict --row 0

# Real model through full SOAR pipeline
python soar\demo_real_model.py

# Agent golden demo (heuristics if CSV rows not attached)
cd soar
python demo_runner.py

# HIDS: score a finished run, or run the sensors into SOAR (dry-run, no process kill)
python -m hids.predict
python -m hids.live --duration 600
```

## Tests

```powershell
python -m pytest nids/tests ml/tests hids/tests soar/tests -q
```

## Dataset citation

Working flow CSV matches **CSE-CIC-IDS2018** multiclass labels
(`Benign`, `Botnet`, `DDoS`, `DoS`, `FTP-BruteForce`, `SSH-Bruteforce`).

## Integration rule

`nids/` and `hids/` emit evidence. **`soar/` owns response** (risk, firewall dry-run, alerts, SQLite, PDF).

See `docs/Project_Gameplan_Blueprint.md` for the full roadmap. Next priority: **live lab feature bridge**, not more offline training.
