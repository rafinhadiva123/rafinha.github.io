// Quadro branco da sala: o "Quadrão do PDCA", seis painéis desenhados em SVG
// lado a lado e rasterizados uma vez num canvas, que vira textura na cena.
// Os desenhos são os do protótipo do quadro, parados num quadro só (a textura
// não anima). As fontes vão embutidas no SVG em data: URL, porque uma imagem
// SVG não enxerga as fontes carregadas na página.
import marcadorUrl from '@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff2?url'
import maoUrl from '@fontsource/caveat/files/caveat-latin-500-normal.woff2?url'

const TINTA = '#23262B'
const ROXO = '#7A48B8'

/* coordenadas do quadro: 6 painéis de 560; a altura segue a proporção da
   superfície na cena (7,4 m × 1,34 m) */
const LARG_PAINEL = 560
const MARGEM = 24
const W = LARG_PAINEL * 6
const H = Math.round((W * 1.34) / 7.4)

const PAINEIS = [
  {
    titulo: ['Roda sobe, calço segura'],
    tag: 'kaizen · SDCA · kaikaku',
    vb: [500, 400],
    corpo: `
    <g filter="url(#m)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 370 H130 V300 H240 V230 H330" stroke="#1F5FBF" stroke-width="7"/>
      <path d="M130 370 L130 300 L95 370 Z M240 300 L240 230 L205 300 Z" fill="#2B8A55" stroke="#2B8A55" stroke-width="2"/>
      <path d="M330 230 C380 230 380 80 440 80" stroke="#D2372C" stroke-width="5" stroke-dasharray="10 9"/>
    </g>
    <g transform="translate(185 276) rotate(20)"><circle r="24" fill="#fff" stroke="#1F5FBF" stroke-width="4"/><path d="M-24 0H24M0 -24V24" stroke="#1F5FBF" stroke-width="3"/></g>
    <g filter="url(#m)">
      <path d="M440 20 C465 40 470 70 462 95 H418 C410 70 415 40 440 20 Z" fill="#fff" stroke="#23262B" stroke-width="4"/>
      <circle cx="440" cy="58" r="9" fill="#1F5FBF"/>
      <path d="M418 95 L404 112 L424 100 M462 95 L476 112 L456 100" fill="#D2372C" stroke="#23262B" stroke-width="3"/>
      <path d="M428 100 Q440 150 452 100" fill="#E0861A"/>
    </g>
    <text x="330" y="40" font-size="30" class="mk" style="fill:#D2372C" transform="rotate(-8 330 40)">KAIKAKU!</text>
    <text x="60" y="394" font-size="22" style="fill:#2B8A55">SDCA segura</text>
    <text x="30" y="250" font-size="24" style="fill:#1F5FBF">PDCA sobe ↗</text>`,
  },
  {
    titulo: ['A cobra das 8 etapas'],
    tag: 'as 4 primeiras = P',
    vb: [500, 430],
    corpo: `
    <rect x="18" y="30" width="470" height="170" rx="30" fill="none" stroke="#1F5FBF" stroke-width="3" stroke-dasharray="14 10"/>
    <g filter="url(#m)" fill="none" stroke-linecap="round">
      <path d="M40 70 H420 C490 70 490 170 420 170 H80 C10 170 10 270 80 270 H420 C490 270 490 370 420 370 H140" stroke="#2B8A55" stroke-width="38"/>
      <path d="M40 70 H420 C490 70 490 170 420 170 H80 C10 170 10 270 80 270 H420 C490 270 490 370 420 370 H140" stroke="#9FD9B4" stroke-width="10" stroke-dasharray="4 16"/>
      <ellipse cx="118" cy="370" rx="36" ry="28" fill="#2B8A55" stroke="#23262B" stroke-width="3"/>
      <path d="M84 370 H58 M58 370 l-10 -8 M58 370 l-10 8" stroke="#D2372C" stroke-width="4"/>
    </g>
    <circle cx="112" cy="358" r="7" fill="#fff"/><circle cx="110" cy="357" r="3" fill="#23262B"/>
    <g font-size="17" text-anchor="middle">
      <g class="mk" font-size="20">
        <circle cx="80" cy="70" r="18" fill="#1F5FBF"/><text x="80" y="77" style="fill:#fff">1</text>
        <circle cx="300" cy="70" r="18" fill="#1F5FBF"/><text x="300" y="77" style="fill:#fff">2</text>
        <circle cx="400" cy="170" r="18" fill="#1F5FBF"/><text x="400" y="177" style="fill:#fff">3</text>
        <circle cx="170" cy="170" r="18" fill="#1F5FBF"/><text x="170" y="177" style="fill:#fff">4</text>
        <circle cx="100" cy="270" r="18" fill="#23262B"/><text x="100" y="277" style="fill:#fff">5</text>
        <circle cx="330" cy="270" r="18" fill="#E0861A"/><text x="330" y="277" style="fill:#fff">6</text>
        <circle cx="420" cy="370" r="18" fill="#D2372C"/><text x="420" y="377" style="fill:#fff">7</text>
        <circle cx="250" cy="370" r="18" fill="#D2372C"/><text x="250" y="377" style="fill:#fff">8</text>
      </g>
      <text x="80" y="112">identificar</text><text x="300" y="112">fenômeno</text><text x="400" y="212">processo</text><text x="170" y="212">plano</text>
      <text x="100" y="312">executar</text><text x="330" y="312">verificar</text><text x="420" y="412">padronizar</text><text x="250" y="412">concluir</text>
    </g>
    <text x="480" y="22" font-size="28" class="mk" text-anchor="end" style="fill:#1F5FBF">P = metade</text>`,
  },
  {
    titulo: ['Coma a baleia em pedaços'],
    tag: 'Análise de Fenômeno',
    vb: [520, 400],
    corpo: `
    <g filter="url(#m)" stroke="#23262B" stroke-width="4" stroke-linejoin="round">
      <path d="M40 230 C40 130 190 100 310 120 C390 135 430 180 440 210 L495 160 L485 240 L505 310 L440 255 C410 305 320 325 210 318 C110 312 40 290 40 230 Z" fill="#6FA8DC"/>
      <path d="M60 260 C140 300 300 305 420 260" fill="none" stroke-width="3"/>
      <path d="M160 120 V330 M270 115 V325 M370 140 V300" stroke="#D2372C" stroke-width="3" stroke-dasharray="8 7" fill="none"/>
      <path d="M130 95 C120 60 100 50 85 55 M130 95 C135 55 150 40 165 45 M130 95 V45" fill="none" stroke="#1F5FBF" stroke-width="4"/>
    </g>
    <circle cx="90" cy="205" r="8" fill="#fff" stroke="#23262B" stroke-width="3"/><circle cx="92" cy="206" r="3" fill="#23262B"/>
    <path d="M50 245 q20 12 40 2" fill="none" stroke="#23262B" stroke-width="3"/>
    <g font-size="21" text-anchor="middle" class="mk"><text x="215" y="210">sequencial</text><text x="320" y="200">Pareto</text><text x="400" y="225" font-size="18">árvore</text></g>
    <g filter="url(#m)" stroke="#23262B" stroke-width="4" fill="none" stroke-linecap="round">
      <path d="M60 380 V330 M50 330 V350 M70 330 V350 M50 350 H70"/>
      <path d="M470 380 V330 C490 335 490 355 470 355"/>
    </g>
    <text x="260" y="385" font-size="24" text-anchor="middle" style="fill:#D2372C">validar os dados primeiro</text>`,
  },
  {
    titulo: ['O peixe dos 6M'],
    tag: 'Ishikawa + 5 porquês',
    vb: [540, 380],
    corpo: `
    <g filter="url(#m)" stroke="#23262B" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M20 120 L80 190 L20 260 Z" fill="#E0861A"/>
      <path d="M80 190 H410" stroke-width="6" fill="none"/>
      <path d="M130 90 L180 190 M240 90 L290 190 M350 90 L400 190 M130 290 L180 190 M240 290 L290 190 M350 290 L400 190" fill="none"/>
      <path d="M410 100 C500 110 530 175 530 190 C530 205 500 270 410 280 Z" fill="#FFE97A"/>
      <path d="M450 110 C430 150 430 230 450 270" fill="none" stroke-width="3"/>
    </g>
    <circle cx="490" cy="165" r="9" fill="#fff" stroke="#23262B" stroke-width="3"/><circle cx="492" cy="166" r="4" fill="#23262B"/>
    <g fill="none" stroke="#1F5FBF" stroke-width="2.5"><circle cx="520" cy="80" r="8"/><circle cx="505" cy="50" r="11"/><circle cx="525" cy="18" r="6"/></g>
    <g font-size="20" text-anchor="middle"><text x="130" y="80">Método</text><text x="240" y="80">Mão de obra</text><text x="350" y="80">Material</text>
      <text x="130" y="314">Máquina</text><text x="240" y="314">Medidas</text><text x="350" y="314">Meio ambiente</text></g>
    <text x="485" y="215" font-size="22" class="mk" text-anchor="middle">efeito</text>
    <text x="20" y="364" font-size="22" style="fill:#7A48B8">por quê? por quê? por quê? por quê?<tspan class="mk" dx="8" style="fill:#D2372C">e mais um!</tspan></text>`,
  },
  {
    titulo: ['A montanha-russa', 'volta pro começo'],
    tag: 'crônica vira projeto',
    vb: [520, 400],
    corpo: `
    <g filter="url(#m)" fill="none" stroke-linecap="round">
      <path d="M30 330 C90 330 90 120 160 120 C230 120 220 300 300 300 C380 300 390 130 340 130 C290 130 300 290 380 290 C440 290 470 200 490 330" stroke="#1F5FBF" stroke-width="7"/>
      <path d="M490 330 C400 380 120 380 30 330" stroke="#D2372C" stroke-width="5" stroke-dasharray="12 9" marker-end="url(#ahr)"/>
      <path d="M160 125 V330 M300 305 V340 M110 200 V335 M220 200 V330 M430 250 V330" stroke="#C9CFD4" stroke-width="4"/>
    </g>
    <g transform="translate(160 116)">
      <rect x="-22" y="-24" width="44" height="22" rx="5" fill="#E0861A" stroke="#23262B" stroke-width="3"/>
      <circle cx="-12" cy="0" r="6" fill="#23262B"/><circle cx="12" cy="0" r="6" fill="#23262B"/>
      <circle cx="0" cy="-32" r="8" fill="#FFE0B8" stroke="#23262B" stroke-width="2"/>
      <path d="M-6 -40 L-14 -54 M6 -40 L14 -54" stroke="#23262B" stroke-width="3"/>
    </g>
    <g font-size="20" text-anchor="middle">
      <text x="60" y="230">DRE</text><text x="214" y="104">meta</text><text x="265" y="245">PDCA</text><text x="340" y="112">padrão</text><text x="410" y="265">DTO</text><text x="495" y="300">FCA</text>
    </g>
    <text x="260" y="396" font-size="26" class="mk" text-anchor="middle" style="fill:#D2372C">crônica? de novo!</text>
    <g fill="#E0861A"><use href="#star" x="330" y="160" width="30" height="30"/></g>`,
  },
]

/* painel de abertura: a roda PDCA e o lema */
function painelTitulo() {
  const lw = 408
  const lh = Math.round((lw * 470) / 480)
  return `
  <svg x="${MARGEM + (LARG_PAINEL - 2 * MARGEM - lw) / 2}" y="8" width="${lw}" height="${lh}" viewBox="0 0 480 470" overflow="visible">
    <g transform="rotate(-12 240 240)"><g filter="url(#m)">
      <path d="M240 240 L240 60 A180 180 0 0 1 420 240 Z" fill="#1F5FBF"/>
      <path d="M240 240 L420 240 A180 180 0 0 1 240 420 Z" fill="#2B8A55"/>
      <path d="M240 240 L240 420 A180 180 0 0 1 60 240 Z" fill="#E0861A"/>
      <path d="M240 240 L60 240 A180 180 0 0 1 240 60 Z" fill="#D2372C"/>
      <circle cx="240" cy="240" r="180" fill="none" stroke="#23262B" stroke-width="5"/>
      <circle cx="240" cy="240" r="46" fill="#F6F7F4" stroke="#23262B" stroke-width="4"/>
    </g>
      <g class="mk" font-size="64" text-anchor="middle"><text x="310" y="190" style="fill:#fff">P</text><text x="310" y="330" style="fill:#fff">D</text><text x="170" y="330" style="fill:#fff">C</text><text x="170" y="190" style="fill:#fff">A</text></g>
    </g>
    <g fill="#E0861A"><use href="#star" x="10" y="10" width="36" height="36"/><use href="#star" x="420" y="400" width="44" height="44"/><use href="#star" x="430" y="20" width="26" height="26"/></g>
    <path d="M20 440 q30 -30 60 0 t60 0 t60 0" fill="none" stroke="#7A48B8" stroke-width="4" stroke-dasharray="14 10"/>
  </svg>
  <g class="mk" font-size="50" fill="#1F5FBF">
    <text x="${MARGEM}" y="${lh + 64}" style="fill:#1F5FBF">Gerenciar =</text>
    <text x="${MARGEM}" y="${lh + 122}"><tspan style="fill:#D2372C">melhorar</tspan><tspan style="fill:#1F5FBF"> + manter</tspan></text>
  </g>`
}

function painel(p) {
  const largura = LARG_PAINEL - 2 * MARGEM
  let y = 56
  let s = p.titulo
    .map((linha, k) => `<text class="mk" x="${MARGEM}" y="${y + k * 36}" font-size="32">${linha}</text>`)
    .join('')
  y += (p.titulo.length - 1) * 36 + 30
  s += `<text x="${MARGEM}" y="${y}" font-size="22" style="fill:${ROXO}">${p.tag}</text>`
  y += 14

  /* o desenho ocupa a largura do painel, ou encolhe se não couber na altura */
  const [vw, vh] = p.vb
  const escala = Math.min(largura / vw, (H - 14 - y) / vh)
  const dw = vw * escala
  const dh = vh * escala
  s += `<svg x="${MARGEM + (largura - dw) / 2}" y="${y}" width="${dw}" height="${dh}" viewBox="0 0 ${vw} ${vh}" overflow="visible">${p.corpo}</svg>`
  return s
}

async function comoDataUrl(url) {
  const blob = await (await fetch(url)).blob()
  return new Promise((ok, erro) => {
    const leitor = new FileReader()
    leitor.onload = () => ok(leitor.result)
    leitor.onerror = erro
    leitor.readAsDataURL(blob)
  })
}

async function montarSvg(larguraPx, alturaPx) {
  /* sem as fontes o quadro ainda sai, só com letra de sistema */
  const [marcador, mao] = await Promise.all([comoDataUrl(marcadorUrl), comoDataUrl(maoUrl)]).catch(() => [null, null])
  const fontes = marcador && mao
    ? `@font-face{font-family:"Permanent Marker";src:url(${marcador}) format("woff2")}
       @font-face{font-family:"Caveat";src:url(${mao}) format("woff2")}`
    : ''

  const paineis = [painelTitulo(), ...PAINEIS.map(painel)]
    .map((conteudo, i) => {
      const sep = i > 0
        ? `<line x1="0" y1="20" x2="0" y2="${H - 20}" stroke="#E3E7E2" stroke-width="3" stroke-dasharray="10 8"/>`
        : ''
      return `<g transform="translate(${i * LARG_PAINEL} 0)">${sep}${conteudo}</g>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${larguraPx}" height="${alturaPx}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
  <style>${fontes}
    text{font-family:"Caveat","Comic Sans MS",cursive;fill:${TINTA}}
    .mk,.mk text{font-family:"Permanent Marker","Caveat","Comic Sans MS",cursive}
  </style>
  <defs>
    <filter id="m" x="-25%" y="-25%" width="150%" height="150%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter>
    <marker id="ahr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#D2372C"/></marker>
    <symbol id="star" viewBox="-10 -10 20 20"><path d="M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2 Z"/></symbol>
    <pattern id="grade" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0 V28 M0 28 H28" fill="none" stroke="#E3E7E2" stroke-width="1"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#F6F7F4"/>
  <rect width="${W}" height="${H}" fill="url(#grade)"/>
  ${paineis}
</svg>`
}

/* o SVG vira bitmap uma vez só; a cena é remontada a cada troca de tema */
let pronto = null

function rasterizar(larguraPx, alturaPx) {
  pronto ??= montarSvg(larguraPx, alturaPx).then(async (svg) => {
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = larguraPx
    cv.height = alturaPx
    cv.getContext('2d').drawImage(img, 0, 0, larguraPx, alturaPx)
    return cv
  })
  return pronto
}

/* pinta o fundo na hora e o quadro completo quando ficar pronto */
export function desenharQuadro(cv) {
  const x = cv.getContext('2d')
  x.fillStyle = '#F6F7F4'
  x.fillRect(0, 0, cv.width, cv.height)
  return rasterizar(cv.width, cv.height).then((pintado) => {
    x.drawImage(pintado, 0, 0)
  })
}
