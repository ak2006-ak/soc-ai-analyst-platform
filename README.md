# SentinelAI SOC Analyst Platform

A full-stack SOC AI Analyst web application for alert ingestion, triage, investigation, and AI-assisted response recommendations.

## Features

- Responsive SOC dashboard with operational metrics and recent alerts
- Alert/case ingestion workflow with persistent local data storage
- Alert queue with search, filter, and sorting controls
- Investigation detail page with:
  - status/severity/assignee updates
  - analyst notes and timeline tracking
  - AI-assisted triage summary + recommended actions
- Analyst role simulation to model ownership and attribution
- API-driven frontend with loading, empty, success, and error states

## Architecture

- **Frontend**: Vanilla HTML/CSS/JavaScript single-page UX
- **Backend**: Node.js HTTP server (`server.js`) with REST API routes
- **Data layer**: File-backed JSON persistence (`data/store.json`) via `src/store.js`
- **AI triage engine**: Rule-based SOC analysis adapter (`src/analysis.js`)

### Key API routes

- `GET /api/health`
- `GET /api/users`
- `GET /api/metrics`
- `GET /api/alerts` (search/filter/sort)
- `POST /api/alerts/ingest`
- `GET /api/alerts/:id`
- `PATCH /api/alerts/:id`
- `POST /api/alerts/:id/notes`
- `POST /api/alerts/:id/analyze`

## Local setup

### Prerequisites

- Node.js 20+

### Install

```bash
npm install
```

### Run (dev)

```bash
npm run dev
```

Open `http://localhost:3000`.

### Build check

```bash
npm run build
```

### Lint check

```bash
npm run lint
```

### Test

```bash
npm test
```

## Environment variables

Copy `.env.example` to `.env` if needed:

- `PORT` - server port (default `3000`)
- `DATA_FILE` - path to file-backed datastore

## Folder structure

- `/index.html` - app shell and views
- `/style.css` - responsive design system and component styling
- `/script.js` - frontend state, API integration, UX workflows
- `/server.js` - API + static server entrypoint
- `/src/store.js` - domain/data persistence models and mutations
- `/src/analysis.js` - AI triage adapter logic
- `/tests/api.test.js` - baseline end-to-end API test coverage

## Known limitations and next steps

- AI analysis is currently rule-based and intended as a mock adapter; replace with an LLM/SIEM enrichment pipeline for production.
- Authentication is simulated via analyst profile selection rather than external identity provider integration.
- Connector integrations (Splunk, Sentinel, CrowdStrike, etc.) are represented through the ingest API, not live streams.
