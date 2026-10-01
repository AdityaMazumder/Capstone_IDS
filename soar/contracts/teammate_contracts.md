# SentinelAI — Teammate Integration Contracts & API Protocols

This document defines the interface specifications and contract protocols for parallel development across all 4 team members.

**Package layout:** Capstone root → `ml/`, `models/`, `nids/`, `hids/`, `soar/`, `dashboard/`.

---

## 1. Member 1 Contract (Machine Learning Lead)
**What Member 1 Provides (NIDS ML Package v2 — FROZEN):**

Canonical freeze write-up: `docs/ML_Package_v2.md`.

| File | Role |
|------|------|
| `models/sentinel_xgb_v2.pkl` | 6-class XGBoost classifier |
| `models/label_encoder_v2.pkl` | Maps class ids ↔ Benign / Botnet / DDoS / DoS / FTP-BruteForce / SSH-Bruteforce |
| `models/feature_columns_v2.pkl` | Ordered list of **77** CIC feature names (**no `Dst Port`**) |

SOAR loads these via `soar/adapters/cic_xgb_adapter.py`.  
Do **not** require `scaler.pkl` for this tree model. Dataset citation: **CSE-CIC-IDS2018**-style multiclass (`cic_multiclass_clean.csv`).

**Hybrid (required for deploy):** pass `dst_port` into `adapter.predict(...)` (or set `FlowEvent.dst_port`) so DoS ↔ FTP/SSH swaps can be resolved. Port is **never** part of the 77-dim training vector.

### Python Model API (through adapter):
```python
from soar.adapters import CicXgbAdapter

adapter = CicXgbAdapter()
adapter.load()
# Prefer explicit dst_port for hybrid override
label, confidence, probs = adapter.predict(raw_features_dict_77, dst_port=21)
```

Legacy short `feature_names.json` / `model.pkl` / `scaler.pkl` sample contracts are obsolete.  
Live flows must populate `FlowEvent.raw_features` with the 77 CIC keys (`nids/feature_extractor.py`) **and** keep `dst_port` on the flow for hybrid policy.

---

## 2. Member 2 Contract (Network Sniffer & PCAP Lead)
**What Member 2 Provides:** Live Flow Dictionary stream via Queue or Generator.

### Flow Dictionary Schema:
Member 2 pushes standardized dictionaries to a Python `queue.Queue` or `multiprocessing.Queue`:
```python
flow_dict = {
    "src_ip": "192.168.1.50",          # Attacker / Source IP (string)
    "dst_ip": "192.168.1.10",          # Destination / Victim IP (string)
    "src_port": 54120,                 # Source Port (int)
    "dst_port": 80,                    # Destination Port (int)
    "protocol": 6,                     # IP Protocol (6=TCP, 17=UDP, 1=ICMP)
    "flow_duration": 0.12,             # Duration in seconds (float)
    "tot_fwd_pkts": 4,                 # Total Forward Packets (int)
    "tot_bwd_pkts": 0,                 # Total Backward Packets (int)
    "fwd_pkt_len_mean": 24.0,          # Mean Fwd Packet Length in bytes (float)
    "bwd_pkt_len_mean": 0.0,           # Mean Bwd Packet Length in bytes (float)
    "flow_bytes_s": 2400.0,            # Flow throughput bytes/sec (float)
    "flow_pkts_s": 140.0,              # Flow packet rate pkts/sec (float)
    "syn_flag_count": 4,               # SYN Flags observed (int)
    "ack_flag_count": 0,               # ACK Flags observed (int)
    "rst_flag_count": 0,               # RST Flags observed (int)
    "timestamp": 1724500000.0          # Epoch timestamp (float)
}
```

### Feeding into Orchestrator:
```python
from core.orchestrator import SentinelOrchestrator

orchestrator = SentinelOrchestrator()
orchestrator.initialize()

# Single flow ingestion:
incident = orchestrator.process_flow(flow_dict)

# Queue listener loop:
# orchestrator.run_queue_listener(sniffer_queue)
```

---

## 3. Member 4 Contract (SOC Dashboard & UI Lead)
**What Member 4 Consumes:** FastAPI RESTful Endpoints (`http://localhost:8000/api/...`) + Real-Time WebSocket (`ws://localhost:8000/ws/live-stream`).

### Interactive Swagger API Documentation:
When the FastAPI backend is running, Member 4 can explore and test all endpoints interactively at:
`http://localhost:8000/docs`

---

### REST API Endpoints for React Frontend:

| Method | Endpoint | Description | Return Payload |
|--------|----------|-------------|----------------|
| `GET` | `/api/status` | System health & agent status matrix | `{ cpu_percent, memory_percent, uptime_seconds, agent_statuses: {...} }` |
| `GET` | `/api/metrics` | High-level Dashboard KPI cards | `{ total_flows_analyzed, total_threats_detected, active_firewall_blocks, average_threat_risk, attack_distribution, top_offenders }` |
| `GET` | `/api/incidents?limit=50&severity=CRITICAL` | Paginated incident list for tables | `{ count: 50, incidents: [...] }` |
| `GET` | `/api/incidents/{incident_id}` | Full incident forensic & MITRE details | `{ incident_id, flow, detection, threat, risk, action_plan, llm_explanation }` |
| `GET` | `/api/blocks` | List of active/released firewall rules | `{ count: 3, blocked_ips: [...] }` |
| `POST` | `/api/blocks/unblock/{rule_id}` | Manual unblock button in React UI | `{ status: "SUCCESS", message: "..." }` |
| `POST` | `/api/flows/ingest` | Submit custom flow (e.g. from sniffer or UI simulator) | `{ status: "PROCESSED", incident_id: "...", risk_score: 8.8, ... }` |
| `POST` | `/api/reports/generate` | Trigger on-demand PDF report generation | `{ status: "GENERATED", filename: "...", download_url: "/api/reports/download/..." }` |
| `GET` | `/api/reports/download/{filename}` | Download compiled PDF report | Binary PDF stream (`application/pdf`) |
| `WS` | `/ws/live-stream` | Real-time bi-directional alert stream | JSON events (`NEW_INCIDENT`, `THREAT_ALERT`, `CONNECTED`) |

---

### React.js Frontend Code Snippets for Member 4:

#### 1. Fetching Dashboard KPIs (React Hook):
```javascript
import React, { useState, useEffect } from 'react';

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/metrics');
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000); // Polling fallback
    return () => clearInterval(interval);
  }, []);

  return { metrics, loading, refetch: fetchMetrics };
}
```

#### 2. Real-Time Alert Stream (React WebSocket Hook):
```javascript
import { useEffect, useState } from 'react';

export function useLiveThreatStream(onNewAlert) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/live-stream');

    ws.onopen = () => {
      console.log('Connected to SentinelAI Threat Stream');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      console.log('Live Alert Received:', payload);
      if (onNewAlert) {
        onNewAlert(payload);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = (err) => console.error('WebSocket error:', err);

    return () => ws.close();
  }, [onNewAlert]);

  return { connected };
}
```

#### 3. Manual Unblock Action Button in React:
```javascript
async function handleUnblock(ruleId) {
  const res = await fetch(`http://localhost:8000/api/blocks/unblock/${ruleId}`, {
    method: 'POST'
  });
  if (res.ok) {
    alert(`Rule ${ruleId} successfully lifted!`);
  }
}
```

---

## 4. Phase 5: HIDS Teammate Contracts (Host Intrusion Detection)

Roles: Member 1 = host sensors, Member 2 = HIDS ML, Member 3 = threat analysis / MITRE,
Member 4 = SOAR / risk / response (`soar/agents/host_agent.py`), Member 5 = dashboard.

### Host event accepted by SOAR (`orchestrator.process_host_event` / `POST /api/host/events/ingest`)

| Field | Required | Notes |
|-------|----------|-------|
| `pid` | yes | Real PID observed by the sensor |
| `process_name` | yes | Executable basename, e.g. `python.exe` |
| `file_path` | yes | File the process accessed |
| `exe_path` | recommended | Full executable path. Before a live kill, SOAR checks the running PID still has this name and path, and refuses otherwise |
| `parent_name` | optional | Left empty if unknown (no longer defaults to `explorer.exe`) |
| `event_type` | optional | `READ` (default), `MODIFY`, `CREATE`, `DELETE` |
| `file_type`, `cpu_percent`, `memory_mb`, `cmdline` | optional | `file_type` is auto-detected from the path if omitted |
| `label` | optional (Member 2) | `Normal`, `Benign`, `Stealer`, `InfoStealer`, `Ransomware`, `Malware`. Kept as-is; other values fall back to SOAR heuristics |
| `confidence`, `anomaly_score` | optional (Member 2) | 0.0–1.0, used for risk scoring when `label` is set |

Sensors can also publish the same dict on the event bus topic `host.event.ingested` (or `host.model.prediction` for ML output).
Threats (anything not `Normal`) are alerted (`AlertMessage.source == "HIDS"`), explained by the LLM agent, saved to `host_incidents`,
and written to `audit_logs` when an action other than `LOG_ONLY` is taken.

Process termination has its own switch: `SentinelOrchestrator(dry_run_host_response=True)` (default), independent of `dry_run_firewall`.

### Member 1: Process Sensor (`hids/process_monitor.py`)
Scans every 2 seconds (fixed rate) and writes lifecycle events to `hids/logs/process_events_YYYY-MM-DD.csv`
(`python -m hids.process_monitor`). One process run = `(pid, create_time)`.

| `event` | Meaning |
|---------|---------|
| `START` | Run first seen: identity, `exe_path`, `cmdline`, `memory_mb` |
| `STATS` | Every 30 s per running process: `cpu_percent`, `memory_mb` |
| `EXIT` | Run disappeared: `lifetime_s`, `samples`, `cpu_mean`, `cpu_max`, `memory_max_mb` |
| `END` | Still running when the monitor stopped: same aggregates as `EXIT` |

Columns: `timestamp` (epoch, ms), `time_iso`, `event`, `pid`, `ppid`, `create_time`, `process_name`, `parent_name`,
`parent_alive` (0 when the parent exited or its PID was reused), `exe_path`, `cmdline`, `cpu_percent`, `memory_mb`,
`lifetime_s`, `samples`, `cpu_mean`, `cpu_max`, `memory_max_mb`.
CPU is a share of total machine CPU (0–100). `EXIT` + `END` rows are one row per run, the starting point for Member 2's training table.
The monitor excludes itself. Run as Administrator to get `cmdline` / `exe_path` for system and other-user processes.

### Member 1: File Sensor (`hids/file_monitor.py`)
Monitors sensitive browser credentials (Chrome `Cookies`, `Local State`, Edge `Cookies`, Firefox `cookies.sqlite`):
```python
{
    "file_path": "C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Network\\Cookies",
    "file_type": "CookieDB",
    "event_type": "READ"
}
```

### Member 2: Dataset & ML Integration (Week 3 Isolation Forest)
Send combined process + file event + ML prediction to SOAR:
```python
from soar.core.orchestrator import SentinelOrchestrator

orchestrator = SentinelOrchestrator(dry_run_firewall=True, dry_run_host_response=True)
orchestrator.initialize()

# Ingest and execute automated SOAR response (PID termination & alert)
host_incident = orchestrator.process_host_event({
    "pid": 5892,
    "process_name": "python.exe",
    "exe_path": "C:\\Users\\User\\Downloads\\python.exe",
    "parent_name": "cmd.exe",
    "cpu_percent": 8.1,
    "memory_mb": 72.0,
    "file_path": "C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Network\\Cookies",
    "label": "Stealer",
    "confidence": 0.9,
    "anomaly_score": 0.92
})
print(f"SOAR Action: {host_incident.soar_action} - Status: {host_incident.action_status}")
```


