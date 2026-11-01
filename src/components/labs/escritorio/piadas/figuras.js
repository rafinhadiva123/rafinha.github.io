// Peças que as piadas usam: o braço com cotovelo (IK), figuras que andam
// (sem cadeira) e os objetos (sanduíche, celular, pilha, porta-retrato,
// globo, porta). Tudo em metros, no mesmo referencial do boneco.
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const suaviza = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/* um material por cor/acabamento, como em boneco.js */
const CACHE = new Map();
export function mat(cor, rough = 0.85, metal = 0.04) {
  const c = new THREE.Color(cor);
  const k = c.getHexString() + '|' + rough + '|' + metal;
  if (!CACHE.has(k)) CACHE.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }));
  return CACHE.get(k);
}

export function caixa(l, a, p, m, x, y, z, g) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}
export function bola(m, x, y, z, r, g, esc) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  o.position.set(x, y, z);
  if (esc) o.scale.set(esc[0], esc[1], esc[2]);
  g.add(o);
  return o;
}
/** Cilindro de A até B (a malha nasce com o comprimento certo). */
export function osso(m, a, b, r1, r2, g, seg = 12) {
  const d = new THREE.Vector3().subVectors(b, a);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r1, r1, d.length(), seg), m);
  posOsso(o, a, b);
  g.add(o);
  return o;
}
/** Põe uma malha de osso entre A e B, sem mudar o comprimento. */
export function posOsso(m, A, B) {
  m.position.copy(A).add(B).multiplyScalar(0.5);
  const d = new THREE.Vector3().subVectors(B, A);
  if (d.lengthSq() > 1e-10) m.quaternion.setFromUnitVectors(Y, d.normalize());
}
/** Tronco com o mesmo perfil de boneco.js (para as figuras que andam). */
export function tronco(m, g) {
  const perfil = [[0.001, 0.5], [0.2, 0.51], [0.245, 0.6], [0.255, 0.76], [0.235, 0.94], [0.245, 1.06],
    [0.262, 1.14], [0.235, 1.21], [0.155, 1.26], [0.088, 1.3], [0.001, 1.31]];
  const o = new THREE.Mesh(new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 22), m);
  o.scale.z = 0.68;
  o.position.z = 0.02;
  g.add(o);
  return o;
}

/* ------------------------------------------------------------------ braço */

/**
 * Cinemática de dois ossos: o ombro (r.S) fica parado, o punho vai até `alvo`
 * (coordenadas do corpo, r.c) e o cotovelo aponta para baixo e para fora.
 * Devolve o punho de fato (se o alvo estiver longe demais, para no limite).
 */
export function ik(r, alvo) {
  const S = r.S;
  const D = new THREE.Vector3().subVectors(alvo, S);
  let d = D.length();
  d = Math.min(r.a + r.b - 0.01, Math.max(Math.abs(r.a - r.b) + 0.01, d));
  const u = D.lengthSq() > 1e-8 ? D.clone().normalize() : V(0, -1, 0);
  const cosA = (r.a * r.a + d * d - r.b * r.b) / (2 * r.a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const polo = V(r.s, -0.6, 0.2);
  const perp = polo.clone().addScaledVector(u, -polo.dot(u)).normalize();
  const cot = S.clone().addScaledVector(u, r.a * cosA).addScaledVector(perp, r.a * sinA);
  const punho = S.clone().addScaledVector(u, d);
  posOsso(r.sup, S, cot);
  r.cot.position.copy(cot);
  posOsso(r.ant, cot, punho);
  r.mao.position.copy(punho);
  return punho;
}

/* ------------------------------------------------------- figuras que andam */

function cabecaGordo(U) {
  const H = new THREE.Group();
  U.add(H);
  const pele = mat('#E9B99A', 0.7), cab = mat('#3E2C20', 0.95);
  bola(pele, 0, 0.125, 0, 0.145, H, [1.06, 1.06, 1.03]);
  [-1, 1].forEach(s => bola(pele, s * 0.145, 0.12, -0.01, 0.036, H, [0.5, 1.15, 0.9]));
  bola(pele, 0, 0.035, 0.06, 0.11, H, [1.2, 0.6, 0.95]);
  const mOlho = mat('#F6F3EE', 0.35), mIris = mat('#2A211B', 0.3);
  [-0.05, 0.05].forEach(dx => {
    bola(mOlho, dx, 0.15, 0.126, 0.024, H, [1, 0.9, 0.6]);
    bola(mIris, dx, 0.15, 0.143, 0.013, H);
    const sob = caixa(0.052, 0.014, 0.016, cab, dx, 0.19, 0.134, H);
    sob.rotation.z = dx > 0 ? -0.25 : 0.25;
  });
  bola(pele, 0, 0.11, 0.152, 0.03, H);
  caixa(0.05, 0.028, 0.014, mat('#5A2A26', 0.6), 0, 0.048, 0.142, H);
  const capa = new THREE.Mesh(new THREE.SphereGeometry(0.156, 20, 16, 0, Math.PI * 2, 0, 1.3), cab);
  capa.position.set(0, 0.125, -0.002);
  capa.scale.set(1.05, 1.08, 1.06);
  capa.rotation.x = -0.22;
  H.add(capa);
  return H;
}

/**
 * Figura em pé, andando ou correndo. Quadril (Q) e tronco (U) são as juntas
 * que `correr` mexe. o.cabeca(U) devolve a cabeça já presa no tronco.
 */
export function fazCorredor(o) {
  const g = new THREE.Group(), corpo = new THREE.Group();
  corpo.scale.setScalar(o.esc || 0.86);
  g.add(corpo);
  const gordo = !!o.gordo;
  const pele = mat(o.pele, 0.72), camisa = mat(o.camisa, 0.88), calca = mat(o.calca || '#3A3F47', 0.92);
  const camisa2 = mat(new THREE.Color(o.camisa).multiplyScalar(0.82), 0.88), sapato = mat('#24262A', 0.6, 0.1);
  bola(calca, 0, 0.93, 0, gordo ? 0.27 : 0.19, corpo, [1.15, 0.62, 0.85]);
  const Q = new THREE.Group();
  Q.position.y = 0.95;
  corpo.add(Q);
  const U = new THREE.Group();
  U.position.y = -0.5;
  Q.add(U);
  const tr = tronco(camisa, U);
  if (gordo) { tr.scale.set(1.3, 1, 0.68 * 1.35); bola(camisa, 0, 0.8, 0.1, 0.3, U, [1.12, 1, 1.05]); }
  const gola = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.155, 0.09, 18), camisa2);
  gola.position.set(0, 1.27, 0.02);
  gola.scale.z = 0.74;
  U.add(gola);
  osso(pele, V(0, 1.24, 0.02), V(0, 1.37, 0.025), 0.072, 0.078, U, 14);
  const cab = o.cabeca(U);
  cab.position.set(0, 1.33, 0.03);
  const bracos = [-1, 1].map(s => {
    const om = new THREE.Group();
    om.position.set(s * (gordo ? 0.31 : 0.238), 1.155, 0.02);
    U.add(om);
    bola(camisa, 0, 0, 0, 0.088, om);
    osso(camisa, V(0, 0, 0), V(0, -0.27, 0), 0.075, 0.066, om);
    const co = new THREE.Group();
    co.position.y = -0.27;
    om.add(co);
    bola(camisa2, 0, 0, 0, 0.066, co);
    osso(pele, V(0, 0, 0), V(0, -0.25, 0), 0.062, 0.05, co);
    bola(pele, 0, -0.28, 0, 0.062, co, [0.85, 1.25, 0.6]);
    return { om, co, s, preso: false };
  });
  const pernas = [-1, 1].map(s => {
    const cx = new THREE.Group();
    cx.position.set(s * (gordo ? 0.15 : 0.115), 0.95, 0);
    corpo.add(cx);
    osso(calca, V(0, 0, 0), V(0, -0.46, 0), gordo ? 0.135 : 0.105, gordo ? 0.11 : 0.09, cx);
    const jo = new THREE.Group();
    jo.position.y = -0.46;
    cx.add(jo);
    bola(calca, 0, 0, 0, gordo ? 0.11 : 0.09, jo);
    osso(calca, V(0, 0, 0), V(0, -0.43, 0), gordo ? 0.1 : 0.085, 0.07, jo);
    caixa(0.13, 0.08, 0.28, sapato, 0, -0.46, 0.07, jo);
    return { cx, jo };
  });
  return { g, corpo, Q, U, bracos, pernas };
}

/** Um passo a cada π de fase. amp 1 = corrida, ~0.4 = caminhada. */
export function correr(c, f, amp = 1) {
  c.pernas.forEach((p, k) => {
    const ph = f + k * Math.PI;
    p.cx.rotation.x = -0.8 * amp * Math.sin(ph);
    p.jo.rotation.x = 0.25 + 1.1 * amp * Math.max(0, Math.cos(ph));
  });
  c.bracos.forEach(b => {
    if (b.preso) return;
    b.om.rotation.x = 0.75 * amp * Math.sin(f + (b.s < 0 ? 0 : Math.PI));
    b.co.rotation.x = -(0.5 + 0.85 * amp);
  });
  c.Q.position.y = 0.95 + 0.04 * amp * Math.abs(Math.cos(f));
  c.Q.rotation.x = 0.2 * amp;
}

/** Cabeça clonada de quem está sentado (o perseguidor corre com a própria cabeça). */
export function cabecaDe(pessoaCab) {
  return U => {
    const h = pessoaCab.clone();
    h.rotation.set(0, 0, 0);
    U.add(h);
    return h;
  };
}
export { cabecaGordo };

/* ------------------------------------------------------------ esqueleto */

export function fazEsqueleto() {
  const m = mat('#ECE6D6', 0.65), oco = mat('#2A2522', 0.9), dente = mat('#FFFFFF', 0.4);
  const g = new THREE.Group();
  bola(m, 0, 0, 0, 0.12, g, [1.3, 0.6, 0.75]);
  for (let k = 0; k < 9; k++) bola(m, 0, 0.07 + k * 0.055, -0.03, 0.024, g);
  for (let k = 0; k < 5; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.125 - k * 0.01, 0.011, 6, 18), m);
    r.rotation.x = Math.PI / 2;
    r.scale.set(1, 0.72, 1);
    r.position.set(0, 0.24 + k * 0.055, 0);
    g.add(r);
  }
  caixa(0.03, 0.2, 0.02, m, 0, 0.36, 0.085, g);
  osso(m, V(-0.17, 0.52, 0), V(0.17, 0.52, 0), 0.014, 0.014, g, 6);
  osso(m, V(0, 0.5, -0.02), V(0, 0.62, 0), 0.02, 0.02, g, 6);
  const cr = new THREE.Group();
  cr.position.set(0, 0.6, 0);
  g.add(cr);
  bola(m, 0, 0.11, 0, 0.11, cr, [0.92, 1.05, 1.08]);
  [-0.04, 0.04].forEach(dx => bola(oco, dx, 0.115, 0.088, 0.028, cr, [1, 1, 0.5]));
  bola(oco, 0, 0.072, 0.104, 0.014, cr);
  caixa(0.08, 0.014, 0.01, dente, 0, 0.046, 0.1, cr);
  const mand = new THREE.Group();
  mand.position.set(0, 0.04, 0);
  cr.add(mand);
  caixa(0.1, 0.03, 0.1, m, 0, -0.016, 0.045, mand);
  caixa(0.08, 0.014, 0.01, dente, 0, 0.002, 0.092, mand);
  const bracos = [-1, 1].map(s => {
    const b = new THREE.Group();
    b.position.set(s * 0.18, 0.5, 0);
    g.add(b);
    osso(m, V(0, 0, 0), V(0, -0.29, 0), 0.017, 0.014, b, 6);
    const a = new THREE.Group();
    a.position.y = -0.29;
    b.add(a);
    bola(m, 0, 0, 0, 0.022, a);
    osso(m, V(0, 0, 0), V(0, -0.26, 0), 0.014, 0.012, a, 6);
    bola(m, 0, -0.29, 0, 0.035, a, [1, 1.3, 0.5]);
    return { b, a };
  });
  const pernas = [-1, 1].map(s => {
    const p = new THREE.Group();
    p.position.set(s * 0.09, -0.03, 0);
    g.add(p);
    osso(m, V(0, 0, 0), V(0, -0.42, 0), 0.022, 0.018, p, 6);
    const j = new THREE.Group();
    j.position.y = -0.42;
    p.add(j);
    bola(m, 0, 0, 0, 0.03, j);
    osso(m, V(0, 0, 0), V(0, -0.4, 0), 0.018, 0.015, j, 6);
    caixa(0.06, 0.03, 0.15, m, 0, -0.41, 0.05, j);
    return { p, j };
  });
  return { g, cr, mand, bracos, pernas };
}

/** Esqueleto debaixo do braço esquerdo do homem que foge. */
export function carregarEsqueleto(c) {
  const e = fazEsqueleto();
  const K = new THREE.Group();
  K.position.set(-0.52, 0.98, 0.06);
  K.rotation.x = Math.PI / 2;
  c.U.add(K);
  e.g.rotation.y = -Math.PI / 2;
  e.g.position.y = -0.3;
  e.g.scale.setScalar(0.8);
  K.add(e.g);
  const b = c.bracos[0];
  b.preso = true;
  b.om.rotation.set(-0.15, 0, -0.32);
  b.co.rotation.x = -1.1;
  return e;
}
export function balancarEsqueleto(e, f, t) {
  e.bracos.forEach((b, k) => {
    b.b.rotation.z = Math.PI / 2 + 0.35 * Math.sin(f + k * 1.7);
    b.a.rotation.z = 0.4 * Math.sin(f * 1.3 + k);
  });
  e.pernas.forEach((p, k) => {
    p.p.rotation.z = 0.75 + 0.3 * Math.sin(f + k * Math.PI);
    p.j.rotation.x = 0.3 * Math.sin(f * 1.1 + k);
  });
  e.cr.rotation.z = 0.25 * Math.sin(f * 0.9);
  e.mand.rotation.x = 0.2 + 0.2 * Math.sin(t * 24);
}

/* ----------------------------------------------------------- objetos */

/** Sanduíche segurado de lado; a fatia se estende para -z, em direção à boca. */
export const LANCHE_COMP = 0.09;
export function fazSanduiche() {
  const g = new THREE.Group(), corpo = new THREE.Group();
  const camada = (cor, l, a, y, rough) => {
    const m = caixa(l, a, LANCHE_COMP, mat(cor, rough || 0.7), 0, y, -LANCHE_COMP / 2, corpo);
    return m;
  };
  camada('#D9A86A', 0.15, 0.018, -0.024, 0.85);
  camada('#E9B84A', 0.158, 0.006, -0.012, 0.5);
  camada('#D98A8A', 0.154, 0.01, -0.004, 0.6);
  camada('#6FA84A', 0.164, 0.006, 0.006, 0.7);
  camada('#F1DFB8', 0.15, 0.004, 0.011, 0.9);
  camada('#D9A86A', 0.15, 0.018, 0.022, 0.85);
  g.add(corpo);
  g.userData = { corpo };
  return g;
}

/** Celular na mão: tela para +z (para quem segura), lente atrás. */
export function fazCelular() {
  const g = new THREE.Group();
  caixa(0.072, 0.145, 0.009, mat('#1C1D21', 0.35, 0.3), 0, 0, 0, g);
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.128), new THREE.MeshBasicMaterial({ color: 0x56738A }));
  tela.position.z = 0.0051;
  g.add(tela);
  const rec = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 14), new THREE.MeshBasicMaterial({ color: 0xE5322D }));
  rec.position.set(-0.021, 0.053, 0.0056);
  g.add(rec);
  g.userData = { rec };
  return g;
}

/** Pilha de papel do acumulador, em volta de um ponto da mesa (eixo +z = para a frente da cadeira). */
export function fazPilha(R) {
  const g = new THREE.Group();
  const papel = mat('#F4F2EC', 0.95), papel2 = mat('#E6E0D0', 0.95), papel3 = mat('#DDE6EE', 0.95);
  const pilha = (px, pz, n, larg, prof) => {
    let y = 0;
    for (let k = 0; k < n; k++) {
      const h = 0.01 + R() * 0.016;
      const b = caixa(larg, h, prof, [papel, papel2, papel3][k % 3], px + (R() - 0.5) * 0.035, y + h / 2, pz + (R() - 0.5) * 0.035, g);
      b.rotation.y = (R() - 0.5) * 0.4;
      y += h;
    }
  };
  pilha(-0.15, -0.05, 16, 0.21, 0.29);
  pilha(0.12, 0.1, 26, 0.23, 0.29);
  pilha(-0.42, 0.2, 10, 0.2, 0.27);
  ['#C8322B', '#1F4FB5', '#1E8A4C', '#E0A21F'].forEach((cor, k) => caixa(0.055, 0.31, 0.27, mat(cor, 0.7), -0.1 + k * 0.06, 0.155, -0.3, g));
  const caneca = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 14), mat('#FFFFFF', 0.45));
  caneca.position.set(0.42, 0.05, -0.25);
  g.add(caneca);
  return g;
}

/** Porta-retrato em pé: moldura e foto com um coração e um nome (virado para quem senta). */
export function fazPortaRetrato(nome) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 320;
  const x = cv.getContext('2d');
  x.fillStyle = '#F7F1E6'; x.fillRect(0, 0, 256, 320);
  x.fillStyle = '#D2334A'; x.beginPath();
  x.moveTo(128, 272);
  x.bezierCurveTo(30, 205, 14, 140, 34, 104);
  x.bezierCurveTo(58, 60, 116, 62, 128, 112);
  x.bezierCurveTo(140, 62, 198, 60, 222, 104);
  x.bezierCurveTo(242, 140, 226, 205, 128, 272);
  x.fill();
  x.fillStyle = '#FFFFFF'; x.font = 'italic 700 58px Georgia, serif';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(nome, 128, 160, 170);
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  const g = new THREE.Group();
  const q = new THREE.Group();
  q.position.y = 0.105;
  q.rotation.x = -0.16;
  g.add(q);
  const moldura = mat('#6B4A2E', 0.6);
  caixa(0.17, 0.012, 0.016, moldura, 0, 0.1, 0, q);
  caixa(0.17, 0.012, 0.016, moldura, 0, -0.1, 0, q);
  caixa(0.012, 0.212, 0.016, moldura, -0.079, 0, 0, q);
  caixa(0.012, 0.212, 0.016, moldura, 0.079, 0, 0, q);
  caixa(0.17, 0.21, 0.006, moldura, 0, 0, -0.006, q);
  const foto = new THREE.Mesh(new THREE.PlaneGeometry(0.148, 0.19), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
  foto.position.z = 0.0005;
  q.add(foto);
  g.userData = { textura: tex };
  return g;
}

/** Globo de espelhos: a esfera, a haste e os pontinhos de luz (pontos são feitos por piadas.js). */
export function fazGlobo(textura) {
  const g = new THREE.Group();
  const bola3d = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 16),
    new THREE.MeshStandardMaterial({ map: textura, emissive: 0xFFFFFF, emissiveMap: textura, emissiveIntensity: 0.25,
      metalness: 0.55, roughness: 0.28, flatShading: true }));
  g.add(bola3d);
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 6), mat('#888', 0.5, 0.6));
  haste.position.y = 0.7;
  g.add(haste);
  return { grupo: g, esfera: bola3d };
}

/** Porta da Saída Norte: a dobradiça fica no pivô; `pv.rotation.y` abre a folha. */
export function fazPorta() {
  const g = new THREE.Group();
  const pv = new THREE.Group();
  pv.position.set(-0.45, 0, 0);
  g.add(pv);
  caixa(0.9, 2.0, 0.05, mat('#8C6A48', 0.7), 0.45, 1.0, 0, pv);
  caixa(0.05, 0.12, 0.05, mat('#C9CCCF', 0.3, 0.7), 0.8, 1.0, 0.04, pv);
  [-0.47, 0.47].forEach(dx => caixa(0.05, 2.08, 0.08, mat('#3B3F44', 0.6), dx, 1.04, 0, g));
  caixa(1.04, 0.06, 0.08, mat('#3B3F44', 0.6), 0, 2.08, 0, g);
  return { grupo: g, pv };
}
