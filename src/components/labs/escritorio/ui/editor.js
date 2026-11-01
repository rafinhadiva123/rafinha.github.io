// Painel "Monte seu personagem": apelido e visual. A cada escolha avisa a
// cena (que redesenha o boneco na cadeira, ao vivo); ao confirmar, chama
// `salvar` e mostra o erro em português se o banco recusar.
// DOM puro; o apelido só entra em textContent/value, nunca como HTML.
import { OPCOES, APELIDO_MAX, sortearVisual, sanearApelido, sanearVisual } from '../visual.js';
import { nomeDaArea } from '../planta/lugares.js';

export const GRUPOS = [
  { chave: 'pele', rot: 'Pele', tipo: 'cor' },
  { chave: 'cabelo', rot: 'Cabelo', tipo: 'chip' },
  { chave: 'corCabelo', rot: 'Cor do cabelo', tipo: 'cor', so: v => v.cabelo !== 'careca' },
  { chave: 'camisa', rot: 'Camisa', tipo: 'cor' },
  { chave: 'barba', rot: 'Barba', tipo: 'chip' },
  { chave: 'oculos', rot: 'Óculos', tipo: 'chip' },
  { chave: 'silhueta', rot: 'Tamanho de silhueta', tipo: 'chip' },
  { chave: 'altura', rot: 'Altura', tipo: 'chip' },
  { chave: 'acessorio', rot: 'Acessório', tipo: 'chip' },
  { chave: 'corLaco', rot: 'Cor do laço', tipo: 'cor', so: v => v.acessorio === 'laco' },
];

const NOMES_COR = {
  pele: ['Pele muito clara', 'Pele clara', 'Pele clara média', 'Pele média', 'Pele morena', 'Pele morena escura', 'Pele escura', 'Pele muito escura'],
  corCabelo: ['Preto', 'Castanho escuro', 'Castanho', 'Ruivo', 'Loiro', 'Grisalho'],
  camisa: ['Branca', 'Verde', 'Azul', 'Rosa', 'Rosa clara', 'Preta', 'Cinza'],
  corLaco: ['Rosa', 'Vermelho', 'Amarelo', 'Azul'],
};

function el(tag, attrs = {}, filhos = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'texto') e.textContent = v;
    else if (k === 'classe') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  filhos.forEach(f => f && e.appendChild(f));
  return e;
}

/**
 * @param raiz      elemento onde o painel aparece
 * @param opcoes.lugar   id da cadeira
 * @param opcoes.meu     {lugar, apelido, visual} se a pessoa já tem personagem
 * @param opcoes.mudou(apelido, visual)   prévia ao vivo
 * @param opcoes.salvar(apelido, visual)  Promise; lança erro com .message
 * @param opcoes.fechar()                 cancelou
 */
export function abrirEditor(raiz, { lugar, meu, mudou, salvar, fechar, aleatorio = Math.random }) {
  let visual = meu ? sanearVisual(meu.visual) : sortearVisual(aleatorio);
  let enviando = false, fechado = false;
  raiz.replaceChildren();
  raiz.hidden = false;

  const titulo = el('h2', { classe: 'ed-titulo', id: 'ed-titulo', texto: meu ? 'Mudar de cadeira' : 'Monte seu personagem' });
  /* sem zona nem número de bancada na tela; só o nome da área, quando tem */
  const area = nomeDaArea(lugar);
  const sub = el('p', {
    classe: 'ed-sub',
    texto: meu
      ? `${area ? `Você vai para a ${area}. ` : ''}A cadeira de antes fica livre.`
      : `${area ? `${area}. ` : ''}Fica salvo para todo mundo que abrir o escritório.`,
  });
  const btnFechar = el('button', { type: 'button', classe: 'ed-fechar', 'aria-label': 'Cancelar e fechar', texto: '×', onclick: () => sair() });

  const campo = el('input', {
    type: 'text', id: 'ed-apelido', classe: 'ed-input', autocomplete: 'off', spellcheck: 'false',
    enterkeyhint: 'done', 'aria-describedby': 'ed-erro',
  });
  if (meu) campo.value = meu.apelido;
  const contador = el('span', { classe: 'ed-cont', 'aria-hidden': 'true' });
  const erro = el('p', { classe: 'ed-erro', id: 'ed-erro', role: 'alert' });
  const atualizarContador = () => { contador.textContent = `${[...sanearApelido(campo.value)].length}/${APELIDO_MAX}`; };
  campo.addEventListener('input', () => {
    if ([...campo.value].length > APELIDO_MAX) campo.value = [...campo.value].slice(0, APELIDO_MAX).join('');
    atualizarContador();
    erro.textContent = '';
    avisar();
  });
  atualizarContador();

  const grupos = el('div', { classe: 'ed-grupos' });
  const sortear = el('button', { type: 'button', classe: 'ed-sec', texto: 'Sortear visual', onclick: () => { visual = sortearVisual(aleatorio); desenhar(); avisar(); } });
  const confirmar = el('button', { type: 'submit', classe: 'ed-pri', texto: meu ? 'Mudar para cá' : 'Sentar aqui' });

  const form = el('form', { classe: 'ed-form', novalidate: true, 'aria-labelledby': 'ed-titulo' }, [
    el('div', { classe: 'ed-topo' }, [el('div', {}, [titulo, sub]), btnFechar]),
    el('div', { classe: 'ed-bloco' }, [
      el('label', { classe: 'ed-rot', for: 'ed-apelido', texto: 'Apelido' }),
      el('div', { classe: 'ed-campo' }, [campo, contador]),
      erro,
    ]),
    grupos,
    el('div', { classe: 'ed-acoes' }, [sortear, confirmar]),
  ]);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (enviando) return;
    const apelido = sanearApelido(campo.value);
    if (!apelido) { erro.textContent = 'Escolha um apelido para o seu personagem.'; campo.focus(); return; }
    enviando = true;
    confirmar.disabled = sortear.disabled = true;
    confirmar.textContent = 'Sentando…';
    try {
      await salvar(apelido, visual);
      fecharPainel();
    } catch (e) {
      enviando = false;
      confirmar.disabled = sortear.disabled = false;
      confirmar.textContent = meu ? 'Mudar para cá' : 'Sentar aqui';
      erro.textContent = (e && e.message) || 'Não deu para salvar agora. Tente de novo.';
      if (e && e.codigo === 'apelido_em_uso') campo.focus();
    }
  });
  raiz.appendChild(form);

  function desenhar() {
    grupos.replaceChildren();
    for (const g of GRUPOS) {
      if (g.so && !g.so(visual)) continue;
      const lista = el('div', { classe: g.tipo === 'cor' ? 'ed-cores' : 'ed-chips', role: 'group', 'aria-label': g.rot });
      OPCOES[g.chave].forEach((op, k) => {
        const v = typeof op === 'string' ? op : op.v;
        const nome = g.tipo === 'cor' ? NOMES_COR[g.chave][k] : op.rot;
        const b = g.tipo === 'cor'
          ? el('button', { type: 'button', classe: 'ed-cor', style: `--c:${v}`, 'aria-label': nome, title: nome })
          : el('button', { type: 'button', classe: 'ed-chip', texto: nome });
        b.setAttribute('aria-pressed', String(visual[g.chave] === v));
        b.dataset.grupo = g.chave;
        b.addEventListener('click', () => {
          visual = { ...visual, [g.chave]: v };
          desenhar(); avisar();
          const igual = grupos.querySelector(`[data-grupo="${g.chave}"][aria-pressed="true"]`);
          if (igual) igual.focus({ preventScroll: true });
        });
        lista.appendChild(b);
      });
      grupos.appendChild(el('fieldset', { classe: 'ed-grupo' }, [el('legend', { classe: 'ed-rot', texto: g.rot }), lista]));
    }
  }

  function avisar() { if (!fechado) mudou(sanearApelido(campo.value), visual); }

  function aoTeclar(e) { if (e.key === 'Escape') { e.stopPropagation(); sair(); } }
  raiz.addEventListener('keydown', aoTeclar);

  function fecharPainel() {
    if (fechado) return;
    fechado = true;
    raiz.removeEventListener('keydown', aoTeclar);
    raiz.hidden = true;
    raiz.replaceChildren();
  }
  function sair() {
    if (enviando) return;
    fecharPainel();
    fechar();
  }

  desenhar();
  avisar();
  /* no celular, focar o campo abre o teclado em cima do boneco: só foca com mouse */
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) campo.focus({ preventScroll: true });

  return { fechar: sair, get aberto() { return !fechado; } };
}
