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

// Toda fórmula precisa terminar com pelo menos MIN_RESULTS perfumes que tenham
// 2 ou mais das 3 notas escolhidas (em qualquer camada). Por isso cada etapa só
// oferece notas que ainda permitem chegar lá.
const MIN_HITS = 2
const MIN_RESULTS = 3
const NOTES = P.map((p) => new Set([...p.t, ...p.h, ...p.f]))
const POOLS = { t: pool('t'), h: pool('h'), f: pool('f') }
const hitsIn = (i, notes) => notes.reduce((n, x) => n + (NOTES[i].has(x) ? 1 : 0), 0)

// Notas de fundo que, somadas a topo + corpo, fecham a fórmula com perfumes suficientes.
function validFundo(a, b) {
  let both = 0
  const freq = new Map()
  NOTES.forEach((s, i) => {
    const h = hitsIn(i, [a, b])
    if (h === 2) both++
    else if (h === 1) s.forEach((n) => freq.set(n, (freq.get(n) || 0) + 1))
  })
  const need = MIN_RESULTS - both
  return POOLS.f.filter((n) => n !== a && n !== b && (need <= 0 || (freq.get(n) || 0) >= need))
}

const MIN_CHOICES = 3 // a etapa seguinte precisa ter ao menos isso de opções
const corpoCache = new Map()
function validCorpo(a) {
  if (!corpoCache.has(a)) corpoCache.set(a, POOLS.h.filter((n) => n !== a && validFundo(a, n).length >= MIN_CHOICES))
  return corpoCache.get(a)
}
let topoCache = null
const validTopo = () => (topoCache ??= POOLS.t.filter((n) => validCorpo(n).length >= MIN_CHOICES))

export function iniciar(raiz) {
  const app = raiz.querySelector('[data-app]')
  const intro = raiz.querySelector('[data-intro]')
  let picks = [] // [{k,note}]
  let options = []

  function makeOptions() {
    const [a, b] = picks.map((x) => x.note)
    const valid = picks.length === 0 ? validTopo() : picks.length === 1 ? validCorpo(a) : validFundo(a, b)
    return shuffle(valid).slice(0, 6)
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
      .filter((p) => picks.filter((x) => has(p, x.note)).length >= MIN_HITS)
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
        if (picks.length < 3) options = makeOptions()
        render()
        voltarAoTopo()
      }),
    )
    const again = app.querySelector('[data-again]')
    if (again)
      again.addEventListener('click', () => {
        picks = []
        options = makeOptions()
        render()
        voltarAoTopo()
      })
  }

  options = makeOptions()
  render()
}
