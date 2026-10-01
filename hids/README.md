# SentinelAI HIDS (Phase 5)

Windows host monitoring lives here:

- `process_monitor.py` — process sensor: START / STATS / EXIT / END lifecycle events to `logs/process_events_YYYY-MM-DD.csv` (format in `soar/contracts/teammate_contracts.md`)
- `file_monitor.py` — file sensor: watches browser cookie/credential files that infostealers target, logs READ / MODIFY / CREATE events to `logs/file_events.csv`

### Watched Files (per-user, auto-resolved)

| Browser | File(s) |
|---------|---------|
| Chrome  | `Cookies` and `Local State` |
| Edge    | `Cookies` |
| Firefox | `cookies.sqlite` |

### `file_events.csv` Schema

| Column | Description |
|--------|-------------|
| `timestamp` | ISO 8601 timestamp (ms precision) |
| `process` | Name of the process accessing the file |
| `file_path` | Absolute path to the touched file |
| `event_type` | `READ`, `MODIFY`, or `CREATE` |

### Usage

```powershell
# Process sensor
python -m hids.process_monitor                      # run until Ctrl+C
python -m hids.process_monitor --duration 600       # 10-minute collection
python -m unittest hids.tests.test_process_monitor  # tests

# File sensor
python -m hids.file_monitor                         # run until Ctrl+C
python -m hids.file_monitor --duration 60           # 1-minute collection
python -m unittest hids.tests.test_file_monitor     # tests
```

The HIDS model (`hids_model.pkl`) will be added after a small labelled behavioural dataset exists.
Host events must feed the same SOAR bus as NIDS — do not bypass Decision / Firewall agents.
