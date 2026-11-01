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

/* sessão anônima que o banco não aceita mais (expirou, ou foi apagada no painel) */
const sessaoVencida = e => Boolean(e) && (e.status === 401 || e.code === 'PGRST301' || e.code === 'PGRST303' || /jwt/i.test(e.message || ''));

/** Espera a promessa, mas desiste depois de ms. */
function comLimite(promessa, ms) {
  let relogio;
  const limite = new Promise((_, rejeita) => { relogio = setTimeout(() => rejeita(erro('rede')), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

export function criarBancoSupabase({ url, chave }, { cliente, tempoLimite = 15000 } = {}) {
  const sb = cliente || createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'rafinha-escritorio-auth' },
  });
  let ultimos = [];
  let cacheMeu;

  async function temSessao() {
    const { data } = await sb.auth.getSession();
    return Boolean(data && data.session);
  }

  async function entrar() {
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw erro(error.status === 429 ? 'muitos' : 'sem_sessao');
  }

  async function gravar(lugar, apelido, visual, deNovo = false) {
    /* o login anônimo só acontece aqui, na hora de sentar: quem só olha não cria conta */
    if (!(await temSessao())) await entrar();
    const { data, error } = await sb.rpc('escritorio_sentar', { p_lugar: lugar, p_apelido: apelido, p_visual: visual });
    if (error) {
      /* renova a sessão e tenta uma vez; um login novo faria a pessoa perder
         o personagem que já tem (e o apelido dela ficaria "em uso") */
      if (sessaoVencida(error)) {
        if (deNovo || !sb.auth.refreshSession) throw erro('sem_sessao');
        const { error: falhou } = await sb.auth.refreshSession();
        if (falhou) throw erro('sem_sessao');
        return gravar(lugar, apelido, visual, true);
      }
      throw erro(MENSAGENS[error.message] ? error.message : 'rede');
    }
    cacheMeu = { lugar, apelido: (data && data.apelido) || apelido, visual };
    return cacheMeu;
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
      try {
        return await comLimite(gravar(lugar, apelido, visual), tempoLimite);
      } catch (e) {
        /* qualquer coisa fora do previsto (rede caiu, demorou) vira frase em português */
        throw e instanceof ErroBanco ? e : erro('rede');
      }
    },

    aoMudar(fn) {
      let espera = 0;
      const avisa = () => { clearTimeout(espera); espera = setTimeout(fn, 250); };
      const canal = sb.channel('escritorio-personagens')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'escritorio_personagens' }, avisa)
        /* a cada (re)conexão lê de novo: cobre quem sentou entre a primeira
           leitura e o canal abrir, e o que passou enquanto ele estava caído */
        .subscribe(estado => { if (estado === 'SUBSCRIBED') avisa(); });
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
    aoMudar(fn) {
      ouvintes.add(fn);
      /* outra aba deste navegador sentou: imita o tempo real do Supabase */
      const deOutraAba = e => { if (e.key === CHAVE) fn(); };
      if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', deOutraAba);
      return () => {
        ouvintes.delete(fn);
        if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('storage', deOutraAba);
      };
    },
  };
}
