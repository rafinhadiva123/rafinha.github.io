// Camada de piadas do Simulador de escritório (Bloco 5).
//
// Desenha os 15 fixos com o braço esquerdo, a cabeça e a boca soltos (é isso
// que deixa a Lika comer, a Jana filmar e todos dançarem) e liga as piadas do
// simulador antigo: sanduíche + filmagem, fuga do armário, pilha de papel,
// porta-retrato, discoteca e quadro branco.
//
// Regra: nenhuma piada guarda coordenada solta. Cada uma se prende a uma
// personagem (pelo apelido; a cadeira dela é lida na hora) ou a um ponto
// nomeado de planta/dados.js (PONTOS). Por isso as piadas sobrevivem a
// mudança de layout e a troca de cadeira. Parado, nada aqui gasta bateria:
// o laço só pede quadro novo enquanto alguma piada está rodando.
import * as THREE from 'three';
import { FIXOS } from '../planta/fixos.js';
import { PONTOS } from '../planta/dados.js';
import { fazBoneco, compactar } from '../render/boneco.js';
import { criarMotor } from './motor.js';

/** Os 15 fixos como pessoas das piadas (corpo com rig), cada um na sua cadeira. */
export function montarPessoas(cena, fixos = FIXOS) {
  return fixos.map((f, i) => {
    const { grupo, rig } = compactar(fazBoneco(f, i));
    cena.add(grupo);
    return {
      nome: f.apelido, i, p: f, g: grupo, rig,
      flags: {
        sanduiche: !!f.sanduiche, filma: !!f.filma, perseguidor: !!f.perseguidor,
        acumulador: !!f.acumulador, retrato: f.retrato || null,
      },
      lugarPadrao: f.lugar, lugar: f.lugar,
    };
  });
}

/**
 * @param andar  o que criarAndar devolve (cena, colisao, raioEm, marcar, voar,
 *               reservarLugares, renderer)
 * @param opcoes.avisar     recebe uma frase curta em português ("Lika está ocupada")
 * @param opcoes.bloqueado  true enquanto o clique é de outra coisa (modo boneco)
 * @param opcoes.pontos     os pontos nomeados (padrão: planta/dados.js)
 */
export function criarPiadas(andar, { avisar = () => {}, bloqueado = () => false, pontos = PONTOS, fixos = FIXOS } = {}) {
  const pessoas = montarPessoas(andar.cena, fixos);
  const motor = criarMotor({ andar, pessoas, PONTOS: pontos });
  for (const p of pessoas) motor.sentar(p, p.lugar);
  andar.reservarLugares(pessoas.map(p => p.lugar));   /* a multidão não repete os 15 */
  andar.marcar();

  const porNome = nome => pessoas.find(p => p.nome === nome);

  /* laço: só pede quadro novo enquanto alguma piada anima */
  let anterior = performance.now() / 1000;
  let quadroId = 0;
  let parado = false;
  function quadro(ms) {
    if (parado) return;
    const t = ms / 1000;
    const dt = Math.min(0.5, t - anterior);   /* tempo real, mesmo com quadros lentos */
    anterior = t;
    if (motor.atualizar(t, dt)) andar.marcar();
    quadroId = requestAnimationFrame(quadro);
  }
  quadroId = requestAnimationFrame(quadro);

  /* clique (ou toque) numa personagem ou no armário; arrasto de câmera não conta */
  const tela = andar.renderer && andar.renderer.domElement;
  const raio = new THREE.Raycaster();
  let aperto = null;
  const abaixo = e => { aperto = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const acima = e => {
    if (!aperto) return;
    const movido = Math.hypot(e.clientX - aperto.x, e.clientY - aperto.y);
    const demora = performance.now() - aperto.t;
    aperto = null;
    if (movido > 6 || demora > 500 || bloqueado()) return;
    const o = andar.raioEm(e.clientX, e.clientY);
    raio.set(new THREE.Vector3(o.origem.x, o.origem.y, o.origem.z), new THREE.Vector3(o.direcao.x, o.direcao.y, o.direcao.z).normalize());
    const hit = raio.intersectObjects([...pessoas.map(p => p.g), ...motor.alvosClique], true)[0];
    if (!hit) return;
    const r = motor.clicar(hit.object);
    if (r && r.msg) avisar(r.msg);
  };
  if (tela) {
    tela.addEventListener('pointerdown', abaixo);
    tela.addEventListener('pointerup', acima);
  }

  const resposta = r => { if (r && r.msg) avisar(r.msg); return Boolean(r && r.ok); };

  return {
    pessoas,
    motor,
    /** A Lika come o sanduíche e a Jana filma. */
    sanduiche() { return resposta(motor.comerSanduiche(porNome('Lika'))); },
    /** O homem do armário do jurídico foge até a Saída Norte; o perseguidor sai atrás. */
    fuga() { return resposta(motor.iniciarFuga()); },
    /** Liga ou desliga a discoteca; devolve true se ligou. */
    discoteca() { return motor.alternarDisco(); },
    /** Manda uma personagem fixa para outra cadeira (a piada vai junto). */
    mudarLugar(apelido, lugar) {
      const p = porNome(apelido);
      return Boolean(p) && motor.andarPara(p, lugar);
    },
    get discotecaLigada() { return motor.discoLigada; },
    get ocupada() { return motor.fugaAtiva || motor.discoLigada || motor.pessoasAndando > 0 || Boolean(motor.filmando); },
    resumo: () => motor.resumo(),
    parar() {
      parado = true;
      cancelAnimationFrame(quadroId);
      if (tela) {
        tela.removeEventListener('pointerdown', abaixo);
        tela.removeEventListener('pointerup', acima);
      }
    },
  };
}
