/*
 * Slide content, part 1 of 2 (slides 1-7). Each slide: { kind, title, ... , notes }.
 * kinds: title | bullets | diagram | code | table. `notes` is the presenter script, shown in the notes panel (N key).
 * Numbers are from the live API and the repo: 29 tests, 744 hours, 31 days, MAE 2,013, bias +1,730.
 */
window.SLIDES = window.SLIDES || []
window.SLIDES.push(
  {
    kind: 'title',
    title: 'Wind Forecast Desk',
    subtitle: 'Developer walkthrough: architecture, decision logic, tests, deployment',
    meta: 'GB day-ahead wind forecast decision support - Elexon FUELHH and WINDFOR - January 2026 pilot',
    notes:
      'Welcome. This is the technical review. In five minutes I will show how the pieces fit, the one rule the product depends on, how I tested it, and how it is deployed. The app is live, and the repo has a README with the file layout.',
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
    kind: 'diagram',
    key: 'architecture',
    title: 'Architecture at a glance',
    notes:
      'Two phases. Left: a script I run by hand pulls two Elexon datasets and writes one JSON file, which is committed. Right: at request time the FastAPI app loads that file once into memory. core.py holds all decisions as pure functions, main.py is a thin HTTP layer, and React calls /api/*. No Elexon call happens at request time, so it is fast and reproducible.',
  },
  {
    kind: 'table',
    title: 'Technology choices and why',
    head: ['Layer', 'Choice', 'Reason'],
    rows: [
      ['Frontend', 'React + TypeScript + Vite', 'The brief requires React; Vite builds static files Vercel can serve'],
      ['Charts', 'Recharts', 'Band area, line and bars in one composable chart'],
      ['Data fetching', 'TanStack Query', 'Caching plus loading and error states'],
      ['Styling', 'Tailwind CSS', 'Consistent layout fast'],
      ['Backend', 'FastAPI (Python)', 'Typed models, validation and API docs for free'],
      ['Data', 'Committed wind.json', 'No live dependency; one command rebuilds it'],
    ],
    notes:
      'Nothing exotic. The one decision worth a sentence: a committed data file instead of a database. The data is about a megabyte and read-only, so a database would add a moving part with no benefit.',
  },
  {
    kind: 'code',
    title: 'Ingest: build the data file',
    file: 'backend/scripts/ingest.py',
    code: [
      'def get_json(url, retries=4):',
      '    for attempt in range(retries):',
      '        try:',
      '            with urllib.request.urlopen(url, timeout=60) as resp:',
      '                return json.load(resp)',
      '        except (URLError, TimeoutError):',
      '            ...  # sleep 2**attempt, retry, then raise',
    ],
    bullets: [
      'Weekly date chunks: the API has range limits.',
      'Retries with backoff; the output is deterministic, so re-running is safe.',
      'WINDFOR is fetched from 28 Dec so early targets still have a vintage.',
      'Result: 1,488 half-hourly actuals and 17,864 forecast rows.',
    ],
    notes:
      'Run python scripts/ingest.py and it rewrites wind.json. If actuals are incomplete it prints a warning, and the app reports the gaps instead of hiding them. I fetch forecasts from 28 December because a 2 January target can be forecast two to three days ahead.',
  },
  {
    kind: 'diagram',
    key: 'requestFlow',
    title: 'One request, end to end',
    notes:
      'Follow GET /api/decision. FastAPI converts the query string into typed arguments. main.py validates the day and cutoff, 404 or 422 on bad input. It then asks core.py for the 24 hourly rows and the band. core.py reads the in-memory data. main.py turns the band into low and high values, computes the three cards, and returns a Pydantic model that FastAPI validates and serializes.',
  },
  {
    kind: 'code',
    title: 'FastAPI layer: a route in 6 lines',
    file: 'backend/app/main.py',
    code: [
      '@app.get("/api/decision", response_model=DecisionResponse)',
      'def decision(day: date, cutoff: str = core.DEFAULT_CUTOFF):',
      '    check_day(day)        # 404 outside 2 Jan - 1 Feb',
      '    check_cutoff(cutoff)  # 422 unless HH:MM',
      '    hours = ds.day_rows(day, cutoff)   # core.py decides',
      '    band = ds.band_for(day, cutoff)',
    ],
    bullets: [
      'Argument names and types ARE the query parameters; FastAPI parses them.',
      'Pydantic models fix the response shape and validate it.',
      'No decision logic here: main.py only validates, calls core.py, shapes JSON.',
      'Four routes: /api/meta, /decision, /accuracy, /vintages.',
    ],
    notes:
      'For anyone new to FastAPI: the decorator ties a URL to the function, the argument types become query parameters, and the response model is the contract. If someone sends day equals banana, FastAPI returns 422 before my code runs.',
  }
)
