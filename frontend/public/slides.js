/*
 * Developer walkthrough: 3 slides. kinds: brief | cards | tree.
 * `notes` is the presenter script (N key in the deck, printed under each slide in the PDF).
 * Slide 1 quotes the original product-manager brief. Other facts come from the repo and the live API.
 */
window.SLIDES = [
  {
    kind: 'brief',
    title: 'Original requirement',
    quote:
      'The client is an energy utility in the UK. To meet their consumers\u2019 demand they must work out how much power needs to be procured beyond the generation available from renewables like wind. Day-ahead purchase decisions are made one day before delivery, so they rely on renewable generation forecasts.',
    blocks: [
      {
        heading: 'The web app must let them',
        bullets: [
          'Clearly understand the latest renewable generation forecasts available when they must decide on a day-ahead purchase.',
          'Evaluate forecast accuracy quantitatively, so decisions account for the quantified error.',
        ],
      },
      {
        heading: 'Data: Elexon only, national wind',
        bullets: [
          'Actuals: FUELHH, fuelType "WIND". startTime (30 min resolution), generation.',
          'Forecasts: WINDFOR. startTime, publishTime (when it was created), generation.',
          'Only purchase decisions made in January 2026.',
        ],
      },
      {
        heading: 'Build and deliver',
        bullets: [
          'React frontend, Python backend, Docker.',
          'Deploy the sample app on Vercel or Heroku.',
          'State any AI-tool use in the README. Max 16 hours.',
          'Unlisted video (customer pitch + tech-lead review, 10 min max); public repo with an anonymous name and README; submission form.',
        ],
      },
    ],
    notes:
      'This is the brief as the product manager wrote it. Two needs: see the forecast that was actually available at decision time, and measure how wrong it is. The scope limits matter for the design: national wind only, two Elexon datasets, January 2026 decisions. The delivery constraints explain the stack: React and Python, Docker for local review, and a Vercel deployment. Everything on the next two slides follows from this page.',
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
      'Nothing exotic, and each choice maps to the brief: React and Python as required, Docker for local review, Vercel for the public URL. The one decision worth a sentence: a committed data file instead of a database. The data is about a megabyte and read-only, so a database would add a moving part with no benefit. FastAPI gives typed models, validation and an interactive /docs page for free. Vercel does not run containers, so there it is static files plus a Python function.',
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
      'Backend on the left, frontend on the right. The split to remember: core.py holds every decision and knows nothing about the web, main.py is a thin FastAPI layer, and wind.json is the only data store. On the frontend, App.tsx owns the URL state, and the two pages fetch through the hooks in api.ts. The public folder holds static pages Vite copies untouched: this deck and the diagram-only screen. Highlighted files are the ones to open first.',
  },
]
