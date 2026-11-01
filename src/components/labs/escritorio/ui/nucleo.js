// Núcleo do Simulador de escritório: a lógica de quem senta onde, sem saber
// como o andar é desenhado. Recebe as peças de tela (`ui`) e um banco com a
// interface de dados/banco.js. O andar em 3D (ui/escritorio.js) e a planta
// sem 3D (ui/planta2d.js) usam este mesmo núcleo, então sentar, conflito,
// atualização ao vivo e mensagens de erro são iguais nas duas versões.
// Este arquivo não importa three: a versão sem 3D não baixa a biblioteca.
//
// Regras:
// - Quem ocupa uma cadeira = FIXOS + visitantes do banco + prévia do editor
//   (a prévia só aparece em cadeira livre ou na própria cadeira).
// - O editor só abre na própria cadeira (para editar) ou, para quem ainda não
//   sentou, numa cadeira livre. Quem já sentou não vê os "+": para trocar de
//   lugar, abre o próprio personagem e aperta "Mudar de cadeira"; aí os "+"
//   voltam até escolher a cadeira nova (ou cancelar).
// - "+" e busca saem do modo boneco antes de agir.
// - A atualização ao vivo (banco.aoMudar) recarrega a lista sem mexer no editor
//   e avisa quem acabou de chegar.
// - Se o banco não carrega, a planta fica com os 15 fixos e um aviso.
// - Voltando para a aba depois de um tempo, a lista é lida de novo (o celular
//   costuma derrubar o canal ao vivo com a tela apagada).
import '../escritorio.css';
import { FIXOS } from '../planta/fixos.js';
import { LUGAR, LUGARES } from '../planta/lugares.js';
import { paraBoneco } from '../visual.js';
import { modoEditor } from './editor.js';

export const MSG_CARGA = 'Não deu para carregar quem está no escritório agora. Os 15 de sempre continuam nas cadeiras.';
export const MSG_CONFLITO = 'Alguém sentou nessa cadeira enquanto você escolhia. Escolha outra.';
export const MSG_LOTADO = 'O escritório está lotado: não sobrou cadeira livre.';
export const msgExcluido = apelido => `Pronto, ${apelido} foi excluído. A cadeira e o apelido ficaram livres.`;
export const msgEditado = apelido => `Pronto, ${apelido} foi atualizado para todo mundo.`;
export const MSG_SO_NA_SUA = 'Você já tem um personagem. Para trocar de lugar, abra o seu e aperte “Mudar de cadeira”.';
export const MSG_ESCOLHA = 'Escolha uma cadeira livre para onde levar o seu personagem.';
const MSG_SEM_BANCO = 'Sem conexão com o escritório agora. Tente de novo em instantes.';

/**
 * Quem ocupa cada cadeira agora: fixos, visitantes e a prévia do editor.
 * Pura. Quem já está numa cadeira não é trocado pela prévia, a não ser a
 * própria pessoa editando na cadeira dela (`meuLugar`).
 */
export function montarOcupantes({ visitantes = [], previa = null, meuLugar = null } = {}) {
  const mapa = new Map();
  for (const f of FIXOS) mapa.set(f.lugar, f);
  for (const v of visitantes) {
    if (!mapa.has(v.lugar)) mapa.set(v.lugar, { ...paraBoneco(v.apelido, v.visual), apelido: v.apelido });
  }
  const fixo = previa && FIXOS.some(f => f.lugar === previa.lugar);
  if (previa && !fixo && (!mapa.has(previa.lugar) || previa.lugar === meuLugar)) {
    mapa.set(previa.lugar, { ...paraBoneco(previa.apelido, previa.visual), apelido: previa.apelido, previa: true });
  }
  return mapa;
}

/** Frase de quem chegou entre duas leituras (sem contar a própria pessoa). Pura. */
export function fraseChegada(antes, depois, meuApelido = null) {
  const tinha = new Set(antes.map(v => v.apelido));
  const novos = depois.filter(v => !tinha.has(v.apelido) && v.apelido !== meuApelido);
  if (!novos.length) return null;
  if (novos.length === 1) return `${novos[0].apelido} acabou de sentar.`;
  if (novos.length === 2) return `${novos[0].apelido} e ${novos[1].apelido} acabaram de sentar.`;
  return `${novos.length} pessoas acabaram de sentar.`;
}

/**
 * Cria as camadas por cima do andar: "+", busca, editor, aviso e o aviso de
 * falha ao carregar. Só mexe no DOM; o controlador não sabe como é.
 */
export function montarCamadas(palco, { tentarDeNovo = () => {} } = {}) {
  const doc = palco.ownerDocument || document;
  const el = (tag, classe, attrs = {}) => {
    const e = doc.createElement(tag);
    e.className = classe;
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  palco.classList.add('esc-palco');
  const camada = el('div', 'mais-camada');
  const busca = el('div', 'bu-raiz');
  const editor = el('div', 'ed-raiz');
  editor.hidden = true;
  const aviso = el('p', 'esc-aviso', { role: 'status', 'aria-live': 'polite' });
  aviso.hidden = true;
  /* "Escolha uma cadeira livre…" enquanto a pessoa muda de cadeira */
  const mudanca = el('div', 'esc-mudanca', { role: 'status' });
  mudanca.hidden = true;
  const mudancaTexto = el('p', 'esc-mudanca-texto');
  mudancaTexto.textContent = MSG_ESCOLHA;
  const mudancaCancelar = el('button', 'esc-tentar', { type: 'button' });
  mudancaCancelar.textContent = 'Cancelar';
  mudanca.append(mudancaTexto, mudancaCancelar);
  const carga = el('div', 'esc-carga', { role: 'alert' });
  carga.hidden = true;
  const cargaTexto = el('p', 'esc-carga-texto');
  const cargaBotao = el('button', 'esc-tentar', { type: 'button' });
  cargaBotao.textContent = 'Tentar de novo';
  cargaBotao.addEventListener('click', () => tentarDeNovo());
  carga.append(cargaTexto, cargaBotao);
  palco.append(camada, busca, editor, mudanca, aviso, carga);
  return { camada, busca, editor, aviso, carga, cargaTexto, mudanca, mudancaCancelar };
}

const TEMPO_LIMITE = 10000;   /* ms: leitura que demora mais que isso conta como falha */
const VOLTOU_DEPOIS = 20000;  /* ms escondida: ao voltar para a aba, lê de novo */

/** Espera a promessa, mas desiste depois de ms (pendurar também é falha). */
export function comLimite(promessa, ms) {
  let relogio;
  const limite = new Promise((_, rejeita) => { relogio = setTimeout(() => rejeita(new Error('demorou demais')), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

/**
 * @param palco  elemento onde o andar aparece (com altura definida)
 * @param banco  criarBancoSupabase(...) ou criarBancoLocal(); pode ser null se
 *               nem deu para montar o banco (aí a planta sai só com os fixos)
 * @param opcoes.ui  as peças de tela: criarAndar, criarMais, criarBusca,
 *                   criarPasseio, abrirEditor, montarCamadas, criarPiadas
 * @param opcoes.tempoLimite  ms até a leitura do banco contar como falha
 * @param opcoes.aleatorio    0..1, para escolher a cadeira em sentarEmLivre
 * @returns {pronto, andar, piadas, recarregar(), abrir(lugar), sentarEmLivre(),
 *           cancelarMudanca(), parar(), aberto, mudando, modo, meu}
 */
export function criarNucleo(palco, banco, { ui, tempoLimite = TEMPO_LIMITE, aleatorio = Math.random } = {}) {
  ui = { montarCamadas, ...ui };
  let parado = false;
  let visitantes = [];        /* lista do banco, sem os fixos */
  let meu = null;             /* {lugar, apelido, visual} de quem já sentou */
  let previa = null;          /* {lugar, apelido, visual} do editor aberto agora */
  let mudando = null;         /* {apelido, visual} enquanto escolhe a cadeira nova */
  let ocupadas = new Set(FIXOS.map(f => f.lugar));
  let editor = null;          /* retorno de abrirEditor, se houver painel aberto */
  let vezEditor = 0;          /* identifica o painel atual: um salvar antigo não mexe no novo */
  let seq = 0;                /* a leitura mais nova vence */
  let carregouUmaVez = false;
  let timerAviso = null;
  let pararAoMudar = null;
  let escondidaDesde = 0;

  const c = ui.montarCamadas(palco, { tentarDeNovo: () => recarregar() });
  const andar = ui.criarAndar(palco);

  function avisar(texto) {
    if (parado) return;
    c.aviso.textContent = texto;
    c.aviso.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { c.aviso.hidden = true; }, 4500);
  }

  const pessoas = () => [
    ...FIXOS.map(f => ({ apelido: f.apelido, lugar: f.lugar })),
    ...visitantes.map(v => ({ apelido: v.apelido, lugar: v.lugar })),
  ];

  function redesenhar() {
    const mapa = montarOcupantes({ visitantes, previa, meuLugar: meu && meu.lugar });
    ocupadas = new Set(mapa.keys());
    andar.definirOcupantes(mapa);
    mais.atualizar();
  }

  const mais = ui.criarMais(c.camada, andar, {
    ocupados: () => ocupadas,
    escolher: lugar => abrirPainel(lugar),
    avisar,
    /* quem já sentou só vê os "+" enquanto escolhe para onde mudar */
    mostrarMais: () => !meu || Boolean(mudando),
    meuLugar: () => (meu ? meu.lugar : null),
    /* no modo boneco o clique é para andar */
    bloqueado: () => Boolean(passeio && passeio.ativo),
  });
  if (c.mudancaCancelar) c.mudancaCancelar.addEventListener('click', () => cancelarMudanca());
  /* no modo boneco o clique é para andar, menos no armário: a fuga continua valendo */
  let piadas = null;
  const passeio = ui.criarPasseio(palco, andar, {
    avisar,
    aoClicar: (cx, cy) => Boolean(piadas && piadas.clicarNoPasseio && piadas.clicarNoPasseio(cx, cy)),
  });
  /* as piadas dos 15 fixos; no modo boneco o clique é do passeio (ver acima) */
  piadas = ui.criarPiadas(andar, { avisar, bloqueado: () => passeio.ativo });
  ui.criarBusca(c.busca, { pessoas, ir: p => irPara(p.lugar) });

  /* quem olha da frente da cadeira: em tela estreita o painel vai para baixo */
  const lado = () => (typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches ? 'baixo' : 'direita');

  function sairDoModoBoneco() {
    if (passeio.ativo) passeio.sair({ voar: false });
  }

  function irPara(lugar) {
    sairDoModoBoneco();
    andar.selecionar(lugar);
    andar.focar(lugar);
    andar.olharPara(lugar, lado());
  }

  function abrirPainel(lugar) {
    if (parado || !LUGAR.has(lugar)) return;
    fecharPainelAtual();
    /* sem a prévia: ela acabou de sair com o painel anterior */
    const ocupada = montarOcupantes({ visitantes }).has(lugar);
    const modo = modoEditor(lugar, meu, { ocupada, mudando: Boolean(mudando) });
    if (!modo) { avisar(ocupada ? MSG_CONFLITO : MSG_SO_NA_SUA); return; }
    sairDoModoBoneco();
    const rascunho = modo === 'mudar' ? mudando : null;
    if (modo !== 'mudar') pararMudanca();
    const vez = ++vezEditor;
    previa = null;
    andar.selecionar(lugar);
    andar.focar(lugar);
    andar.olharPara(lugar, lado());
    mais.ligar(false);
    if (c.mudanca) c.mudanca.hidden = true;
    editor = ui.abrirEditor(c.editor, {
      lugar,
      meu,
      ocupada,
      mudando: modo === 'mudar',
      rascunho,
      mudou: (apelido, visual) => {
        if (vez !== vezEditor) return;
        previa = { lugar, apelido, visual };
        redesenhar();
      },
      salvar: (apelido, visual) => salvar(vez, lugar, apelido, visual),
      excluir: modo === 'editar' && banco && banco.sair ? () => excluir(vez) : null,
      mudarCadeira: modo === 'editar' ? (apelido, visual) => comecarMudanca(vez, apelido, visual) : null,
      fechar: () => { if (vez === vezEditor) encerrarPainel(); },
    });
    if (!editor) { encerrarPainel(); return; }
    redesenhar();
  }

  /* "Mudar de cadeira" no editor: o painel já fechou; os "+" voltam e a
     próxima cadeira livre escolhida abre o editor no modo "mudar" */
  function comecarMudanca(vez, apelido, visual) {
    if (vez !== vezEditor || !meu) return;
    editor = null;
    previa = null;
    vezEditor++;
    mudando = { apelido: apelido || meu.apelido, visual: visual || meu.visual };
    andar.selecionar(null);
    /* sai da vista de retrato (onde os "+" somem) para uma vista das bancadas em volta */
    const l = LUGAR.get(meu.lugar);
    if (l && typeof andar.irPara === 'function') andar.irPara(l.x, l.z);
    mais.ligar(true);
    if (c.mudanca) c.mudanca.hidden = false;
    else avisar(MSG_ESCOLHA);
    if (doc && doc.addEventListener) doc.addEventListener('keydown', escParaCancelar);
    redesenhar();
  }

  function escParaCancelar(e) { if (e.key === 'Escape' && mudando && !editor) cancelarMudanca(); }

  function pararMudanca() {
    mudando = null;
    if (c.mudanca) c.mudanca.hidden = true;
    if (doc && doc.removeEventListener) doc.removeEventListener('keydown', escParaCancelar);
  }

  /** Desiste de mudar de cadeira: tudo fica como estava. */
  function cancelarMudanca() {
    if (!mudando) return;
    pararMudanca();
    redesenhar();
  }

  /* fecha o painel aberto sem avisar a lista (ao abrir outro) */
  function fecharPainelAtual() {
    if (!editor) return;
    const e = editor;
    editor = null;
    vezEditor++;
    previa = null;
    e.fechar();
  }

  /* o painel saiu (cancelou ou salvou): solta os "+" e tira a prévia */
  function encerrarPainel() {
    editor = null;
    previa = null;
    vezEditor++;
    pararMudanca();
    andar.selecionar(null);
    mais.ligar(true);
    redesenhar();
  }

  /** Abre o editor numa cadeira livre qualquer (caminho para teclado e leitor
      de tela). Quem já sentou abre o próprio personagem, na cadeira dele. */
  function sentarEmLivre() {
    if (parado) return null;
    fecharPainelAtual();
    if (meu && !mudando) { abrirPainel(meu.lugar); return meu.lugar; }
    const livres = LUGARES.filter(l => !ocupadas.has(l.id));
    if (!livres.length) { avisar(MSG_LOTADO); return null; }
    const lugar = livres[Math.floor(aleatorio() * livres.length) % livres.length].id;
    abrirPainel(lugar);
    return lugar;
  }

  async function salvar(vez, lugar, apelido, visual) {
    if (!banco) throw new Error(MSG_SEM_BANCO);
    const anterior = meu;
    const novo = await banco.sentar(lugar, apelido, visual);
    meu = novo;
    /* o editor fecha sozinho ao salvar; aqui a cadeira já aparece como ocupada */
    visitantes = visitantes
      .filter(v => v.lugar !== novo.lugar && !(anterior && v.lugar === anterior.lugar))
      .concat(novo);
    if (vez === vezEditor) encerrarPainel();
    await recarregar();
    /* sentar pela primeira vez não mostra aviso: o boneco na cadeira já diz tudo */
    if (!anterior) return;
    avisar(anterior.lugar === novo.lugar
      ? msgEditado(novo.apelido)
      : `Pronto, ${novo.apelido} está sentado. Quem abrir o escritório vai ver você aqui.`);
  }

  /* "Excluir meu personagem": some da cadeira na hora e o apelido fica livre */
  async function excluir(vez) {
    if (!banco || !banco.sair) throw new Error(MSG_SEM_BANCO);
    const anterior = meu;
    await banco.sair();
    meu = null;
    if (anterior) visitantes = visitantes.filter(v => v.lugar !== anterior.lugar);
    if (vez === vezEditor) encerrarPainel();
    await recarregar();
    if (anterior) avisar(msgExcluido(anterior.apelido));
  }

  async function recarregar({ aoVivo = false } = {}) {
    const minha = ++seq;
    let lista = null;
    try {
      if (!banco) throw new Error(MSG_SEM_BANCO);
      lista = await comLimite(banco.listar(), tempoLimite);
    } catch {
      lista = null;
    }
    if (parado || minha !== seq) return;
    const antes = visitantes;
    if (lista) {
      visitantes = lista;
      c.carga.hidden = true;
    } else {
      c.cargaTexto.textContent = MSG_CARGA;
      c.carga.hidden = false;
    }
    redesenhar();
    /* alguém sentou na cadeira que a pessoa estava escolhendo */
    if (lista && editor && previa) {
      const outro = visitantes.some(v => v.lugar === previa.lugar) && !(meu && meu.lugar === previa.lugar);
      if (outro) { avisar(MSG_CONFLITO); return; }
    }
    /* com o editor aberto não distrai: quem chegou só aparece na cadeira */
    if (lista && aoVivo && carregouUmaVez && !editor) {
      const frase = fraseChegada(antes, lista, meu && meu.apelido);
      if (frase) avisar(frase);
    }
    if (lista) carregouUmaVez = true;
  }

  async function iniciar() {
    try { meu = banco ? await comLimite(banco.meu(), tempoLimite) : null; } catch { meu = null; }
    if (parado) return;
    redesenhar();
    await recarregar();
  }

  /* volta para a aba: o canal ao vivo pode ter caído enquanto ela estava escondida */
  const doc = palco.ownerDocument || (typeof document !== 'undefined' ? document : null);
  function aoVisibilidade() {
    if (!doc) return;
    if (doc.visibilityState === 'hidden') { escondidaDesde = Date.now(); return; }
    if (escondidaDesde && Date.now() - escondidaDesde > VOLTOU_DEPOIS) recarregar({ aoVivo: true });
    escondidaDesde = 0;
  }
  if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', aoVisibilidade);

  if (banco) {
    try { pararAoMudar = banco.aoMudar(() => { if (!parado) recarregar({ aoVivo: true }); }); } catch { pararAoMudar = null; }
  }
  const pronto = iniciar();

  return {
    andar,
    piadas,
    pronto,
    recarregar,
    abrir: abrirPainel,
    sentarEmLivre,
    avisar,
    cancelarMudanca,
    get aberto() { return Boolean(editor); },
    get mudando() { return Boolean(mudando); },
    get modo() { return banco ? banco.modo : 'sem'; },
    get meu() { return meu; },
    get pessoas() { return pessoas(); },
    parar() {
      if (parado) return;
      fecharPainelAtual();
      pararMudanca();
      parado = true;
      clearTimeout(timerAviso);
      if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', aoVisibilidade);
      try { if (pararAoMudar) pararAoMudar(); } catch { /* o canal já tinha fechado */ }
      mais.parar();
      piadas.parar();
      if (passeio.parar) passeio.parar();
      if (andar.parar) andar.parar();
    },
  };
}
