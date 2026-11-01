// O Simulador de escritório em 3D: o núcleo (ui/nucleo.js) com o andar em
// three.js, os "+" das cadeiras, o modo boneco e as piadas dos 15 fixos.
// A página do site e a página de teste carregam este arquivo só quando vão
// mostrar o 3D (import dinâmico), então o three não pesa em mais lugar nenhum.
import { criarAndar } from '../render/andar.js';
import { criarMais } from './mais.js';
import { criarBusca } from './busca.js';
import { criarPasseio } from './passeio.js';
import { abrirEditor } from './editor.js';
import { criarPiadas } from '../piadas/index.js';
import { criarNucleo, montarCamadas } from './nucleo.js';

export { montarOcupantes, montarCamadas, fraseChegada, MSG_CARGA, MSG_CONFLITO, MSG_LOTADO, msgExcluido } from './nucleo.js';

const UI_3D = { criarAndar, criarMais, criarBusca, criarPasseio, abrirEditor, montarCamadas, criarPiadas };

/**
 * @param palco  elemento onde o andar aparece (com altura definida)
 * @param banco  criarBancoSupabase(...) ou criarBancoLocal(), ou null
 * @param opcoes.ui  peças trocadas (usado nos testes)
 * @param opcoes.tempoLimite  ms até a leitura do banco contar como falha
 */
export function criarEscritorio(palco, banco, { ui: trocas = {}, ...resto } = {}) {
  const esc = criarNucleo(palco, banco, { ...resto, ui: { ...UI_3D, ...trocas } });
  /* o canvas não diz nada ao leitor de tela; quem precisa usa a busca ou a versão sem 3D */
  const tela = esc.andar && esc.andar.renderer && esc.andar.renderer.domElement;
  if (tela && tela.setAttribute) {
    tela.setAttribute('role', 'img');
    tela.setAttribute('aria-label', 'Andar do escritório em 3D. Para navegar pelo teclado, use a busca pelo apelido ou a versão sem 3D.');
  }
  return esc;
}
