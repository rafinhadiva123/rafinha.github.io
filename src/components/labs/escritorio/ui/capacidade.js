// Decide se a página abre o andar em 3D ou a planta sem 3D. Sem three:
// roda antes de baixar qualquer coisa pesada.
//
// Ordem: o endereço (?planta ou ?3d) > a escolha que a pessoa fez antes
// (guardada neste navegador) > sem WebGL > aparelho fraco > economia de dados.

export const CHAVE_PREFERENCIA = 'escritorio:versao';

export const MOTIVOS = {
  'sem-webgl': 'Este navegador não mostra 3D, então abrimos a planta vista de cima.',
  fraco: 'Para não pesar neste aparelho, abrimos a planta vista de cima.',
  economia: 'O modo de economia de dados está ligado, então abrimos a planta vista de cima.',
};

/** Testa o WebGL sem guardar nada: {ok, lento}. lento = só por software. */
export function testarWebGL(doc = globalThis.document) {
  try {
    const cv = doc.createElement('canvas');
    const soltar = gl => { try { gl && gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* nada */ } };
    const opcoes = { failIfMajorPerformanceCaveat: true };
    let gl = cv.getContext('webgl2', opcoes) || cv.getContext('webgl', opcoes);
    if (gl) { soltar(gl); return { ok: true, lento: false }; }
    const cv2 = doc.createElement('canvas');
    gl = cv2.getContext('webgl2') || cv2.getContext('webgl');
    if (gl) { soltar(gl); return { ok: true, lento: true }; }
  } catch { /* sem canvas */ }
  return { ok: false, lento: false };
}

/**
 * Pura: recebe o que dá para saber do aparelho e devolve {versao, motivo}.
 * versao: '3d' | 'planta'; motivo: null (escolha da pessoa) ou uma chave de MOTIVOS.
 */
export function escolherVersao({ busca = '', preferencia = null, webgl = { ok: true, lento: false }, memoria, nucleos, economia = false } = {}) {
  const q = new URLSearchParams(busca);
  if (q.has('planta')) return { versao: 'planta', motivo: null };
  if (!webgl.ok) return { versao: 'planta', motivo: 'sem-webgl' };
  if (q.has('3d')) return { versao: '3d', motivo: null };
  if (preferencia === 'planta' || preferencia === '3d') return { versao: preferencia, motivo: null };
  if (webgl.lento || (memoria && memoria <= 2) || (nucleos && nucleos <= 2)) return { versao: 'planta', motivo: 'fraco' };
  if (economia) return { versao: 'planta', motivo: 'economia' };
  return { versao: '3d', motivo: null };
}

/** Lê o aparelho de verdade e chama escolherVersao. */
export function versaoDoAparelho(win = globalThis.window) {
  let preferencia = null;
  try { preferencia = win.localStorage.getItem(CHAVE_PREFERENCIA); } catch { /* navegação privada */ }
  const nav = win.navigator || {};
  return escolherVersao({
    busca: win.location ? win.location.search : '',
    preferencia,
    webgl: testarWebGL(win.document),
    memoria: nav.deviceMemory,
    nucleos: nav.hardwareConcurrency,
    economia: Boolean(nav.connection && nav.connection.saveData),
  });
}

export function guardarPreferencia(versao, win = globalThis.window) {
  try { win.localStorage.setItem(CHAVE_PREFERENCIA, versao); } catch { /* sem armazenamento: vale só agora */ }
}
