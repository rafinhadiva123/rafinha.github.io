// O andar em 3D: cenário mesclado, móveis instanciados, multidão com dois
// níveis de detalhe e câmera orbital. As zonas da planta não aparecem na
// tela; o que vai por cima do canvas (botões "+", busca) é da pasta ui/ e
// se reposiciona pelo aviso `aoDesenhar`. Só redesenha quando alguma coisa muda
// (câmera mexendo, animação rodando, gente sentando); parado, não gasta
// bateria. A sombra é calculada uma vez, porque nada que faz sombra se mexe.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LUGARES, LUGAR } from '../planta/lugares.js';
import { montarCenario } from './cenario.js';
import { mesclarEstatico } from './estatico.js';
import { montarMoveis } from './moveis.js';
import { criarMultidao } from './multidao.js';
import { montarColisao } from './colisao.js';

export function criarAndar(palco) {
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  /* sem conversão de cor na saída, igual à planta original */
  palco.prepend(renderer.domElement);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.maxPolarAngle = 1.45;
  controles.minDistance = 2.5;
  controles.maxDistance = 180;
  controles.screenSpacePanning = false;
  controles.zoomSpeed = 1.4;          /* chega perto do chão com menos giros da roda */

  let sujo = true;
  const marcar = () => { sujo = true; };
  controles.addEventListener('change', marcar);

  function lerFundo() {
    const c = getComputedStyle(palco).getPropertyValue('--scene').trim() || '#e3e6eb';
    cena.background = new THREE.Color(c);
    marcar();
  }
  lerFundo();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', lerFundo);
  new MutationObserver(lerFundo).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-tema'] });

  cena.add(new THREE.HemisphereLight(0xffffff, 0xb7b0a2, 0.78));
  const sol = new THREE.DirectionalLight(0xffffff, 0.55);
  sol.position.set(20, 45, 40);
  sol.target.position.set(33, 0, 16);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -70, right: 70, top: 60, bottom: -60, near: 1, far: 120 });
  sol.shadow.bias = -0.0006;
  cena.add(sol, sol.target);

  /* cenário fixo, mesclado por material */
  const mundo = new THREE.Group();
  const { M } = montarCenario(mundo);
  /* o mapa do modo boneco sai das peças antes de elas virarem uma malha só */
  const colisao = montarColisao(mundo);
  const mescla = mesclarEstatico(mundo);
  cena.add(mundo);
  cena.add(montarMoveis(M));
  const multidao = criarMultidao(cena);

  /* anel de seleção no chão, na cor de destaque da página */
  const corDestaque = () => getComputedStyle(palco).getPropertyValue('--accent').trim() || '#24306b';
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 40), new THREE.MeshBasicMaterial({ color: corDestaque(), transparent: true, opacity: 0.9, depthWrite: false }));
  anel.rotation.x = -Math.PI / 2;
  anel.visible = false;
  anel.renderOrder = 2;
  cena.add(anel);
  renderer.shadowMap.needsUpdate = true;

  /* câmera: voo suave entre vistas */
  let voo = null, modo = '3d';
  function voarPara(pos, alvo, ms) {
    if (voo && voo.fim) voo.fim();
    return new Promise(fim => {
      voo = { p0: camera.position.clone(), t0: controles.target.clone(), p1: pos, t1: alvo, ini: performance.now(), ms: reduz ? 0 : ms || 900, fim };
      marcar();
    });
  }
  const posInicial = () => {
    const k = Math.max(1, Math.pow(1.4 / Math.max(camera.aspect, 0.3), 0.85));
    return new THREE.Vector3(20 - 24 * k, 54 * k, 12 + 62 * k);
  };
  function vista3d() { modo = '3d'; controles.maxPolarAngle = 1.45; voarPara(posInicial(), new THREE.Vector3(20, 0, 12)); }
  function vistaTopo() {
    modo = 'topo';
    const k = Math.max(1, 1.6 / Math.max(camera.aspect, 0.3));
    voarPara(new THREE.Vector3(20, 118 * k, 10.9), new THREE.Vector3(20, 0, 10.8));
  }
  function irPara(x, z, dist = 9) { voarPara(new THREE.Vector3(x - dist * 0.6, dist, z + dist), new THREE.Vector3(x, 0, z)); }

  /** Câmera de frente para quem senta na cadeira. painel: 'direita' deixa o
      boneco à esquerda da tela; 'baixo' deixa o boneco na metade de cima. */
  function olharPara(id, painel) {
    const l = LUGAR.get(id);
    if (!l) return;
    modo = '3d';
    controles.maxPolarAngle = 1.45;
    const frente = new THREE.Vector3(Math.sin(l.giro), 0, Math.cos(l.giro));
    /* por cima dos monitores: a câmera fica do outro lado da bancada, alta, olhando o rosto */
    const alvo = new THREE.Vector3(l.x, 1.25 + (l.dy || 0), l.z);
    const pos = alvo.clone().addScaledVector(frente, 2.5).add(new THREE.Vector3(0, 1.45, 0));
    if (painel === 'direita') {
      const direita = new THREE.Vector3().crossVectors(frente.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
      alvo.addScaledVector(direita, 0.95); pos.addScaledVector(direita, 0.95);
    } else if (painel === 'baixo') {
      alvo.y -= 0.85; pos.y += 0.5; pos.addScaledVector(frente, 0.8);
    }
    voarPara(pos, alvo, 1000);
  }

  /** Ponto do chão embaixo do ponto da tela (clientX, clientY), ou null. */
  const raio = new THREE.Raycaster(), acerto = new THREE.Vector3();
  const chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), assento = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
  function raioDaTela(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    raio.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
  }
  /** Raio que sai da câmera pelo ponto da tela: {origem, direcao} ({x,y,z}). */
  function raioEm(cx, cy) {
    raioDaTela(cx, cy);
    const o = raio.ray.origin, d = raio.ray.direction;
    return { origem: { x: o.x, y: o.y, z: o.z }, direcao: { x: d.x, y: d.y, z: d.z } };
  }
  function pontoNoChao(cx, cy) {
    raioDaTela(cx, cy);
    return raio.ray.intersectPlane(chao, acerto) ? { x: acerto.x, z: acerto.z } : null;
  }

  /** Qual cadeira está embaixo do ponto da tela (clientX, clientY), ou null. */
  function lugarEm(cx, cy) {
    raioDaTela(cx, cy);
    if (!raio.ray.intersectPlane(assento, acerto)) return null;
    let melhor = null, d = 0.7;
    for (const l of LUGARES) {
      const e = Math.hypot(l.x - acerto.x, l.z - acerto.z);
      if (e < d) { d = e; melhor = l.id; }
    }
    return melhor;
  }

  /** Ponto 3D → pixels dentro do palco; visivel=false se está atrás ou fora. */
  const proj = new THREE.Vector3();
  function projetar(x, y, z) {
    proj.set(x, y, z).project(camera);
    const w = palco.clientWidth, h = palco.clientHeight;
    return {
      x: ((proj.x + 1) / 2) * w,
      y: ((1 - proj.y) / 2) * h,
      visivel: proj.z < 1 && proj.x > -1.05 && proj.x < 1.05 && proj.y > -1.05 && proj.y < 1.05,
    };
  }

  function selecionar(id) {
    const l = id && LUGAR.get(id);
    anel.visible = Boolean(l);
    if (l) { anel.position.set(l.x, 0.025, l.z); anel.material.color.set(corDestaque()); }
    marcar();
  }

  function redimensionar() {
    const r = palco.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(r.height, 1);
    camera.updateProjectionMatrix();
    marcar();
  }
  new ResizeObserver(redimensionar).observe(palco);
  redimensionar();
  camera.position.copy(posInicial());
  controles.target.set(20, 0, 12);
  controles.update();

  /* laço: só desenha quando está sujo */
  const aoDesenharFns = new Set();
  let livre = null;          /* modo boneco: quem mexe a câmera é ele, não a órbita */
  let anterior = performance.now();
  let ultimaLod = 0, camMudou = true, quadros = 0, fps = 0, t0fps = performance.now();
  const ultimaPos = new THREE.Vector3(), ultimoAlvo = new THREE.Vector3();
  function laco(agora) {
    requestAnimationFrame(laco);
    const dt = Math.min(0.1, (agora - anterior) / 1000);
    anterior = agora;
    if (voo) {
      const k = voo.ms ? Math.min((agora - voo.ini) / voo.ms, 1) : 1;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camera.position.lerpVectors(voo.p0, voo.p1, e);
      controles.target.lerpVectors(voo.t0, voo.t1, e);
      if (k >= 1) { const fim = voo.fim; voo = null; if (modo === 'topo') controles.maxPolarAngle = 0.0001; fim(); }
      else if (modo !== 'topo') controles.maxPolarAngle = 1.45;
      marcar();
    }
    if (livre && !voo) { if (livre(dt)) marcar(); }
    else controles.update();
    if (!camera.position.equals(ultimaPos) || !controles.target.equals(ultimoAlvo)) {
      camMudou = true; ultimaPos.copy(camera.position); ultimoAlvo.copy(controles.target);
    }
    if (camMudou && agora - ultimaLod > 120) {
      camera.updateMatrixWorld();
      if (multidao.atualizar(camera)) marcar();
      ultimaLod = agora; camMudou = false;
    }
    if (!sujo) { if (agora - t0fps > 1000) { fps = 0; quadros = 0; t0fps = agora; } return; }
    sujo = false;
    renderer.render(cena, camera);
    quadros++;
    if (agora - t0fps > 1000) { fps = Math.round((quadros * 1000) / (agora - t0fps)); quadros = 0; t0fps = agora; }
    /* o que fica por cima do canvas acompanha o quadro desenhado */
    for (const fn of aoDesenharFns) fn();
  }
  requestAnimationFrame(laco);

  return {
    renderer, cena, camera, controles, multidao,
    vista3d, vistaTopo, irPara, olharPara, lugarEm, pontoNoChao, raioEm, projetar, selecionar,
    /** Distância da câmera até o ponto que ela olha: pequena = perto do chão. */
    distancia() { return camera.position.distanceTo(controles.target); },
    alvo() { return { x: controles.target.x, z: controles.target.z }; },
    get voando() { return Boolean(voo); },
    /** Voo da câmera até pos olhando alvo (THREE.Vector3); resolve ao chegar. */
    voar(pos, alvo, ms) { return voarPara(pos, alvo, ms); },
    /** Modo boneco: fn(dt) mexe camera e controles.target e devolve true se
        mudou algo. null devolve a câmera para a órbita. */
    assumirCamera(fn) {
      livre = fn;
      controles.enabled = !fn;
      if (!fn) { modo = '3d'; controles.maxPolarAngle = 1.45; controles.update(); }
      marcar();
    },
    colisao,
    /** fn() roda depois de cada quadro desenhado; devolve "parar". */
    aoDesenhar(fn) { aoDesenharFns.add(fn); marcar(); return () => aoDesenharFns.delete(fn); },
    focar(id) { multidao.definirFoco(id); camMudou = true; marcar(); },
    /** Map(idDoLugar -> personagem) */
    definirOcupantes(mapa) {
      multidao.definir(mapa);
      camera.updateMatrixWorld();
      multidao.atualizar(camera);
      marcar();
    },
    /** Cadeiras que a camada de piadas desenha (a multidão não repete). */
    reservarLugares(ids) { multidao.reservar(ids); marcar(); },
    marcar,
    estatisticas() {
      return {
        fps,
        chamadas: renderer.info.render.calls,
        triangulos: renderer.info.render.triangles,
        pecasCenario: mescla,
        lugares: LUGARES.length,
        ocupados: multidao.total,
        detalhados: multidao.detalhados,
      };
    },
  };
}
