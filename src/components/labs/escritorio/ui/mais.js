// Os botões "+" das cadeiras livres. De longe a planta fica limpa; quando a
// câmera chega perto do chão (deu zoom numa área), aparecem os "+" das
// cadeiras livres em volta do ponto que ela olha, até um limite, os mais
// próximos primeiro. São botões de verdade (dá para usar com Tab e Enter),
// reaproveitados de quadro em quadro.
import { LUGARES, LUGAR, nomeDaArea } from '../planta/lugares.js';

export const PERTO = 30;      /* distância câmera → alvo, em metros, para mostrar os "+" */
/* mais perto que isso é a vista de retrato (busca, editor): os "+" das
   cadeiras de trás cairiam em cima dos nomes, então somem; o clique direto
   na cadeira livre continua valendo. */
export const RETRATO = 5;
export const MAX_MAIS = 60;   /* botões ao mesmo tempo */
const ALTURA = 0.95;          /* em cima do assento vazio */

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
 * @param opcoes.escolher(id) clicou no "+"
 */
export function criarMais(camada, andar, { ocupados, escolher }) {
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

  function escolherQuais() {
    const ids = ligado ? lugaresComMais({ ocupados: ocupados(), alvo: andar.alvo(), distancia: andar.distancia() }) : [];
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
      if (p.visivel) b.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
    });
  }
  const parar = andar.aoDesenhar(posicionar);

  return {
    /** Esconde todos (editor aberto) ou volta a mostrar. */
    ligar(sim) { ligado = sim; ultimaChave = '#'; andar.marcar(); },
    /** Chame quando alguém sentar ou levantar. */
    atualizar() { ultimaChave = '#'; andar.marcar(); },
    get visiveis() { return ativos.length; },
    parar,
  };
}
