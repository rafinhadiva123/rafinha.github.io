// Ateliê de Notas: três etapas (topo, corpo, fundo), seis frascos por etapa,
// e no fim os três perfumes que mais se parecem com a fórmula.
import { LAYERS, P, DESC, LINKS } from './dados.js'

const shuffle = (a) => {
  a = a.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pool = (k) => [...new Set(P.flatMap((p) => p[k]))]
const has = (p, note) => ['t', 'h', 'f'].some((k) => p[k].includes(note))
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

export function iniciar(raiz) {
  const app = raiz.querySelector('[data-app]')
  const intro = raiz.querySelector('[data-intro]')
  let picks = [] // [{k,note}]
  let options = []

  function makeOptions(layer) {
    const all = pool(layer.k).filter((n) => !picks.some((x) => x.note === n))
    if (!picks.length) return shuffle(all).slice(0, 6)
    // notas de perfumes que já combinam com as escolhas anteriores, para a fórmula fazer sentido
    const related = P.filter((p) => picks.some((x) => has(p, x.note)))
    const near = [...new Set(related.flatMap((p) => p[layer.k]))].filter((n) => all.includes(n))
    const a = shuffle(near).slice(0, 3)
    const rest = shuffle(all.filter((n) => !a.includes(n))).slice(0, 6 - a.length)
    return shuffle(a.concat(rest))
  }

  function score(p) {
    let s = 0,
      same = 0
    picks.forEach((x) => {
      if (p[x.k].includes(x.note)) {
        s += 3
        same++
      } else if (has(p, x.note)) s += 1
    })
    return { s, same }
  }

  function tags(p, k) {
    return p[k]
      .map((n) => {
        const pk = picks.find((x) => x.note === n)
        const cls = pk ? (pk.k === k ? 'hit' : 'near') : ''
        const c = pk ? LAYERS.find((l) => l.k === pk.k).c : 'var(--line)'
        return `<span class="tag ${cls}" style="--c:${c}" title="${attr(DESC[n] || '')}">${n}</span>`
      })
      .join('')
  }

  function formulaLine() {
    if (!picks.length) return ''
    return `<ul class="formula" aria-label="Sua fórmula até agora">${picks
      .map((p, i) => `<li><span class="dot" style="background:${LAYERS[i].c}"></span>${LAYERS[i].name} <span class="nm">${p.note}</span></li>`)
      .join('')}</ul>`
  }

  function renderStage() {
    const i = picks.length,
      L = LAYERS[i]
    return `<section class="panel">
      <span class="step" style="color:${L.c}">Etapa ${i + 1} de 3 · Nota de ${L.name.toLowerCase()}</span>
      ${formulaLine()}
      <h2>${L.title}</h2>
      <p class="hint">${L.hint}</p>
      <div class="vials">${options
        .map((n) => `<button type="button" class="vial" style="--c:${L.c}" data-note="${attr(n)}"><span class="nm">${n}</span><span class="ds">${DESC[n] || ''}</span></button>`)
        .join('')}</div>
    </section>`
  }

  function buyLink(p) {
    const l = LINKS[p.n]
    if (!l) return ''
    return `<a class="buy" href="${l[1]}" target="_blank" rel="noopener noreferrer">Comprar na ${l[0]} ↗</a>`
  }

  function renderResult() {
    const ranked = shuffle(P)
      .map((p) => ({ p, ...score(p) }))
      .sort((a, b) => b.s - a.s || b.same - a.same)
      .slice(0, 3)
    const cards = ranked
      .map((r, idx) => {
        const hits = picks.filter((x) => has(r.p, x.note)).length
        return `<article class="perf ${idx === 0 ? 'first' : ''}">
        <div class="perf-head"><div><span class="perf-brand">${r.p.b}</span><h3 class="perf-name">${r.p.n}</h3></div>
        <span class="score">${hits} de 3 notas da sua fórmula</span></div>
        <div class="rows">
          <span class="lab">Topo</span><div class="tags">${tags(r.p, 't')}</div>
          <span class="lab">Corpo</span><div class="tags">${tags(r.p, 'h')}</div>
          <span class="lab">Fundo</span><div class="tags">${tags(r.p, 'f')}</div>
        </div>${buyLink(r.p)}</article>`
      })
      .join('')
    return `<section class="panel">
      <span class="step" style="color:var(--accent)">Fórmula pronta</span>
      <h2>Três perfumes com as suas notas</h2>
      <div class="legend"><span>Nota preenchida: está na camada que você escolheu</span><span>Nota com contorno: aparece em outra camada</span></div>
      <div class="results">${cards}</div>
      <button type="button" class="btn" data-again>Criar outra fórmula</button>
    </section>`
  }

  // Rola só se o topo do jogo saiu da tela — a página tem cabeçalho e texto acima.
  function voltarAoTopo() {
    if (raiz.getBoundingClientRect().top < 0) {
      const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      raiz.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' })
    }
  }

  function render() {
    app.innerHTML = picks.length < 3 ? renderStage() : renderResult()
    if (intro) intro.hidden = picks.length >= 3
    app.querySelectorAll('.vial').forEach((b) =>
      b.addEventListener('click', () => {
        picks.push({ k: LAYERS[picks.length].k, note: b.dataset.note })
        if (picks.length < 3) options = makeOptions(LAYERS[picks.length])
        render()
        voltarAoTopo()
      }),
    )
    const again = app.querySelector('[data-again]')
    if (again)
      again.addEventListener('click', () => {
        picks = []
        options = makeOptions(LAYERS[0])
        render()
        voltarAoTopo()
      })
  }

  options = makeOptions(LAYERS[0])
  render()
}
