// Busca por apelido: digita um nome e a câmera vai até a pessoa. Sem
// diferença de acento nem maiúscula ("joao" acha "João"), igual à regra de
// apelido único do banco. Caixa de combinação acessível (setas, Enter, Esc).
// Fechada é só uma lupa meio transparente no canto do andar; clicar nela abre
// o campo, e o campo vazio fecha de novo ao perder o foco ou com Esc.
// DOM puro; apelido só entra em textContent.
import { chaveApelido } from '../planta/fixos.js';

export const MAX_RESULTADOS = 6;

/**
 * Quem combina com o termo: primeiro os que começam com ele, depois os que
 * têm alguma palavra começando com ele, depois os que só contêm. Pura.
 * @param pessoas [{apelido, lugar}]
 */
export function buscarApelido(pessoas, termo, max = MAX_RESULTADOS) {
  const t = chaveApelido(termo || '');
  if (!t) return [];
  const pontos = [];
  for (const p of pessoas) {
    const k = chaveApelido(p.apelido);
    let nota = -1;
    if (k === t) nota = 0;
    else if (k.startsWith(t)) nota = 1;
    else if (k.split(' ').some(w => w.startsWith(t))) nota = 2;
    else if (k.includes(t)) nota = 3;
    if (nota >= 0) pontos.push([nota, k, p]);
  }
  pontos.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1], 'pt-BR'));
  return pontos.slice(0, max).map(([, , p]) => p);
}

function el(tag, attrs = {}) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'texto') e.textContent = v;
    else if (k === 'classe') e.className = v;
    else e.setAttribute(k, v);
  }
  return e;
}

/**
 * @param raiz              onde a caixa de busca aparece
 * @param opcoes.pessoas()  [{apelido, lugar}] de quem está sentado agora
 * @param opcoes.ir(pessoa) leva a câmera até a pessoa
 */
export function criarBusca(raiz, { pessoas, ir }) {
  const lista = el('ul', { classe: 'bu-lista', id: 'bu-lista', role: 'listbox', 'aria-label': 'Pessoas encontradas' });
  lista.hidden = true;
  const campo = el('input', {
    type: 'search', classe: 'bu-campo', id: 'bu-campo',
    autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
    role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'bu-lista', 'aria-autocomplete': 'list',
    'aria-label': 'Buscar pessoa pelo apelido',
  });
  campo.hidden = true;
  const lupa = el('button', {
    type: 'button', classe: 'bu-lupa', 'aria-label': 'Buscar pessoa pelo apelido',
    'aria-expanded': 'false', 'aria-controls': 'bu-campo',
  });
  lupa.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>';
  const caixa = el('div', { classe: 'bu', role: 'search' });
  caixa.append(lupa, campo, lista);
  raiz.appendChild(caixa);

  function abrir() {
    caixa.classList.add('aberta');
    campo.hidden = false;
    lupa.setAttribute('aria-expanded', 'true');
    campo.focus();
  }

  function fechar() {
    fecharLista();
    caixa.classList.remove('aberta');
    campo.hidden = true;
    lupa.setAttribute('aria-expanded', 'false');
  }

  lupa.addEventListener('click', () => {
    if (campo.hidden) abrir();
    else if (campo.value.trim()) campo.focus();
    else { fechar(); lupa.focus(); }
  });
  /* clicar na lupa com o campo aberto não deve tirar o foco dele antes */
  lupa.addEventListener('pointerdown', ev => { if (!campo.hidden) ev.preventDefault(); });

  let achados = [], marcado = -1;

  function desenhar() {
    lista.replaceChildren();
    const termo = campo.value.trim();
    if (!termo) { fecharLista(); return; }
    achados = buscarApelido(pessoas(), termo);
    if (!achados.length) {
      lista.appendChild(el('li', { classe: 'bu-vazio', texto: 'Ninguém com esse apelido por aqui.' }));
    }
    achados.forEach((p, k) => {
      const li = el('li', { classe: 'bu-item', role: 'option', id: `bu-op-${k}`, 'aria-selected': String(k === marcado), texto: p.apelido });
      li.addEventListener('pointerdown', ev => ev.preventDefault()); /* não tira o foco do campo */
      li.addEventListener('click', () => escolher(k));
      lista.appendChild(li);
    });
    lista.hidden = false;
    campo.setAttribute('aria-expanded', 'true');
    if (marcado >= 0 && achados[marcado]) campo.setAttribute('aria-activedescendant', `bu-op-${marcado}`);
    else campo.removeAttribute('aria-activedescendant');
  }

  function fecharLista() {
    lista.hidden = true;
    marcado = -1;
    campo.setAttribute('aria-expanded', 'false');
    campo.removeAttribute('aria-activedescendant');
  }

  function escolher(k) {
    const p = achados[k];
    if (!p) return;
    campo.value = p.apelido;
    fecharLista();
    ir(p);
    /* no celular, tira o teclado da frente da pessoa */
    if (!matchMedia('(pointer: fine)').matches) campo.blur();
  }

  campo.addEventListener('input', () => { marcado = -1; desenhar(); });
  campo.addEventListener('focus', () => { if (campo.value.trim()) desenhar(); });
  campo.addEventListener('blur', () => setTimeout(() => {
    if (raiz.ownerDocument.activeElement === campo) return;
    if (campo.value.trim()) fecharLista(); else fechar();
  }, 120));
  campo.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (lista.hidden) desenhar();
      if (!achados.length) return;
      e.preventDefault();
      const n = achados.length;
      marcado = e.key === 'ArrowDown' ? (marcado + 1) % n : (marcado - 1 + n) % n;
      desenhar();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!achados.length) desenhar();
      escolher(Math.max(0, marcado));
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      if (!lista.hidden) fecharLista();
      else if (campo.value) campo.value = '';
      else { fechar(); lupa.focus(); }
    }
  });

  return {
    focar() { abrir(); },
    limpar() { campo.value = ''; fechar(); },
  };
}
