/* Slide engine for walkthrough.html. Slide data lives in slides.js. */
;(function () {
  const slides = window.SLIDES
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const host = document.getElementById('slide-host')
  const viewport = document.getElementById('viewport')
  const notesBody = document.getElementById('notes-body')
  const progress = document.getElementById('progress')
  let index = Math.min(slides.length - 1, Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1))

  const list = (items) => `<ul>${items.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`

  /** HTML for one slide's inner content, by kind. */
  function body(s) {
    switch (s.kind) {
      case 'title':
        return `<h2>${esc(s.title)}</h2><div class="sub">${esc(s.subtitle)}</div><div class="meta">${esc(s.meta)}</div>`
      case 'bullets':
        return `<h2>${esc(s.title)}</h2><div class="body">${list(s.bullets)}</div>`
      case 'cards':
        return (
          `<h2>${esc(s.title)}</h2><div class="body"><div class="cards">` +
          s.cards
            .map(
              (c) =>
                `<div class="card"><h3>${esc(c.heading)}</h3><dl>${c.items
                  .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
                  .join('')}</dl></div>`
            )
            .join('') +
          `</div></div>`
        )
      case 'jargon':
        return (
          `<h2>${esc(s.title)}</h2><div class="body"><div class="jargon">` +
          `<div class="ctx"><h3>${esc(s.contextTitle)}</h3>${list(s.context)}</div>` +
          `<div class="terms"><h3>${esc(s.termsTitle)}</h3><dl>${s.terms
            .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
            .join('')}</dl></div></div></div>`
        )
      case 'tree': {
        const col = (rows) =>
          `<pre class="tree">${rows
            .map(([name, note, key]) => `<span class="${key ? 'k' : ''}">${esc(name)}</span>${note ? `<i>  ${esc(note)}</i>` : ''}`)
            .join('\n')}</pre>`
        return `<h2>${esc(s.title)}</h2><div class="body"><div class="trees">${col(s.left)}${col(s.right)}</div></div>`
      }
      default:
        return `<h2>${esc(s.title || '')}</h2>`
    }
  }

  const slideHtml = (s) => `<section class="slide${s.kind === 'title' ? ' title-slide' : ''}">${body(s)}</section>`

  function fit() {
    const el = host.firstElementChild
    if (!el) return
    const scale = Math.min((viewport.clientWidth - 32) / 1280, (viewport.clientHeight - 32) / 720)
    el.style.transform = `scale(${scale})`
    host.style.width = `${1280 * scale}px`
    host.style.height = `${720 * scale}px`
    el.style.transformOrigin = 'top left'
  }

  function show(i) {
    index = Math.min(slides.length - 1, Math.max(0, i))
    const s = slides[index]
    host.innerHTML = slideHtml(s)
    notesBody.textContent = s.notes || ''
    progress.textContent = `Slide ${index + 1} of ${slides.length} · ${s.title}`
    history.replaceState(null, '', `#${index + 1}`)
    fit()
  }

  // Print layout: every slide on its own page, presenter notes underneath.
  document.getElementById('print-host').innerHTML = slides
    .map((s) => `<div class="print-page">${slideHtml(s)}<div class="pnotes"><b>Notes.</b> ${esc(s.notes || '')}</div></div>`)
    .join('')

  const toggleNotes = () => {
    const on = document.body.classList.toggle('show-notes')
    document.getElementById('btn-notes').setAttribute('aria-pressed', String(on))
    fit()
  }
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())

  document.getElementById('btn-notes').addEventListener('click', toggleNotes)
  document.getElementById('btn-full').addEventListener('click', toggleFull)
  document.getElementById('btn-print').addEventListener('click', () => window.print())
  window.addEventListener('resize', fit)
  document.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) show(index + 1)
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) show(index - 1)
    else if (e.key === 'Home') show(0)
    else if (e.key === 'End') show(slides.length - 1)
    else if (e.key.toLowerCase() === 'n') toggleNotes()
    else if (e.key.toLowerCase() === 'f') toggleFull()
    else if (e.key.toLowerCase() === 'p') window.print()
  })
  viewport.addEventListener('click', (e) => show(index + (e.clientX > viewport.clientWidth / 2 ? 1 : -1)))

  show(index)
  window.addEventListener('hashchange', () => {
    const n = parseInt(location.hash.slice(1), 10)
    if (n && n - 1 !== index) show(n - 1)
  })
})()
