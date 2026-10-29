/* Diagrams 5-6: frontend component tree and deployment. Depends on diagrams-base.js. */
;(function () {
  const { node, codeBox, edge, svg } = window.DG

  const frontend = svg(
    'Frontend component tree: main.tsx wraps App, which renders the header, day strip, Decision page and Accuracy page',
    [
      node(370, 10, 260, 52, 'main.tsx', ['QueryClientProvider, cache'], 'n-ext'),
      edge(500, 62, 500, 90),
      node(350, 90, 300, 58, 'App.tsx', ['URL state: tab, day, cutoff']),
      edge(450, 148, 125, 190),
      edge(480, 148, 375, 190),
      edge(520, 148, 625, 190),
      edge(550, 148, 875, 190),
      node(20, 190, 210, 82, 'Header', ['tabs, day picker', 'cutoff, vintage badge']),
      node(270, 190, 210, 82, 'DayStrip', ['31 days, shaded by MAE', 'click a day to open it']),
      node(520, 190, 210, 82, 'DecisionPage', ['useDecision(day, cutoff)'], 'n-brand'),
      node(770, 190, 210, 82, 'AccuracyPage', ['useAccuracy, useVintages'], 'n-brand'),
      edge(625, 272, 625, 300),
      edge(875, 272, 875, 300),
      node(520, 300, 210, 70, 'Cards, Callouts', ['hourly chart, table']),
      node(770, 300, 210, 70, 'KPI cards', ['2 charts, vintage table']),
      node(20, 385, 470, 46, 'api.ts: TanStack Query hooks, fetch /api/*', [], 'n-data'),
      node(510, 385, 470, 46, 'components.tsx, format.ts: shared UI', [], 'n-ext'),
    ].join('')
  )

  window.defineDiagram(
    'frontend',
    'Frontend',
    'App owns the URL state; pages fetch through four cached query hooks.',
    frontend
  )

  const deployment = svg(
    'Deployment: GitHub to Vercel (static files plus a Python function) and to Docker (two-stage image served by uvicorn)',
    [
      node(390, 10, 220, 46, 'GitHub repo', [], 'n-ext'),
      edge(440, 56, 245, 78, 'push: auto-deploy', { lx: 440, ly: 62, anchor: 'end' }),
      edge(560, 56, 755, 78, 'git clone', { lx: 560, ly: 62, anchor: 'start' }),
      `<rect class="grp" x="10" y="80" width="470" height="352" rx="14"/><text class="gl" x="26" y="103">VERCEL - PUBLIC URL</text>`,
      `<rect class="grp" x="520" y="80" width="470" height="352" rx="14"/><text class="gl" x="536" y="103">DOCKER - LOCAL AND REVIEW</text>`,
      node(30, 118, 205, 84, 'Static files', ['npm ci, npm run build', 'frontend/dist'], 'n-brand'),
      node(255, 118, 205, 84, 'Python function', ['api/index.py: FastAPI', 'app + data bundled'], 'n-brand'),
      node(30, 222, 430, 56, 'Routing', ['/api/* to the function, the rest to static files'], 'n-data'),
      node(30, 298, 430, 120, 'Gotcha we hit', [
        'Vercel auto-detected FastAPI and skipped requirements.txt',
        'Result: ModuleNotFoundError for fastapi',
        'Fix: "framework": null in vercel.json',
      ], 'n-warn'),
      node(540, 118, 205, 84, 'Stage 1', ['node:22-alpine', 'npm run build']),
      node(765, 118, 205, 84, 'Stage 2', ['python:3.12-slim', 'app + data + static']),
      edge(745, 160, 765, 160),
      node(540, 222, 430, 56, 'uvicorn app.main:app on :8000', ['serves /api and the built React app'], 'n-data'),
      codeBox(540, 298, 430, 120, ['docker compose up --build', '', 'open http://localhost:8000']),
    ].join('')
  )

  window.defineDiagram(
    'deployment',
    'Deployment',
    'Vercel serves static files plus a Python function; Docker runs one container for local review.',
    deployment
  )
})()
