/* Slide content, part 2 of 2 (slides 8-15). Same shape as slides-a.js. */
window.SLIDES.push(
  {
    kind: 'diagram',
    key: 'vintage',
    title: 'The central rule: forecast vintage',
    notes:
      'This is the product. WINDFOR is published about eight times a day. For a delivery hour, the forecast to use is the one with the latest publish time that is at or before the cutoff. With a 09:50 cutoff on D-1 that is normally the 09:30 publish. Anything published later is shown in red: the desk could not have known it, so it is never returned.',
  },
  {
    kind: 'code',
    title: 'select_vintage(): the whole rule in code',
    file: 'backend/app/core.py',
    code: [
      'def select_vintage(self, target, cutoff_at):',
      '    pubs = self._pub.get(target)',
      '    if not pubs:',
      '        return None',
      '    i = bisect.bisect_right(pubs, min(cutoff_at, target)) - 1',
      '    if i < 0:',
      '        return None',
      '    return self._val[target][i], pubs[i]',
    ],
    bullets: [
      'Publish times per target are kept sorted, so selection is a binary search.',
      'bisect_right: a publish exactly at the cutoff is included.',
      'min(cutoff_at, target): a forecast made after its own hour began is excluded.',
      'The only place that decides what the desk knew. One place to get wrong, one place to test.',
    ],
    notes:
      'bisect_right returns the insertion point after any equal element, so minus one gives the latest publish not after the cutoff. The min with the target time drops forecasts published after their own hour started, which are really nowcasts. Timezones: the cutoff is built with Europe/London, never assumed UTC.',
  },
  {
    kind: 'bullets',
    title: 'Metrics and data-quality decisions',
    bullets: [
      'Error = forecast - actual, in MW. Positive means over-forecast, so the desk under-buys.',
      'WINDFOR is hourly, FUELHH half-hourly: an hourly actual is the mean of its two half-hours.',
      'A missing half-hour makes that hour a gap. Gaps are listed, never interpolated.',
      'Metrics: MAE, RMSE, bias, P10 / P50 / P90 and P90 of absolute error.',
      'January result: 744 of 744 hours matched, MAE 2,013 MW, bias +1,730 MW.',
    ],
    notes:
      'Two decisions worth defending. First, hourly comparison with an explicit averaging rule, rather than interpolating the forecast to half-hours and inventing data. Second, gaps are reported. In this dataset there are zero gaps, but the app would show them. The bias is measured, but I have not established its cause, and the UI says so.',
  },
  {
    kind: 'diagram',
    key: 'band',
    title: 'Error band without look-ahead',
    notes:
      'At 09:50 on D-1, the actuals for D-1 are not complete, so the newest fully known day is D-2. The band for delivery day D therefore pools the errors of the seven days D-8 to D-2, takes P10 and P90, and applies them to the forecast. Over-forecasting history pulls the band down. With fewer than three days of history, the band is withheld with a reason, as on 2 to 4 January.',
  },
  {
    kind: 'code',
    title: 'band_for(): the no-look-ahead guard',
    file: 'backend/app/core.py',
    code: [
      'd = delivery_day - timedelta(days=2)      # newest KNOWN day',
      'while d >= self.first_delivery and len(history) < 7:',
      '    if self.day_errors(d, cutoff):',
      '        history.append(d)',
      '    d -= timedelta(days=1)',
      'if len(history) < 3:',
      '    return {"available": False, "reason": ...}',
    ],
    bullets: [
      'Starts at D-2, so the delivery day and D-1 can never leak into their own band.',
      'Rolling 7-day window, minimum 3 days.',
      'Pooled errors give one P10 and P90 per day, not one per hour.',
      'band = [forecast - P90, forecast - P10] because error = forecast - actual.',
    ],
    notes:
      'The loop starts at delivery_day minus two. That one line is the no-look-ahead guarantee, and there is a test that proves the band uses only days up to D-2. The sign flip in the last bullet trips people up: a high error means the forecast was too high, so the low end of the wind range comes from the high error quantile.',
  },
  {
    kind: 'diagram',
    key: 'frontend',
    title: 'Frontend structure',
    notes:
      'App.tsx owns the URL state: tab, day and cutoff, so any view can be shared or screenshotted. The header and the day strip share cached queries with the pages, so they never disagree with the data below. All fetching goes through four TanStack Query hooks in api.ts. Pages are mostly presentational. There is a loading bar, spinners and skeletons for every request.',
  },
  {
    kind: 'bullets',
    title: 'Testing: 29 tests, two layers',
    bullets: [
      'Core, synthetic data: latest publish not after cutoff; only-later forecasts return nothing.',
      'Boundaries: publish exactly at cutoff is included; forecast made after its own hour is excluded.',
      'Time: London clock in summer; 23- and 25-hour DST days.',
      'Band: uses only days up to D-2; capped at 7 days; withheld with a reason under 3 days.',
      'API, real data: vintage never after cutoff for any day; month accuracy matches an independent computation.',
      'Lint: ruff on the backend, tsc and oxlint on the frontend.',
    ],
    notes:
      'Run python -m pytest -q in the backend folder: 29 passed. The tests target the risks in the BRD: look-ahead, timezones, resolution mismatch. The month-level test recomputes MAE and bias from the raw data independently of the app, so a bug in the shared logic cannot hide behind itself.',
  },
  {
    kind: 'diagram',
    key: 'deployment',
    title: 'Deployment and the one gotcha',
    notes:
      'Vercel does not run containers, so the frontend builds to static files and the same FastAPI app runs as a Python function with the data file bundled. The gotcha: Vercel auto-detected FastAPI, skipped requirements.txt and the function crashed with ModuleNotFoundError. Setting framework to null in vercel.json fixed it. For review there is a two-stage Dockerfile, and docker compose up serves everything on port 8000.',
  },
  {
    kind: 'bullets',
    title: 'Trade-offs, limits and AI use',
    bullets: [
      'Static dataset, not live ingestion: simple and fast, but it must be rebuilt for new months.',
      'One month, 31 days: quantiles are indicative, and the UI says so.',
      'Bias is measured, not explained. Possible cause (unverified): FUELHH may exclude embedded wind.',
      'Wind only: the plan-for figure is wind uncertainty, not a purchase volume.',
      'Next: demand and prices, more months, live ingestion, CSV export.',
      'AI use: an AI coding assistant helped with exploration, drafting and review. The README says so.',
    ],
    notes:
      'Be direct about limits. The decisions I would revisit with more time: a store instead of a JSON file once there is more than a few months, a live ingest job, and an explanation for the bias. Close by pointing at the README for the file layout and the live link.',
  }
)
