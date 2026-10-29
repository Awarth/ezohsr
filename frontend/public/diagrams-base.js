/*
 * Shared SVG diagram helpers for architecture.html (diagram-only screen) and walkthrough.html (slides).
 * Diagrams are defined in diagrams-*.js and registered here, so both pages render one source of truth.
 * Every diagram is drawn on a 1000 x 440 canvas; styling lives in deck.css.
 */
;(function () {
  const W = 1000
  const H = 440
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  /** Rounded box: bold title plus muted lines, centred vertically. */
  function node(x, y, w, h, title, sub = [], cls = 'n') {
    const block = 18 + sub.length * 17
    const top = y + (h - block) / 2
    let out = `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`
    out += `<text class="t" x="${x + w / 2}" y="${top + 14}" text-anchor="middle">${esc(title)}</text>`
    sub.forEach((line, i) => {
      out += `<text class="s" x="${x + w / 2}" y="${top + 32 + i * 17}" text-anchor="middle">${esc(line)}</text>`
    })
    return out
  }

  /** Dark box with left-aligned monospace lines. */
  function codeBox(x, y, w, h, lines) {
    let out = `<rect class="n-code" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`
    lines.forEach((line, i) => {
      out += `<text class="code" x="${x + 18}" y="${y + 28 + i * 22}">${esc(line)}</text>`
    })
    return out
  }

  /** Arrow with an optional label. o: { dash, lx, ly, anchor }. */
  function edge(x1, y1, x2, y2, label, o = {}) {
    let out = `<path class="edge${o.dash ? ' edge-d' : ''}" d="M${x1} ${y1}L${x2} ${y2}"/>`
    if (label) {
      const lx = o.lx ?? (x1 + x2) / 2
      const ly = o.ly ?? (y1 + y2) / 2 - 7
      out += `<text class="lbl" x="${lx}" y="${ly}" text-anchor="${o.anchor || 'middle'}">${esc(label)}</text>`
    }
    return out
  }

  const svg = (label, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`

  window.DG = { node, codeBox, edge, svg, esc }
  window.DIAGRAM_ORDER = ['architecture', 'requestFlow', 'vintage', 'band', 'frontend', 'deployment']
  window.DIAGRAMS = {}
  window.defineDiagram = (key, title, caption, svgString) => {
    window.DIAGRAMS[key] = { title, caption, svg: svgString }
  }

  /** Arrowhead marker referenced by every diagram via url(#arr). */
  window.mountDiagramDefs = function () {
    if (document.getElementById('diagram-defs')) return
    const el = document.createElement('div')
    el.id = 'diagram-defs'
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
    el.innerHTML =
      '<svg width="0" height="0"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#475569"/></marker></defs></svg>'
    document.body.prepend(el)
  }
})()
