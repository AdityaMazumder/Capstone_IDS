# SentinelAI Dashboard

React SOC dashboard for SentinelAI. Shows network (NIDS) and host (HIDS) incidents from the SOAR backend in plain
language, with live pop-up alerts over WebSocket.

## Quick start

1. Start the SOAR backend API (from the repo root, with the `.venv` from the root README):

```powershell
cd soar
python main.py server            # http://127.0.0.1:8000
```

2. Start the dashboard dev server:

```powershell
cd dashboard
npm install
copy .env.example .env.local     # first time only
npm run dev                      # http://localhost:5173
```

`npm` commands must be run from inside `dashboard/`.

## Configuration (`.env.local`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE` | `http://localhost:8000` | SOAR REST API base URL |
| `VITE_WS_URL` | derived from `VITE_API_BASE` | Live stream, `ws://…/ws/live-stream` |
| `VITE_USE_MOCKS` | `false` | `true` runs the UI with bundled mock data (`src/api/mocks/`) and fake live alerts, no backend needed |

Restart `npm run dev` after changing env values.

## Pages

| Route | Page | Data |
|-------|------|------|
| `/` | Home | Overall status, KPIs, recent alerts (`/api/metrics`, `/api/incidents`, `/api/host/incidents`) |
| `/activity` | Activity | Merged network + host alert feed with filters |
| `/activity/:source/:id` | Alert detail | Story view, risk gauge, actions taken, technical details (`/api/incidents/{id}` or host row) |
| `/blocked` | Blocked connections | Firewall rules, manual unblock (`/api/blocks`, `/api/blocks/unblock/{rule_id}`) |
| `/computer` | Computer protection | Host (HIDS) incidents |
| `/reports` | Reports | Generate + download PDF (`/api/reports/generate`) |
| `/health` | System health | Agent status, CPU / memory (`/api/status`) |
| `/learn` | Learn | Plain-language explanations of attack types |
| `/settings` | Settings | Preferences |
| `/demo` | Demo panel (Expert mode only) | Sends a sample flow or stealer event through the real pipeline |

## Live updates

`src/hooks/useLiveStream.ts` connects to `/ws/live-stream` and:

- shows the **Live / Reconnecting / Offline** pill in the top bar,
- turns `THREAT_ALERT` events into toasts and bell notifications that link to the matching incident (`incident_id`),
- refreshes cached queries on `NEW_INCIDENT` / `NEW_HOST_INCIDENT`,
- reconnects with backoff and falls back to polling while disconnected.

## Simple vs Expert view

- **Simple** (default): plain-English stories, no jargon.
- **Expert**: technical details open by default (readable field grid with probability bars, plus "Copy as JSON"),
  and the Demo panel is enabled.

## Test mode

The backend runs with dry-run firewall and host response by default, so blocks and process kills are shown as
**Simulated** on the alert detail and Blocked connections pages.

## Tech stack

- React 19, TypeScript, Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`, no `tailwind.config.js` / PostCSS config)
- TanStack Query, react-router v7
- Recharts, sonner (toasts), dayjs, lucide-react

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | `tsc -b` type-check + production build to `dist/` |
| `npm run lint` | oxlint |
| `npm run preview` | Serve the production build |
