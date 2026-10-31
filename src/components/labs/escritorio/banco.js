// Onde os personagens ficam guardados. Com o Supabase configurado, usa a API
// REST dele direto (sem biblioteca extra); sem configuração, cai no
// localStorage para dar para testar o simulador.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';
import { TOTAL } from './layout.js';
import { sanearApelido, sanearVisual } from './visual.js';

const TABELA = 'escritorio_personagens';
const CHAVE_LOCAL = 'escritorio:personagens';

export const online = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export class ErroBanco extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo; /* 'ocupado' | 'invalido' | 'rede' */
  }
}

/** Limpa uma lista vinda de fora: lugares válidos, sem repetição. */
export function sanearLista(linhas) {
  const vistos = new Set();
  const saida = [];
  for (const l of Array.isArray(linhas) ? linhas : []) {
    const lugar = Number(l && l.lugar);
    const apelido = sanearApelido(l && l.apelido);
    if (!Number.isInteger(lugar) || lugar < 0 || lugar >= TOTAL || vistos.has(lugar) || !apelido) continue;
    vistos.add(lugar);
    saida.push({ lugar, apelido, visual: sanearVisual(l.visual) });
  }
  return saida;
}

function urlTabela(consulta = '') {
  return `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${TABELA}${consulta}`;
}
const cabecalhos = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
});

function lerLocal() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '[]');
  } catch {
    return [];
  }
}

export async function listar() {
  if (!online) return sanearLista(lerLocal());
  let r;
  try {
    r = await fetch(urlTabela('?select=lugar,apelido,visual&order=lugar.asc'), {
      headers: cabecalhos(),
      cache: 'no-store',
    });
  } catch {
    throw new ErroBanco('rede', 'Sem conexão com o escritório agora.');
  }
  if (!r.ok) throw new ErroBanco('rede', 'O escritório não respondeu. Tente de novo daqui a pouco.');
  return sanearLista(await r.json());
}

export async function sentar(lugar, apelidoBruto, visualBruto) {
  const apelido = sanearApelido(apelidoBruto);
  if (!apelido) throw new ErroBanco('invalido', 'Escolha um apelido.');
  if (!Number.isInteger(lugar) || lugar < 0 || lugar >= TOTAL) throw new ErroBanco('invalido', 'Cadeira inválida.');
  const registro = { lugar, apelido, visual: sanearVisual(visualBruto) };

  if (!online) {
    const atual = sanearLista(lerLocal());
    if (atual.some(p => p.lugar === lugar)) throw new ErroBanco('ocupado', 'Essa cadeira já tem dono.');
    atual.push(registro);
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(atual));
    } catch {
      throw new ErroBanco('rede', 'Não deu para salvar neste navegador.');
    }
    return registro;
  }

  let r;
  try {
    r = await fetch(urlTabela(), {
      method: 'POST',
      headers: { ...cabecalhos(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(registro),
    });
  } catch {
    throw new ErroBanco('rede', 'Sem conexão. Seu personagem não foi salvo.');
  }
  if (r.status === 409) throw new ErroBanco('ocupado', 'Alguém acabou de sentar nessa cadeira.');
  if (r.status === 400) throw new ErroBanco('invalido', 'Esse apelido não passou. Tente outro.');
  if (!r.ok) throw new ErroBanco('rede', 'O escritório não aceitou agora. Tente de novo.');
  return registro;
}
