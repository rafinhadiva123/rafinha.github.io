// O boneco detalhado, o mesmo do simulador original (cabelos, barba,
// óculos, laço, headset, olhos). Sentado, olhando para +z, com a origem no
// centro do assento; quem chama posiciona e gira. A cadeira não vem junto:
// ela já está desenhada em moveis.js.
// Cada boneco tem umas 60 peças, então só os mais perto da câmera usam este
// modelo; o resto da multidão usa o boneco simples de multidao.js.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* um material por cor/acabamento, compartilhado entre os bonecos */
const CACHE = new Map();
function mat(cor, rough, metal){
  const k = (typeof cor === "string" ? cor : new THREE.Color(cor).getHexString()) + "|" + (rough ?? .85) + "|" + (metal ?? .04);
  if(!CACHE.has(k)) CACHE.set(k, new THREE.MeshStandardMaterial({color:new THREE.Color(cor), roughness:rough ?? .85, metalness:metal ?? .04}));
  return CACHE.get(k);
}
function caixa(l, a, p, material, x, y, z, grupo){
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  grupo.add(m); return m;
}

/* ---- helpers de corpo ---- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function osso(material, a, b, r1, r2, grupo, seg){
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r1, r1, d.length(), seg || 12), material);
  m.position.copy(a).add(b).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  m.castShadow = true; grupo.add(m); return m;
}
function bola(material, x, y, z, r, grupo, esc){
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
  m.position.set(x, y, z); if(esc) m.scale.set(esc[0], esc[1], esc[2]);
  m.castShadow = r > .055; grupo.add(m); return m;
}
function tronco(material, grupo){
  const perfil = [[.001,.50],[.20,.51],[.245,.60],[.255,.76],[.235,.94],[.245,1.06],
                  [.262,1.14],[.235,1.21],[.155,1.26],[.088,1.30],[.001,1.31]];
  const m = new THREE.Mesh(
    new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 22), material);
  m.scale.z = .68; m.position.z = .02; m.castShadow = true; m.receiveShadow = true;
  grupo.add(m); return m;
}

export function fazBoneco(p, i){
  const nome = p.apelido || p.nome || "";
  const g = new THREE.Group();
  let rig = null;

  const semente = [...nome].reduce((a, c) => a + c.charCodeAt(0), (i || 0) * 7);
  const c = new THREE.Group();
  const esc = p.altura || (.965 + (semente % 8) / 100);
  c.scale.setScalar(esc); c.position.y = .8 - .8 * esc;
  c.rotation.y = ((semente % 5) - 2) * .035;
  g.add(c);

  const camisa = mat(p.camisa, .88);
  const camisa2 = mat(new THREE.Color(p.camisa).multiplyScalar(.82).getStyle(), .88);
  const pele = mat(p.pele, .72);
  const calca = mat(p.calca || "#3A3F47", .92);
  const sapato = mat("#24262A", .6, .1);
  const mcab = mat(p.cor, .96);

  /* pernas sob a mesa */
  [-.135, .135].forEach(dx => {
    osso(calca, V(dx, .55, -.02), V(dx * 1.06, .54, .42), .105, .1, c);
    bola(calca, dx * 1.06, .53, .43, .1, c);
    osso(calca, V(dx * 1.06, .5, .44), V(dx * 1.06, .1, .47), .085, .07, c);
    const sp = caixa(.14, .08, .28, sapato, dx * 1.06, .045, .56, c); sp.rotation.x = .06;
  });

  /* tronco, gola e pescoço */
  const tr = tronco(camisa, c); if(p.mulher) tr.scale.x = .9;
  const gola = new THREE.Mesh(new THREE.CylinderGeometry(.115, .155, .09, 18), camisa2);
  gola.position.set(0, 1.27, .02); gola.scale.z = .74; gola.castShadow = true; c.add(gola);
  osso(pele, V(0, 1.24, .02), V(0, 1.37, .025), .072, .078, c, 14);
  if(p.social){
    const mcol = mat("#FFFFFF", .8);
    [-1, 1].forEach(s => {
      const pt = caixa(.075, .055, .014, mcol, s * .045, 1.245, .118, c);
      pt.rotation.set(-.35, 0, s * .55); pt.castShadow = false;
    });
    const vinco = caixa(.022, .5, .01, camisa2, 0, .98, .184, c); vinco.castShadow = false;
    [1.14, 1.02, .9, .78].forEach(y => bola(mat("#D8D6D0", .5), 0, y, .19, .008, c));
  }

  /* braços com cotovelo, mãos na mesa */
  [-1, 1].forEach(s => {
    const ombro = V(s * (p.mulher ? .218 : .238), 1.155, .02), cotovelo = V(s * .29, .93, .18), mao = V(s * .2, .8, .6);
    bola(camisa, ombro.x, ombro.y, ombro.z, .088, c);
    const sup = osso(camisa, ombro, cotovelo, .075, .066, c);
    const cot = bola(camisa2, cotovelo.x, cotovelo.y, cotovelo.z, .066, c);
    const ant = osso(pele, cotovelo, mao, .062, .05, c);
    const mm = bola(pele, mao.x, mao.y, mao.z + .03, .062, c, [.85, .55, 1.25]);
    if(s === -1) rig = {S:ombro, T0:mao.clone(), a:ombro.distanceTo(cotovelo), b:cotovelo.distanceTo(mao), s, sup, cot, ant, mao:mm, c, g};
  });

  /* cabeça */
  const cab = bola(pele, 0, 1.455, .03, .134, c, [.99, 1.11, 1.03]);
  bola(pele, -.13, 1.45, .012, .034, c, [.5, 1.15, .9]);
  bola(pele, .13, 1.45, .012, .034, c, [.5, 1.15, .9]);
  const mOlho = mat("#F6F3EE", .35), mIris = mat("#2A211B", .3);
  [-.05, .05].forEach(dx => {
    const pux = p.olhos === "puxados";
    bola(mOlho, dx, 1.477, .125, .026, c, pux ? [1.08, .52, .6] : [1, .82, .6]);
    bola(mIris, dx, 1.475, .144, .0145, c, pux ? [1, .72, 1] : null);
    const sob = caixa(p.mulher ? .046 : .054, p.mulher ? .011 : .018, .016, mcab, dx, 1.515, .134, c);
    sob.rotation.x = -.2; sob.castShadow = false;
  });
  bola(pele, 0, 1.434, .146, .026, c, [.78, 1.1, .95]);
  const boca = caixa(.054, .013, .014, mat(p.barba ? "#6E4038" : "#9A6257", .6), 0, 1.386, p.barba === "cheia" ? .168 : .156, c);
  boca.castShadow = false;
  bola(pele, 0, 1.374, .1, .047, c, p.mulher ? [1.1, .72, .78] : [1.45, .82, .86]);

  /* cabelo */
  if(p.cabelo === "careca"){
    const coroa = new THREE.Mesh(new THREE.SphereGeometry(.144, 20, 14, Math.PI * .86, Math.PI * 1.28, .92, .62), mcab);
    coroa.position.set(0, 1.455, .03); coroa.scale.set(1, 1.1, 1.04); c.add(coroa);
  }else if(p.cabelo === "calvoFrente"){
    /* uma calota sem a fatia da frente: cabelo na nuca, nas laterais e no alto
       de trás; a calvície abre na testa e afina até o cocuruto */
    const calva = Math.PI * .55, mDupla = mcab.clone(); mDupla.side = THREE.DoubleSide;   /* esconde o vão na borda */
    const capa = new THREE.Mesh(new THREE.SphereGeometry(.148, 24, 16, Math.PI / 2 + calva / 2, Math.PI * 2 - calva, 0, 1.62), mDupla);
    capa.position.set(0, 1.455, .028); capa.scale.set(1.01, 1.1, 1.05); capa.rotation.x = -.12;
    capa.castShadow = true; c.add(capa);
    const nuca = new THREE.Mesh(new THREE.SphereGeometry(.15, 18, 14, Math.PI, Math.PI, 1.2, .9), mcab);
    nuca.position.set(0, 1.45, .028); nuca.scale.set(1.01, 1.1, 1.05); c.add(nuca);
  }else{
    const alt = (p.cabelo === "curto" || p.cabelo === "topete") ? 1.3 : p.cabelo === "baguncado" ? 1.4 : 1.46;
    const capa = new THREE.Mesh(new THREE.SphereGeometry(.148, 20, 16, 0, Math.PI * 2, 0, alt), mcab);
    capa.position.set(0, 1.455, .028); capa.scale.set(1.01, 1.1, 1.05);
    capa.rotation.x = (p.cabelo === "curto" || p.cabelo === "topete") ? -.22 : -.36;
    capa.castShadow = true; c.add(capa);
    const nuca = new THREE.Mesh(new THREE.SphereGeometry(.15, 18, 14, Math.PI, Math.PI, .25, 1.45), mcab);
    nuca.position.set(0, 1.45, .028); nuca.scale.set(1.01, 1.1, 1.05); c.add(nuca);
    if(p.cabelo === "medio" || p.cabelo === "longo")
      [-.128, .128].forEach(dx => bola(mcab, dx, 1.4, -.01, .07, c, [.55, 1.5, 1.05]));
    if(p.cabelo === "longo"){
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.155, .185, .34, 18, 1, true, Math.PI * .3, Math.PI * 1.4), mcab);
      m.position.set(0, 1.28, -.03); m.scale.z = .72; m.castShadow = true; c.add(m);
      bola(mcab, 0, 1.12, -.05, .17, c, [1, .55, .7]);
    }
    if(p.cabelo === "chanel"){
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.152, .166, .17, 20, 1, true, Math.PI * .3, Math.PI * 1.4), mcab);
      m.position.set(0, 1.405, .02); m.scale.z = 1.02; m.castShadow = true; c.add(m);
      const franja = new THREE.Mesh(new THREE.SphereGeometry(.152, 18, 10, Math.PI * .2, Math.PI * .6, .55, .5), mcab);
      franja.position.set(0, 1.455, .03); franja.scale.set(1, 1.1, 1.05); franja.rotation.x = -.3; c.add(franja);
    }
    if(p.cabelo === "baguncado"){
      [[-.06,1.585,.07],[.02,1.6,.085],[.08,1.575,.05],[-.09,1.56,-.02],[.05,1.595,-.03],[-.02,1.59,-.07],[.1,1.535,.08],[-.1,1.54,.085]]
        .forEach(([x,y,z], k) => bola(mcab, x, y, z, .036 + (k % 3) * .006, c, [1, .75, 1]));
      const franja = new THREE.Mesh(new THREE.SphereGeometry(.152, 18, 10, Math.PI * .15, Math.PI * .7, .55, .4), mcab);
      franja.position.set(0, 1.455, .03); franja.scale.set(1, 1.1, 1.05); franja.rotation.x = -.28; c.add(franja);
    }
    if(p.cabelo === "coque") bola(mcab, 0, 1.58, -.06, .082, c);
    if(p.cabelo === "topete") bola(mcab, .015, 1.585, .085, .075, c, [1.25, .55, .8]);
  }

  /* barba */
  if(p.barba){
    const cheia = p.barba === "cheia";
    const mb = cheia ? mcab : new THREE.MeshStandardMaterial({color:new THREE.Color(p.cor), transparent:true, opacity:.55, roughness:1});
    const casca = new THREE.Mesh(new THREE.SphereGeometry(.141, 22, 12,
        cheia ? -.25 : .15, cheia ? Math.PI + .5 : Math.PI - .3,
        cheia ? 1.9 : 2.05, cheia ? .98 : .8), mb);
    casca.position.set(0, 1.455, .03); casca.scale.set(1.01, 1.11, 1.061); c.add(casca);
    const bigode = caixa(cheia ? .08 : .06, cheia ? .02 : .012, .02, mb, 0, 1.408, .163, c);
    bigode.castShadow = false;
  }

  /* óculos */
  if(p.oculos){
    const redondo = p.oculos === "redondo";
    const mo = mat(redondo ? "#3A3530" : "#1D1F22", .4, redondo ? .6 : .1);
    const lente = new THREE.MeshStandardMaterial({color:0xDDE8EE, transparent:true, opacity:.18, roughness:.1});
    [-.052, .052].forEach(dx => {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(.031, redondo ? .0045 : .006, 8, 26), mo);
      aro.position.set(dx, 1.478, .166); if(!redondo) aro.scale.set(1.28, .82, 1); c.add(aro);
      const vid = new THREE.Mesh(new THREE.CircleGeometry(.03, 22), lente);
      vid.position.set(dx, 1.478, .165); if(!redondo) vid.scale.set(1.28, .82, 1); c.add(vid);
      osso(mo, V(dx * 1.75, 1.482, .16), V(dx * 2.62, 1.47, .03), .004, .004, c, 6);
    });
    osso(mo, V(-.014, 1.484, .168), V(.014, 1.484, .168), .004, .004, c, 6);
  }

  /* laço */
  if(p.laco){
    const ml = mat(p.laco, .6);
    const l = new THREE.Group(); l.position.set(.07, 1.612, .0); l.rotation.set(.1, .25, -.4); c.add(l);
    bola(ml, -.05, 0, 0, .045, l, [1.2, .78, .5]);
    bola(ml,  .05, 0, 0, .045, l, [1.2, .78, .5]);
    bola(ml, 0, 0, 0, .022, l, [1, 1, .9]);
  }

  /* tudo que é cabeça vai para um grupo com pivô no pescoço */
  const cabG = new THREE.Group(); cabG.position.set(0, 1.33, .03); c.add(cabG);
  [...c.children].forEach(o => { if(o !== cabG && o.position.y > 1.335) cabG.attach(o); });
  if(rig){ rig.cab = cabG; rig.boca = boca; }

  /* headset */
  if(p.fone){
    const mf = mat("#1C1F23", .7, .15);
    const arco = new THREE.Mesh(new THREE.TorusGeometry(.155, .02, 8, 22, Math.PI), mf);
    arco.position.set(0, 1.47, .025); arco.rotation.y = Math.PI / 2; arco.castShadow = true; c.add(arco);
    [-.163, .163].forEach(dx => {
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .035, 14), mf);
      cp.position.set(dx, 1.452, .02); cp.rotation.z = Math.PI / 2; cp.castShadow = true; c.add(cp);
    });
    osso(mf, V(-.16, 1.43, .05), V(-.075, 1.385, .15), .009, .009, c, 8);
  }

  g.traverse(o => { if(o.isMesh) o.castShadow = false; });
  return {grupo: g, rig};
}

/* ---- compactar: junta as peças que não se mexem, por material ----
   O corpo vira poucas malhas; a cabeça (que balança na discoteca e mastiga)
   vira outras poucas, ainda dentro do grupo dela; o braço esquerdo, que as
   piadas animam, fica com as peças soltas. De ~45 chamadas para ~15. */
function geoNoReferencial(malha, inversa) {
  let g = malha.geometry.index ? malha.geometry.toNonIndexed() : malha.geometry.clone();
  for (const nome of Object.keys(g.attributes)) if (nome !== 'position' && nome !== 'normal') g.deleteAttribute(nome);
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, malha.matrixWorld));
  return g;
}

function juntarEm(container, pular) {
  container.updateMatrixWorld(true);
  const inversa = new THREE.Matrix4().copy(container.matrixWorld).invert();
  const porMaterial = new Map();
  const tirar = [];
  const visitar = o => {
    for (const filho of [...o.children]) {
      if (pular.has(filho)) continue;
      if (filho.isMesh && !Array.isArray(filho.material)) {
        if (!porMaterial.has(filho.material)) porMaterial.set(filho.material, []);
        porMaterial.get(filho.material).push(geoNoReferencial(filho, inversa));
        tirar.push(filho);
      } else if (filho.children.length) {
        visitar(filho);
        tirar.push(filho);
      }
    }
  };
  visitar(container);
  for (const o of tirar) o.parent && o.parent.remove(o);
  for (const [material, geos] of porMaterial) {
    const geo = BufferGeometryUtils.mergeBufferGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (geo) container.add(new THREE.Mesh(geo, material));
  }
}

export function compactar({ grupo, rig }) {
  if (!rig) return { grupo, rig };
  const braco = new Set([rig.sup, rig.cot, rig.ant, rig.mao, rig.cab]);
  if (rig.cab) juntarEm(rig.cab, new Set([rig.boca]));  /* a boca mastiga: fica solta */
  juntarEm(rig.c, braco);
  return { grupo, rig };
}
