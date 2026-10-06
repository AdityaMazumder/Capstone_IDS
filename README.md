# SentinelAI — Hybrid NIDS + HIDS + Multi-Agent SOAR

SentinelAI is a Windows-based cybersecurity defence platform that combines **Network Intrusion Detection (NIDS)**, **Host Intrusion Detection (HIDS)**, and a **Multi-Agent Security Orchestration, Automation and Response (SOAR)** system.

The platform detects suspicious network and host activity using machine-learning models, evaluates the associated risk, coordinates a response through a multi-agent pipeline, stores security events in SQLite, and displays them through a live React-based SOC dashboard.

> **Status:** Working end-to-end prototype
> **Platform:** Windows
> **NIDS:** XGBoost
> **HIDS:** Isolation Forest
> **Backend:** FastAPI + WebSocket
> **Frontend:** React + Vite
> **Database:** SQLite

---

## Features

* Network Intrusion Detection using XGBoost
* Host Intrusion Detection using Isolation Forest
* CSE-CIC-IDS2018-style network flow features
* Laboratory-generated network traffic
* Seven-class NIDS model
* Host process and credential-file monitoring
* Multi-agent SOAR pipeline
* Risk assessment and response decisions
* Firewall response integration
* Process termination integration
* SQLite event storage
* FastAPI REST backend
* WebSocket-based live updates
* React SOC dashboard
* Dry-run mode for safe testing
* Automated Python and dashboard tests

---

## Architecture

```text
              Network Traffic
                     │
                     ▼
              ┌─────────────┐
              │    NIDS     │
              │   XGBoost   │
              └──────┬──────┘
                     │
                  Evidence
                     │
                     ▼
┌─────────────┐  ┌─────────────┐
│ Host Activity│─▶│    SOAR     │
│    HIDS      │  │ Multi-Agent │
│Isolation     │  │   Pipeline  │
│   Forest     │  └──────┬──────┘
└─────────────┘         │
                        ▼
                 Risk Assessment
                        │
                        ▼
                  Decision Agent
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
         Firewall             Process
          Response             Response
              │                   │
              └─────────┬─────────┘
                        ▼
                     SQLite
                        │
                        ▼
               FastAPI + WebSocket
                        │
                        ▼
                React SOC Dashboard
```

### Core Integration Rule

```text
NIDS + HIDS → Evidence
SOAR        → Risk + Response
Dashboard   → Visualization
```

NIDS and HIDS only produce security evidence. The **SOAR layer owns the response logic**.

---

# Repository Structure

```text
Capstone/
│
├── config/             # Shared configuration and paths
├── data/               # Local datasets (gitignored)
├── docs/               # Reports and technical documentation
│
├── ml/                 # Dataset building, training and evaluation
│   └── tests/
│
├── models/             # XGBoost and Isolation Forest models
│
├── nids/               # Network intrusion detection
│   └── tests/
│
├── hids/               # Host intrusion detection
│   ├── dataset/        # HIDS dataset/training utilities
│   └── tests/
│
├── soar/               # Multi-agent SOAR + FastAPI backend
│   └── tests/
│
├── dashboard/          # React + Vite SOC dashboard
│
├── requirements.txt    # Python dependencies
└── README.md
```

---

# Technology Stack

| Component               | Technology                  |
| ----------------------- | --------------------------- |
| NIDS Model              | XGBoost                     |
| HIDS Model              | Isolation Forest            |
| Backend                 | FastAPI                     |
| Real-time Communication | WebSocket                   |
| Database                | SQLite                      |
| Frontend                | React                       |
| Frontend Tooling        | Vite                        |
| Network Data            | CSE-CIC-IDS2018-style flows |
| Host Platform           | Windows                     |
| Language                | Python / TypeScript         |

---

# NIDS — Network Intrusion Detection

The NIDS component analyses network flow features and uses an **XGBoost multiclass classifier** to identify suspicious network activity.

### Pipeline

```text
Network Traffic
      ↓
Packet Capture
      ↓
Flow / Feature Extraction
      ↓
Feature Processing
      ↓
XGBoost
      ↓
Attack Classification
      ↓
SOAR Evidence
```

The active NIDS model is **v3**.

### Supported Classes

```text
Benign
Botnet
DDoS
DoS
FTP-BruteForce
SSH-Bruteforce
PortScan
```

The first six classes follow the CSE-CIC-IDS2018-style labels. The `PortScan` class was added using laboratory-generated traffic.

---

# HIDS — Host Intrusion Detection

The HIDS component monitors Windows host activity and focuses on suspicious process and credential-file behaviour.

An **Isolation Forest** model is used to identify anomalous behaviour.

### Pipeline

```text
Windows Host
     ↓
Process / File Activity
     ↓
Feature Engineering
     ↓
Isolation Forest
     ↓
Anomaly Detection
     ↓
SOAR Evidence
```

The HIDS directory also contains utilities for:

* Stealer simulation
* Dataset generation
* Feature engineering
* Model training
* Offline prediction
* Live monitoring

---

# Multi-Agent SOAR

The SOAR layer is the central coordination component of SentinelAI.

It receives evidence from NIDS and HIDS and performs the following operations:

```text
Evidence
   ↓
Risk Assessment
   ↓
Decision
   ↓
Response
   ↓
Logging
   ↓
Dashboard
```

Possible response actions include:

* Firewall blocking
* Process termination
* Security alerts
* Event logging
* Report generation

Response actions are configured to run in **dry-run/test mode by default** during development.

---

# Machine Learning Packages

SentinelAI currently maintains two NIDS model packages.

### v3 — Active

The active model is **v3**, built using a combination of CIC data and laboratory-generated network traffic.

Documentation:

```text
docs/ML_Package_v3.md
```

### v2 — Rollback

The previous CIC-only model is retained as a rollback/reference package.

Documentation:

```text
docs/ML_Package_v2.md
```

The shared configuration currently points to **v3**.

---

# Dataset

The network component uses CSE-CIC-IDS2018-style flow features and multiclass labels.

The project also supports laboratory traffic generation.

```text
PCAP
 ↓
Flow Conversion
 ↓
CSV Features
 ↓
Cleaning / Validation
 ↓
Lab Labels
 ↓
Dataset Merge
 ↓
Training / Evaluation
```

Local datasets are stored under:

```text
data/
```

and are excluded from Git.

---

# Installation

## Requirements

* Windows
* Python 3.11+
* Node.js 20+
* Git

Python 3.14 has also been tested with the project.

---

## 1. Clone the Repository

```powershell
git clone <repository-url>
cd Capstone
```

---

## 2. Create Python Environment

```powershell
python -m venv .venv
```

Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

---

# Running SentinelAI

## Start the Backend

Open Terminal 1:

```powershell
cd soar
python main.py server
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger API documentation:

```text
http://127.0.0.1:8000/docs
```

---

## Start the Dashboard

Open Terminal 2:

```powershell
cd dashboard
npm install
```

Create the local environment file:

```powershell
copy .env.example .env.local
```

Start the dashboard:

```powershell
npm run dev
```

Dashboard:

```text
http://localhost:5173
```

---

# Dashboard Demo

Enable **Expert Mode** from the dashboard top bar.

The Expert Mode provides a **Demo Panel** that can generate sample:

* Network attack events
* Host stealer events

These events are sent through the actual SentinelAI pipeline.

```text
Demo Panel
    ↓
SOAR
    ↓
Risk Assessment
    ↓
Decision
    ↓
SQLite / Alert
    ↓
WebSocket
    ↓
Dashboard
```

This allows the complete architecture to be demonstrated without requiring a live attack.

---

# Command Reference

## NIDS Prediction

Run the active model against a CSV row:

```powershell
python -m nids.live_predict --row 0
```

---

## Real NIDS → SOAR Demo

```powershell
python soar\demo_real_model.py
```

---

## SOAR Demo

From the `soar` directory:

```powershell
python main.py demo
```

---

## SOAR Simulation

```powershell
python main.py simulate --dry-run
```

---

## HIDS Prediction

```powershell
python -m hids.predict
```

---

## HIDS Live Monitoring

```powershell
python -m hids.live --duration 600
```

---

# Testing

Run the Python test suites:

```powershell
python -m pytest nids/tests ml/tests hids/tests soar/tests -q
```

This covers:

* NIDS
* ML
* HIDS
* SOAR

---

## Dashboard Build Test

```powershell
cd dashboard
npm run build
```

This performs TypeScript checking and creates the production Vite build.

---

# End-to-End Data Flow

A complete SentinelAI event follows this general path:

```text
                   ┌──────────────┐
                   │ Environment  │
                   └──────┬───────┘
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
      Network Traffic             Host Activity
             │                         │
             ▼                         ▼
           NIDS                      HIDS
         XGBoost               Isolation Forest
             │                         │
             └────────────┬────────────┘
                          ▼
                       SOAR
                          │
                          ▼
                  Risk Assessment
                          │
                          ▼
                     Response
                          │
              ┌───────────┴──────────┐
              ▼                      ▼
          Firewall               Process
           Action                Action
              │                      │
              └──────────┬───────────┘
                         ▼
                      SQLite
                         │
                         ▼
                  FastAPI/WebSocket
                         │
                         ▼
                   SOC Dashboard
```

---

# Configuration

Shared project paths are maintained in:

```text
config/paths.py
```

This acts as the central configuration for model and data paths and currently points to the v3 ML package.

---

# Documentation

Additional technical documentation is available in:

```text
docs/
```

Important files include:

```text
docs/ML_Package_v2.md
docs/ML_Package_v3.md
docs/Project_Gameplan_Blueprint.md
```

The project also maintains feature contracts and integration documentation.

The SOAR integration contract is available at:

```text
soar/contracts/teammate_contracts.md
```

---

# Design Principles

### Separation of Detection and Response

NIDS and HIDS generate evidence. SOAR makes response decisions.

### Modular Architecture

Each major component has its own directory and responsibilities.

### Centralized Configuration

Shared model and data paths are maintained through `config/paths.py`.

### Safe Testing

Response actions run in dry-run/test mode by default.

### Reproducibility

Dataset generation, ML packages, testing, and execution procedures are documented within the repository.

---

# Limitations

SentinelAI is an academic/capstone prototype and is not intended to be treated as a production-grade security platform.

Current limitations include:

* Limited training data compared with real-world network diversity
* Laboratory-generated traffic may not represent every real-world attack
* HIDS behaviour depends on the monitored Windows environment
* ML predictions can produce false positives or false negatives
* Automated response requires careful validation before production use
* The current system is primarily designed for Windows

---

# Future Scope

Potential improvements include:

* Additional attack classes
* Larger and more diverse datasets
* Improved HIDS telemetry
* Advanced risk scoring
* Improved false-positive handling
* Additional automated response actions
* Expanded dashboard analytics
* Historical security analytics
* Model monitoring and retraining
* SIEM integration
* Production deployment support

---

# Security Disclaimer

SentinelAI contains functionality capable of interacting with system-level security controls, including firewall operations and process termination.

The project should only be used on systems and networks where appropriate authorization has been obtained.

**Dry-run mode is recommended during development and demonstrations.**

---

# Quick Start

For the fastest demonstration:

### Terminal 1

```powershell
.\.venv\Scripts\Activate.ps1
cd soar
python main.py server
```

### Terminal 2

```powershell
cd dashboard
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

Enable **Expert Mode → Demo Panel** to generate sample events.

---

# Project Summary

SentinelAI combines:

```text
NIDS
  +
HIDS
  +
Machine Learning
  +
Multi-Agent SOAR
  +
Automated Response
  +
FastAPI/WebSocket
  +
React SOC Dashboard
```

into a unified Windows cybersecurity defence platform.

The core architecture is:

> **Detect → Assess → Decide → Respond → Log → Visualize**

---

## Project Information

**Project:** SentinelAI — Hybrid NIDS + HIDS + Multi-Agent SOAR
**Type:** Cybersecurity Capstone Project
**Platform:** Windows
**Status:** Working End-to-End Prototype

For detailed implementation information, dataset reports, ML package documentation, and project planning material, refer to the `docs/` directory.
