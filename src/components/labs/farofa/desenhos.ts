// Desenhos portados de prototipo-farofa.html, literalmente — path por path.
// Devolvem string de SVG/HTML (pra injetar via dangerouslySetInnerHTML), nunca
// importam React nem tocam no DOM. Não "simplifique" as formas aqui: cada uma
// já passou por retrabalho no protótipo pra deixar de ser um traço genérico.

import { ingredientes, ingredientesPorId, type Ingrediente } from './ingredientes'
import type { Estado, Resultado } from './modelo'
import { pct, pct1 } from './modelo'

const CT = '#241a10' // contorno

export function misturaCor(a: string, b: string, t: number): string {
  const pa = [parseInt(a.substr(1, 2), 16), parseInt(a.substr(3, 2), 16), parseInt(a.substr(5, 2), 16)]
  const pb = [parseInt(b.substr(1, 2), 16), parseInt(b.substr(3, 2), 16), parseInt(b.substr(5, 2), 16)]
  return (
    '#' +
    pa
      .map((v, i) => {
        const n = Math.round(v + (pb[i] - v) * t).toString(16)
        return n.length < 2 ? '0' + n : n
      })
      .join('')
  )
}

// gerador determinístico — as posições não tremem entre renders
export function rng(seed: number): () => number {
  let s = seed
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// contorno orgânico fechado: polígono com raio variável, suavizado
export function blob(cx: number, cy: number, raio: number, variacao: number, rand: () => number, n: number): string {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = raio * (1 - variacao / 2 + rand() * variacao)
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  const meio = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const m0 = meio(pts[n - 1], pts[0])
  let d = 'M' + m0[0].toFixed(1) + ',' + m0[1].toFixed(1)
  for (let i = 0; i < n; i++) {
    const atual = pts[i]
    const prox = pts[(i + 1) % n]
    const mm = meio(atual, prox)
    d += ' Q' + atual[0].toFixed(1) + ',' + atual[1].toFixed(1) + ' ' + mm[0].toFixed(1) + ',' + mm[1].toFixed(1)
  }
  return d + ' Z'
}

export function glifo(id: string): string {
  const ing = ingredientesPorId[id]
  const cor = ing ? ing.cor : '#cccccc'
  const claro = misturaCor(cor, '#ffffff', 0.48)
  const escuro = misturaCor(cor, '#000000', 0.2)
  const o = `stroke="${CT}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`
  const of = `stroke="${CT}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" fill="none"`
  const f = `fill="url(#g-${id})"`

  const defs =
    `<defs><linearGradient id="g-${id}" x1="0.15" y1="0" x2="0.75" y2="1">` +
    `<stop offset="0" stop-color="${claro}"/>` +
    `<stop offset=".5" stop-color="${cor}"/>` +
    `<stop offset="1" stop-color="${escuro}"/></linearGradient></defs>`
  const sombra = '<ellipse cx="24" cy="43.5" rx="13" ry="2.8" fill="#1a1008" opacity=".26"/>'

  const g: Record<string, string> = {
    // bloco isométrico de manteiga
    manteiga:
      `<path d="M11,18 L26,11 L39,16.5 L24,23.5 Z" fill="${claro}" ${o}/>` +
      `<path d="M11,18 L24,23.5 L24,37 L11,31.5 Z" fill="${cor}" ${o}/>` +
      `<path d="M39,16.5 L39,30 L24,37 L24,23.5 Z" fill="${escuro}" ${o}/>`,

    // garrafa de dendê
    dende:
      `<path d="M16,24 C16,20 20,19 20.5,16 L20.5,12 L27.5,12 L27.5,16 C28,19 32,20 32,24 L32,33.5 C32,37.5 29,39.5 24,39.5 C19,39.5 16,37.5 16,33.5 Z" ${f} ${o}/>` +
      `<rect x="18.8" y="5" width="10.4" height="7" rx="2.4" fill="#7a4a18" ${o}/>` +
      `<rect x="18.6" y="26" width="3.2" height="9" rx="1.6" fill="#ffffff" opacity=".42"/>`,

    // tira ondulada com gordura
    bacon:
      `<path d="M7,15 C13,9 17,19 24,14 C31,9 35,18 41,13 L41,26 C35,31 31,22 24,27 C17,32 13,22 7,28 Z" ${f} ${o}/>` +
      `<path d="M7,18.5 C13,12.5 17,22.5 24,17.5 C31,12.5 35,21.5 41,16.5" stroke="#fbeae4" stroke-width="3.2" fill="none" stroke-linecap="round"/>` +
      `<path d="M7,24 C13,18 17,28 24,23 C31,18 35,27 41,22" stroke="#fbeae4" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,

    // rodelas de calabresa
    calabresa:
      `<circle cx="18" cy="29" r="11" fill="${escuro}" ${o}/><circle cx="18" cy="29" r="7.6" ${f}/>` +
      `<circle cx="31" cy="18" r="9.6" fill="${escuro}" ${o}/><circle cx="31" cy="18" r="6.6" ${f}/>` +
      '<circle cx="15.4" cy="27" r="1.7" fill="#f6ded6"/><circle cx="20" cy="31.6" r="1.5" fill="#f6ded6"/>' +
      '<circle cx="21" cy="26.6" r="1.2" fill="#f6ded6"/><circle cx="32.6" cy="17" r="1.5" fill="#f6ded6"/>' +
      '<circle cx="29" cy="20.4" r="1.2" fill="#f6ded6"/>',

    // fatia de coalho grelhada (laje, não cubo — separa da manteiga)
    coalho:
      `<path d="M8,24 L24,16 L40,24 L24,32 Z" fill="${claro}" ${o}/>` +
      `<path d="M8,24 L24,32 L24,39 L8,31 Z" fill="${cor}" ${o}/>` +
      `<path d="M40,24 L40,31 L24,39 L24,32 Z" fill="${escuro}" ${o}/>` +
      '<path d="M14,21 L30,29 M20,18 L36,26" stroke="#a8641f" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M26,26.5 L14.5,32" stroke="#a8641f" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>',

    // cebola: bulbo de casca dourada, broto verde e raízes
    cebola:
      `<path d="M24,11 C25,15 27,16 30,18 C36,22 38,27.5 36,32.5 C34,38 29,41 24,41 C19,41 14,38 12,32.5 C10,27.5 12,22 18,18 C21,16 23,15 24,11 Z" ${f} ${o}/>` +
      `<path d="M19.5,15.5 C15,22.5 15,33.5 19.5,40" ${of} stroke="${escuro}"/>` +
      `<path d="M28.5,15.5 C33,22.5 33,33.5 28.5,40" ${of} stroke="${escuro}"/>` +
      '<path d="M24,12 C22.5,8 20,5.5 17,4.5 M24,12 C25.5,8 28,5.5 31,4.5" stroke="#5fae42" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M21,41 L19,44.5 M24,41.5 L24,45 M27,41 L29,44.5" stroke="#b9a07c" stroke-width="1.8" stroke-linecap="round"/>',

    // alho: cabeça branca com dentes marcados e pescoço seco
    alho:
      `<path d="M24,13 C32,16 37.5,22 37.5,29.5 C37.5,36 31.5,40.5 24,40.5 C16.5,40.5 10.5,36 10.5,29.5 C10.5,22 16,16 24,13 Z" ${f} ${o}/>` +
      '<path d="M24,13.5 L24,40.3" stroke="#b9a678" stroke-width="2.2" fill="none"/>' +
      '<path d="M16.5,16.5 C13.8,23.5 13.8,34.5 17,40" stroke="#b9a678" stroke-width="2.2" fill="none"/>' +
      '<path d="M31.5,16.5 C34.2,23.5 34.2,34.5 31,40" stroke="#b9a678" stroke-width="2.2" fill="none"/>' +
      `<path d="M20,14.5 C21,9.5 20,6 22,4 L26,4 C28,6 27,9.5 28,14.5 Z" fill="${escuro}" ${o}/>`,

    // maço de cheiro-verde amarrado
    cheiroverde:
      `<path d="M24,40 C21,30 17,21 11,13" stroke="${escuro}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M24,40 C24,29 23,19 21,10" stroke="${cor}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M24,40 C26,30 30,21 36,12" stroke="${cor}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M24,40 C26,31 28,24 29,16" stroke="${claro}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="11" cy="12" rx="4" ry="3" fill="${claro}" transform="rotate(-38 11 12)" ${o}/>` +
      `<ellipse cx="21" cy="9.5" rx="3.6" ry="2.8" fill="${claro}" transform="rotate(-8 21 9.5)" ${o}/>` +
      `<ellipse cx="36.5" cy="11.5" rx="4" ry="3" fill="${claro}" transform="rotate(34 36.5 11.5)" ${o}/>` +
      '<rect x="18.5" y="32" width="11" height="6" rx="2.6" fill="#c98a3a" ' + o + '/>',

    // folha de couve com nervuras
    couve:
      `<path d="M24,5 C34,13 40.5,24 36.5,32 C33,39 27,42 24,42 C21,42 15,39 11.5,32 C7.5,24 14,13 24,5 Z" ${f} ${o}/>` +
      `<path d="M24,7 L24,41" stroke="${claro}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M24,15 L16,19 M24,15 L32,19 M24,24 L14.5,28 M24,24 L33.5,28 M24,32 L18,35 M24,32 L30,35" stroke="${claro}" stroke-width="1.8" stroke-linecap="round"/>`,

    // castanha-de-caju em meia-lua
    castanha:
      `<path d="M35,13 C22,10 10.5,18 10.5,26.5 C10.5,35 20.5,40.5 29,37 C22.5,36 18,31.5 18,26.5 C18,20 25,14.5 35,13 Z" ${f} ${o}/>` +
      '<path d="M31,15.5 C22,17.5 16,21.5 15,27" stroke="#ffffff" stroke-width="2.2" opacity=".4" fill="none" stroke-linecap="round"/>',

    // amendoim na casca — cintura bem marcada
    amendoim:
      `<path d="M24,6.5 C32,6.5 36.5,12 35,18 C34,21.5 30,22.5 30,24 C30,25.5 34.5,26.5 35.5,31 C37,37.5 32,41.5 24,41.5 C16,41.5 11,37.5 12.5,31 C13.5,26.5 18,25.5 18,24 C18,22.5 14,21.5 13,18 C11.5,12 16,6.5 24,6.5 Z" ${f} ${o}/>` +
      `<path d="M14.5,15.5 C19,18 29,18 33.5,15.5 M13.5,32.5 C18.5,29.5 29.5,29.5 34.5,32.5 M13.5,37 C18.5,34.5 29.5,34.5 34.5,37" ${of} stroke="${escuro}"/>`,

    // ovo frito
    ovo:
      `<path d="M12,23 C9,16.5 15,11.5 20.5,13 C25,9.5 32,11 35,15.5 C41,17.5 42,25 37.5,29.5 C35.5,36 26.5,39 20,35.5 C13,34.5 9,29 12,23 Z" fill="#fdfaf1" ${o}/>` +
      `<circle cx="25" cy="23" r="8.6" ${f} ${o}/>` +
      '<ellipse cx="22" cy="20" rx="3" ry="2.2" fill="#ffffff" opacity=".55" transform="rotate(-25 22 20)"/>',

    // banana-da-terra inteira
    banana:
      `<path d="M13,12 C13,25 21,36 33.5,37.5 C36.5,37.8 38.5,36 38.5,33.8 C38.5,31.8 36.8,30.4 34.6,30.2 C24.6,29 19,22 19,12.5 C19,10.2 17.4,8.5 15.8,8.5 C14.2,8.5 13,9.8 13,12 Z" ${f} ${o}/>` +
      `<path d="M16,12.5 C16,23 22,32 32,34.5" stroke="${claro}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      '<path d="M13.2,10.5 C14,8 17.5,7.8 18.6,10" stroke="#6f8a3a" stroke-width="2.6" fill="none" stroke-linecap="round"/>',

    // punhado de uvas-passas enrugadas
    passas:
      `<g transform="rotate(-18 17 30)"><ellipse cx="17" cy="30" rx="8" ry="6.2" ${f} ${o}/>` +
      `<path d="M11,29 C14,31 20,31 23,29 M12,32.5 C15,34 19,34 22,32.5" ${of} stroke="${escuro}"/></g>` +
      `<g transform="rotate(20 31 24)"><ellipse cx="31" cy="24" rx="7.4" ry="5.8" ${f} ${o}/>` +
      `<path d="M25.5,23 C28,25 34,25 36.5,23" ${of} stroke="${escuro}"/></g>` +
      `<g transform="rotate(-6 24 14)"><ellipse cx="24" cy="14" rx="7" ry="5.4" ${f} ${o}/>` +
      `<path d="M19,13 C21.5,15 26.5,15 29,13" ${of} stroke="${escuro}"/></g>`,

    // pimenta-biquinho com o bico
    pimenta:
      `<path d="M21.5,13 C30,14 36,20.5 36,27.5 C36,33.5 31,38 26,37 C18.5,35.5 13.5,28.5 14.5,21.5 C15,16.5 17.5,13 21.5,13 Z" ${f} ${o}/>` +
      `<path d="M35.4,30 L41.5,33.5 L34.5,34.5 Z" ${f} ${o}/>` +
      '<path d="M21.5,13 C20,9 16.5,7 13,7.5" stroke="#4e8a3a" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="21" cy="12.5" rx="5" ry="3" fill="#5fae42" transform="rotate(-24 21 12.5)" ' +
      o +
      '/>' +
      '<ellipse cx="21.5" cy="20" rx="2.6" ry="4" fill="#ffffff" opacity=".35" transform="rotate(-22 21.5 20)"/>',
  }

  return `<svg viewBox="0 0 48 48" aria-hidden="true">${defs}${sombra}${g[id] || ''}</svg>`
}

export function glifoSaco(cor: string): string {
  return (
    '<svg viewBox="0 0 30 30" aria-hidden="true">' +
    `<path d="M7 11c0-3 3-4 8-4s8 1 8 4v14c0 2-2 3-8 3s-8-1-8-3z" fill="${cor}" stroke="${CT}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M8 11c3 2 11 2 14 0" stroke="${CT}" stroke-width="1.8" fill="none" opacity=".5"/></svg>`
  )
}

// Forma de cada alimento dentro da panela, em coordenadas unitárias (-10..10).
// Gorduras não têm forma: viram brilho sobre a farofa (ver desenharPanela).
export function marcaUnidade(ing: Ingrediente): string {
  const c = ing.cor
  const cl = misturaCor(c, '#ffffff', 0.34)
  const ce = misturaCor(c, '#000000', 0.3)
  const o = 'stroke="#23180e" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"'

  switch (ing.id) {
    case 'bacon': // tirinha ondulada
      return (
        `<path d="M-11,-3 q5.5,-4.5 11,0 q5.5,4.5 11,0 v7.5 q-5.5,4.5 -11,0 q-5.5,-4.5 -11,0 Z" fill="${c}" ${o}/>` +
        '<path d="M-11,0.8 q5.5,-4.5 11,0 q5.5,4.5 11,0" stroke="#fbeae4" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
      )
    case 'calabresa': // rodela
      return (
        `<circle r="8.5" fill="${ce}" ${o}/><circle r="5.8" fill="${c}"/>` +
        '<circle cx="-2" cy="-1.5" r="1.3" fill="#f6ded6"/><circle cx="2" cy="2" r="1.1" fill="#f6ded6"/>'
      )
    case 'coalho': // cubinho grelhado
      return (
        `<rect x="-7" y="-7" width="14" height="14" rx="2.5" fill="${cl}" ${o}/>` +
        '<path d="M-5,-2.5 h10 M-5,2.5 h10" stroke="#b07026" stroke-width="2" stroke-linecap="round"/>'
      )
    case 'cebola': // tira refogada
      return `<path d="M-10,4 a10,8.5 0 0 1 20,0 a10,2.5 0 0 0 -20,0 Z" fill="${cl}" ${o}/>`
    case 'alho': // lasquinha
      return `<ellipse rx="5.5" ry="3.2" fill="${cl}" ${o}/>`
    case 'cheiroverde': // raminho
      return (
        `<ellipse cx="-4.5" cy="2" rx="3.6" ry="2.6" fill="${c}" ${o}/>` +
        `<ellipse cx="3" cy="-2.5" rx="3.2" ry="2.3" fill="${cl}" ${o}/>` +
        `<ellipse cx="4.5" cy="4.5" rx="2.8" ry="2.1" fill="${c}" ${o}/>`
      )
    case 'couve': // fita de folha
      return (
        `<path d="M-10,1 q5,-7 10,-2 q5,5 10,-2 v7 q-5,7 -10,2 q-5,-5 -10,2 Z" fill="${c}" ${o}/>` +
        `<path d="M-10,2.5 q5,-8 10,-3 q5,5 10,-3" stroke="${cl}" stroke-width="1.4" fill="none"/>`
      )
    case 'castanha': // meia-lua
      return `<path d="M6,-7.5 a9.8,9.8 0 1 0 2,13.5 a7.6,7.6 0 1 1 -2,-13.5 Z" fill="${c}" ${o}/>`
    case 'amendoim': // casquinha em oito
      return `<path d="M0,-9 c4.5,0 6.5,2.8 5.6,5.6 c-0.5,1.5 -2.8,2 -2.8,3.4 c0,1.4 2.3,1.9 2.8,3.4 c0.9,2.8 -1.1,5.6 -5.6,5.6 c-4.5,0 -6.5,-2.8 -5.6,-5.6 c0.5,-1.5 2.8,-2 2.8,-3.4 c0,-1.4 -2.3,-1.9 -2.8,-3.4 c-0.9,-2.8 1.1,-5.6 5.6,-5.6 Z" fill="${c}" ${o}/>`
    case 'ovo': // pedaço de ovo mexido
      return (
        `<path d="M-8,0 q-1.5,-6 5,-6.5 q3,-3 7,0.5 q5,2 3,6 q-1,5 -7,4.5 q-7,0 -8,-4.5 Z" fill="#fdfaf1" ${o}/>` +
        `<circle cx="1" cy="0" r="4.2" fill="${c}"/>`
      )
    case 'banana': // rodela
      return `<circle r="7.5" fill="${c}" ${o}/><circle r="3" fill="${cl}"/>`
    case 'passas': // passa enrugada
      return (
        `<ellipse rx="7" ry="5.2" fill="${c}" ${o}/>` +
        `<path d="M-4.5,-1 q4.5,2.5 9,0 M-4,2.2 q4,2 8,0" stroke="${ce}" stroke-width="1.3" fill="none"/>`
      )
    case 'pimenta': // biquinho
      return (
        `<path d="M-6,-5.5 q10.5,-2 11.5,6 q0,6 -6,6 q-8.5,-1 -7.5,-8.5 Z" fill="${c}" ${o}/>` +
        '<path d="M-6,-5.5 q-2.5,-1.5 -4,-0.5" stroke="#4e8a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      )
    default:
      return ''
  }
}

export function corFarofa(estado: Estado, farinhaCor: string): string {
  const t = estado.tostagem
  if (t <= 6) return misturaCor(farinhaCor, '#b9772f', (t / 6) * 0.85)
  return misturaCor(misturaCor(farinhaCor, '#b9772f', 0.85), '#3b2210', (t - 6) / 4)
}

export function desenharPanela(estado: Estado, resultado: Resultado, farinhaCor: string): string {
  const CX = 180
  const CY = 158
  const L = 232
  const r = L / 2
  const brasa = resultado.metricas.Q > 0.8 ? '#e2452a' : '#f2a63c'
  let s = '<title id="panelaTitulo">Frigideira vista de cima com a farofa</title>'

  // cabo
  s +=
    '<g transform="rotate(38 180 158)"><rect x="168" y="150" width="24" height="176" rx="11" fill="#8a5a2b" stroke="' +
    CT +
    '" stroke-width="5"/>' +
    `<rect x="168" y="150" width="24" height="42" rx="10" fill="${brasa}" stroke="${CT}" stroke-width="5"/></g>`

  s += '<g transform="rotate(-7 180 158)">'
  s += `<rect x="${CX - r}" y="${CY - r}" width="${L}" height="${L}" rx="40" fill="${brasa}" stroke="${CT}" stroke-width="6"/>`
  s += `<rect x="${CX - r + 11}" y="${CY - r + 11}" width="${L - 22}" height="${L - 22}" rx="32" fill="#3b3e46" stroke="${CT}" stroke-width="5"/>`
  s += `<rect x="${CX - r + 20}" y="${CY - r + 20}" width="${L - 40}" height="${L - 40}" rx="26" fill="#2b2e35"/>`

  // conteúdo recortado
  s += `<clipPath id="corte"><rect x="${CX - r + 20}" y="${CY - r + 20}" width="${L - 40}" height="${L - 40}" rx="26"/></clipPath>`
  s += '<g clip-path="url(#corte)">'

  const rand = rng(7)
  const cor = corFarofa(estado, farinhaCor)
  const corCl = misturaCor(cor, '#ffe9c0', 0.3)
  const corEsc = misturaCor(cor, '#2a1708', 0.34)

  // marcas da grelha ficam no fundo da panela, sob a comida
  for (let l2 = 0; l2 < 5; l2++) {
    const ly = CY - r + 42 + l2 * 38
    s += `<line x1="${CX - r + 22}" y1="${ly}" x2="${CX + r - 22}" y2="${ly}" stroke="#1d1f24" stroke-width="7" opacity=".5" stroke-linecap="round"/>`
  }

  // cama de farofa: monte irregular, não retângulo pintado
  const R = 52 + Math.min(32, estado.gramasFarinha / 11)
  s += `<path d="${blob(CX, CY, R * 1.02, 0.16, rng(21), 20)}" fill="${corEsc}" opacity=".95"/>`
  s += `<path d="${blob(CX, CY, R * 0.97, 0.13, rng(33), 20)}" fill="${cor}"/>`
  s += `<path d="${blob(CX - R * 0.1, CY - R * 0.12, R * 0.62, 0.2, rng(44), 16)}" fill="${corCl}" opacity=".55"/>`

  // textura de grão por cima da cama
  const graos = Math.min(420, Math.round(150 + estado.gramasFarinha / 2.4))
  for (let i = 0; i < graos; i++) {
    const ga = rand() * Math.PI * 2
    const gd = Math.sqrt(rand()) * R * 0.94
    const gx = CX + Math.cos(ga) * gd
    const gy = CY + Math.sin(ga) * gd
    const rr = 1.3 + rand() * 2.4
    const t = rand()
    s +=
      `<circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="${rr.toFixed(1)}" fill="${t > 0.62 ? corEsc : t > 0.28 ? corCl : cor}" ` +
      `opacity="${(0.5 + rand() * 0.5).toFixed(2)}"/>`
  }

  // brilho da gordura: manteiga e dendê não viram pedaço, viram lustro
  const gordura = (estado.ingredientes.manteiga || 0) * 0.82 + (estado.ingredientes.dende || 0)
  if (gordura > 0) {
    const rg = rng(55)
    const brilho = Math.min(0.3, (gordura / estado.gramasFarinha) * 0.65)
    const tinta = (estado.ingredientes.dende || 0) > 0 ? '#ffb24d' : '#fff2c4'
    for (let b = 0; b < 8; b++) {
      const ba = rg() * Math.PI * 2
      const bd = Math.sqrt(rg()) * R * 0.8
      const bx = CX + Math.cos(ba) * bd
      const by = CY + Math.sin(ba) * bd
      s +=
        `<ellipse cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" rx="${(9 + rg() * 15).toFixed(1)}" ` +
        `ry="${(5 + rg() * 8).toFixed(1)}" fill="${tinta}" opacity="${brilho.toFixed(3)}" ` +
        `transform="rotate(${Math.round(rg() * 180)} ${bx.toFixed(1)} ${by.toFixed(1)})"/>`
    }
  }

  // ingredientes por cima, cada um com a própria forma (a ordem do array
  // importa: define a semente do rng de cada um, pra não tremer entre renders)
  ingredientes.forEach((ing, k) => {
    const m = estado.ingredientes[ing.id] || 0
    if (!m) return
    const forma = marcaUnidade(ing)
    if (!forma) return
    const n = Math.max(2, Math.min(11, Math.round(m / 16)))
    const r2 = rng(100 + k * 17)
    for (let j = 0; j < n; j++) {
      const pa = r2() * Math.PI * 2
      const pd = Math.sqrt(r2()) * R * 0.82
      const px = CX + Math.cos(pa) * pd
      const py = CY + Math.sin(pa) * pd
      const k2 = (0.8 + r2() * 0.45).toFixed(2)
      const ang = Math.round(r2() * 360)
      s += `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${ang}) scale(${k2})">${forma}</g>`
    }
  })

  s += '</g>'

  // brilho da borda
  s += `<rect x="${CX - r + 11}" y="${CY - r + 11}" width="${L - 22}" height="${L - 22}" rx="32" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/>`
  s += '</g>'

  // fumaça
  const fumaca = Math.min(1, Math.max(0, (estado.tostagem - 5) / 5))
  if (fumaca > 0) {
    for (let f = 0; f < 3; f++) {
      const fx = 120 + f * 60
      s +=
        `<path d="M${fx} 60 q -12 -22 4 -34 q 16 -12 2 -26" stroke="rgba(255,255,255,${(0.1 + fumaca * 0.3).toFixed(2)})" ` +
        `stroke-width="${(5 + fumaca * 4).toFixed(1)}" fill="none" stroke-linecap="round"/>`
    }
  }

  return s
}

export function desenharKnob(tostagem: number): string {
  const ang = -135 + (tostagem / 10) * 270
  const cor = tostagem > 8.5 ? '#e2452a' : tostagem > 6 ? '#f2812c' : '#f2a63c'
  let s =
    `<circle cx="30" cy="30" r="24" fill="#2f3b47" stroke="${CT}" stroke-width="4"/>` +
    `<circle cx="30" cy="30" r="16" fill="#4a5a68" stroke="${CT}" stroke-width="3"/>` +
    `<g transform="rotate(${ang} 30 30)"><rect x="27.5" y="12" width="5" height="16" rx="2.5" fill="${cor}" stroke="${CT}" stroke-width="2"/></g>`
  for (let i = 0; i <= 10; i += 5) {
    const a = ((-135 + (i / 10) * 270) * Math.PI) / 180
    s += `<circle cx="${(30 + Math.sin(a) * 26).toFixed(1)}" cy="${(30 - Math.cos(a) * 26).toFixed(1)}" r="2" fill="rgba(255,255,255,.5)"/>`
  }
  return s
}

// ficha: plano U × C (cores calibradas pro papel, não reaproveita as do jogo)
const X0 = 42
const X1 = 306
const Y0 = 14
const Y1 = 178

function sx(u: number): number {
  return X0 + (Math.max(0, Math.min(0.5, u)) / 0.5) * (X1 - X0)
}

function sy(c: number): number {
  return Y1 - (Math.max(0, Math.min(10, c)) / 10) * (Y1 - Y0)
}

export function desenharPlano(resultado: Resultado): string {
  const m = resultado.metricas
  const regioes = [
    { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0, cor: '#4e8a3a', a: 0.2, t: 'no ponto', tx: sx(0.15), ty: sy(7.6) },
    { x: X0, y: sy(3), w: sx(0.45) - X0, h: Y1 - sy(3), cor: '#d89a2a', a: 0.28, t: 'murcha', tx: sx(0.18), ty: sy(1.3) },
    { x: X0, y: Y0, w: sx(0.05) - X0, h: sy(6) - Y0, cor: '#d89a2a', a: 0.28, t: null, tx: null, ty: null },
    { x: sx(0.25), y: Y0, w: sx(0.45) - sx(0.25), h: Y1 - Y0, cor: '#d89a2a', a: 0.34, t: 'molhada', tx: sx(0.35), ty: sy(8.8) },
    { x: sx(0.45), y: Y0, w: X1 - sx(0.45), h: Y1 - Y0, cor: '#c0452e', a: 0.38, t: null, tx: null, ty: null },
  ]
  let s = '<title id="planoTitulo">Posição da farofa no plano umidade por crocância</title>'
  regioes.forEach((r) => {
    s += `<rect x="${r.x}" y="${r.y}" width="${Math.max(0, r.w)}" height="${Math.max(0, r.h)}" fill="${r.cor}" opacity="${r.a}"/>`
  })
  ;[0.1, 0.2, 0.3, 0.4].forEach((u) => {
    s += `<line x1="${sx(u)}" y1="${Y0}" x2="${sx(u)}" y2="${Y1}" stroke="#b79f6e" stroke-width="1" opacity=".55"/>`
  })
  s += `<line x1="${X0}" y1="${sy(5)}" x2="${X1}" y2="${sy(5)}" stroke="#b79f6e" stroke-width="1" opacity=".55"/>`
  regioes.forEach((r) => {
    if (!r.t) return
    s += `<text x="${r.tx}" y="${r.ty}" fill="#6b5433" font-family="IBM Plex Mono, monospace" font-size="9" letter-spacing="1.3" text-anchor="middle">${r.t.toUpperCase()}</text>`
  })
  s += `<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="none" stroke="#6b5433" stroke-width="2"/>`
  ;[0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach((u) => {
    s += `<text x="${sx(u)}" y="${Y1 + 14}" fill="#85714c" font-family="IBM Plex Mono, monospace" font-size="9" text-anchor="middle">${u * 100}%</text>`
  })
  ;[0, 5, 10].forEach((c) => {
    s += `<text x="${X0 - 8}" y="${sy(c) + 3.5}" fill="#85714c" font-family="IBM Plex Mono, monospace" font-size="9" text-anchor="end">${c}</text>`
  })
  s += `<text x="${(X0 + X1) / 2}" y="${Y1 + 32}" fill="#6b5433" font-family="IBM Plex Mono, monospace" font-size="9.5" letter-spacing="1" text-anchor="middle">UMIDADE LIVRE</text>`
  s += `<text x="11" y="${(Y0 + Y1) / 2}" fill="#6b5433" font-family="IBM Plex Mono, monospace" font-size="9.5" letter-spacing="1" text-anchor="middle" transform="rotate(-90 11 ${(Y0 + Y1) / 2})">CROCÂNCIA</text>`

  const px = sx(m.U)
  const py = sy(m.C)
  s += `<line x1="${X0}" y1="${py}" x2="${px}" y2="${py}" stroke="#4a3620" stroke-width="1" stroke-dasharray="2 3" opacity=".55"/>`
  s += `<line x1="${px}" y1="${Y1}" x2="${px}" y2="${py}" stroke="#4a3620" stroke-width="1" stroke-dasharray="2 3" opacity=".55"/>`
  s += `<circle cx="${px}" cy="${py}" r="7.5" fill="#f3e3be"/>`
  s += `<circle cx="${px}" cy="${py}" r="5" fill="#c0452e" stroke="#4a3620" stroke-width="2"/>`
  return s
}

export function desenharBarras(resultado: Resultado): string {
  const m = resultado.metricas
  const defs = [
    { rot: 'Gordura / farinha', v: m.G, min: 0.25, max: 0.4, escala: 0.7, texto: pct(m.G), faixa: resultado.faixas.G },
    { rot: 'Umidade livre', v: m.U, min: 0.08, max: 0.2, escala: 0.5, texto: pct(m.U), faixa: resultado.faixas.U },
    { rot: 'Sal / peso', v: m.S, min: 0.008, max: 0.012, escala: 0.022, texto: pct1(m.S), faixa: resultado.faixas.S },
  ]
  let s = ''
  defs.forEach((d) => {
    const esq = Math.min(100, (d.min / d.escala) * 100)
    const larg = Math.min(100 - esq, ((d.max - d.min) / d.escala) * 100)
    const pos = Math.max(0, Math.min(100, (d.v / d.escala) * 100))
    const corFaixa = d.faixa === 'ideal' ? '#4e8a3a' : '#a8720f'
    s +=
      '<div style="margin-bottom:11px">' +
      '<div style="display:flex;justify-content:space-between;font-family:\'IBM Plex Mono\',monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#85714c;margin-bottom:4px">' +
      `<span>${d.rot}</span><span style="color:${corFaixa};font-weight:600">${d.texto} · ${d.faixa}</span></div>` +
      '<div style="position:relative;height:9px;background:#e2cfa2;border:2px solid #6b5433;border-radius:5px;overflow:hidden">' +
      `<div style="position:absolute;top:0;bottom:0;left:${esq}%;width:${larg}%;background:#7fb35f"></div>` +
      `<div style="position:absolute;top:-2px;bottom:-2px;left:calc(${pos}% - 2px);width:4px;background:#4a3620;border-radius:2px"></div>` +
      '</div></div>'
  })
  return s
}

export function desenharMedidores(resultado: Resultado): string {
  const m = resultado.metricas
  const defs = [
    { rot: 'Gordura', v: m.G, min: 0.25, max: 0.4, escala: 0.7, texto: pct(m.G) },
    { rot: 'Umidade', v: m.U, min: 0.08, max: 0.2, escala: 0.5, texto: pct(m.U) },
    { rot: 'Sal', v: m.S, min: 0.008, max: 0.012, escala: 0.022, texto: pct1(m.S) },
  ]
  let s = ''
  defs.forEach((d) => {
    const esq = Math.min(100, (d.min / d.escala) * 100)
    const larg = Math.min(100 - esq, ((d.max - d.min) / d.escala) * 100)
    const pos = Math.max(0, Math.min(100, (d.v / d.escala) * 100))
    s +=
      `<div><div class="medidor-topo"><span>${d.rot}</span><span class="v">${d.texto}</span></div>` +
      `<div class="trilha"><div class="zona" style="left:${esq}%;width:${larg}%"></div>` +
      `<div class="marcador" style="left:calc(${pos}% - 3px)"></div></div></div>`
  })
  let pips = ''
  for (let i = 0; i < 5; i++) pips += `<div class="pip${m.C >= (i + 1) * 2 - 1 ? ' on' : ''}"></div>`
  s +=
    `<div><div class="medidor-topo"><span>Crocância</span><span class="v">${m.C.toFixed(1).replace('.', ',')} / 10</span></div>` +
    `<div class="croc-pips">${pips}</div></div>`
  return s
}
