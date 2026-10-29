/* Diagrams 1-2: system architecture and one request end to end. Depends on diagrams-base.js. */
;(function () {
  const { node, edge, svg } = window.DG

  const architecture = svg(
    'System architecture: Elexon API to ingest script to wind.json to core.py to FastAPI main.py to the React app',
    [
      `<rect class="grp" x="10" y="45" width="360" height="185" rx="14"/><text class="gl" x="26" y="68">BUILD TIME - RUN BY HAND</text>`,
      `<rect class="grp" x="610" y="45" width="380" height="185" rx="14"/><text class="gl" x="626" y="68">REQUEST TIME - EVERY API CALL</text>`,
      node(20, 90, 140, 120, 'Elexon BMRS', ['FUELHH actuals', 'WINDFOR forecasts'], 'n-ext'),
      node(220, 90, 140, 120, 'ingest.py', ['weekly chunks', '4 retries', 'idempotent']),
      node(420, 90, 140, 120, 'wind.json', ['~1 MB, committed', '1,488 actuals', '17,864 forecasts'], 'n-data'),
      node(620, 90, 140, 120, 'core.py', ['pure Python', 'vintage, metrics', 'error band'], 'n-brand'),
      node(820, 90, 160, 120, 'main.py', ['FastAPI', 'validate input', 'shape JSON']),
      edge(160, 150, 220, 150, 'GET', { ly: 140 }),
      edge(360, 150, 420, 150, 'writes', { ly: 140 }),
      edge(560, 150, 620, 150, 'load once', { ly: 140 }),
      edge(760, 150, 820, 150, 'calls', { ly: 140 }),
      node(700, 300, 280, 110, 'React app', ['TypeScript, Vite, Tailwind', 'Recharts, TanStack Query'], 'n-brand'),
      edge(900, 210, 900, 300, 'JSON from GET /api/*', { lx: 892, ly: 262, anchor: 'end' }),
      node(395, 300, 260, 110, 'pytest - 29 tests', ['core: synthetic data', 'API: real data file']),
      edge(600, 300, 665, 210, null, { dash: true }),
      node(20, 300, 340, 110, 'Why a static data file?', ['No Elexon call at request time', 'Fast, reproducible, offline-safe'], 'n-ext'),
    ].join('')
  )

  window.defineDiagram(
    'architecture',
    'Architecture',
    'Two phases: build the data file once, then serve it. No Elexon call happens at request time.',
    architecture
  )

  const lanes = [
    [20, 'Browser', 'React app'],
    [270, 'main.py', 'FastAPI route'],
    [520, 'core.py', 'Dataset'],
    [770, 'wind.json', 'held in memory'],
  ]
  const requestFlow = svg(
    'Sequence of one GET /api/decision request through the browser, main.py, core.py and the in-memory data',
    [
      ...lanes.map(([x]) => `<path class="life" d="M${x + 100} 60V432"/>`),
      ...lanes.map(([x, t, s]) => node(x, 8, 200, 52, t, [s])),
      edge(120, 100, 370, 100, '1  GET /api/decision?day&cutoff', { lx: 130, ly: 92, anchor: 'start' }),
      `<rect class="n-brand" x="280" y="112" width="180" height="30" rx="8"/><text class="s2" x="370" y="132" text-anchor="middle">2  validate: 404 or 422</text>`,
      edge(370, 175, 620, 175, '3  day_rows(), band_for()', { lx: 380, ly: 167, anchor: 'start' }),
      edge(620, 220, 870, 220, '4  select_vintage() per hour', { lx: 630, ly: 212, anchor: 'start' }),
      edge(870, 265, 620, 265, '5  forecasts + actuals', { dash: true, lx: 860, ly: 257, anchor: 'end' }),
      edge(620, 310, 370, 310, '6  HourRow list + band', { dash: true, lx: 610, ly: 302, anchor: 'end' }),
      `<rect class="n-brand" x="250" y="322" width="240" height="30" rx="8"/><text class="s2" x="370" y="342" text-anchor="middle">7  build cards, band low/high</text>`,
      edge(370, 395, 120, 395, '8  200 JSON, Pydantic-checked', { dash: true, lx: 360, ly: 387, anchor: 'end' }),
    ].join('')
  )

  window.defineDiagram(
    'requestFlow',
    'One request',
    'GET /api/decision from browser to JSON. main.py validates and shapes; core.py decides.',
    requestFlow
  )
})()
