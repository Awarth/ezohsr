# Wind Forecast Desk

Decision support for a GB day-ahead power buyer. For any delivery day it shows the wind forecast that was
actually available at the day-ahead cutoff, and quantifies how wrong that forecast tends to be.

Data: national wind only, from Elexon BMRS `FUELHH` (actuals, `fuelType=WIND`) and `WINDFOR` (forecasts).
Scope: decisions made in January 2026, i.e. delivery days 2 Jan - 1 Feb 2026.

- **Live app:** https://ezohsr.vercel.app/
- **Diagrams only:** https://ezohsr.vercel.app/architecture.html
- **Developer walkthrough slides:** https://ezohsr.vercel.app/walkthrough.html (press `N` for presenter notes, `P` to print or save as PDF)

## AI tool usage

This project was built with the help of an AI coding assistant (Claude, via the Oh My Pi CLI). It was used for
exploring the Elexon APIs, drafting the requirements and UI design, and writing and reviewing code and tests.
All numbers were cross-checked against an independent computation on the raw API data (see
`backend/tests/test_api.py::test_month_accuracy_matches_independent_computation`).

## How it works

- **Decision cutoff:** the N2EX GB day-ahead auction closes at 09:50 UK time on D-1. Configurable in the UI.
- **Vintage rule:** for each delivery hour, use the `WINDFOR` row with the latest `publishTime` at or before the
  cutoff. Forecasts published later were not knowable at decision time and are never used
  (`Dataset.select_vintage` in `backend/app/core.py`, covered by tests).
- **Resolution:** `WINDFOR` is hourly, `FUELHH` half-hourly. Actuals are averaged to hours; an hour missing either
  half-hour is reported as a gap and never interpolated.
- **Error:** `forecast - actual` in MW. Positive = over-forecast.
- **Error band:** P10-P90 of errors from the previous 7 delivery days up to D-2 (the newest fully known day at the
  cutoff). Withheld, with a reason, when fewer than 3 days of history exist.
- **Vintage comparison:** the same hours scored under a D-2 cutoff, your cutoff, and the latest pre-delivery
  forecast (marked as not usable). Only hours covered by all three are compared.

## Files and directories

```
.
├── README.md
├── requirements.txt          runtime Python deps (used by Docker and Vercel)
├── Dockerfile                multi-stage: builds React, serves API + static from FastAPI
├── docker-compose.yml        `docker compose up` -> http://localhost:8000
├── vercel.json               Vercel build + Python function config
├── api/index.py              Vercel serverless entrypoint (re-exports the FastAPI app)
├── backend/
│   ├── app/core.py           pure logic: vintage selection, metrics, error band (no I/O framework)
│   ├── app/main.py           FastAPI endpoints: /api/meta, /decision, /accuracy, /vintages
│   ├── scripts/ingest.py     builds data/wind.json from the Elexon API
│   ├── data/wind.json        pre-built dataset (committed; no live Elexon calls at request time)
│   ├── tests/                pytest: core logic (synthetic data) and API contract (real data)
│   ├── requirements-dev.txt  adds pytest, httpx, ruff
│   └── ruff.toml
└── frontend/                 React + TypeScript + Vite + Tailwind + Recharts + TanStack Query
    └── src/
        ├── App.tsx           header (day, cutoff, vintage line), tabs, URL state
        ├── DecisionPage.tsx  KPI cards, forecast chart with band, hourly table, "reveal actual"
        ├── AccuracyPage.tsx  KPI strip, daily and hour-of-day charts, vintage comparison
        ├── api.ts            response types and query hooks
        ├── components.tsx    Card, Panel, Toggle, Segmented, Loading, ErrorBox
        ├── format.ts         number, date and London-time formatting
        └── ../public/        static pages served as-is: architecture.html (diagrams only, uses diagrams-*.js),
                              walkthrough.html (3-slide dev deck: slides.js text and notes, deck.js engine), deck.css
```

## Run it

### Docker

```bash
docker compose up --build
# open http://localhost:8000
```

### Local development

```bash
# backend (Python 3.10+)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8000        # API docs at http://localhost:8000/docs

# frontend (Node 20+), in another terminal
cd frontend
npm install
npm run dev                                       # http://localhost:5173, proxies /api to :8000
```

### Tests and lint

```bash
cd backend && .venv/bin/python -m pytest -q && .venv/bin/ruff check app scripts tests
cd frontend && npx tsc -b
```

### Rebuild the dataset

```bash
cd backend && .venv/bin/python scripts/ingest.py   # fetches from Elexon, rewrites data/wind.json
```

## Deploy (Vercel)

`vercel.json` builds the frontend to static files and serves `api/index.py` (the same FastAPI app) as a Python
function with `backend/app` and `backend/data` bundled. Import the repo in Vercel with the repo root as the
project root; no environment variables are needed.

## Limitations

- One month (31 days) of evidence: quantiles are indicative, and the UI says so.
- The January forecast over-predicts wind by about 1,730 MW on average. The cause is not established here; one
  possibility is that `FUELHH` excludes embedded wind that the forecast includes. This is unverified.
- Wind only: no demand, prices or other fuels, so the "plan-for" figure is wind uncertainty, not a purchase volume.
