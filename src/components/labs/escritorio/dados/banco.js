// O que o site usa para ler e salvar personagens. Duas versões com a mesma
// cara: a online (Supabase, login anônimo, atualização ao vivo) e a local
// (só neste navegador, para desenvolver e testar sem rede).
//
// Interface:
//   listar()                     → [{lugar, apelido, visual}] dos visitantes
//   meu()                        → {lugar, apelido, visual} | null
//   sentar(lugar, apelido, vis.) → salva (ou muda de cadeira); lança ErroBanco
//   aoMudar(fn)                  → chama fn quando alguém senta; devolve "parar"
//
// Tudo que vem do banco passa pela limpeza de visual.js antes de chegar na
// cena: qualquer pessoa consegue falar com a API direto.
import { createClient } from '@supabase/supabase-js';
import { LUGAR } from '../planta/lugares.js';
import { APELIDOS_RESERVADOS, chaveApelido } from '../planta/fixos.js';
import { sanearApelido, sanearVisual } from '../visual.js';

export class ErroBanco extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

export const MENSAGENS = {
  lugar_ocupado: 'Alguém acabou de sentar nessa cadeira. Escolha outra.',
  apelido_em_uso: 'Esse apelido já tem dono. Escolha outro.',
  apelido_invalido: 'O apelido precisa ter de 1 a 18 caracteres.',
  visual_invalido: 'Esse visual não passou. Tente sortear de novo.',
  lugar_invalido: 'Essa cadeira não está disponível.',
  sem_sessao: 'Não deu para entrar agora. Tente de novo em instantes.',
  muitos: 'Muita gente entrando ao mesmo tempo. Tente de novo em alguns minutos.',
  rede: 'Sem conexão com o escritório agora. Tente de novo.',
};
const erro = codigo => new ErroBanco(codigo, MENSAGENS[codigo] || MENSAGENS.rede);

/** Limpa a lista vinda de fora: cadeira que existe no layout, sem repetir. */
export function sanearLinhas(linhas) {
  const vistos = new Set();
  const saida = [];
  for (const l of Array.isArray(linhas) ? linhas : []) {
    if (!l || l.fixo) continue;
    const apelido = sanearApelido(l.apelido);
    if (typeof l.lugar !== 'string' || !LUGAR.has(l.lugar) || vistos.has(l.lugar) || !apelido) continue;
    vistos.add(l.lugar);
    saida.push({ lugar: l.lugar, apelido, visual: sanearVisual(l.visual) });
  }
  return saida;
}

/** Confere antes de mandar, para responder na hora. O banco confere de novo. */
function conferir(lugar, apelidoBruto, ocupados, meuApelido) {
  const apelido = sanearApelido(apelidoBruto);
  if (!apelido) throw erro('apelido_invalido');
  if (!LUGAR.has(lugar)) throw erro('lugar_invalido');
  const chave = chaveApelido(apelido);
  if (APELIDOS_RESERVADOS.has(chave)) throw erro('apelido_em_uso');
  const dono = ocupados.find(o => o.lugar === lugar);
  if (dono && chaveApelido(dono.apelido) !== chaveApelido(meuApelido || '')) throw erro('lugar_ocupado');
  if (ocupados.some(o => chaveApelido(o.apelido) === chave && chaveApelido(o.apelido) !== chaveApelido(meuApelido || ''))) throw erro('apelido_em_uso');
  return apelido;
}

/* ------------------------------------------------------------------ online */

export function criarBancoSupabase({ url, chave }, { cliente } = {}) {
  const sb = cliente || createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'rafinha-escritorio-auth' },
  });
  let ultimos = [];
  let cacheMeu;

  async function temSessao() {
    const { data } = await sb.auth.getSession();
    return Boolean(data && data.session);
  }

  return {
    modo: 'online',

    async listar() {
      const { data, error } = await sb.from('escritorio_personagens')
        .select('lugar, apelido, visual, fixo')
        .not('lugar', 'is', null);
      if (error) throw erro('rede');
      ultimos = sanearLinhas(data);
      return ultimos;
    },

    async meu() {
      if (!(await temSessao())) return null;
      const { data, error } = await sb.rpc('escritorio_meu');
      if (error || !data || !data.apelido) return (cacheMeu = null);
      cacheMeu = { lugar: data.lugar, apelido: sanearApelido(data.apelido), visual: sanearVisual(data.visual) };
      return cacheMeu;
    },

    async sentar(lugar, apelidoBruto, visualBruto) {
      const apelido = conferir(lugar, apelidoBruto, ultimos, cacheMeu && cacheMeu.apelido);
      const visual = sanearVisual(visualBruto);
      /* o login anônimo só acontece aqui, na hora de sentar: quem só olha não cria conta */
      if (!(await temSessao())) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) throw erro(error.status === 429 ? 'muitos' : 'sem_sessao');
      }
      const { data, error } = await sb.rpc('escritorio_sentar', { p_lugar: lugar, p_apelido: apelido, p_visual: visual });
      if (error) throw erro(MENSAGENS[error.message] ? error.message : 'rede');
      cacheMeu = { lugar, apelido: data.apelido, visual };
      return cacheMeu;
    },

    aoMudar(fn) {
      let espera = 0;
      const canal = sb.channel('escritorio-personagens')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'escritorio_personagens' }, () => {
          clearTimeout(espera);
          espera = setTimeout(fn, 250);
        })
        .subscribe();
      return () => { clearTimeout(espera); sb.removeChannel(canal); };
    },
  };
}

/* ------------------------------------------------------------------- local */

export function criarBancoLocal(armazenamento = globalThis.localStorage) {
  const CHAVE = 'escritorio:local';
  const ouvintes = new Set();
  const ler = () => {
    try { return JSON.parse(armazenamento.getItem(CHAVE)) || { lista: [], meu: null }; } catch { return { lista: [], meu: null }; }
  };
  const gravar = d => {
    try { armazenamento.setItem(CHAVE, JSON.stringify(d)); } catch { throw erro('rede'); }
  };
  return {
    modo: 'local',
    async listar() { return sanearLinhas(ler().lista); },
    async meu() {
      const d = ler();
      return d.meu ? d.lista.find(p => p.apelido === d.meu) || null : null;
    },
    async sentar(lugar, apelidoBruto, visualBruto) {
      const d = ler();
      const apelido = conferir(lugar, apelidoBruto, sanearLinhas(d.lista), d.meu);
      const novo = { lugar, apelido, visual: sanearVisual(visualBruto) };
      d.lista = d.lista.filter(p => p.apelido !== d.meu).concat(novo);
      d.meu = apelido;
      gravar(d);
      ouvintes.forEach(f => f());
      return novo;
    },
    aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
  };
}
