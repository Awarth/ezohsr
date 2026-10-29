/*
 * Developer walkthrough: 5 slides. kinds: title | bullets | cards | jargon | tree.
 * `notes` is the presenter script (N key in the deck, printed under each slide in the PDF).
 * Facts come from the repo and the live API: 744 hours, 31 days, MAE 2,013 MW, bias +1,730 MW, 29 tests.
 */
window.SLIDES = [
  {
    kind: 'title',
    title: 'Wind Forecast Desk',
    subtitle: 'Developer walkthrough: tech, domain jargon, code layout',
    meta: 'GB day-ahead wind forecast decision support - Elexon FUELHH and WINDFOR - January 2026 pilot',
    notes:
      'Welcome. This is the technical review. Four things in five minutes: the problem, the tech we used, the domain jargon you need to read the code, and where everything lives in the repo. The app is live and the repo README has the same layout.',
  },
  {
    kind: 'bullets',
    title: 'The problem in one slide',
    bullets: [
      'A day-ahead desk must buy power by 09:50 on D-1, with wind still a forecast.',
      'Question 1: which forecast did we actually have at that moment?',
      'Question 2: how wrong is that forecast, in MW, so the desk can plan for it?',
      'Scope: national GB wind only, from Elexon. Delivery days 2 Jan to 1 Feb 2026 (744 hours).',
      'Out of scope: demand, prices, other fuels, live ingestion, login.',
    ],
    notes:
      'Keep this quick. The engineering consequence is in the first line: time matters. Every number must be computed as of the decision time, never with hindsight. That drives the design.',
  },
  {
    kind: 'cards',
    title: 'Tech used',
    cards: [
      {
        heading: 'Frontend',
        items: [
          ['React 19 + TypeScript 6', 'typed UI'],
          ['Vite 8', 'dev server, static build'],
          ['Tailwind CSS 4', 'styling'],
          ['Recharts 3', 'band, line and bar charts'],
          ['TanStack Query 5', 'fetch, cache, loading states'],
        ],
      },
      {
        heading: 'Backend',
        items: [
          ['Python 3.12', 'Docker and Vercel runtime'],
          ['FastAPI', 'routes, validation, /docs'],
          ['Pydantic', 'typed response models'],
          ['uvicorn', 'server that runs the app'],
          ['zoneinfo + tzdata', 'Europe/London time'],
        ],
      },
      {
        heading: 'Data',
        items: [
          ['Elexon BMRS API', 'FUELHH actuals, WINDFOR forecasts'],
          ['wind.json', '1,488 actuals, 17,864 forecasts'],
          ['ingest.py', 'weekly chunks, retries, idempotent'],
          ['No database', 'read-only, ~1 MB, loaded once'],
        ],
      },
      {
        heading: 'Quality and delivery',
        items: [
          ['pytest', '29 tests: core logic and API'],
          ['ruff, oxlint, tsc', 'lint and type checks'],
          ['Docker', '2-stage image, docker compose up'],
          ['Vercel', 'static files + Python function'],
          ['GitHub', 'source, deploy on push'],
        ],
      },
    ],
    notes:
      'Nothing exotic. The one decision worth a sentence: a committed data file instead of a database. The data is about a megabyte and read-only, so a database would add a moving part with no benefit. FastAPI gives typed models, validation and an interactive /docs page for free. Vercel does not run containers, so there it is static files plus a Python function; Docker is for local review.',
  },
  {
    kind: 'jargon',
    title: 'Context and jargon',
    contextTitle: 'How the market works',
    context: [
      'The desk buys tomorrow\'s power in the N2EX day-ahead auction. The gate closes at 09:50 London time on D-1.',
      'Wind depends on weather, so the desk plans around a forecast and buys the rest from other sources.',
      'Elexon publishes a new wind forecast about 8 times a day. At 09:50 the newest is the 09:30 one.',
      'Buy too little: shortfall at imbalance prices. Buy too much: surplus sold at a loss.',
      'January 2026 result: MAE 2,013 MW, forecast ran +1,730 MW too high.',
    ],
    termsTitle: 'Jargon',
    terms: [
      ['D, D-1, D-2', 'Delivery day; one or two days before it'],
      ['Cutoff', 'Decision deadline: 09:50 London on D-1'],
      ['Vintage', 'Publish time of a forecast; we use the latest one at or before the cutoff'],
      ['Look-ahead', 'Using information the desk could not have had yet'],
      ['MW', 'Megawatts: power at a moment; hourly averages here'],
      ['FUELHH', 'Elexon actual generation by fuel, half-hourly (we use WIND)'],
      ['WINDFOR', 'Elexon hourly wind forecasts, each with a publish time'],
      ['Error', 'Forecast minus actual; positive means over-forecast'],
      ['Bias', 'Average signed error: does the forecast lean high or low'],
      ['MAE, RMSE', 'Average miss; same but punishes big misses more'],
      ['P10, P90', '10th and 90th percentile: 1 in 10 outcomes beyond each'],
      ['Error band', 'Forecast shifted by past P10 and P90 errors, days up to D-2 only'],
      ['Plan-for', 'Low end of the band; wind uncertainty, not a purchase volume'],
    ],
    notes:
      'This is the slide to keep open while reading the code. Left: why timing matters. Right: the words that appear in function and variable names. The two that cause the most confusion are vintage, which is just the publish time of a forecast, and P10 and P90, which are percentiles of past errors, not of wind. The error is forecast minus actual, so a high error means the forecast was too high, and the low end of the wind band comes from the high error percentile.',
  },
  {
    kind: 'tree',
    title: 'Folder structure',
    left: [
      ['ezohsr/', '', 0],
      ['├─ README.md', 'run, deploy, AI-use note', 0],
      ['├─ requirements.txt', 'fastapi, uvicorn, tzdata', 0],
      ['├─ vercel.json', 'build + function config', 0],
      ['├─ Dockerfile', '2-stage image', 0],
      ['├─ docker-compose.yml', 'docker compose up', 0],
      ['├─ api/index.py', 'Vercel entrypoint', 0],
      ['└─ backend/', '', 0],
      ['   ├─ app/core.py', 'pure logic: vintage, metrics', 1],
      ['   ├─ app/main.py', 'FastAPI routes + models', 1],
      ['   ├─ data/wind.json', 'pre-built Elexon data', 1],
      ['   ├─ scripts/ingest.py', 'rebuilds wind.json', 0],
      ['   └─ tests/', '29 tests', 0],
      ['      ├─ test_core.py', 'logic, synthetic data', 0],
      ['      └─ test_api.py', 'API, real data file', 0],
    ],
    right: [
      ['frontend/', '', 0],
      ['├─ index.html', 'Vite entry', 0],
      ['├─ package.json', 'deps and scripts', 0],
      ['├─ vite.config.ts', 'dev /api proxy', 0],
      ['├─ public/', 'copied as-is', 0],
      ['│  ├─ architecture.html', 'diagrams only', 0],
      ['│  ├─ walkthrough.html', 'this deck', 0],
      ['│  └─ deck, diagrams, slides', '.js and .css', 0],
      ['└─ src/', '', 0],
      ['   ├─ main.tsx', 'React + query client', 0],
      ['   ├─ App.tsx', 'header, tabs, URL state', 1],
      ['   ├─ DecisionPage.tsx', 'cards, chart, table', 0],
      ['   ├─ AccuracyPage.tsx', 'KPIs, charts, vintages', 0],
      ['   ├─ DayStrip.tsx', '31-day error strip', 0],
      ['   ├─ api.ts', 'types + query hooks', 0],
      ['   ├─ components.tsx', 'shared UI, loaders', 0],
      ['   └─ format.ts, index.css', 'formatting, Tailwind', 0],
    ],
    notes:
      'Backend on the left, frontend on the right. The split to remember: core.py holds every decision and knows nothing about the web, main.py is a thin FastAPI layer, and wind.json is the only data store. On the frontend, App.tsx owns the URL state, the two pages fetch through the hooks in api.ts. The public folder holds static pages Vite copies untouched: this deck and the diagram-only screen. Highlighted files are the ones to open first.',
  },
]
