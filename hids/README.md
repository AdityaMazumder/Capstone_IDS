# SentinelAI HIDS (Phase 5)

Windows host monitoring lives here:

- `process_monitor.py` — process sensor: START / STATS / EXIT / END lifecycle events to `logs/process_events_YYYY-MM-DD.csv`
- `file_monitor.py` — file sensor: who opened the browser credential files infostealers target, to `logs/file_events_YYYY-MM-DD.csv`

Both formats are documented in `soar/contracts/teammate_contracts.md`.

### Watched files (every profile, auto-resolved for the current user)

| Browser / app | Files |
|---------------|-------|
| Chrome, Edge, Brave, Vivaldi, Opera, Opera GX | `Login Data`, `Login Data For Account`, `Cookies`, `Network\Cookies`, `Web Data`, `Local State` |
| Firefox | `logins.json`, `key4.db`, `cookies.sqlite` |
| Bitcoin Core | `wallet.dat` |

### File sensor modes

| Mode | Needs | Sees | Process |
|------|-------|------|---------|
| `audit` | Administrator | `READ`, `MODIFY`, `DELETE` (Windows event 4663) | Real PID and executable path |
| `poll` | nothing | `CREATE`, `MODIFY`, `DELETE` only | `unknown` |

Only audit mode can catch a stealer, because stealers read (copy) the files instead of changing them.
It enables File System auditing (`auditpol`) and adds an audit rule to each target file; nothing else
on the files is changed. The rules stay after the sensor stops; remove them with `--remove-audit`.

`accessor_is_owner` is `1` only when the browser's own executable, from its real install folder,
opened its own file. A `chrome.exe` running from `Temp` is `0`.

### Usage

```powershell
# Process sensor
python -m hids.process_monitor                      # run until Ctrl+C
python -m hids.process_monitor --duration 600       # 10-minute collection

# File sensor (Administrator PowerShell for audit mode)
python -m hids.file_monitor --list-targets          # show what would be watched
python -m hids.file_monitor                         # audit if elevated, else poll
python -m hids.file_monitor --mode audit --duration 600
python -m hids.file_monitor --remove-audit          # undo audit rules and policy

# Tests
python -m pytest hids/tests -q
```

## Model, live scoring and SOAR

- `dataset/` builds the labelled training table and trains the Isolation Forest
  (`models/hids_isolation_forest.joblib`). See `dataset/README.md`.
- `predict.py` scores a finished process run (`label`, `confidence`, `anomaly_score`).
- `live.py` (`HostBridge`) sends anomalous runs and non-owner credential-file reads to
  `orchestrator.process_host_event`. Dry-run unless `--live-response` is passed.
- Over HTTP, sensors can post the same event to `POST /api/host/events/ingest` on the SOAR server; the incident
  then shows up live on the dashboard's Computer protection page.

```powershell
python -m hids.predict
python -m hids.live --duration 600
```

Host events must feed the same SOAR pipeline as NIDS — do not bypass the HostAgent / response agents.
