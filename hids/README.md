# SentinelAI HIDS (Phase 5)

Windows host monitoring lives here:

- `process_monitor.py` — process sensor: START / STATS / EXIT / END lifecycle events to `logs/process_events_YYYY-MM-DD.csv` (format in `soar/contracts/teammate_contracts.md`)
- `file_monitor.py` — sensitive path heuristics (cookies / tokens), still a stub

```powershell
python -m hids.process_monitor                      # run until Ctrl+C
python -m hids.process_monitor --duration 600       # 10-minute collection
python -m unittest hids.tests.test_process_monitor  # tests
```

The HIDS model (`hids_model.pkl`) will be added after a small labelled behavioural dataset exists.
Host events must feed the same SOAR bus as NIDS — do not bypass Decision / Firewall agents.
