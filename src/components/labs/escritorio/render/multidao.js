// Quem está sentado, desenhado em dois níveis de detalhe:
// - de longe, um boneco simples (tronco, braços, cabeça, cabelo e pernas)
//   com instancing: os 508 cabem em 5 chamadas à placa de vídeo, cada um com as
//   suas cores;
// - de perto, o boneco completo de boneco.js, só para os mais próximos da
//   câmera (até MAX_DETALHE), com o apelido em cima.
import * as THREE from 'three';
import { LUGAR } from '../planta/lugares.js';
import { fazBoneco, compactar } from './boneco.js';

const MAX_DETALHE = 28;     /* bonecos completos ao mesmo tempo */
const RAIO_DETALHE = 13;    /* metros entre a câmera e o boneco */
const MAX_CACHE = 90;       /* bonecos completos guardados prontos */

const geoTronco = new THREE.CylinderGeometry(0.17, 0.23, 0.75, 10);
geoTronco.translate(0, 0.89, 0.02);
const geoCabeca = new THREE.SphereGeometry(0.145, 12, 10);
geoCabeca.translate(0, 1.47, 0.03);
const geoCabelo = new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
geoCabelo.rotateX(-0.3);
geoCabelo.translate(0, 1.5, 0.01);
const geoPernas = new THREE.BoxGeometry(0.4, 0.16, 0.48);
geoPernas.translate(0, 0.55, 0.22);
/* braços apoiados na mesa, na cor da camisa */
const geoBracos = new THREE.BoxGeometry(0.52, 0.11, 0.42);
geoBracos.translate(0, 0.9, 0.3);

const cor = new THREE.Color();

function texturaNome(texto) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const x = cv.getContext('2d');
  x.font = '600 60px "Instrument Sans", system-ui, sans-serif';
  const w = Math.min(500, x.measureText(texto).width + 56);
  x.fillStyle = 'rgba(26,32,50,.88)';
  const r = 30, x0 = (512 - w) / 2;
  x.beginPath();
  x.moveTo(x0 + r, 14); x.arcTo(x0 + w, 14, x0 + w, 114, r); x.arcTo(x0 + w, 114, x0, 114, r);
  x.arcTo(x0, 114, x0, 14, r); x.arcTo(x0, 14, x0 + w, 14, r); x.closePath(); x.fill();
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(texto, 256, 66, 460);
  const t = new THREE.CanvasTexture(cv);
  return t;
}

export function criarMultidao(cena) {
  const grupo = new THREE.Group();
  cena.add(grupo);
  const matCor = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  let tronco, cabeca, cabelo, pernas, bracos;
  let ocupantes = [];                 /* [{id, p, lugar, indice}] */
  let reservados = new Set();         /* cadeiras desenhadas pelas piadas */
  let ultimoMapa = null;
  const porId = new Map();
  const cache = new Map();            /* id -> {grupo, chave, usado} */
  const nomes = new Map();            /* id -> Sprite */
  let detalhados = new Set();
  let foco = null;            /* cadeira que aparece sempre completa (editor aberto) */
  const base = new THREE.Object3D();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);

  function matrizDe(o) {
    const l = o.lugar, esc = o.p.altura || 0.965;
    base.position.set(l.x, 0.8 - 0.8 * esc + (l.dy || 0), l.z);
    base.rotation.set(0, l.giro, 0);
    base.scale.setScalar(esc);
    base.updateMatrix();
    return base.matrix;
  }

  function recriarInstancias() {
    for (const m of [tronco, cabeca, cabelo, pernas, bracos]) if (m) { grupo.remove(m); m.dispose?.(); }
    const n = Math.max(1, ocupantes.length);
    const mk = (geo, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      m.count = ocupantes.length; grupo.add(m); return m;
    };
    tronco = mk(geoTronco, matCor());
    cabeca = mk(geoCabeca, matCor());
    cabelo = mk(geoCabelo, matCor());
    pernas = mk(geoPernas, new THREE.MeshLambertMaterial({ color: 0x3a3f47 }));
    bracos = mk(geoBracos, matCor());
    ocupantes.forEach((o, k) => {
      const m = matrizDe(o);
      for (const mesh of [tronco, cabeca, cabelo, pernas, bracos]) mesh.setMatrixAt(k, m);
      tronco.setColorAt(k, cor.set(o.p.camisa));
      bracos.setColorAt(k, cor.set(o.p.camisa));
      cabeca.setColorAt(k, cor.set(o.p.pele));
      cabelo.setColorAt(k, cor.set(o.p.cabelo === 'careca' ? o.p.pele : o.p.cor));
    });
    for (const m of [tronco, cabeca, cabelo, pernas, bracos]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    detalhados = new Set();
  }

  function esconderSimples(k, sim) {
    const m = sim ? zero : matrizDe(ocupantes[k]);
    for (const mesh of [tronco, cabeca, cabelo, pernas, bracos]) mesh.setMatrixAt(k, m);
  }

  function completo(o) {
    const chave = JSON.stringify(o.p);
    let c = cache.get(o.id);
    if (c && c.chave !== chave) { descartar(o.id); c = null; }
    if (!c) {
      const { grupo: g, rig } = compactar(fazBoneco(o.p, o.indice));
      g.position.set(o.lugar.x, o.lugar.dy || 0, o.lugar.z);
      g.rotation.y = o.lugar.giro;
      c = { grupo: g, rig, chave, usado: 0 };
      cache.set(o.id, c);
    }
    c.usado = performance.now();
    return c;
  }

  function descartar(id) {
    const c = cache.get(id);
    if (!c) return;
    grupo.remove(c.grupo);
    c.grupo.traverse(x => x.geometry && x.geometry.dispose());
    cache.delete(id);
  }

  function nome(o, mostrar) {
    let s = nomes.get(o.id);
    if (!mostrar) { if (s) s.visible = false; return; }
    if (!s || s.userData.texto !== o.p.apelido) {
      if (s) { grupo.remove(s); s.material.map.dispose(); s.material.dispose(); }
      /* tamanho fixo na tela, perto ou longe */
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaNome(o.p.apelido), depthWrite: false, sizeAttenuation: false }));
      s.userData.texto = o.p.apelido;
      s.scale.set(0.15, 0.0375, 1);
      s.renderOrder = 5;
      nomes.set(o.id, s);
      grupo.add(s);
    }
    s.position.set(o.lugar.x, 1.95 * (o.p.altura || 1), o.lugar.z);
    s.visible = true;
  }

  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), ponto = new THREE.Vector3();

  return {
    grupo,
    /** ocupantes: Map(idDoLugar -> personagem) */
    definir(mapa) {
      ultimoMapa = mapa;
      ocupantes = [];
      porId.clear();
      let k = 0;
      for (const [id, p] of mapa) {
        const lugar = LUGAR.get(id);
        if (!lugar) continue;          /* cadeira que não existe mais no layout */
        if (reservados.has(id)) continue;   /* quem desenha essa cadeira é a camada de piadas */
        const o = { id, p, lugar, indice: k++ };
        ocupantes.push(o); porId.set(id, o);
      }
      for (const id of [...cache.keys()]) if (!porId.has(id)) descartar(id);
      for (const [id, s] of nomes) if (!porId.has(id)) s.visible = false;
      recriarInstancias();
    },

    /** Cadeiras que outra camada desenha (as piadas): a multidão pula essas. */
    reservar(ids) {
      reservados = new Set(ids);
      if (ultimoMapa) this.definir(ultimoMapa);
    },

    /** Decide quem aparece completo. Devolve true se algo mudou. */
    atualizar(camera) {
      if (!tronco) return false;
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pv);
      const perto = [];
      for (const o of ocupantes) {
        const d = camera.position.distanceTo(ponto.set(o.lugar.x, 1, o.lugar.z));
        if (d > RAIO_DETALHE) continue;
        if (!frustum.containsPoint(ponto)) continue;
        perto.push([d, o]);
      }
      perto.sort((a, b) => a[0] - b[0]);
      const novo = new Set(perto.slice(0, MAX_DETALHE).map(([, o]) => o.id));
      if (foco && porId.has(foco)) novo.add(foco);

      let mudou = false;
      for (const id of detalhados) {
        if (novo.has(id)) continue;
        const o = porId.get(id);
        if (o) { esconderSimples(o.indice, false); nome(o, false); }
        const c = cache.get(id);
        if (c) grupo.remove(c.grupo);
        mudou = true;
      }
      for (const id of novo) {
        if (detalhados.has(id)) continue;
        const o = porId.get(id);
        const c = completo(o);
        grupo.add(c.grupo);
        esconderSimples(o.indice, true);
        nome(o, true);
        mudou = true;
      }
      detalhados = novo;
      if (mudou) for (const m of [tronco, cabeca, cabelo, pernas, bracos]) m.instanceMatrix.needsUpdate = true;

      if (cache.size > MAX_CACHE) {
        const velhos = [...cache.entries()].filter(([id]) => !novo.has(id)).sort((a, b) => a[1].usado - b[1].usado);
        for (const [id] of velhos.slice(0, cache.size - MAX_CACHE)) descartar(id);
      }
      return mudou;
    },

    definirFoco(id) { foco = id; },
    get total() { return ocupantes.length; },
    get detalhados() { return detalhados.size; },
    rigDe(id) { const c = cache.get(id); return c && detalhados.has(id) ? c.rig : null; },
  };
}
