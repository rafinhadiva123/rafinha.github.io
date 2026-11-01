// Os botões "+" das cadeiras livres. De longe a planta fica limpa; quando a
// câmera chega perto do chão (deu zoom numa área), aparecem os "+" das
// cadeiras livres em volta do ponto que ela olha, até um limite, os mais
// próximos primeiro. São botões de verdade (dá para usar com Tab e Enter),
// reaproveitados de quadro em quadro.
// Quem já sentou não vê os "+" (só enquanto muda de cadeira); para abrir o
// editor do personagem, basta clicar na própria cadeira (ou no boneco nela).
import { LUGARES, LUGAR, nomeDaArea } from '../planta/lugares.js';

export const PERTO = 16;      /* distância câmera → alvo, em metros, para mostrar os "+": zoom de umas três bancadas na tela */
/* mais perto que isso é a vista de retrato (busca, editor): os "+" das
   cadeiras de trás cairiam em cima dos nomes, então somem; o clique direto
   na cadeira livre continua valendo. */
export const RETRATO = 5;
export const MAX_MAIS = 60;   /* botões ao mesmo tempo */
const ALTURA = 0.95;          /* em cima do assento vazio */
const ALCANCE = 0.55;         /* raio (m) em volta da cadeira que conta como clique nela */
const TOPO = 1.75;            /* altura (m) da cabeça de quem senta, acima do chão */

/**
 * O raio da tela passa pela cadeira (um cilindro em pé no lugar dela, do
 * chão até a cabeça de quem senta)? Pura, para dar para testar.
 * @param raio {origem:{x,y,z}, direcao:{x,y,z}} como andar.raioEm devolve
 * @param l    lugar da planta {x, z, dy?}
 */
export function acertaCadeira(raio, l, { alcance = ALCANCE, topo = TOPO } = {}) {
  const { origem: o, direcao: d } = raio;
  const base = l.dy || 0;
  /* trecho do raio entre o chão e a cabeça (e na frente da câmera) */
  let t0 = 0, t1 = Infinity;
  if (Math.abs(d.y) > 1e-9) {
    const a = (base - o.y) / d.y, b = (base + topo - o.y) / d.y;
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
  } else if (o.y < base || o.y > base + topo) return false;
  if (t0 > t1) return false;
  /* ponto do trecho mais perto do eixo da cadeira, só no plano do chão */
  const hx = o.x - l.x, hz = o.z - l.z, hh = d.x * d.x + d.z * d.z;
  const t = Math.min(t1, Math.max(t0, hh > 1e-12 ? -(hx * d.x + hz * d.z) / hh : t0));
  return Math.hypot(hx + t * d.x, hz + t * d.z) <= alcance;
}

/** Raio (m) em volta do alvo onde os "+" aparecem: cresce um pouco com a distância. */
export const raioDosMais = distancia => Math.min(16, Math.max(6, distancia * 0.75));

/**
 * Quais cadeiras ganham "+" agora. Pura, para dar para testar.
 * @param ocupados  Set de ids ocupados (fixos, visitantes e a prévia do editor)
 * @param alvo      {x, z} para onde a câmera olha
 * @param distancia câmera → alvo
 */
export function lugaresComMais({ ocupados, alvo, distancia, lugares = LUGARES, perto = PERTO, retrato = RETRATO, max = MAX_MAIS }) {
  if (!(distancia <= perto) || distancia < retrato) return [];
  const r = raioDosMais(distancia);
  const lista = [];
  for (const l of lugares) {
    if (ocupados.has(l.id)) continue;
    const d = Math.hypot(l.x - alvo.x, l.z - alvo.z);
    if (d <= r) lista.push([d, l.id]);
  }
  lista.sort((a, b) => a[0] - b[0]);
  return lista.slice(0, max).map(([, id]) => id);
}

/**
 * @param camada  elemento por cima do canvas (position:absolute; inset:0)
 * @param andar   o que criarAndar devolve
 * @param opcoes.ocupados()  Set de ids ocupados agora
 * @param opcoes.escolher(id) clicou no "+" ou na própria cadeira
 * @param opcoes.mostrarMais()  false esconde os "+" (quem já sentou)
 * @param opcoes.meuLugar()     cadeira da própria pessoa: clicar nela abre o editor
 * @param opcoes.bloqueado()    true quando o clique é de outro (modo boneco)
 */
export function criarMais(camada, andar, { ocupados, escolher, mostrarMais = () => true, meuLugar = () => null, bloqueado = () => false }) {
  const pool = [];
  let ativos = [];           /* ids com botão agora */
  let ligado = true;
  let ultimaChave = '';

  function botao(k) {
    if (pool[k]) return pool[k];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mais';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
    b.addEventListener('click', ev => { ev.stopPropagation(); if (b.dataset.lugar) escolher(b.dataset.lugar); });
    camada.appendChild(b);
    pool[k] = b;
    return b;
  }

  /* clique (ou toque) na própria cadeira abre o editor; arrasto de câmera não conta */
  const tela = andar.renderer && andar.renderer.domElement;
  function minhaCadeiraEm(cx, cy) {
    const id = ligado && !bloqueado() ? meuLugar() : null;
    const l = id && LUGAR.get(id);
    return l && acertaCadeira(andar.raioEm(cx, cy), l) ? id : null;
  }
  let aperto = null;
  const abaixo = e => { aperto = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; };
  const acima = e => {
    if (!aperto) return;
    const movido = Math.hypot(e.clientX - aperto.x, e.clientY - aperto.y);
    const demora = performance.now() - aperto.t;
    aperto = null;
    if (movido > 6 || demora > 500) return;
    const id = minhaCadeiraEm(e.clientX, e.clientY);
    if (id) escolher(id);
  };
  /* com o mouse, a mãozinha avisa que dá para clicar */
  const passar = e => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const pode = Boolean(minhaCadeiraEm(e.clientX, e.clientY));
    if (pode !== (tela.style.cursor === 'pointer')) tela.style.cursor = pode ? 'pointer' : '';
  };
  if (tela) {
    tela.addEventListener('pointerdown', abaixo);
    tela.addEventListener('pointerup', acima);
    tela.addEventListener('pointermove', passar);
  }

  function escolherQuais() {
    const ids = ligado && mostrarMais() ? lugaresComMais({ ocupados: ocupados(), alvo: andar.alvo(), distancia: andar.distancia() }) : [];
    const chave = ids.join('|');
    if (chave === ultimaChave) return;
    ultimaChave = chave;
    ativos = ids;
    ids.forEach((id, k) => {
      const b = botao(k);
      b.dataset.lugar = id;
      const area = nomeDaArea(id);
      b.setAttribute('aria-label', area ? `Sentar nesta cadeira livre da ${area}` : 'Sentar nesta cadeira livre');
      b.title = 'Sentar aqui';
    });
    for (let k = ids.length; k < pool.length; k++) { pool[k].hidden = true; delete pool[k].dataset.lugar; }
    camada.classList.toggle('perto', ids.length > 0);
  }

  function posicionar() {
    escolherQuais();
    ativos.forEach((id, k) => {
      const l = LUGAR.get(id), b = pool[k];
      const p = andar.projetar(l.x, ALTURA + (l.dy || 0), l.z);
      b.hidden = !p.visivel;
      if (p.visivel) b.style.translate = `${p.x}px ${p.y}px`;
    });
  }
  const pararDesenho = andar.aoDesenhar(posicionar);
  function parar() {
    if (pararDesenho) pararDesenho();
    if (tela) {
      tela.removeEventListener('pointerdown', abaixo);
      tela.removeEventListener('pointerup', acima);
      tela.removeEventListener('pointermove', passar);
      tela.style.cursor = '';
    }
  }

  return {
    /** Esconde todos (editor aberto) ou volta a mostrar. */
    ligar(sim) { ligado = sim; ultimaChave = '#'; andar.marcar(); },
    /** Chame quando alguém sentar ou levantar. */
    atualizar() { ultimaChave = '#'; andar.marcar(); },
    get visiveis() { return ativos.length; },
    parar,
  };
}
