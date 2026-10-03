# HIDS dataset tools (Member 2)

Turns the raw sensor logs into a labelled, one-row-per-process-run table for the
Isolation Forest, and generates realistic "Stealer" examples safely.

## Files

| File | Purpose |
|------|---------|
| `stealer_simulator.py` | Safe infostealer simulator: runs disguised from `%TEMP%`, copies browser credential files, then shreds them. Writes a run manifest. |
| `features.py` | Feature engineering (pure functions): path buckets, rarity vs the benign corpus, command-line flags, file-access aggregation. |
| `build_dataset.py` | Loads sensor CSVs, keeps one row per run, joins file activity, labels runs from manifests, writes the training table. |
| `train_model.py` | Trains the Isolation Forest on Normal runs and writes `models/hids_isolation_forest.joblib`. |
| `manifests/` | Simulator run records (git-ignored: they contain local paths). |
| `hids_dataset.csv` | The built table (`label` = `Normal` / `Stealer`). `_normal.csv` / `_stealer.csv` with `--split`. |

## How a process run becomes a row

A run is identified by `(pid, create_time)` — the same key both sensors use. The
`EXIT`/`END` row from the process sensor is one run; file-sensor rows with the same key
are aggregated onto it. Raw `exe_path` and `cmdline` are **not** emitted (they leak
usernames and are useless to a model); they become a path bucket, boolean flags and lengths.

Feature groups (see `features.FEATURE_COLUMNS`):
- lifetime / resource: `lifetime_s`, `is_running`, `samples`, `cpu_mean`, `cpu_max`, `memory_max_mb`
- rarity vs benign corpus: `name_freq`, `parent_freq`, `pair_freq`
- location / lineage: `path_bucket`, `from_user_space`, `from_temp_or_downloads`, `from_program_files`, `parent_is_shell`, `name_exe_mismatch`
- command line: `cmd_len`, `cmd_tokens`, `cmd_has_url`, `cmd_encoded`, `cmd_hidden`, `cmd_noninteractive_bypass`, `cmd_download`, `cmd_browser_data`
- file access (0 if none): `file_reads/writes/deletes`, `touched_password_db/cookies/master_key/web_data`, `distinct_sensitive_types`, `distinct_browsers`, `accessed_not_owner`, `accessed_as_owner`

## Collect data

```powershell
# Benign baseline (Administrator for full cmdline/exe). Run on several PCs for ~40 min each.
python -m hids.process_monitor --duration 2400

# Optional, Administrator only: who read the credential files (adds the file-access features)
python -m hids.file_monitor --mode audit --duration 2400
```

## Generate labelled stealer examples

Run the process sensor (and, as Administrator, the file sensor) at the same time:

```powershell
python -m hids.process_monitor --interval 1 --duration 300
# in another window:
python -m hids.dataset.stealer_simulator --runs 25
```

Each run copies the browser credential files to a temp folder, records its exact
`(pid, create_time)` to `manifests/stealer_runs.jsonl`, shreds the copies and exits.
Nothing is exfiltrated.

## Build the table

```powershell
python -m hids.dataset.build_dataset --split
```

Auto-discovers `hids/logs/*.csv` and `manifests/*.jsonl`. A run is labelled `Stealer`
only if its exact run key is in a manifest — so there is no leakage and no "every
python.exe is a stealer" guessing.

## Score a live run

`hids/predict.py` loads the saved model and scores one EXIT/END row with the same
four features used in training (`log_life`, `from_user_space`, `from_temp_or_downloads`,
`parent_is_shell`). `hids/live.py` sends anomalous runs to SOAR, and sends a
non-owner credential-file access immediately so a short-lived stealer is not
missed just because scoring waits for the process to exit. Both stay in dry-run
unless `--live-response` is passed.

```powershell
python -m hids.predict
python -m hids.live
python -m hids.process_monitor --soar
python -m hids.file_monitor --mode audit --soar
```

The training CSVs under this folder are generated locally and are gitignored.

## Modelling note

Train the Isolation Forest on the `Normal` rows only; keep the `Stealer` rows to measure
detection. `lifetime_s` spans seconds to days (still-running `END` rows), so log-compress
it (`log1p`) and standardise features before fitting. On the current sample a focused
feature set gives 100% stealer detection at ~1% false positives; the full raw feature set
needs this preprocessing because a cluster of near-identical anomalies otherwise masks
itself in a vanilla Isolation Forest.
