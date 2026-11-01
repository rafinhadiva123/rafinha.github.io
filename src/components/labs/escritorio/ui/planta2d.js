// Versão sem 3D do Simulador de escritório: a planta vista de cima, em SVG.
// Para quem não tem WebGL, tem aparelho fraco ou prefere assim. Usa o mesmo
// núcleo (ui/nucleo.js), o mesmo editor e a mesma busca do 3D, então sentar,
// conflito, atualização ao vivo e erros são iguais. Não importa three.
//
// Cada cadeira é um botão (role="button"), com o apelido de quem senta ali.
// Teclado: Tab entra na planta, as setas vão para a cadeira mais próxima
// naquela direção, Enter ou espaço senta (cadeira livre) ou diz quem está ali.
// Só uma cadeira por vez fica na ordem do Tab (tabindex móvel), para quem usa
// teclado não ter de passar por 511 botões.
import { LUGARES, LUGAR, nomeDaArea } from '../planta/lugares.js';
import { BANCADAS, BANCADA, AREAS, ANDAR } from '../planta/dados.js';
import { FIXOS } from '../planta/fixos.js';
import { criarNucleo } from './nucleo.js';
import { criarBusca } from './busca.js';
import { abrirEditor } from './editor.js';

const SVG = 'http://www.w3.org/2000/svg';
const FIXO = new Set(FIXOS.map(f => f.lugar));
const peso = o => (o.previa ? 0 : FIXO.has(o.lugar) ? 1 : 2);   /* só os fixos trazem .lugar */
const MARGEM = 1.2;                       /* metros em volta da planta */
const ESCALAS = [10, 14, 19, 26];         /* pixels por metro */
const R_CADEIRA = 0.5;
const R_TOQUE = 0.7;                      /* área de toque (as cadeiras ficam a 1,4 m) */
const MAX_ROTULO = 10;
const FONTE = 0.5;                        /* altura do nome, em metros */
const LETRA = 0.3;                        /* largura média de uma letra, em metros */

/* limites do desenho: o andar, a recepção e a sala executiva */
export const LIMITES = (() => {
  let x0 = 0, z0 = ANDAR.norte, x1 = ANDAR.largura, z1 = 41.6;
  for (const a of AREAS) { x0 = Math.min(x0, a.r[0]); z0 = Math.min(z0, a.r[1]); x1 = Math.max(x1, a.r[2]); z1 = Math.max(z1, a.r[3]); }
  for (const l of LUGARES) { x0 = Math.min(x0, l.x); z0 = Math.min(z0, l.z); x1 = Math.max(x1, l.x); z1 = Math.max(z1, l.z); }
  /* em cima sobra mais: os nomes da primeira fileira da zona leste sobem */
  return { x0: x0 - MARGEM, z0: z0 - MARGEM - 2, x1: x1 + MARGEM, z1: z1 + MARGEM };
})();

/**
 * A cadeira mais próxima de `de` na direção (dx, dz), ou null. Pura.
 * Prefere quem está bem na direção: o desvio lateral pesa o dobro.
 */
export function vizinhaNaDirecao(de, dx, dz, lugares = LUGARES) {
  const a = LUGAR.get(de) || lugares.find(l => l.id === de);
  if (!a) return null;
  let melhor = null, nota = Infinity;
  for (const l of lugares) {
    if (l.id === a.id) continue;
    const vx = l.x - a.x, vz = l.z - a.z;
    const frente = vx * dx + vz * dz;
    if (frente <= 0.05) continue;
    const lado = Math.abs(vx * dz - vz * dx);
    if (lado > frente * 2.5) continue;      /* fora do cone de ~70° */
    const n = frente + lado * 2;
    if (n < nota) { nota = n; melhor = l.id; }
  }
  return melhor;
}

/** Rótulo curto para caber na planta (o apelido inteiro vai no aria-label). */
export const rotuloCurto = (apelido, max = MAX_ROTULO) => ([...apelido].length > max ? [...apelido].slice(0, max - 1).join('') + '…' : apelido);

/**
 * Onde fica o nome de quem senta: atrás da cadeira, no corredor. As duas
 * fileiras que se olham pelo corredor ficam desencontradas (uma um pouco para
 * cada lado), assim os nomes não se encavalam com o escritório cheio. Pura.
 * @returns {x, z, ang, ancora} relativo ao centro da cadeira
 */
export function posicaoDoRotulo(l) {
  if (!l.zona) return { x: 0.75, z: 0, ang: 0, ancora: 'start' };   /* avulsa: à direita */
  const fx = Math.sin(l.giro), fz = Math.cos(l.giro);
  if (Math.abs(fz) > 0.5) {
    /* bancada leste-oeste: nome em pé, subindo (lado norte) ou descendo (lado sul) */
    return { x: fz > 0 ? -0.3 : 0.3, z: -fz * 0.75, ang: fz > 0 ? -90 : 90, ancora: 'start' };
  }
  /* bancada norte-sul: nome deitado, para a esquerda (lado oeste) ou direita (leste) */
  return { x: -fx * 0.75, z: fx > 0 ? -0.3 : 0.3, ang: 0, ancora: fx > 0 ? 'end' : 'start' };
}

/** O que o leitor de tela fala sobre a cadeira. Pura. */
export function descreverCadeira(id, ocupante, ocupantes) {
  const area = nomeDaArea(id);
  const onde = area ? ` na ${area}` : '';
  if (ocupante) return ocupante.previa ? `Sua prévia${onde}: ${ocupante.apelido || 'sem apelido ainda'}` : `${ocupante.apelido}${onde}`;
  /* sem zona nem número na tela: a referência é quem está perto */
  const l = LUGAR.get(id);
  let perto = null, d = 4.5;
  for (const [lid, o] of ocupantes) {
    if (o.previa) continue;
    const m = LUGAR.get(lid);
    const e = m ? Math.hypot(m.x - l.x, m.z - l.z) : Infinity;
    if (e < d) { d = e; perto = o.apelido; }
  }
  return `Cadeira livre${onde}${perto ? `, perto de ${perto}` : ''}. Enter para sentar.`;
}

/** Retângulo [x0, z0, x1, z1] (metros) que o nome ocupa na planta. Pura. */
export function caixaDoRotulo(l, texto) {
  const r = posicaoDoRotulo(l);
  const comp = [...texto].length * LETRA, meia = FONTE * 0.55;
  const cx = l.x + r.x, cz = l.z + r.z;
  if (r.ang === 0) {
    const a = r.ancora === 'start' ? cx : cx - comp;
    return [a, cz - meia, a + comp, cz + meia];
  }
  const a = r.ang < 0 ? cz - comp : cz;   /* -90 sobe, 90 desce */
  return [cx - meia, a, cx + meia, a + comp];
}

const cruza = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * Quais nomes aparecem escritos na planta: na ordem dada (os 15 de sempre
 * primeiro), cada nome entra se não cobre outra pessoa nem outro nome. Quem
 * fica de fora aparece no balão (mouse, toque, foco, busca). Pura.
 * @param itens [{id, texto}]
 * @returns Set de ids com nome escrito
 */
export function escolherRotulos(itens) {
  const R = R_CADEIRA * 0.9;
  const corpos = itens.map(({ id }) => { const l = LUGAR.get(id); return l ? [id, [l.x - R, l.z - R, l.x + R, l.z + R]] : null; }).filter(Boolean);
  const postas = [];
  const sim = new Set();
  for (const { id, texto } of itens) {
    const l = LUGAR.get(id);
    if (!l || !texto) continue;
    const c = caixaDoRotulo(l, texto);
    if (postas.some(p => cruza(p, c))) continue;
    if (corpos.some(([outro, q]) => outro !== id && cruza(q, c))) continue;
    postas.push(c);
    sim.add(id);
  }
  return sim;
}

function no(tag, attrs = {}, pai = null) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (pai) pai.appendChild(e);
  return e;
}

/** A planta em SVG, com a mesma interface que o núcleo espera do andar em 3D. */
export function criarPlanta(palco) {
  const reduz = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { x0, z0, x1, z1 } = LIMITES;
  const W = x1 - x0, H = z1 - z0;
  palco.classList.add('p2');

  const rolagem = document.createElement('div');
  rolagem.className = 'p2-rolagem';
  rolagem.tabIndex = -1;   /* sem parada extra no Tab: as setas já levam a planta junto */
  const ajuda = document.createElement('p');
  ajuda.id = 'p2-ajuda';
  ajuda.className = 'p2-so-leitor';
  ajuda.textContent = 'Planta do escritório vista de cima. Use as setas para ir de uma cadeira a outra e Enter para sentar numa cadeira livre.';
  const svg = no('svg', { class: 'p2-svg', viewBox: `${x0} ${z0} ${W} ${H}`, role: 'group', 'aria-label': 'Planta do escritório', 'aria-describedby': 'p2-ajuda' });
  rolagem.append(ajuda, svg);
  /* depois da busca na ordem do Tab (ela aparece em cima da planta) */
  const depoisDaBusca = palco.querySelector(':scope > .ed-raiz');
  if (depoisDaBusca) palco.insertBefore(rolagem, depoisDaBusca); else palco.prepend(rolagem);

  /* chão, áreas e bancadas: desenhados uma vez */
  const fundo = no('g', { class: 'p2-fundo', 'aria-hidden': 'true' }, svg);
  no('rect', { class: 'p2-piso', x: 0, y: ANDAR.norte, width: ANDAR.largura, height: 41.6 - ANDAR.norte }, fundo);
  for (const a of AREAS) {
    const [ax0, az0, ax1, az1] = a.r;
    const largura = ax1 - ax0, altura = az1 - az0;
    no('rect', { class: ax0 < 0 ? 'p2-piso' : 'p2-area', x: ax0, y: az0, width: largura, height: altura }, fundo);
    if (largura >= 6 && altura >= 3) {
      const t = no('text', { class: 'p2-nome-area', x: ax0 + largura / 2, y: az0 + Math.min(1.3, altura / 2), 'text-anchor': 'middle' }, fundo);
      t.textContent = a.nome;
    }
  }
  for (const b of BANCADAS) {
    const comp = b.lugares * BANCADA.passo, prof = BANCADA.profundidade;
    const [w, h] = b.eixo === 'z' ? [prof, comp] : [comp, prof];
    no('rect', { class: 'p2-bancada', x: b.x - w / 2, y: b.z - h / 2, width: w, height: h, rx: 0.15 }, fundo);
  }

  /* cadeiras */
  const camada = no('g', { class: 'p2-cadeiras', tabindex: -1 }, svg);   /* o grupo não entra no Tab; só a cadeira atual */
  const anel = no('circle', { class: 'p2-anel', r: R_CADEIRA + 0.28, cx: -999, cy: -999, 'aria-hidden': 'true' }, svg);
  /* nome inteiro de quem está na cadeira escolhida (busca, clique, teclado) */
  const balao = no('text', { class: 'p2-balao', 'aria-hidden': 'true', 'text-anchor': 'middle', x: -999, y: -999 }, svg);
  function mostrarBalao(id) {
    const o = id && ocupantes.get(id), l = id && LUGAR.get(id);
    if (!o || !l || !o.apelido) { balao.setAttribute('x', '-999'); balao.setAttribute('y', '-999'); return; }
    balao.textContent = o.apelido;
    balao.setAttribute('x', String(l.x));
    balao.setAttribute('y', String(l.z - 1.05));
    svg.appendChild(balao);
  }
  const cadeiras = new Map();
  for (const l of LUGARES) {
    const g = no('g', { class: 'p2-cad livre', role: 'button', tabindex: -1, 'data-lugar': l.id, transform: `translate(${l.x} ${l.z})` }, camada);
    no('circle', { class: 'p2-toque', r: R_TOQUE }, g);
    const corpo = no('circle', { class: 'p2-corpo', r: R_CADEIRA }, g);
    const cabeca = no('circle', { class: 'p2-cabeca', r: 0.25 }, g);
    const mais = no('path', { class: 'p2-mais', d: 'M-.22 0H.22M0 -.22V.22' }, g);
    const r = posicaoDoRotulo(l);
    const texto = no('text', {
      class: 'p2-rotulo', 'aria-hidden': 'true', 'text-anchor': r.ancora, 'dominant-baseline': 'central',
      transform: `translate(${r.x} ${r.z}) rotate(${r.ang})`,
    }, g);
    const dica = no('title', {}, g);   /* nome inteiro ao passar o mouse */
    dica.textContent = 'Cadeira livre';
    cadeiras.set(l.id, { g, corpo, cabeca, mais, texto, dica });
  }

  let ocupantes = new Map();
  let atual = FIXOS[0].lugar;          /* a cadeira que fica no Tab */
  let selecionada = null;
  let escala = ESCALAS[typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches ? 2 : 1];
  let aoAtivar = () => {};

  function aplicarEscala(manter = true) {
    const cx = rolagem.scrollLeft + rolagem.clientWidth / 2, cy = rolagem.scrollTop + rolagem.clientHeight / 2;
    const antes = svg.getBoundingClientRect().width || W * escala;
    svg.setAttribute('width', String(Math.round(W * escala)));
    svg.setAttribute('height', String(Math.round(H * escala)));
    if (manter && antes) {
      const k = (W * escala) / antes;
      rolagem.scrollLeft = cx * k - rolagem.clientWidth / 2;
      rolagem.scrollTop = cy * k - rolagem.clientHeight / 2;
    }
  }
  aplicarEscala(false);

  /* centro da cadeira na área rolável, em pixels */
  /* (o SVG tem 12 px de folga à esquerda e 56 px em cima, para a busca) */
  const pixel = l => ({ x: (l.x - x0) * escala + 12, y: (l.z - z0) * escala + 56 });

  function centrar(id, painel, suave = !reduz) {
    const l = LUGAR.get(id);
    if (!l) return;
    const p = pixel(l);
    const vw = rolagem.clientWidth * (painel === 'direita' ? 0.56 : 1);
    const vh = rolagem.clientHeight * (painel === 'baixo' ? 0.38 : 1);
    rolagem.scrollTo({ left: p.x - vw / 2, top: p.y - vh / 2, behavior: suave ? 'smooth' : 'auto' });
  }

  function rotular(id) {
    const c = cadeiras.get(id);
    if (c) c.g.setAttribute('aria-label', descreverCadeira(id, ocupantes.get(id), ocupantes));
  }

  function moverFoco(id) {
    if (!cadeiras.has(id)) return;
    cadeiras.get(atual)?.g.setAttribute('tabindex', '-1');
    atual = id;
    const c = cadeiras.get(id);
    c.g.setAttribute('tabindex', '0');
    rotular(id);
    c.g.focus({ preventScroll: true });
    /* traz para a vista só se saiu dela */
    const r = c.g.getBoundingClientRect(), v = rolagem.getBoundingClientRect();
    if (r.left < v.left + 8 || r.right > v.right - 8 || r.top < v.top + 56 || r.bottom > v.bottom - 8) centrar(id, null);
  }

  const DIRECOES = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  camada.addEventListener('keydown', e => {
    const d = DIRECOES[e.key];
    if (d) {
      e.preventDefault();
      const prox = vizinhaNaDirecao(atual, d[0], d[1]);
      if (prox) moverFoco(prox);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      aoAtivar(atual);
    }
  });
  camada.addEventListener('focusin', e => {
    const g = e.target.closest && e.target.closest('.p2-cad');
    if (g) { rotular(g.dataset.lugar); mostrarBalao(g.dataset.lugar); }
  });
  camada.addEventListener('focusout', () => mostrarBalao(selecionada));
  camada.addEventListener('pointerover', e => {
    const g = e.target.closest && e.target.closest('.p2-cad.ocupada');
    if (g && e.pointerType === 'mouse') mostrarBalao(g.dataset.lugar);
  });
  camada.addEventListener('pointerleave', () => mostrarBalao(selecionada));
  camada.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('.p2-cad');
    if (!g) return;
    const id = g.dataset.lugar;
    cadeiras.get(atual)?.g.setAttribute('tabindex', '-1');
    atual = id;
    g.setAttribute('tabindex', '0');
    aoAtivar(id);
  });
  cadeiras.get(atual).g.setAttribute('tabindex', '0');

  /* zoom: − e + no canto */
  const zoom = document.createElement('div');
  zoom.className = 'p2-zoom';
  zoom.setAttribute('role', 'group');
  zoom.setAttribute('aria-label', 'Zoom da planta');
  const btn = (rot, texto, passo) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', rot);
    b.title = rot;
    b.textContent = texto;
    b.addEventListener('click', () => {
      const k = Math.max(0, Math.min(ESCALAS.length - 1, ESCALAS.indexOf(escala) + passo));
      escala = ESCALAS[k];
      aplicarEscala();
      menos.disabled = k === 0;
      maisZoom.disabled = k === ESCALAS.length - 1;
    });
    zoom.appendChild(b);
    return b;
  };
  const menos = btn('Afastar', '−', -1);
  const maisZoom = btn('Aproximar', '+', 1);
  palco.appendChild(zoom);

  /* começa olhando para onde estão os 15 de sempre */
  const cx = FIXOS.reduce((s, f) => s + LUGAR.get(f.lugar).x, 0) / FIXOS.length;
  const cz = FIXOS.reduce((s, f) => s + LUGAR.get(f.lugar).z, 0) / FIXOS.length;
  requestAnimationFrame(() => {
    rolagem.scrollLeft = (cx - x0) * escala - rolagem.clientWidth / 2;
    rolagem.scrollTop = (cz - z0) * escala - rolagem.clientHeight / 2;
  });

  return {
    renderer: null,
    /** Map(idDoLugar -> personagem) */
    definirOcupantes(mapa) {
      ocupantes = mapa;
      const textos = new Map();
      for (const [id, o] of mapa) textos.set(id, rotuloCurto(o.apelido || '…', LUGAR.get(id) && LUGAR.get(id).zona ? MAX_ROTULO : 14));
      /* os 15 de sempre e a prévia têm preferência pelo nome escrito */
      const ordem = [...mapa.keys()].sort((a, b) => peso(mapa.get(a)) - peso(mapa.get(b)));
      const escritos = escolherRotulos(ordem.map(id => ({ id, texto: textos.get(id) })));
      for (const [id, c] of cadeiras) {
        const o = mapa.get(id);
        if (!o) {
          if (c.g.classList.contains('livre') && !c.texto.textContent) continue;
          c.g.setAttribute('class', 'p2-cad livre');
          c.corpo.removeAttribute('style');
          c.cabeca.removeAttribute('style');
          c.texto.textContent = '';
          c.dica.textContent = 'Cadeira livre';
          c.g.removeAttribute('aria-label');
          continue;
        }
        c.g.setAttribute('class', `p2-cad ocupada${o.previa ? ' previa' : ''}`);
        c.corpo.setAttribute('style', `fill:${o.camisa || '#8A8F98'}`);
        /* vista de cima: aparece o cabelo, ou a cabeça se for careca */
        c.cabeca.setAttribute('style', `fill:${o.cabelo === 'careca' ? o.pele || '#D9AC86' : o.cor || '#3A2517'}`);
        c.texto.textContent = escritos.has(id) ? textos.get(id) : '';
        c.dica.textContent = o.apelido || '';
        c.g.removeAttribute('aria-label');
      }
      rotular(atual);
      mostrarBalao(selecionada);
    },
    selecionar(id) {
      selecionada = id && LUGAR.get(id) ? id : null;
      const l = selecionada && LUGAR.get(selecionada);
      anel.setAttribute('cx', l ? String(l.x) : '-999');
      anel.setAttribute('cy', l ? String(l.z) : '-999');
      mostrarBalao(selecionada);
    },
    focar() {},
    olharPara(id, painel) { centrar(id, painel); },
    marcar() {},
    ocupante: id => ocupantes.get(id) || null,
    /** quem trata o Enter/clique numa cadeira (ligado pelo criarMais da planta) */
    aoAtivar(fn) { aoAtivar = fn; },
    get escala() { return escala; },
    parar() { rolagem.remove(); zoom.remove(); palco.classList.remove('p2'); },
  };
}

/* No 3D os "+" aparecem perto da câmera; na planta toda cadeira livre é botão. */
function criarMaisPlanta(_camada, planta, { escolher, avisar = () => {} }) {
  let ligado = true;
  planta.aoAtivar(id => {
    const o = planta.ocupante(id);
    if (!o) { escolher(id); return; }
    if (o.previa) return;                       /* o editor já está aberto nela */
    if (ligado) planta.selecionar(id);
    avisar(`${o.apelido} senta aqui.`);
  });
  return { ligar(sim) { ligado = sim; }, atualizar() {}, parar() { planta.aoAtivar(() => {}); } };
}

const UI_PLANTA = {
  criarAndar: criarPlanta,
  criarMais: criarMaisPlanta,
  criarBusca,
  abrirEditor,
  criarPasseio: () => ({ ativo: false, sair() {}, parar() {} }),
  criarPiadas: () => ({ parar() {}, sanduiche: () => false, fuga: () => false, discoteca: () => false }),
};

/** O escritório sem 3D, com o mesmo núcleo do 3D. */
export function criarEscritorioPlanta(palco, banco, { ui: trocas = {}, ...resto } = {}) {
  return criarNucleo(palco, banco, { ...resto, ui: { ...UI_PLANTA, ...trocas } });
}
