// Liga a página do Simulador de escritório (SimuladorEscritorio.astro).
// Este arquivo é pequeno de propósito: decide a versão (3D ou planta) e só
// então baixa o código dela com import dinâmico. O three e o andar em 3D só
// chegam ao navegador quando o 3D vai mesmo aparecer; o Supabase também só
// é baixado aqui, quando a página do escritório abre.
//
// ?planta abre a versão sem 3D, ?3d força o 3D, ?local usa o banco deste
// navegador (sem rede, para testar).
import { versaoDoAparelho, guardarPreferencia, testarWebGL, MOTIVOS } from './capacidade.js';

const MSG_FALHA_3D = 'Não deu para abrir o 3D aqui, então abrimos a planta vista de cima.';
const MSG_PERDEU_3D = 'O 3D parou de responder neste aparelho, então trocamos para a planta vista de cima.';

async function criarBanco(local) {
  try {
    const { criarBancoSupabase, criarBancoLocal } = await import('../dados/banco.js');
    if (local) return criarBancoLocal();
    const { SUPABASE } = await import('../dados/config.js');
    return criarBancoSupabase(SUPABASE);
  } catch {
    /* sem banco a planta ainda aparece, com os fixos e um aviso */
    return null;
  }
}

/**
 * @param raiz  o elemento .escritorio da página, com [data-esc="palco"] e
 *              [data-esc="barra"] dentro
 * @returns Promise do controle {versao, trocar(versao), parar()}
 */
export async function iniciarPagina(raiz) {
  const palco = raiz.querySelector('[data-esc="palco"]');
  const barra = raiz.querySelector('[data-esc="barra"]');
  const botao = acao => barra && barra.querySelector(`[data-acao="${acao}"]`);
  const busca = new URLSearchParams(location.search);
  const banco = await criarBanco(busca.has('local'));

  let esc = null;
  let versao = null;
  let fila = Promise.resolve();
  let soltarPerda = null;

  function limparPalco() {
    if (soltarPerda) { soltarPerda(); soltarPerda = null; }
    if (esc) { try { esc.parar(); } catch { /* já parou */ } esc = null; }
    palco.replaceChildren();
    palco.className = 'esc-palco';
  }

  function atualizarBarra() {
    if (!barra) return;
    raiz.dataset.versao = versao;
    for (const b of barra.querySelectorAll('[data-so3d]')) b.hidden = versao !== '3d';
    const disco = botao('discoteca');
    if (disco) disco.setAttribute('aria-pressed', 'false');
    const troca = botao('versao');
    if (troca) {
      const semWebgl = versao === 'planta' && !testarWebGL().ok;
      troca.textContent = versao === '3d' ? 'Ver sem 3D' : 'Ver em 3D';
      troca.disabled = semWebgl;
      troca.title = semWebgl ? 'Este navegador não mostra 3D' : '';
    }
  }

  async function montar(v, motivo = null) {
    limparPalco();
    palco.setAttribute('aria-busy', 'true');
    const carregando = document.createElement('p');
    carregando.className = 'esc-carregando';
    carregando.textContent = v === '3d' ? 'Carregando o escritório em 3D…' : 'Carregando a planta do escritório…';
    palco.appendChild(carregando);
    try {
      if (v === '3d') {
        const { criarEscritorio } = await import('./escritorio.js');
        carregando.remove();
        esc = criarEscritorio(palco, banco);
        /* GPU travou ou faltou memória: troca sozinho para a planta */
        if (esc.andar.aoPerderContexto) soltarPerda = esc.andar.aoPerderContexto(() => trocar('planta', 'perdeu', false));
      } else {
        const { criarEscritorioPlanta } = await import('./planta2d.js');
        carregando.remove();
        esc = criarEscritorioPlanta(palco, banco);
      }
      versao = v;
    } catch (e) {
      if (v === '3d') return await montar('planta', 'falhou');
      limparPalco();
      const p = document.createElement('p');
      p.className = 'esc-carregando';
      p.textContent = 'Não deu para abrir o escritório agora. Recarregue a página para tentar de novo.';
      palco.appendChild(p);
      versao = null;
      throw e;
    } finally {
      palco.removeAttribute('aria-busy');
    }
    atualizarBarra();
    const frase = motivo === 'falhou' ? MSG_FALHA_3D : motivo === 'perdeu' ? MSG_PERDEU_3D : MOTIVOS[motivo];
    if (frase) esc.avisar(frase);
    return esc;
  }

  /* trocas em fila: dois cliques rápidos não montam duas versões juntas */
  function trocar(v, motivo = null, guardar = true) {
    if (guardar) guardarPreferencia(v);
    fila = fila.then(() => montar(v, motivo)).catch(() => {});
    return fila;
  }

  if (barra) {
    barra.addEventListener('click', ev => {
      const b = ev.target.closest && ev.target.closest('[data-acao]');
      if (!b || !esc) return;
      const acao = b.dataset.acao;
      if (acao === 'sentar') esc.sentarEmLivre();
      else if (acao === 'versao') trocar(versao === '3d' ? 'planta' : '3d');
      else if (versao !== '3d') return;
      else if (acao === 'sanduiche') esc.piadas.sanduiche();
      else if (acao === 'fuga') esc.piadas.fuga();
      else if (acao === 'discoteca') b.setAttribute('aria-pressed', String(Boolean(esc.piadas.discoteca())));
      else if (acao === 'tudo') esc.andar.vista3d();
      else if (acao === 'cima') esc.andar.vistaTopo();
    });
  }

  const inicio = versaoDoAparelho(window);
  fila = montar(inicio.versao, inicio.motivo).catch(() => {});
  await fila;

  return {
    get versao() { return versao; },
    get escritorio() { return esc; },
    trocar,
    parar: limparPalco,
  };
}
