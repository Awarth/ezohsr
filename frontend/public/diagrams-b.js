/* Diagrams 3-4: forecast vintage timeline and the no-look-ahead error band. Depends on diagrams-base.js. */
;(function () {
  const { node, codeBox, edge, svg } = window.DG

  const X = (h) => 60 + (h * 880) / 24
  const cut = 9 + 50 / 60
  const pubs = [2.5, 4.5, 7.5, 9.5, 11.5, 15.5, 18.5, 22.5]
  const clock = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`

  const vintage = svg(
    'Timeline of D-1 showing WINDFOR publish times; the latest one before the 09:50 cutoff, 09:30, is the forecast used',
    [
      `<rect class="zone-ok" x="60" y="105" width="${X(cut) - 60}" height="195"/>`,
      `<rect class="zone-no" x="${X(cut)}" y="105" width="${940 - X(cut)}" height="195"/>`,
      `<text class="gl" x="76" y="128">KNOWABLE AT 09:50</text>`,
      `<text class="gl" x="${X(cut) + 16}" y="128">NOT KNOWABLE YET</text>`,
      `<text class="s2" x="60" y="98">D-1, London time</text>`,
      `<path class="cutline" d="M${X(cut)} 104V300"/>`,
      `<text class="cutlbl" x="${X(cut)}" y="92" text-anchor="middle">09:50 cutoff - N2EX gate closes</text>`,
      `<path class="axis" d="M60 250H940"/>`,
      ...[0, 6, 12, 18, 24].map(
        (h) => `<path class="axis" d="M${X(h)} 250v8"/><text class="s" x="${X(h)}" y="318" text-anchor="middle">${clock(h)}</text>`
      ),
      ...pubs.map((h) => {
        const used = h === 9.5
        const cls = used ? 'tick-used' : h < cut ? 'tick-ok' : 'tick-no'
        return (
          `<circle class="${cls}" cx="${X(h)}" cy="250" r="${used ? 10 : 7}"/>` +
          `<text class="${used ? 't acc' : 's'}" x="${X(h)}" y="282" text-anchor="middle">${clock(h)}</text>`
        )
      }),
      node(110, 150, 230, 44, 'latest publish <= cutoff', [], 'n-brand'),
      edge(330, 194, 402, 243),
      `<text class="s2" x="${(X(cut) + 940) / 2}" y="190" text-anchor="middle">published after the cutoff: never used</text>`,
      codeBox(60, 340, 880, 84, [
        'vintage(t, T) = forecast row with  max(publishTime) <= T',
        'cutoff 09:50 -> 09:30 vintage        cutoff 08:00 -> 07:30 vintage',
      ]),
    ].join('')
  )

  window.defineDiagram(
    'vintage',
    'Forecast vintage',
    'The product rests on one rule: use the latest forecast published at or before the cutoff.',
    vintage
  )

  const dayLabels = ['D-9', 'D-8', 'D-7', 'D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'D']
  const dates = ['6 Jan', '7 Jan', '8 Jan', '9 Jan', '10 Jan', '11 Jan', '12 Jan', '13 Jan', '14 Jan', '15 Jan']
  const note = { 0: 'unused', 8: 'incomplete', 9: 'delivery' }
  const cellCls = (i) => (i === 0 ? 'n-ext' : i === 8 ? 'n-warn' : i === 9 ? 'n-data' : 'n-brand')

  const band = svg(
    'Error band: the seven fully known days D-8 to D-2 are pooled to get P10 and P90; D-1 is incomplete at 09:50',
    [
      `<text class="s2" x="60" y="96">Example: delivery day D = 15 Jan 2026, decision made on D-1 at 09:50</text>`,
      ...dayLabels.map((l, i) => node(60 + 88 * i, 118, 80, 92, l, note[i] ? [dates[i], note[i]] : [dates[i]], cellCls(i))),
      `<path class="brace" d="M148 228v8H756v-8"/>`,
      `<text class="t acc" x="452" y="258" text-anchor="middle">7 prior days: D-8 to D-2</text>`,
      edge(452, 266, 452, 300),
      codeBox(120, 300, 760, 124, [
        '1  pool the hourly errors (forecast - actual) of those 7 days',
        '2  err_low = P10, err_high = P90 of the pooled errors',
        '3  band = [ forecast - err_high ,  forecast - err_low ]',
        'Fewer than 3 days of history -> band withheld, with a reason',
      ]),
    ].join('')
  )

  window.defineDiagram(
    'band',
    'Error band',
    'The band for day D uses only days up to D-2, so it never sees information the desk lacked.',
    band
  )
})()
