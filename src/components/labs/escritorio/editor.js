// Painel "Monte seu personagem": apelido + escolhas de visual. A cada mudança
// avisa a cena (que redesenha o boneco na cadeira, ao vivo) e, ao confirmar,
// grava no banco. Tudo com DOM puro; o apelido só entra em textContent/value.
import { OPCOES, APELIDO_MAX, sortearVisual, sanearApelido } from './visual.js';

const GRUPOS = [
  { chave: 'pele', rot: 'Pele', tipo: 'cor' },
  { chave: 'cabelo', rot: 'Cabelo', tipo: 'chip' },
  { chave: 'corCabelo', rot: 'Cor do cabelo', tipo: 'cor' },
  { chave: 'camisa', rot: 'Camisa', tipo: 'cor' },
  { chave: 'barba', rot: 'Barba', tipo: 'chip' },
  { chave: 'oculos', rot: 'Óculos', tipo: 'chip' },
  { chave: 'tracos', rot: 'Traços', tipo: 'chip' },
  { chave: 'altura', rot: 'Altura', tipo: 'chip' },
  { chave: 'acessorio', rot: 'Acessório', tipo: 'chip' },
  { chave: 'corLaco', rot: 'Cor do laço', tipo: 'cor', so: v => v.acessorio === 'laco' },
];

const NOMES_COR = {
  pele: ['Pele muito clara', 'Pele clara', 'Pele clara média', 'Pele média', 'Pele morena', 'Pele morena escura', 'Pele escura', 'Pele muito escura'],
  corCabelo: ['Preto', 'Castanho escuro', 'Castanho', 'Ruivo', 'Loiro', 'Grisalho', 'Rosa', 'Azul'],
  camisa: ['Verde', 'Azul', 'Terracota', 'Ameixa', 'Mostarda', 'Grafite', 'Branca', 'Verde-musgo', 'Vermelha', 'Cinza-azulado'],
  corLaco: ['Rosa', 'Vermelho', 'Amarelo', 'Azul'],
};

function el(tag, attrs = {}, filhos = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'texto') e.textContent = v;
    else if (k === 'classe') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  filhos.forEach(f => f && e.appendChild(f));
  return e;
}

export function abrirEditor(raiz, { lugar, mudou, salvar, cancelar, ocupada }) {
  let visual = sortearVisual();
  let enviando = false;
  let fechado = false;
  raiz.replaceChildren();
  raiz.hidden = false;

  const titulo = el('h2', { classe: 'ed-titulo', id: 'ed-titulo', texto: 'Monte seu personagem' });
  const sub = el('p', { classe: 'ed-sub', texto: `Cadeira ${String(lugar + 1).padStart(2, '0')} · fica salvo para todo mundo que abrir o escritório.` });
  const fechar = el('button', { type: 'button', classe: 'ed-fechar', 'aria-label': 'Cancelar e fechar', texto: '×', onclick: () => sair() });

  const campo = el('input', {
    type: 'text', id: 'ed-apelido', classe: 'ed-input', maxlength: String(APELIDO_MAX * 2),
    autocomplete: 'off', spellcheck: 'false', placeholder: 'Como te chamam?', enterkeyhint: 'done',
  });
  const contador = el('span', { classe: 'ed-cont', 'aria-hidden': 'true', texto: `0/${APELIDO_MAX}` });
  campo.addEventListener('input', () => {
    const limpo = sanearApelido(campo.value);
    contador.textContent = `${[...limpo].length}/${APELIDO_MAX}`;
    if ([...campo.value].length > APELIDO_MAX) campo.value = [...campo.value].slice(0, APELIDO_MAX).join('');
    erro.textContent = '';
    avisar();
  });

  const grupos = el('div', { classe: 'ed-grupos' });
  const erro = el('p', { classe: 'ed-erro', role: 'alert' });
  const sortear = el('button', {
    type: 'button', classe: 'ed-sec', texto: 'Sortear visual',
    onclick: () => { visual = sortearVisual(); desenhar(); avisar(); },
  });
  const confirmar = el('button', { type: 'submit', classe: 'ed-pri', texto: 'Sentar aqui' });

  const form = el('form', { classe: 'ed-form', novalidate: 'true', 'aria-labelledby': 'ed-titulo' }, [
    el('div', { classe: 'ed-topo' }, [el('div', {}, [titulo, sub]), fechar]),
    el('label', { classe: 'ed-rot', for: 'ed-apelido', texto: 'Apelido' }),
    el('div', { classe: 'ed-campo' }, [campo, contador]),
    grupos,
    erro,
    el('div', { classe: 'ed-acoes' }, [sortear, confirmar]),
  ]);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (enviando) return;
    const apelido = sanearApelido(campo.value);
    if (!apelido) { erro.textContent = 'Escolha um apelido para o seu personagem.'; campo.focus(); return; }
    enviando = true; confirmar.disabled = true; confirmar.textContent = 'Sentando…';
    try {
      await salvar(apelido, visual);
      fecharPainel();
    } catch (e) {
      enviando = false; confirmar.disabled = false; confirmar.textContent = 'Sentar aqui';
      erro.textContent = e && e.message ? e.message : 'Não deu para salvar agora.';
      if (e && e.codigo === 'ocupado') travarOcupada();
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
        const ativo = visual[g.chave] === v;
        const b = g.tipo === 'cor'
          ? el('button', { type: 'button', classe: 'ed-cor', style: `--c:${v}`, 'aria-label': NOMES_COR[g.chave][k], title: NOMES_COR[g.chave][k] })
          : el('button', { type: 'button', classe: 'ed-chip', texto: op.rot });
        b.setAttribute('aria-pressed', String(ativo));
        b.addEventListener('click', () => {
          visual = { ...visual, [g.chave]: v };
          desenhar(); avisar();
          const mesmo = grupos.querySelector(`[aria-label="${g.rot}"] [aria-pressed="true"]`);
          if (mesmo) mesmo.focus({ preventScroll: true });
        });
        lista.appendChild(b);
      });
      grupos.appendChild(el('fieldset', { classe: 'ed-grupo' }, [el('legend', { classe: 'ed-rot', texto: g.rot }), lista]));
    }
  }

  function avisar() {
    if (!fechado) mudou(sanearApelido(campo.value), visual);
  }

  function travarOcupada() {
    confirmar.disabled = true; sortear.disabled = true;
    setTimeout(() => { fecharPainel(); ocupada(); }, 1800);
  }

  function aoTeclar(e) {
    if (e.key === 'Escape') { e.stopPropagation(); sair(); }
  }
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
    cancelar();
  }

  desenhar();
  avisar();
  /* no celular, focar o campo abre o teclado em cima do boneco; só foca no desktop */
  if (window.matchMedia('(pointer: fine)').matches) campo.focus({ preventScroll: true });

  return {
    fechar: sair,
    avisarOcupada() {
      if (fechado || enviando) return;
      erro.textContent = 'Alguém acabou de sentar nessa cadeira. Escolha outra.';
      travarOcupada();
    },
  };
}
