# SentinelAI Dashboard

This is the front-end dashboard for the SentinelAI platform.

## Quick Start

1. Start the SOAR backend API:
```powershell
cd C:\Capstone\soar
pip install -r requirements.txt
python main.py server
```

2. Start the dashboard dev server:
```powershell
cd C:\Capstone\dashboard
npm install
npm run dev
```

## Features

- **Real-time Updates**: Live stream connected via WebSocket to the SOAR backend.
- **Test Mode Supported**: When the backend runs in test mode, the UI reflects actions as "Simulated".
- **Mock Mode**: Run entirely without a backend by setting `VITE_USE_MOCKS=true` in `.env`.
- **Expert vs Simple View**: Toggle between plain English for normal users and raw technical logs for analysts.

## Tech Stack
- React 18, Vite, TypeScript
- Tailwind CSS v4
- TanStack Query
- Recharts
- dayjs & lucide-react
