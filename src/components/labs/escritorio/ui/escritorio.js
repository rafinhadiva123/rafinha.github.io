// Controlador do Simulador de escritório. Monta o andar, os "+" das cadeiras
// livres, a busca, o modo boneco e o editor, e liga tudo ao banco (online ou
// local). Não sabe de página nem de URL: recebe o palco (elemento) e um banco
// com a interface de dados/banco.js. A página de teste e, no Bloco 6, o site
// usam este mesmo controlador.
//
// Regras:
// - Quem ocupa uma cadeira = FIXOS + visitantes do banco + prévia do editor
//   (a prévia só aparece em cadeira livre).
// - "+" e busca saem do modo boneco antes de agir.
// - A atualização ao vivo (banco.aoMudar) recarrega a lista sem mexer no editor.
// - Se o banco não carrega, a planta fica com os 15 fixos e um aviso.
// - Os 15 fixos são desenhados pela camada de piadas (../piadas), não pela
//   multidão; a multidão pula essas cadeiras (andar.reservarLugares).
import '../escritorio.css';
import { criarAndar } from '../render/andar.js';
import { criarMais } from './mais.js';
import { criarBusca } from './busca.js';
import { criarPasseio } from './passeio.js';
import { abrirEditor } from './editor.js';
import { criarPiadas } from '../piadas/index.js';
import { FIXOS } from '../planta/fixos.js';
import { LUGAR } from '../planta/lugares.js';
import { paraBoneco } from '../visual.js';

export const MSG_CARGA = 'Não deu para carregar quem está no escritório agora. Os 15 de sempre continuam nas cadeiras.';
export const MSG_CONFLITO = 'Alguém sentou nessa cadeira enquanto você escolhia. Escolha outra.';
const MSG_SEM_BANCO = 'Sem conexão com o escritório agora. Tente de novo em instantes.';

/**
 * Quem ocupa cada cadeira agora: fixos, visitantes e a prévia do editor.
 * Pura. Quem já está numa cadeira não é trocado pela prévia.
 */
export function montarOcupantes({ visitantes = [], previa = null } = {}) {
  const mapa = new Map();
  for (const f of FIXOS) mapa.set(f.lugar, f);
  for (const v of visitantes) {
    if (!mapa.has(v.lugar)) mapa.set(v.lugar, { ...paraBoneco(v.apelido, v.visual), apelido: v.apelido });
  }
  if (previa && !mapa.has(previa.lugar)) {
    mapa.set(previa.lugar, { ...paraBoneco(previa.apelido, previa.visual), apelido: previa.apelido });
  }
  return mapa;
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
  const carga = el('div', 'esc-carga', { role: 'alert' });
  carga.hidden = true;
  const cargaTexto = el('p', 'esc-carga-texto');
  const cargaBotao = el('button', 'esc-tentar', { type: 'button' });
  cargaBotao.textContent = 'Tentar de novo';
  cargaBotao.addEventListener('click', () => tentarDeNovo());
  carga.append(cargaTexto, cargaBotao);
  palco.append(camada, busca, editor, aviso, carga);
  return { camada, busca, editor, aviso, carga, cargaTexto };
}

const UI_PADRAO = { criarAndar, criarMais, criarBusca, criarPasseio, abrirEditor, montarCamadas, criarPiadas };
const TEMPO_LIMITE = 10000;   /* ms: leitura que demora mais que isso conta como falha */

/** Espera a promessa, mas desiste depois de ms (pendurar também é falha). */
function comLimite(promessa, ms) {
  let relogio;
  const limite = new Promise((_, rejeita) => { relogio = setTimeout(() => rejeita(new Error('demorou demais')), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

/**
 * @param palco  elemento onde o andar aparece (com altura definida)
 * @param banco  criarBancoSupabase(...) ou criarBancoLocal(); pode ser null se
 *               nem deu para montar o banco (aí a planta sai só com os fixos)
 * @param opcoes.ui  peças trocadas (usado nos testes)
 * @param opcoes.tempoLimite  ms até a leitura do banco contar como falha
 * @returns {pronto, andar, recarregar(), parar(), aberto, modo}
 */
export function criarEscritorio(palco, banco, { ui: trocas = {}, tempoLimite = TEMPO_LIMITE } = {}) {
  const ui = { ...UI_PADRAO, ...trocas };
  let parado = false;
  let visitantes = [];        /* lista do banco, sem os fixos */
  let meu = null;             /* {lugar, apelido, visual} de quem já sentou */
  let previa = null;          /* {lugar, apelido, visual} do editor aberto agora */
  let ocupadas = new Set(FIXOS.map(f => f.lugar));
  let editor = null;          /* retorno de abrirEditor, se houver painel aberto */
  let vezEditor = 0;          /* identifica o painel atual: um salvar antigo não mexe no novo */
  let seq = 0;                /* a leitura mais nova vence */
  let timerAviso = null;
  let pararAoMudar = null;

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
    const mapa = montarOcupantes({ visitantes, previa });
    ocupadas = new Set(mapa.keys());
    andar.definirOcupantes(mapa);
    mais.atualizar();
  }

  const mais = ui.criarMais(c.camada, andar, {
    ocupados: () => ocupadas,
    escolher: lugar => abrirPainel(lugar),
  });
  const passeio = ui.criarPasseio(palco, andar, { avisar });
  /* as piadas dos 15 fixos; no modo boneco o clique é para andar, não para elas */
  const piadas = ui.criarPiadas(andar, { avisar, bloqueado: () => passeio.ativo });
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
    if (ocupadas.has(lugar)) { avisar(MSG_CONFLITO); return; }
    sairDoModoBoneco();
    const vez = ++vezEditor;
    previa = null;
    andar.selecionar(lugar);
    andar.focar(lugar);
    andar.olharPara(lugar, lado());
    mais.ligar(false);
    editor = ui.abrirEditor(c.editor, {
      lugar,
      meu,
      mudou: (apelido, visual) => {
        if (vez !== vezEditor) return;
        previa = { lugar, apelido, visual };
        redesenhar();
      },
      salvar: (apelido, visual) => salvar(vez, lugar, apelido, visual),
      fechar: () => { if (vez === vezEditor) encerrarPainel(); },
    });
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
    andar.selecionar(null);
    mais.ligar(true);
    redesenhar();
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
    avisar(`Pronto, ${novo.apelido} está sentado. Quem abrir o escritório vai ver você aqui.`);
  }

  async function recarregar() {
    const minha = ++seq;
    let lista = null;
    try {
      if (!banco) throw new Error(MSG_SEM_BANCO);
      lista = await comLimite(banco.listar(), tempoLimite);
    } catch {
      lista = null;
    }
    if (parado || minha !== seq) return;
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
      if (outro) avisar(MSG_CONFLITO);
    }
  }

  async function iniciar() {
    try { meu = banco ? await banco.meu() : null; } catch { meu = null; }
    redesenhar();
    await recarregar();
  }

  if (banco) {
    try { pararAoMudar = banco.aoMudar(() => { if (!parado) recarregar(); }); } catch { pararAoMudar = null; }
  }
  const pronto = iniciar();

  return {
    andar,
    piadas,
    pronto,
    recarregar,
    get aberto() { return Boolean(editor); },
    get modo() { return banco ? banco.modo : 'sem'; },
    parar() {
      if (parado) return;
      parado = true;
      clearTimeout(timerAviso);
      try { if (pararAoMudar) pararAoMudar(); } catch { /* o canal já tinha fechado */ }
      mais.parar();
      piadas.parar();
    },
  };
}
