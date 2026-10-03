// Sala 3D do escritório, portada do protótipo standalone. Usa three.js r128
// (fixado no package.json: as APIs de cor e luz mudaram nas versões seguintes).
// Tudo é montado dentro de `raiz`, o bloco do SimuladorEscritorio.astro.
import * as THREE from 'three'
import { PESSOAS, N, MESAS, COLS, LUGAR } from './pessoas.js'
import { desenharQuadro } from './quadro.js'

export function iniciar(raiz) {
  const $ = s => raiz.querySelector(s);
  const palco = $("#palco");
  const POSTO = [];
  let atual = 12;


  /* ================= 3D ================= */
  const PAL = {
    claro:{bg:"#E7E5E0", nevoa:"#E7E5E0", piso:"#8F8D87", parede:"#CFCDC5", teto:"#E3E1DC",
           madeira:"#C9A473", estrutura:"#BFBCB4", cadeira:"#26292E", cadeira3:"#33373D", plastico:"#1C1F23",
           tela:"#33373C", telaOn:"#7E97AB", tv:"#111315",
           hemi:0.42, amb:0.10, dir:0.42, ponto:0.22, expo:0.98},
    escuro:{bg:"#0E1012", nevoa:"#0E1012", piso:"#202326", parede:"#282C30", teto:"#181B1E",
           madeira:"#7E6240", estrutura:"#33373B", cadeira:"#131619", cadeira3:"#1B1F23", plastico:"#0D1013",
           tela:"#24282C", telaOn:"#5E93B5", tv:"#090B0D",
           hemi:0.16, amb:0.05, dir:0.16, ponto:0.55, expo:1.05}
  };
  let P = PAL.claro, escuro = false;
  /* o site é escuro por padrão; o alternador põe data-tema="claro" no <html> */
  function detectarTema(){
    return document.documentElement.dataset.tema !== "claro";
  }
  const destaque = () => getComputedStyle(raiz).getPropertyValue("--destaque").trim() || "#7dd3a0";
  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

  let renderer, scene, camera, raycaster, alvos = [], grupos = [], anel, etiqueta;
  let MAT = {}, luzes = {}, orb = null, anim = null, paredes = [], tetoGrupo = null;

  function mat(cor, rough, metal){
    return new THREE.MeshStandardMaterial({color:new THREE.Color(cor), roughness:rough ?? .85, metalness:metal ?? .04});
  }
  function caixa(l, a, p, material, x, y, z, grupo){
    const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    (grupo || scene).add(m); return m;
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
  function cadeiraGiratoria(g){
    const mc = MAT.cadeira, mp = MAT.plastico, mt = MAT.tela3;
    const assento = caixa(.5, .085, .48, mc, 0, .455, .02, g); assento.receiveShadow = true;
    caixa(.5, .05, .46, mt, 0, .5, .02, g);
    const enc = caixa(.48, .6, .07, mc, 0, .8, -.25, g); enc.rotation.x = -.13;
    const tel = caixa(.38, .46, .03, mt, 0, .81, -.21, g); tel.rotation.x = -.13;
    [-.285, .285].forEach(dx => {
      caixa(.06, .045, .3, mc, dx, .63, .04, g);
      caixa(.045, .16, .05, mp, dx, .55, -.08, g);
    });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .34, 12), mp);
    col.position.set(0, .24, .02); col.castShadow = true; g.add(col);
    for(let k = 0; k < 5; k++){
      const a = (k / 5) * Math.PI * 2 + .3;
      const br = caixa(.055, .04, .3, mp, Math.sin(a) * .17, .075, Math.cos(a) * .17 + .02, g);
      br.rotation.y = a;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(.042, .042, .028, 10), mp);
      rod.position.set(Math.sin(a) * .32, .042, Math.cos(a) * .32 + .02);
      rod.rotation.z = Math.PI / 2; rod.rotation.y = a; g.add(rod);
    }
  }

  function fazPessoa(i){
    const p = PESSOAS[i], L = LUGAR[i];
    const g = new THREE.Group();
    g.position.set(L.x, 0, L.z); g.rotation.y = L.giro;
    cadeiraGiratoria(g);

    const semente = [...p.nome].reduce((a, c) => a + c.charCodeAt(0), i * 7);
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
      if(s === -1){
        RIG[i] = {S:ombro, T0:mao.clone(), a:ombro.distanceTo(cotovelo), b:cotovelo.distanceTo(mao), s, sup, cot, ant, mao:mm, c, g};
        ik(RIG[i], mao);
      }
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
    if(RIG[i]){ RIG[i].cab = cabG; RIG[i].boca = boca; }

    /* headset */
    if(p.fone){
      const mf = MAT.plastico;
      const arco = new THREE.Mesh(new THREE.TorusGeometry(.155, .02, 8, 22, Math.PI), mf);
      arco.position.set(0, 1.47, .025); arco.rotation.y = Math.PI / 2; arco.castShadow = true; c.add(arco);
      [-.163, .163].forEach(dx => {
        const cp = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .035, 14), mf);
        cp.position.set(dx, 1.452, .02); cp.rotation.z = Math.PI / 2; cp.castShadow = true; c.add(cp);
      });
      osso(mf, V(-.16, 1.43, .05), V(-.075, 1.385, .15), .009, .009, c, 8);
    }

    g.traverse(o => { if(o.isMesh){ o.userData.i = i; alvos.push(o); } });
    scene.add(g); grupos[i] = g;
  }

  /* ================= quadro branco (desenho em quadro.js) ================= */
  function sorteio(semente){ let s = semente; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  function quadroBranco(parede, cx, cy){
    const W = 7.4, H = 1.34;
    const cv = document.createElement("canvas"); cv.width = 4096; cv.height = Math.round(4096 * H / W);
    const tex = new THREE.CanvasTexture(cv);
    desenharQuadro(cv).then(() => { tex.needsUpdate = true; }).catch(() => {});
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const sup = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
      new THREE.MeshStandardMaterial({map:tex, roughness:.32, metalness:0}));
    sup.position.set(cx, cy, .1); sup.receiveShadow = true; parede.add(sup);

    const alu = mat("#AEB2B7", .35, .6);
    const mold = [[W + .08, .05, cx, cy + H / 2 + .02], [W + .08, .05, cx, cy - H / 2 - .02]];
    mold.forEach(([l, a, px, py]) => caixa(l, a, .05, alu, px, py, .1, parede).castShadow = false);
    [[cx - W / 2 - .02], [cx + W / 2 + .02]].forEach(([px]) => caixa(.05, H + .08, .05, alu, px, cy, .1, parede).castShadow = false);
    /* canaleta com canetas e apagador */
    caixa(W * .7, .03, .1, alu, cx, cy - H / 2 - .06, .14, parede).castShadow = false;
    [["#C8322B", -1.6], ["#1F4FB5", -1.45], ["#23262B", -1.3], ["#1E8A4C", -1.15]].forEach(([cor, dx]) => {
      const cn = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .14, 8), mat(cor, .5));
      cn.rotation.z = Math.PI / 2; cn.position.set(cx + dx, cy - H / 2 - .035, .16); parede.add(cn);
    });
    caixa(.15, .045, .06, mat("#3A3D42", .8), cx + 1.4, cy - H / 2 - .03, .15, parede).castShadow = false;

  }

  /* ================= a mesa do acumulador ================= */
  function bagunca(i){
    const P = POSTO[i], L = LUGAR[i], R = sorteio(97 + i);
    const g = new THREE.Group(); g.position.set(P.x, .78, P.z); g.rotation.y = P.giro; scene.add(g);
    const marca = (m, sombra) => { m.castShadow = !!sombra; m.receiveShadow = true; m.userData.i = i; alvos.push(m); return m; };
    const papel = mat("#F4F2EC", .95), papel2 = mat("#E6E0D0", .95), papel3 = mat("#DDE6EE", .95);

    /* pilhas de papel tortas */
    function pilha(grupo, px, pz, n, larg, y0){
      let y = y0 || 0;
      for(let k = 0; k < n; k++){
        const h = .01 + R() * .016;
        const b = caixa(larg || .21, h, .29, [papel, papel2, papel3][k % 3], px + (R() - .5) * .035, y + h / 2, pz + (R() - .5) * .035, grupo);
        b.rotation.y = (R() - .5) * .4; b.rotation.z = (R() - .5) * .03; marca(b, k === n - 1); y += h;
      }
      return y;
    }
    pilha(g, -.62, -.1, 16); pilha(g, -.4, .17, 26, .23); pilha(g, .68, -.3, 10); pilha(g, .1, .24, 8, .26);

    /* fichários em pé */
    ["#C8322B", "#1F4FB5", "#1E8A4C", "#E0A21F", "#6B4FA0", "#2B2E33"].forEach((cor, k) => {
      const b = caixa(.055, .31, .27, mat(cor, .7), -.86 + k * .06, .155, .19, g);
      b.rotation.z = (k - 2.5) * .03 + (R() - .5) * .05; marca(b, true);
    });

    /* canecas, copinhos e garrafas */
    function caneca(px, pz, cor, y0){
      const y = y0 || 0, m = mat(cor, .45);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.042, .038, .1, 14), m); c.position.set(px, y + .05, pz); g.add(c); marca(c, true);
      const a = new THREE.Mesh(new THREE.TorusGeometry(.027, .008, 6, 12), m); a.position.set(px + .047, y + .05, pz); g.add(a); marca(a);
      const cf = new THREE.Mesh(new THREE.CircleGeometry(.036, 12), mat("#3B2416", .3));
      cf.rotation.x = -Math.PI / 2; cf.position.set(px, y + .092, pz); g.add(cf); marca(cf);
    }
    caneca(-.43, -.36, "#FFFFFF"); caneca(.44, -.12, "#C8322B"); caneca(-.3, .02, "#1F4FB5");
    caneca(.66, .12, "#F4F2EC"); caneca(.66, .12, "#E0A21F", .1); caneca(.52, .4, "#2F6F5E", .4);
    [[-.18, -.52], [.62, -.05], [-.72, -.38], [.36, .16]].forEach(([px, pz], k) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.036, .027, .11, 12), mat("#F7F5F0", .8));
      c.position.set(px, .055, pz); g.add(c); marca(c, true);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(.038, .038, .012, 12), mat("#5A3A26", .6));
      t.position.set(px, .115, pz); g.add(t); marca(t);
      if(k === 3){ c.rotation.z = Math.PI / 2; c.position.y = .036; t.visible = false; }
    });
    [[.46, .22], [.54, .27], [.58, .2]].forEach(([px, pz]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(.032, .032, .24, 12),
        new THREE.MeshStandardMaterial({color:0xA9D2EC, transparent:true, opacity:.55, roughness:.1}));
      b.position.set(px, .12, pz); g.add(b); marca(b);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .03, 10), mat("#1F4FB5", .5));
      t.position.set(px, .255, pz); g.add(t); marca(t);
    });

    /* notebooks empilhados, salgadinho, bolacha */
    [0, 1, 2].forEach(k => { const b = caixa(.3, .022, .21, mat(k === 1 ? "#8E9398" : "#3A3D42", .5, .4), -.58, .011 + k * .023, -.4, g);
      b.rotation.y = (R() - .5) * .3; marca(b, true); });
    const sal = caixa(.15, .2, .045, mat("#E0A21F", .6), .5, .03, -.3, g); sal.rotation.set(-Math.PI / 2 + .1, .4, 0); marca(sal, true);
    const bol = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .2, 14), mat("#1F4FB5", .6));
    bol.rotation.z = Math.PI / 2; bol.rotation.y = .5; bol.position.set(.1, .035, -.52); g.add(bol); marca(bol, true);

    /* ventilador */
    const vent = new THREE.Group(); vent.position.set(-.82, 0, -.28); vent.rotation.y = .4; g.add(vent);
    marca(caixa(.14, .025, .12, MAT.plastico, 0, .012, 0, vent), true);
    marca(caixa(.02, .16, .02, MAT.plastico, 0, .1, 0, vent));
    const hel = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .045, 20), mat("#DDE1E4", .4));
    hel.rotation.x = Math.PI / 2; hel.position.set(0, .22, -.01); vent.add(hel); marca(hel, true);
    const gra = new THREE.Mesh(new THREE.TorusGeometry(.09, .006, 6, 24), MAT.plastico);
    gra.position.set(0, .22, -.035); vent.add(gra); marca(gra);

    /* plantinha meio morta */
    const vaso = new THREE.Mesh(new THREE.CylinderGeometry(.06, .045, .09, 12), mat("#B0714A", .8));
    vaso.position.set(.78, .045, .2); g.add(vaso); marca(vaso, true);
    [[0, .14, 0], [.03, .12, .02], [-.03, .11, -.01]].forEach(([px, py, pz]) => {
      const f = bola(mat("#8A9A4C", .9), .78 + px, py, .2 + pz, .035, g, [1, .6, 1]); marca(f);
    });

    /* post-its colados no monitor (lado que ele vê) */
    const cores = ["#FFE869", "#FFB3CF", "#B6F0A8", "#A8D8FF", "#FFE869", "#FFC98A"];
    const pos = [[-.3, .52], [-.2, .54], [-.1, .53], [.02, .545], [.14, .53], [.26, .52],
                 [-.33, .42], [-.33, .3], [-.32, .2], [.33, .44], [.32, .33], [.33, .22], [-.24, .2], [.24, .19]];
    pos.forEach(([px, py], k) => {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(.065, .065), mat(cores[k % cores.length], .9));
      pl.position.set(px, py, -.028); pl.rotation.set(0, Math.PI, (R() - .5) * .5); g.add(pl); marca(pl);
    });

    /* patinho de borracha em cima do monitor */
    const pato = new THREE.Group(); pato.position.set(.12, .565, .01); pato.rotation.y = Math.PI; g.add(pato);
    marca(bola(mat("#FFD43B", .4), 0, .03, 0, .042, pato, [1.25, .8, 1]));
    marca(bola(mat("#FFD43B", .4), .03, .075, 0, .027, pato));
    marca(bola(mat("#F08A24", .4), .058, .072, 0, .012, pato, [1.4, .6, 1]));

    /* rolo de cabo e papel em cima da torre */
    const cabo = new THREE.Mesh(new THREE.TorusGeometry(.07, .012, 6, 18), MAT.plastico);
    cabo.rotation.x = Math.PI / 2; cabo.position.set(-.15, .015, .3); g.add(cabo); marca(cabo);
    pilha(g, .52, .02, 5, .12, .4);

    /* no chão: caixas, mochila e mais papel */
    const d = L.giro === 0 ? 1 : -1;
    const chao = new THREE.Group(); chao.position.set(L.x + .82, 0, L.z - d * .1); scene.add(chao);
    const pap = mat("#C09A6B", .95);
    [[.5, .34, .4, 0, .17, 0, .1], [.42, .3, .36, .03, .49, .02, -.18], [.34, .24, .3, -.02, .76, 0, .3]].forEach(([l, a, pr, px, py, pz, ry]) => {
      const b = caixa(l, a, pr, pap, px, py, pz, chao); b.rotation.y = ry; marca(b, true);
    });
    [0, 1, 2, 3].forEach(k => { const f = caixa(.21, .004, .29, papel, (R() - .5) * .1, .9 + k * .005, (R() - .5) * .08, chao);
      f.rotation.set((R() - .5) * .5, R() * 3, (R() - .5) * .5); marca(f); });
    const moch = new THREE.Group(); moch.position.set(L.x - .5, 0, L.z - d * .2); moch.rotation.set(-.12, .6, 0); scene.add(moch);
    marca(caixa(.3, .4, .17, mat("#2C3E50", .85), 0, .2, 0, moch), true);
    marca(bola(mat("#2C3E50", .85), 0, .4, 0, .15, moch, [1, .45, .57]));
    marca(caixa(.22, .16, .05, mat("#3D5268", .85), 0, .15, .1, moch));
    pilha(scene, L.x + .45, L.z + d * .55, 12, .23);
  }

  /* ================= armário do jurídico ================= */
  function armarioJuridico(xParede, zc){
    const P = .5, A = 1.9, L = 1.04;                 /* profundidade, altura, largura */
    const g = new THREE.Group(); g.position.set(xParede - P / 2, 0, zc); scene.add(g);
    const aco = mat("#B9BDC1", .45, .35), porta = mat("#C7CBCF", .4, .35), escuro = mat("#2B2E33", .5, .4);

    /* corpo oco: fundo, laterais, teto e chão (por dentro é escuro) */
    const dentro = mat("#4A4E54", .7, .2), e = .02;
    caixa(e, A, L, aco, P / 2 - e / 2, A / 2 + .04, 0, g);
    [-1, 1].forEach(s => caixa(P, A, e, aco, 0, A / 2 + .04, s * (L / 2 - e / 2), g));
    caixa(P, e, L, aco, 0, A + .04 - e / 2, 0, g); caixa(P, e, L, aco, 0, .04 + e / 2, 0, g);
    caixa(.004, A - .06, L - .06, dentro, P / 2 - e - .002, A / 2 + .04, 0, g);
    [[-.2, -.44], [-.2, .44], [.2, -.44], [.2, .44]].forEach(([dx, dz]) =>
      caixa(.05, .04, .05, escuro, dx, .02, dz, g));                          /* pezinhos */
    /* duas portas com fresta no meio, cada uma num pivô na dobradiça */
    const portas = [];
    [-1, 1].forEach(s => {
      const W = L / 2 - .025, zH = s * (L / 2 - .0065);
      const pv = new THREE.Group(); pv.position.set(-P / 2 - .01, 0, zH); g.add(pv);
      const d = caixa(.02, A - .3, W, porta, 0, (A - .3) / 2 + .1, -s * W / 2, pv);
      d.receiveShadow = true;
      caixa(.03, .2, .025, escuro, -.025, 1.02, s * .045 - zH, pv);            /* puxador */
      [.35, 1.55].forEach(y => caixa(.012, .06, .03, escuro, -P / 2 - .012, y, s * (L / 2 - .03), g)); /* dobradiças */
      portas.push({pv, s});
    });
    const tranca = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .02, 12), mat("#D4B45A", .3, .8));
    tranca.rotation.z = Math.PI / 2; tranca.position.set(-.02, 1.2, -.006 - portas[1].pv.position.z); portas[1].pv.add(tranca);

    /* plaqueta no alto: ARMÁRIO DO JURÍDICO */
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 150;
    const pintar = () => {
      const x = cv.getContext("2d");
      x.fillStyle = "#F7F6F2"; x.fillRect(0, 0, 1024, 150);
      x.strokeStyle = "#23262B"; x.lineWidth = 8; x.strokeRect(10, 10, 1004, 130);
      x.fillStyle = "#23262B"; x.font = '700 76px Archivo, "Helvetica Neue", Arial, sans-serif';
      x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("ARMÁRIO DO JURÍDICO", 512, 80, 960);
    };
    pintar();
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(.9, .132), new THREE.MeshStandardMaterial({map:tex, roughness:.6}));
    placa.rotation.y = -Math.PI / 2; placa.position.set(-P / 2 - .004, A - .06, 0); g.add(placa);
    if(document.fonts && document.fonts.load)
      document.fonts.load('700 76px Archivo').then(() => { pintar(); tex.needsUpdate = true; }).catch(() => {});
    g.traverse(o => { if(o.isMesh){ o.userData.armario = true; alvos.push(o); } });
    armario = {g, portas, abre:0};
  }

  /* ================= café para todo mundo ================= */
  const RIG = [];
  let cafe = null, carrinho = null, _u, _p, _E, _d, _T, _q, _Y, _w;
  function prepararVetores(){
    _u = new THREE.Vector3(); _p = new THREE.Vector3(); _E = new THREE.Vector3(); _d = new THREE.Vector3();
    _T = new THREE.Vector3(); _q = new THREE.Vector3(); _w = new THREE.Vector3(); _Y = new THREE.Vector3(0, 1, 0);
  }
  function posOsso(m, A, B){
    m.position.copy(A).add(B).multiplyScalar(.5);
    _q.subVectors(B, A).normalize(); m.quaternion.setFromUnitVectors(_Y, _q);
  }
  /* IK de dois ossos: ombro fixo, punho vai até o alvo, cotovelo aponta para baixo e para fora */
  function ik(r, alvo){
    _d.subVectors(alvo, r.S);
    const a = r.a, b = r.b;
    const d = Math.min(Math.max(_d.length(), Math.abs(a - b) + .001), a + b - .001);
    _u.copy(_d).normalize();
    const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    _p.set(r.s * .55, -1, -.15); _p.addScaledVector(_u, -_p.dot(_u)).normalize();
    _E.copy(r.S).addScaledVector(_u, x).addScaledVector(_p, h);
    _T.copy(r.S).addScaledVector(_u, d);
    posOsso(r.sup, r.S, _E); posOsso(r.ant, _E, _T); r.cot.position.copy(_E);
    _w.subVectors(_T, _E).normalize(); r.mao.position.copy(_T).addScaledVector(_w, .03);
    return _T;
  }

  function fazXicara(){
    const g = new THREE.Group(), branco = mat("#FBFAF7", .35);
    const corpo = new THREE.Mesh(new THREE.CylinderGeometry(.04, .033, .1, 16), branco);
    corpo.castShadow = true; g.add(corpo);
    const asa = new THREE.Mesh(new THREE.TorusGeometry(.025, .007, 6, 12), branco);
    asa.position.set(.045, 0, 0); g.add(asa);
    const liquido = new THREE.Mesh(new THREE.CircleGeometry(.036, 16), mat("#4A2A17", .25));
    liquido.rotation.x = -Math.PI / 2; liquido.position.y = .046; g.add(liquido);
    const vapor = [0, 1, 2].map(() => {
      const v = new THREE.Mesh(new THREE.SphereGeometry(.02, 8, 6),
        new THREE.MeshBasicMaterial({color:0xFFFFFF, transparent:true, opacity:.3, depthWrite:false}));
      g.add(v); return v;
    });
    g.userData = {liquido, vapor};
    return g;
  }

  function fazCarrinho(){
    const g = new THREE.Group();
    const aco = mat("#9FA4AA", .35, .55), tampo = mat("#56625B", .55);
    caixa(.9, .035, .5, tampo, 0, .82, 0, g); caixa(.9, .035, .5, tampo, 0, .32, 0, g);
    [[-.42, -.22], [.42, -.22], [-.42, .22], [.42, .22]].forEach(([x, z]) => {
      caixa(.03, .8, .03, aco, x, .44, z, g);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .03, 14), MAT.plastico);
      r.rotation.x = Math.PI / 2; r.position.set(x, .045, z); g.add(r);
    });
    osso(aco, V(-.44, .82, -.22), V(-.56, 1.02, -.22), .012, .012, g, 8);
    osso(aco, V(-.44, .82, .22), V(-.56, 1.02, .22), .012, .012, g, 8);
    osso(aco, V(-.56, 1.02, -.24), V(-.56, 1.02, .24), .016, .016, g, 8);
    const garrafa = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .32, 18), mat("#C8322B", .3, .25));
    garrafa.position.set(-.2, 1.0, 0); garrafa.castShadow = true; g.add(garrafa);
    const tampa = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, .07, 16), MAT.plastico);
    tampa.position.set(-.2, 1.195, 0); g.add(tampa);
    const bico = osso(MAT.plastico, V(-.2, 1.19, .06), V(-.2, 1.17, .13), .012, .018, g, 8);
    [[.12, -.11], [.12, .11], [.3, -.11], [.3, .11]].forEach(([x, z]) => {
      for(let k = 0; k < 3; k++){
        const xc = new THREE.Mesh(new THREE.CylinderGeometry(.04, .033, .1, 12), mat("#FBFAF7", .35));
        xc.position.set(x, .89 + k * .055, z); xc.castShadow = k === 2; g.add(xc);
      }
    });
    const acucar = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .09, 14), mat("#E9E4D6", .4));
    acucar.position.set(-.35, .88, .16); g.add(acucar);
    return g;
  }

  function botaoCafe(ocupado, rotulo){
    const b = $("#pedir-cafe"); if(!b) return;
    b.disabled = ocupado; $("#cafe-rot").textContent = rotulo;
  }

  function pedirCafe(){
    if(!renderer || (cafe && cafe.rodando)) return;
    /* limpa a rodada anterior */
    if(cafe) cafe.pessoas.forEach(st => { st.xicara.parent && st.xicara.parent.remove(st.xicara); resetarPose(st.i); });
    const t = performance.now() / 1000;
    const ordem = PESSOAS.map((_, i) => i).filter(i => !sumiram.has(i)).sort((a, b) => LUGAR[a].x - LUGAR[b].x || LUGAR[a].z - LUGAR[b].z);
    cafe = {t0:t, rodando:true, pessoas:ordem.map(i => {
      const L = LUGAR[i], r = RIG[i];
      r.g.updateMatrixWorld(true);
      const mundo = r.g.localToWorld(V(-.33, .83, .66));
      const ladoA = L.z < -1;
      return {i, fase:"espera", xicara:fazXicara(), para:mundo, de:new THREE.Vector3(),
              D:r.c.worldToLocal(mundo.clone()), dur:ladoA ? .85 : .6, pico:ladoA ? 1.1 : .55,
              espera:.25 + Math.random() * 1.1, giro:Math.random() < .5 ? 1 : -1};
    })};
    botaoCafe(true, "Café a caminho…");
    voarPara(VISTA_GERAL(), 900);
  }

  function resetarPose(i){
    const r = RIG[i]; if(!r) return;
    ik(r, r.T0); r.cabCafe = 0; if(r.cab) r.cab.rotation.set(0, 0, 0);
  }

  const suaviza = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  const GRIP = [0, .045, .02];

  function atualizarCafe(t){
    const e = t - cafe.t0;
    const cx = Math.min(-5.2 + e * 1.35, 4.95);
    carrinho.position.set(cx, 0, 1.55);
    let terminou = true;

    cafe.pessoas.forEach(st => {
      const r = RIG[st.i], L = LUGAR[st.i], x = st.xicara, u = x.userData;
      if(st.fase !== "fim") terminou = false;

      if(st.fase === "espera" && cx >= L.x - .15){
        st.fase = "voo"; st.tv = t;
        st.de.set(cx + .15, 1.02, 1.55);
        x.position.copy(st.de); scene.add(x);
      }
      if(st.fase === "voo"){
        const k = Math.min(1, (t - st.tv) / st.dur);
        x.position.lerpVectors(st.de, st.para, k);
        x.position.y += Math.sin(Math.PI * k) * st.pico;
        x.rotation.set(0, k * Math.PI * 2 * st.giro, 0);
        u.vapor.forEach(v => v.visible = false);
        if(k >= 1){
          st.fase = "mesa"; st.tm = t;
          r.c.attach(x); x.position.copy(st.D); x.rotation.set(0, 0, 0);
        }
      }
      if(st.fase === "mesa" && t - st.tm > st.espera && !(lanche && lanche.i === st.i)){ st.fase = "beber"; st.tb = t; }

      if(st.fase === "beber"){
        const b = t - st.tb, s = r.s;
        const Pg = _T.set(st.D.x - GRIP[0], st.D.y - GRIP[1], st.D.z - GRIP[2]).clone();
        const M = V(s * .045, 1.3, .21);
        let alvo, naMao = false, incl = 0, cab = 0;
        if(b < .45){ alvo = new THREE.Vector3().lerpVectors(r.T0, Pg, suaviza(b / .45)); }
        else if(b < 1.05){ alvo = new THREE.Vector3().lerpVectors(Pg, M, suaviza((b - .45) / .6)); naMao = true; incl = -.25 * suaviza((b - .45) / .6); }
        else if(b < 2.45){
          const k = (b - 1.05) / 1.4, f = Math.sin(Math.min(1, k * 1.4) * Math.PI / 2);
          alvo = M.clone(); alvo.y += Math.sin(k * Math.PI * 3) * .006; naMao = true;
          incl = -.25 - .6 * f; cab = -.2 * Math.sin(Math.min(1, k) * Math.PI);
          if(k > .55) u.liquido.visible = false;
        }
        else if(b < 3.05){ alvo = new THREE.Vector3().lerpVectors(M, Pg, suaviza((b - 2.45) / .6)); naMao = true; incl = -.25 * (1 - suaviza((b - 2.45) / .6)); }
        else if(b < 3.5){ alvo = new THREE.Vector3().lerpVectors(Pg, r.T0, suaviza((b - 3.05) / .45)); }
        else { alvo = r.T0; st.fase = "fim"; }

        const punho = ik(r, alvo);
        if(naMao){ x.position.set(punho.x + GRIP[0], punho.y + GRIP[1], punho.z + GRIP[2]); x.rotation.set(incl, 0, 0); }
        else { x.position.copy(st.D); x.rotation.set(0, 0, 0); }
        r.cabCafe = cab;
      }

      /* vapor enquanto tem café e a xícara está parada */
      const vaporOn = u.liquido.visible && (st.fase === "mesa" || (st.fase === "beber" && t - st.tb < .45));
      u.vapor.forEach((v, k) => {
        v.visible = vaporOn;
        if(!vaporOn) return;
        const f = ((t * .45) + k / 3) % 1;
        v.position.set(Math.sin(t * 2.2 + k * 2) * .012, .07 + f * .17, Math.cos(t * 1.7 + k) * .01);
        v.scale.setScalar(1 + f * 1.6); v.material.opacity = .32 * (1 - f);
      });
    });

    if(terminou && cafe.rodando){ cafe.rodando = false; botaoCafe(false, "Pedir mais café"); }
  }

  /* ================= sanduíche (clicar em quem tem `sanduiche`) ================= */
  let lanche = null;
  const LANCHE_COMP = .09;
  function fazSanduiche(){
    /* segurado de lado, pivô na mão; a fatia se estende para -z, em direção à boca */
    const g = new THREE.Group(), corpo = new THREE.Group();
    const camada = (cor, l, a, y, rough) => { const m = caixa(l, a, LANCHE_COMP, mat(cor, rough || .7), 0, y, -LANCHE_COMP / 2, corpo); m.castShadow = false; return m; };
    camada("#D9A86A", .15, .018, -.024, .85);
    camada("#E9B84A", .158, .006, -.012, .5);          /* queijo */
    camada("#D98A8A", .154, .01, -.004, .6);           /* presunto */
    camada("#6FA84A", .164, .006, .006, .7);           /* alface */
    camada("#F1DFB8", .15, .004, .011, .9);
    camada("#D9A86A", .15, .018, .022, .85);
    g.add(corpo); g.userData = {corpo};
    return g;
  }
  function comerSanduiche(i){
    const r = RIG[i];
    if(!r || (lanche && lanche.i === i)) return;
    /* não disputa o braço com o café */
    if(cafe && cafe.pessoas.some(st => st.i === i && st.fase === "beber")) return;
    const s = fazSanduiche(); s.scale.setScalar(.001); r.c.add(s);
    lanche = {i, t0:performance.now() / 1000, s};
  }
  function atualizarLanche(t){
    const L = lanche, r = RIG[L.i], b = t - L.t0, s = r.s;
    const MORDIDAS = 4, CICLO = .85, INI = .55, FIM = INI + MORDIDAS * CICLO;
    /* quanto do sanduíche ainda existe (1 → 0), caindo a cada mordida */
    const feitas = Math.max(0, Math.min(MORDIDAS, (b - INI) / CICLO));
    const inteiras = Math.floor(feitas), fr = feitas - inteiras;
    const resto = 1 - (inteiras + suaviza((fr - .4) / .15)) / MORDIDAS;
    /* mão fica onde a ponta do sanduíche encosta na boca, recua entre mordidas */
    const recuo = b < INI || b >= FIM ? .05 : .05 * (1 - Math.sin(Math.min(1, fr / .55) * Math.PI));
    const boca = V(s * .02, 1.37, .185 + LANCHE_COMP * Math.max(resto, .15) + recuo);
    let alvo, aparece = 1;
    if(b < INI){ const k = suaviza(b / INI); alvo = new THREE.Vector3().lerpVectors(r.T0, boca, k); aparece = k; }
    else if(b < FIM){ alvo = boca; }
    else if(b < FIM + .5){ alvo = new THREE.Vector3().lerpVectors(boca, r.T0, suaviza((b - FIM) / .5)); }
    else {
      L.s.parent && L.s.parent.remove(L.s); lanche = null;
      ik(r, r.T0); r.cabCafe = 0; if(r.boca) r.boca.scale.y = 1;
      if(!disco && r.cab) r.cab.rotation.x = 0;
      return;
    }
    const punho = ik(r, alvo);
    L.s.position.set(punho.x - s * .02, punho.y + .03, punho.z - .01);
    L.s.scale.set(aparece, aparece, aparece);
    L.s.userData.corpo.scale.z = Math.max(.001, resto);
    L.s.visible = resto > .001;
    /* mastiga: boca abre e fecha, cabeça acompanha de leve */
    const mastigando = b > INI && b < FIM + .5;
    const mast = mastigando ? Math.abs(Math.sin(b * 11)) : 0;
    if(r.boca) r.boca.scale.y = 1 + mast * 1.8;
    r.cabCafe = mastigando ? .06 + mast * .04 : 0;
    if(!disco && r.cab) r.cab.rotation.x = r.cabCafe;
  }

  /* ================= armário do jurídico: o esqueleto foge ================= */
  /* clicar no armário: sai um homem correndo com o esqueleto debaixo do braço, pelo
     corredor, até a porta da parede oeste. Quem tem `perseguidor` sai atrás na primeira
     vez e não volta mais: `sumiram` fica fora do montar(), só a recarga traz de volta. */
  let armario = null, saida = null, fuga = null, ultFuga = 0;
  const sumiram = new Set();
  const ROTA_FUGA = [[5.78, 1.15], [4.3, 1.05], [3.4, 1.45], [-5.5, 1.45], [-7.4, 1.45]];
  const rotaPerseguidor = L => [[L.x, L.z], [L.x - .4, 1.6], [-5.5, 1.45], [-7.4, 1.45]];

  function portaSaida(parede){
    /* no referencial da parede oeste: x = .072 é a face de dentro, y = -1.5 é o chão */
    const x0 = .072, y0 = -1.5, zc = 1.45;
    const vao = new THREE.Mesh(new THREE.PlaneGeometry(.9, 2.05), new THREE.MeshBasicMaterial({color:0x121417}));
    vao.rotation.y = Math.PI / 2; vao.position.set(x0 + .001, y0 + 1.025, zc); parede.add(vao);
    const batente = mat("#3B3F44", .6);
    caixa(.03, .06, 1.02, batente, x0 + .015, y0 + 2.08, zc, parede);
    [-1, 1].forEach(s => caixa(.03, 2.11, .06, batente, x0 + .015, y0 + 1.055, zc + s * .48, parede));
    /* pivô na dobradiça do lado +z: abre para dentro da sala sem cruzar o corredor */
    const pv = new THREE.Group(); pv.position.set(x0 + .03, y0, zc + .45); parede.add(pv);
    caixa(.04, 2.03, .88, mat("#8C6A48", .7), 0, 1.025, -.45, pv);
    caixa(.05, .03, .12, mat("#C9CCCF", .3, .7), .045, 1.0, -.8, pv);
    saida = {pv, abre:0};
  }

  function fazCorredor(o){
    const g = new THREE.Group(), corpo = new THREE.Group();
    corpo.scale.setScalar(o.esc || .86); g.add(corpo);
    const gordo = !!o.gordo;
    const pele = mat(o.pele, .72), camisa = mat(o.camisa, .88), calca = mat(o.calca || "#3A3F47", .92);
    const camisa2 = mat(new THREE.Color(o.camisa).multiplyScalar(.82).getStyle(), .88), sapato = mat("#24262A", .6, .1);
    bola(calca, 0, .93, 0, gordo ? .27 : .19, corpo, [1.15, .62, .85]);
    /* Q: quadril (balança e inclina); U: tronco montado nas mesmas medidas de quem senta */
    const Q = new THREE.Group(); Q.position.y = .95; corpo.add(Q);
    const U = new THREE.Group(); U.position.y = -.5; Q.add(U);
    const tr = tronco(camisa, U);
    if(gordo){ tr.scale.set(1.3, 1, .68 * 1.35); bola(camisa, 0, .8, .1, .3, U, [1.12, 1, 1.05]); }
    const gola = new THREE.Mesh(new THREE.CylinderGeometry(.115, .155, .09, 18), camisa2);
    gola.position.set(0, 1.27, .02); gola.scale.z = .74; U.add(gola);
    osso(pele, V(0, 1.24, .02), V(0, 1.37, .025), .072, .078, U, 14);
    o.cabeca(U).position.set(0, 1.33, .03);
    const bracos = [-1, 1].map(s => {
      const om = new THREE.Group(); om.position.set(s * (gordo ? .31 : .238), 1.155, .02); U.add(om);
      bola(camisa, 0, 0, 0, .088, om);
      osso(camisa, V(0, 0, 0), V(0, -.27, 0), .075, .066, om);
      const co = new THREE.Group(); co.position.y = -.27; om.add(co);
      bola(camisa2, 0, 0, 0, .066, co);
      osso(pele, V(0, 0, 0), V(0, -.25, 0), .062, .05, co);
      bola(pele, 0, -.28, 0, .062, co, [.85, 1.25, .6]);
      return {om, co, s};
    });
    const pernas = [-1, 1].map(s => {
      const cx = new THREE.Group(); cx.position.set(s * (gordo ? .15 : .115), .95, 0); corpo.add(cx);
      osso(calca, V(0, 0, 0), V(0, -.46, 0), gordo ? .135 : .105, gordo ? .11 : .09, cx);
      const jo = new THREE.Group(); jo.position.y = -.46; cx.add(jo);
      bola(calca, 0, 0, 0, gordo ? .11 : .09, jo);
      osso(calca, V(0, 0, 0), V(0, -.43, 0), gordo ? .1 : .085, .07, jo);
      caixa(.13, .08, .28, sapato, 0, -.46, .07, jo);
      return {cx, jo};
    });
    return {g, corpo, Q, U, bracos, pernas};
  }

  /* um passo a cada π de fase: coxa vai e volta, joelho dobra na volta, braço oposto */
  function correr(c, f){
    c.pernas.forEach((p, k) => {
      const ph = f + k * Math.PI;
      p.cx.rotation.x = -.8 * Math.sin(ph);
      p.jo.rotation.x = .25 + 1.1 * Math.max(0, Math.cos(ph));
    });
    c.bracos.forEach(b => {
      if(b.preso) return;
      b.om.rotation.x = .75 * Math.sin(f + (b.s < 0 ? 0 : Math.PI)); b.co.rotation.x = -1.35;
    });
    c.Q.position.y = .95 + .04 * Math.abs(Math.cos(f));
    c.Q.rotation.x = .2;
  }

  function cabecaGordo(U){
    const H = new THREE.Group(); U.add(H);
    const pele = mat("#E9B99A", .7), cab = mat("#3E2C20", .95);
    bola(pele, 0, .125, 0, .145, H, [1.06, 1.06, 1.03]);
    [-1, 1].forEach(s => bola(pele, s * .145, .12, -.01, .036, H, [.5, 1.15, .9]));
    bola(pele, 0, .035, .06, .11, H, [1.2, .6, .95]);                         /* papada */
    const mOlho = mat("#F6F3EE", .35), mIris = mat("#2A211B", .3);
    [-.05, .05].forEach(dx => {
      bola(mOlho, dx, .15, .126, .024, H, [1, .9, .6]); bola(mIris, dx, .15, .143, .013, H);
      const sob = caixa(.052, .014, .016, cab, dx, .19, .134, H); sob.rotation.z = dx > 0 ? -.25 : .25;
    });
    bola(pele, 0, .11, .152, .03, H);                                         /* nariz */
    caixa(.05, .028, .014, mat("#5A2A26", .6), 0, .048, .142, H);            /* boca aberta, ofegante */
    /* cabelo curto cheio */
    const capa = new THREE.Mesh(new THREE.SphereGeometry(.156, 20, 16, 0, Math.PI * 2, 0, 1.3), cab);
    capa.position.set(0, .125, -.002); capa.scale.set(1.05, 1.08, 1.06); capa.rotation.x = -.22; H.add(capa);
    const nuca = new THREE.Mesh(new THREE.SphereGeometry(.158, 18, 14, Math.PI, Math.PI, .25, 1.45), cab);
    nuca.position.set(0, .12, -.002); nuca.scale.set(1.05, 1.08, 1.06); H.add(nuca);
    return H;
  }

  function fazEsqueleto(){
    const m = mat("#ECE6D6", .65), oco = mat("#2A2522", .9), dente = mat("#FFFFFF", .4);
    const g = new THREE.Group();
    bola(m, 0, 0, 0, .12, g, [1.3, .6, .75]);                                 /* bacia */
    for(let k = 0; k < 9; k++) bola(m, 0, .07 + k * .055, -.03, .024, g);   /* coluna */
    for(let k = 0; k < 5; k++){                                               /* costelas */
      const r = new THREE.Mesh(new THREE.TorusGeometry(.125 - k * .01, .011, 6, 18), m);
      r.rotation.x = Math.PI / 2; r.scale.set(1, .72, 1); r.position.set(0, .24 + k * .055, 0); g.add(r);
    }
    caixa(.03, .2, .02, m, 0, .36, .085, g);                                  /* esterno */
    osso(m, V(-.17, .52, 0), V(.17, .52, 0), .014, .014, g, 6);              /* clavículas */
    osso(m, V(0, .5, -.02), V(0, .62, 0), .02, .02, g, 6);
    const cr = new THREE.Group(); cr.position.set(0, .6, 0); g.add(cr);
    bola(m, 0, .11, 0, .11, cr, [.92, 1.05, 1.08]);
    [-.04, .04].forEach(dx => bola(oco, dx, .115, .088, .028, cr, [1, 1, .5]));
    bola(oco, 0, .072, .104, .014, cr);
    caixa(.08, .014, .01, dente, 0, .046, .1, cr);
    const mand = new THREE.Group(); mand.position.set(0, .04, 0); cr.add(mand);
    caixa(.1, .03, .1, m, 0, -.016, .045, mand);
    caixa(.08, .014, .01, dente, 0, .002, .092, mand);
    const bracos = [-1, 1].map(s => {
      const b = new THREE.Group(); b.position.set(s * .18, .5, 0); g.add(b);
      osso(m, V(0, 0, 0), V(0, -.29, 0), .017, .014, b, 6);
      const a = new THREE.Group(); a.position.y = -.29; b.add(a);
      bola(m, 0, 0, 0, .022, a);
      osso(m, V(0, 0, 0), V(0, -.26, 0), .014, .012, a, 6);
      bola(m, 0, -.29, 0, .035, a, [1, 1.3, .5]);
      return {b, a};
    });
    const pernas = [-1, 1].map(s => {
      const p = new THREE.Group(); p.position.set(s * .09, -.03, 0); g.add(p);
      osso(m, V(0, 0, 0), V(0, -.42, 0), .022, .018, p, 6);
      const j = new THREE.Group(); j.position.y = -.42; p.add(j);
      bola(m, 0, 0, 0, .03, j);
      osso(m, V(0, 0, 0), V(0, -.4, 0), .018, .015, j, 6);
      caixa(.06, .03, .15, m, 0, -.41, .05, j);
      return {p, j};
    });
    return {g, cr, mand, bracos, pernas};
  }

  /* esqueleto deitado debaixo do braço esquerdo: crânio para a frente, pernas para trás,
     braços pendurados para o chão (que no referencial dele é +x) */
  function carregarEsqueleto(c){
    const e = fazEsqueleto();
    const K = new THREE.Group(); K.position.set(-.52, .98, .06); K.rotation.x = Math.PI / 2; c.U.add(K);
    e.g.rotation.y = -Math.PI / 2; e.g.position.y = -.3; e.g.scale.setScalar(.8); K.add(e.g);
    const b = c.bracos[0]; b.preso = true;
    b.om.rotation.set(-.15, 0, -.32); b.co.rotation.x = -1.1;
    return e;
  }
  function balancarEsqueleto(e, f, t){
    e.bracos.forEach((b, k) => {
      b.b.rotation.z = Math.PI / 2 + .35 * Math.sin(f + k * 1.7);
      b.a.rotation.z = .4 * Math.sin(f * 1.3 + k);
    });
    e.pernas.forEach((p, k) => {
      p.p.rotation.z = .75 + .3 * Math.sin(f + k * Math.PI);
      p.j.rotation.x = .3 * Math.sin(f * 1.1 + k);
    });
    e.cr.rotation.z = .25 * Math.sin(f * .9);
    e.mand.rotation.x = .2 + .2 * Math.sin(t * 24);                          /* bate os dentes */
  }

  function fazRota(pts){
    const seg = []; let tot = 0;
    for(let k = 1; k < pts.length; k++){
      const [ax, az] = pts[k - 1], [bx, bz] = pts[k], l = Math.hypot(bx - ax, bz - az);
      seg.push({ax, az, bx, bz, l, d0:tot}); tot += l;
    }
    return {seg, tot};
  }
  function naRota(r, d){
    const s = r.seg.find(s => d <= s.d0 + s.l) || r.seg[r.seg.length - 1];
    const k = Math.min(1, (d - s.d0) / s.l);
    return {x:s.ax + (s.bx - s.ax) * k, z:s.az + (s.bz - s.az) * k, ang:Math.atan2(s.bx - s.ax, s.bz - s.az)};
  }

  function abrirArmario(){
    if(!renderer || !armario || fuga) return;
    const t = performance.now() / 1000;
    const c = fazCorredor({pele:"#E9B99A", camisa:"#F2F0EA", calca:"#4A4F57", gordo:true, esc:.9, cabeca:cabecaGordo});
    const esq = carregarEsqueleto(c);
    c.g.position.set(ROTA_FUGA[0][0], 0, ROTA_FUGA[0][1]);
    scene.add(c.g);
    const quem = PESSOAS.findIndex((p, i) => p.perseguidor && !sumiram.has(i));
    fuga = {t0:t, perseguidor:quem >= 0 ? quem : null, saiu:false,
            corredores:[{c, esq, rota:fazRota(ROTA_FUGA), vel:2.5, inicio:t + .4}]};
    voarPara(VISTA_GERAL(), 900);
  }

  function sairCorrendo(i, t){
    const p = PESSOAS[i], L = LUGAR[i], r = RIG[i];
    sumiram.add(i); r.c.visible = false;
    const cabeca = U => { const h = r.cab.clone(); h.rotation.set(0, 0, 0); U.add(h); return h; };
    const c = fazCorredor({pele:p.pele, camisa:p.camisa, calca:p.calca, cabeca, esc:.86});
    c.g.position.set(L.x, 0, L.z); c.g.rotation.y = L.giro;
    scene.add(c.g);
    fuga.corredores.push({c, rota:fazRota(rotaPerseguidor(L)), vel:2.9, inicio:t + .35, ang:L.giro, pulo:true});
  }

  function atualizarFuga(t){
    const dt = Math.min(.1, t - (ultFuga || t)); ultFuga = t;
    let pertoDaSaida = false;
    if(fuga){
      let acabou = true;
      fuga.corredores.forEach(r => {
        if(r.fim) return;
        acabou = false;
        const d = Math.max(0, (t - r.inicio) * r.vel), P = naRota(r.rota, d), g = r.c.g;
        g.position.set(P.x, 0, P.z);
        if(r.ang === undefined) r.ang = P.ang;
        if(t >= r.inicio){
          let da = P.ang - r.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
          r.ang += da * Math.min(1, dt * 12);
        }
        g.rotation.y = r.ang;
        const f = d * 3.4;
        if(t >= r.inicio) correr(r.c, f);
        /* o perseguidor levanta num pulo antes de sair */
        r.c.corpo.position.y = r.pulo && t < r.inicio ? .22 * Math.sin(Math.PI * (1 - (r.inicio - t) / .35)) : 0;
        if(r.esq) balancarEsqueleto(r.esq, f, t);
        if(P.x < -3.4) pertoDaSaida = true;
        if(d >= r.rota.tot){ r.fim = true; scene.remove(g); }
      });
      const g0 = fuga.corredores[0].c.g;
      if(fuga.perseguidor !== null && !fuga.saiu && g0.position.x < LUGAR[fuga.perseguidor].x + .8){
        fuga.saiu = true; sairCorrendo(fuga.perseguidor, t); acabou = false;
      }
      if(acabou) fuga = null;
    }
    if(armario){
      const alvo = fuga && t - fuga.t0 < 1.5 ? 1 : 0;
      armario.abre += (alvo - armario.abre) * Math.min(1, dt * (alvo ? 10 : 4));
      armario.portas.forEach(p => p.pv.rotation.y = p.s * 1.9 * armario.abre);
    }
    if(saida){
      const alvo = pertoDaSaida ? 1 : 0;
      saida.abre += (alvo - saida.abre) * Math.min(1, dt * (alvo ? 8 : 3));
      saida.pv.rotation.y = -1.6 * saida.abre;
    }
  }

  /* ================= discoteca ================= */
  const CORES_DISCO = ["#FF2E88", "#2EC4FF", "#FFD23F", "#7CFF4F", "#B04BFF", "#FF7A1A"];
  const BPM = 122;
  let disco = null;

  function texturaGlobo(){
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
    const x = cv.getContext("2d"), R = sorteio(3);
    for(let i = 0; i < 32; i++) for(let j = 0; j < 16; j++){
      const v = 150 + (R() * 105 | 0);
      x.fillStyle = `rgb(${v},${v},${Math.min(255, v + 8)})`; x.fillRect(i * 16, j * 16, 16, 16);
    }
    x.strokeStyle = "rgba(40,44,52,.85)"; x.lineWidth = 2;
    for(let i = 0; i <= 32; i++){ x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 256); x.stroke(); }
    for(let j = 0; j <= 16; j++){ x.beginPath(); x.moveTo(0, j * 16); x.lineTo(512, j * 16); x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  }
  function texturaPonto(){
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const x = cv.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.35, "rgba(255,255,255,.7)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  function montarDisco(){
    const d = {alvo:0, mix:0, t0:0, ult:0, fases:PESSOAS.map((_, i) => (i * .137) % 1)};
    /* globo pendurado */
    d.globo = new THREE.Group(); d.globo.position.set(0, 3.6, .3); scene.add(d.globo);
    const tex = texturaGlobo();
    d.bola = new THREE.Mesh(new THREE.SphereGeometry(.34, 32, 16),
      new THREE.MeshStandardMaterial({map:tex, emissive:0xFFFFFF, emissiveMap:tex, emissiveIntensity:.25,
                                      metalness:.55, roughness:.28, flatShading:true}));
    d.globo.add(d.bola);
    const fio = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1.4, 6), MAT.plastico);
    fio.position.y = .34 + .7; d.globo.add(fio);
    const tampa = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .06, 12), mat("#C9CCD0", .3, .7));
    tampa.position.y = .36; d.globo.add(tampa);
    d.luzGlobo = new THREE.PointLight(0xFFFFFF, 0, 6, 2); d.luzGlobo.position.set(0, -.5, 0); d.globo.add(d.luzGlobo);
    d.globo.visible = false;

    /* canhões de luz colorida */
    d.spots = [[-3, -1.7], [3, -1.7], [-3, 2.2], [3, 2.2]].map(([x, z], k) => {
      const sp = new THREE.SpotLight(0xFFFFFF, 0, 16, .42, .55, 1.2);
      sp.position.set(x, 2.95, z); scene.add(sp); scene.add(sp.target); return sp;
    });

    /* pontinhos refletidos pelo globo nas paredes, chão e teto */
    const N = 170, R = sorteio(11);
    d.dirs = [];
    for(let k = 0; k < N; k++){
      let v; do { v = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); } while(v.lengthSq() > 1 || v.lengthSq() < .05);
      d.dirs.push(v.normalize());
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    d.pontos = new THREE.Points(geo, new THREE.PointsMaterial({size:.17, map:texturaPonto(), vertexColors:true,
      transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending}));
    d.pontos.frustumCulled = false; d.pontos.visible = false; scene.add(d.pontos);

    /* guarda os valores normais para voltar depois */
    d.normal = {hemi:luzes.hemi.intensity, amb:luzes.amb.intensity, dir:luzes.dir.intensity,
                ponto:P.ponto, bg:scene.background.clone(), luz:MAT.luz.color.clone(),
                telaEm:MAT.tela.emissive.clone(), telaInt:MAT.tela.emissiveIntensity};
    d.cor = new THREE.Color(); d.tmp = new THREE.Color(); d.v = new THREE.Vector3(); d.w = new THREE.Vector3();
    disco = d;
    botaoDisco(false);
  }

  function botaoDisco(on){
    const b = $("#discoteca"); if(!b) return;
    b.setAttribute("aria-pressed", String(on));
    $("#disco-rot").textContent = on ? "Parar a festa" : "Discoteca";
  }
  function alternarDisco(){
    if(!disco) return;
    const ligar = disco.alvo === 0;
    disco.alvo = ligar ? 1 : 0;
    if(ligar){ disco.t0 = performance.now() / 1000; voarPara(VISTA_GERAL(), 900); }
    botaoDisco(ligar);
  }

  /* onde o raio que sai do globo bate na sala: 0 oeste, 1 leste, 2 chão, 3 teto, 4 fundo, 5 parede da Mesa 2 */
  function bateNaSala(B, d, out){
    const lim = [[-5.93, 5.93], [.012, 2.985], [-3.93, 3.93]], eixo = ["x", "y", "z"];
    let tMin = Infinity, face = -1;
    for(let a = 0; a < 3; a++){
      const v = d[eixo[a]]; if(Math.abs(v) < 1e-5) continue;
      const t = ((v > 0 ? lim[a][1] : lim[a][0]) - B[eixo[a]]) / v;
      if(t > 0 && t < tMin){ tMin = t; face = a * 2 + (v > 0 ? 1 : 0); }
    }
    out.copy(B).addScaledVector(d, tMin); return face;
  }

  function atualizarDisco(t){
    const d = disco; if(!d) return;
    const dt = Math.min(.1, t - (d.ult || t)); d.ult = t;
    d.mix += (d.alvo - d.mix) * Math.min(1, dt * 2.2);
    if(Math.abs(d.mix - d.alvo) < .002) d.mix = d.alvo;
    const m = d.mix, ativo = m > .001;

    /* batida */
    const bt = Math.max(0, t - d.t0) * BPM / 60, beat = Math.floor(bt), fase = bt - beat;
    const pulso = .35 + .65 * Math.exp(-fase * 5);

    /* luz ambiente cai, teto apaga */
    const N0 = d.normal;
    luzes.hemi.intensity = N0.hemi * (1 - .86 * m);
    luzes.amb.intensity = N0.amb * (1 - .85 * m);
    luzes.dir.intensity = N0.dir * (1 - .85 * m);
    luzes.pontos.forEach(pt => pt.intensity = N0.ponto * (1 - .9 * m));
    scene.background.copy(N0.bg).lerp(d.tmp.set("#07060B"), m * .9);
    scene.fog.color.copy(scene.background);
    MAT.luz.color.copy(N0.luz).lerp(d.tmp.set("#3A3640"), m);

    /* globo desce do teto */
    d.globo.visible = ativo;
    const desce = m < 1 ? 1 - Math.pow(1 - m, 3) : 1;
    d.globo.position.y = 3.6 - 1.3 * desce;
    d.bola.rotation.y = t * .9;
    d.bola.material.emissiveIntensity = .12 + .45 * (.5 + .5 * Math.sin(t * 11)) * m;

    /* canhões coloridos varrendo a sala */
    d.spots.forEach((sp, k) => {
      d.cor.set(CORES_DISCO[(beat + k * 2) % CORES_DISCO.length]);
      sp.color.copy(d.cor);
      sp.intensity = ativo ? 4.4 * m * pulso : 0;
      sp.target.position.set(Math.sin(t * .9 + k * 1.7) * 3.4, 0, .3 + Math.cos(t * 1.15 + k * 2.3) * 2.6);
    });
    d.cor.set(CORES_DISCO[beat % CORES_DISCO.length]);
    d.luzGlobo.color.copy(d.cor); d.luzGlobo.intensity = ativo ? 1.2 * m * pulso : 0;

    /* telas dos monitores entram no ritmo */
    MAT.tela.emissive.copy(N0.telaEm).lerp(d.cor, m * .85);
    MAT.tela.emissiveIntensity = N0.telaInt + (1.1 - N0.telaInt) * m * pulso;

    /* reflexos girando */
    d.pontos.visible = ativo; d.pontos.material.opacity = m;
    if(ativo){
      const pos = d.pontos.geometry.attributes.position.array, col = d.pontos.geometry.attributes.color.array;
      const B = d.globo.position, ang = d.bola.rotation.y, ca = Math.cos(ang), sa = Math.sin(ang);
      const vis = [paredes[2].m.visible, paredes[3].m.visible, true, tetoGrupo ? tetoGrupo.visible : true,
                   paredes[0].m.visible, paredes[1].m.visible];
      d.dirs.forEach((v, k) => {
        d.w.set(v.x * ca + v.z * sa, v.y, -v.x * sa + v.z * ca);
        const face = bateNaSala(B, d.w, d.v);
        if(!vis[face]) d.v.set(0, -60, 0);
        pos[k * 3] = d.v.x; pos[k * 3 + 1] = d.v.y; pos[k * 3 + 2] = d.v.z;
        d.tmp.set(k % 3 === 0 ? "#FFFFFF" : CORES_DISCO[(beat + k) % CORES_DISCO.length]);
        const brilho = .55 + .45 * Math.sin(t * 6 + k);
        col[k * 3] = d.tmp.r * brilho; col[k * 3 + 1] = d.tmp.g * brilho; col[k * 3 + 2] = d.tmp.b * brilho;
      });
      d.pontos.geometry.attributes.position.needsUpdate = true;
      d.pontos.geometry.attributes.color.needsUpdate = true;
    }

    /* todo mundo balança a cabeça na batida */
    RIG.forEach((r, i) => {
      if(!r || !r.cab) return;
      const f = (bt + d.fases[i]) % 1;
      r.cab.rotation.x = (r.cabCafe || 0) + (ativo ? Math.sin(f * Math.PI * 2) * .13 * m : 0);
      r.cab.rotation.z = ativo ? Math.sin((bt * .5 + d.fases[i]) * Math.PI * 2) * .06 * m : 0;
    });
  }

  function fazMesa(x0, x1, zc, prof, comMonitorDosDoisLados){
    const larg = x1 - x0, cx = (x0 + x1) / 2;
    caixa(larg, .06, prof, MAT.madeira, cx, .75, zc);
    caixa(larg, .04, prof - .1, MAT.estrutura, cx, .7, zc);
    for(let x = x0 + .5; x <= x1 - .4; x += 2.2){
      caixa(.08, .72, .08, MAT.estrutura, x, .36, zc - prof / 2 + .2);
      caixa(.08, .72, .08, MAT.estrutura, x, .36, zc + prof / 2 - .2);
    }
    return cx;
  }
  function fazPosto(x, z, giro){
    /* monitor virado para quem senta (giro = rotação do usuário) */
    const g = new THREE.Group();
    g.position.set(x, .78, z); g.rotation.y = giro;
    caixa(.18, .02, .16, MAT.plastico, 0, .01, 0, g);
    caixa(.05, .16, .05, MAT.plastico, 0, .09, 0, g);
    caixa(.62, .38, .035, MAT.plastico, 0, .36, .01, g);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(.57, .33), MAT.tela);
    tela.position.set(0, .36, -.02); tela.rotation.y = Math.PI; g.add(tela);
    caixa(.11, .4, .36, MAT.plastico, .52, .2, .02, g);   /* torre em cima da mesa */
    caixa(.42, .022, .15, MAT.plastico, 0, .012, -.36, g);   /* teclado, do lado de quem senta */
    caixa(.07, .025, .11, MAT.plastico, .3, .013, -.34, g);  /* mouse */
    scene.add(g);
  }

  /* porta-retrato em pé na mesa, virado para quem senta: coração com um nome */
  function portaRetrato(i, nome){
    const P = POSTO[i];
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 320;
    const x = cv.getContext("2d");
    x.fillStyle = "#F7F1E6"; x.fillRect(0, 0, 256, 320);
    x.fillStyle = "#D2334A"; x.beginPath();
    x.moveTo(128, 272);
    x.bezierCurveTo(30, 205, 14, 140, 34, 104);
    x.bezierCurveTo(58, 60, 116, 62, 128, 112);
    x.bezierCurveTo(140, 62, 198, 60, 222, 104);
    x.bezierCurveTo(242, 140, 226, 205, 128, 272);
    x.fill();
    x.fillStyle = "#FFFFFF"; x.font = "italic 700 58px Georgia, serif";
    x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(nome, 128, 160, 170);
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;

    const g = new THREE.Group(); g.position.set(P.x, .78, P.z); g.rotation.y = P.giro; scene.add(g);
    const pe = new THREE.Group(); pe.position.set(-.44, 0, -.14); pe.rotation.y = 2.45; g.add(pe);
    const q = new THREE.Group(); q.position.y = .105; q.rotation.x = -.16; pe.add(q);
    const moldura = mat("#6B4A2E", .6);
    caixa(.17, .012, .016, moldura, 0, .1, 0, q); caixa(.17, .012, .016, moldura, 0, -.1, 0, q);
    caixa(.012, .212, .016, moldura, -.079, 0, 0, q); caixa(.012, .212, .016, moldura, .079, 0, 0, q);
    caixa(.17, .21, .006, moldura, 0, 0, -.006, q);
    const foto = new THREE.Mesh(new THREE.PlaneGeometry(.148, .19), new THREE.MeshStandardMaterial({map:tex, roughness:.55}));
    foto.position.z = .0005; q.add(foto);
    const apoio = osso(moldura, V(0, .07, -.01), V(0, -.105, -.07), .006, .006, q, 6); apoio.castShadow = false;
  }

  function montar(){
    P = escuro ? PAL.escuro : PAL.claro;
    cafe = null; lanche = null; fuga = null; botaoCafe(false, "Pedir café");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(P.bg);
    scene.fog = new THREE.Fog(P.nevoa, 18, 42);
    alvos = []; grupos = [];

    MAT = {
      piso:mat(P.piso, .95), parede:mat(P.parede, .98), teto:mat(P.teto, 1),
      madeira:mat(P.madeira, .78), estrutura:mat(P.estrutura, .8),
      cadeira:mat(P.cadeira, .85), tela3:mat(P.cadeira3, .98), plastico:mat(P.plastico, .7, .15),
      tela:new THREE.MeshStandardMaterial({color:new THREE.Color(P.tela), emissive:new THREE.Color(P.telaOn),
        emissiveIntensity:escuro ? .85 : .35, roughness:.4}),
      tv:mat(P.tv, .35, .3),
      luz:new THREE.MeshBasicMaterial({color:0xFFF8DC})
    };

    /* sala 12 x 8 x 3 */
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), MAT.piso);
    piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
    const teto = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), MAT.teto);
    teto.rotation.x = Math.PI / 2; teto.position.y = 3; scene.add(teto);
    const pN = caixa(12, 3, .14, MAT.parede, 0, 1.5, -4.07);
    const pS = caixa(12, 3, .14, MAT.parede, 0, 1.5, 4.07);
    const pL = caixa(.14, 3, 8.2, MAT.parede, 6.07, 1.5, 0);
    paredes = [
      {m:pN, eixo:"z", lim:-4.07, sinal:-1},
      {m:pS, eixo:"z", lim: 4.07, sinal: 1},
      {m:caixa(.14, 3, 8.2, MAT.parede, -6.07, 1.5, 0), eixo:"x", lim:-6.07, sinal:-1},
      {m:pL, eixo:"x", lim: 6.07, sinal: 1}
    ];
    /* o que está pendurado some junto com a parede */
    const tv = caixa(.09, 1.45, 2.55, MAT.tv, -.1, .32, -1, pL); tv.castShadow = false;
    quadroBranco(pN, 0, .4);
    portaSaida(paredes[2].m);

    /* pilar */
    caixa(.5, 3, .5, MAT.teto, -4.6, 1.5, -.3);

    /* luminárias */
    tetoGrupo = new THREE.Group(); scene.add(tetoGrupo); luzes.pontos = [];
    [-2.2, .6, 2.9].forEach(z => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(7.4, .07, .26), MAT.luz);
      l.position.set(0, 2.92, z); tetoGrupo.add(l);
      const pt = new THREE.PointLight(0xFFF3D0, P.ponto, 11, 2);
      pt.position.set(0, 2.7, z); scene.add(pt); luzes.pontos.push(pt);
    });

    /* mesas */
    fazMesa(-3.7, 3.7, -1.0, 1.7);   /* Mesa 1 */
    fazMesa(-3.7, 3.7, 3.35, 1.1);   /* Mesa 2, encostada */

    /* postos */
    MESAS[0].A.forEach((i,k) => { POSTO[i] = {x:COLS[k], z:-1.38, giro:0};       fazPosto(COLS[k], -1.38, 0); });
    MESAS[0].B.forEach((i,k) => { POSTO[i] = {x:COLS[k], z:-0.62, giro:Math.PI}; fazPosto(COLS[k], -0.62, Math.PI); });
    MESAS[1].A.forEach((i,k) => { POSTO[i] = {x:COLS[k], z:3.18,  giro:0};       fazPosto(COLS[k], 3.18, 0); });

    /* caixa de papelão e planta */
    armarioJuridico(6.0, 1.15);
    const vaso = new THREE.Mesh(new THREE.CylinderGeometry(.18, .13, .3, 12), mat("#B08256", .9));
    vaso.position.set(-5.2, .15, 2.9); vaso.castShadow = true; scene.add(vaso);
    const folha = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 12), mat("#5E8452", .95));
    folha.position.set(-5.2, .56, 2.9); folha.castShadow = true; scene.add(folha);

    /* gente */
    PESSOAS.forEach((_, i) => fazPessoa(i));
    PESSOAS.forEach((p, i) => { if(p.acumulador) bagunca(i); });
    PESSOAS.forEach((p, i) => { if(p.retrato) portaRetrato(i, p.retrato); });
    sumiram.forEach(i => { if(RIG[i]) RIG[i].c.visible = false; });
    carrinho = fazCarrinho(); carrinho.position.set(4.95, 0, 1.55); scene.add(carrinho);

    /* anel de seleção + etiqueta */
    anel = new THREE.Mesh(new THREE.TorusGeometry(.52, .035, 8, 40),
      new THREE.MeshBasicMaterial({color:new THREE.Color(destaque())}));
    anel.rotation.x = -Math.PI / 2; anel.position.y = .02; scene.add(anel);
    etiqueta = new THREE.Sprite(new THREE.SpriteMaterial({transparent:true}));
    etiqueta.scale.set(.98, .27, 1); scene.add(etiqueta);

    /* luzes */
    luzes.hemi = new THREE.HemisphereLight(escuro ? 0x35404C : 0xF2F0EA, escuro ? 0x0C0E10 : 0xA8A59D, P.hemi);
    scene.add(luzes.hemi);
    luzes.amb = new THREE.AmbientLight(0xFFFFFF, P.amb); scene.add(luzes.amb);
    luzes.dir = new THREE.DirectionalLight(0xFFFFFF, P.dir);
    luzes.dir.position.set(-5, 8, 4); luzes.dir.castShadow = true;
    luzes.dir.shadow.mapSize.set(1536, 1536);
    luzes.dir.shadow.bias = -0.0006; luzes.dir.shadow.normalBias = 0.03;
    const c = luzes.dir.shadow.camera; c.left = -7.5; c.right = 7.5; c.top = 6; c.bottom = -6; c.near = 1; c.far = 20; c.updateProjectionMatrix();
    scene.add(luzes.dir);

    montarDisco();
    marcarSelecao();
  }

  function etiquetaTextura(txt){
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 140;
    const x = cv.getContext("2d");
    x.fillStyle = escuro ? "rgba(30,33,36,.94)" : "rgba(251,250,247,.96)";
    x.strokeStyle = destaque(); x.lineWidth = 6;
    const r = 26; x.beginPath();
    x.moveTo(r + 3, 3); x.arcTo(509, 3, 509, 137, r); x.arcTo(509, 137, 3, 137, r);
    x.arcTo(3, 137, 3, 3, r); x.arcTo(3, 3, 509, 3, r); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = escuro ? "#E8E7E2" : "#21241E";
    x.font = "600 58px Archivo, system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(txt, 256, 74, 460);
    const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
  }
  function marcarSelecao(){
    const L = LUGAR[atual];
    anel.position.set(L.x, .02, L.z);
    etiqueta.position.set(L.x, 2.16, L.z);
    if(etiqueta.material.map) etiqueta.material.map.dispose();
    etiqueta.material.map = etiquetaTextura(PESSOAS[atual].nome);
    etiqueta.material.needsUpdate = true;
  }

  /* ---- câmera ---- */
  function posCamera(){
    const s = new THREE.Vector3(
      orb.raio * Math.sin(orb.phi) * Math.cos(orb.theta),
      orb.raio * Math.cos(orb.phi),
      orb.raio * Math.sin(orb.phi) * Math.sin(orb.theta));
    camera.position.copy(orb.alvo).add(s);
    camera.lookAt(orb.alvo);
  }
  function voarPara(estado, ms){
    const de = {alvo:orb.alvo.clone(), theta:orb.theta, phi:orb.phi, raio:orb.raio};
    let dTheta = ((estado.theta - de.theta + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const t0 = performance.now();
    if(reduzMovimento.matches) ms = 1;
    anim = t => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      orb.alvo.lerpVectors(de.alvo, estado.alvo, e);
      orb.theta = de.theta + dTheta * e;
      orb.phi = de.phi + (estado.phi - de.phi) * e;
      orb.raio = de.raio + (estado.raio - de.raio) * e;
      if(k >= 1) anim = null;
    };
  }
  function olharPara(i){
    const L = LUGAR[i];
    /* fica na frente do rosto: o giro 0 olha para +z, então a câmera vai para +z */
    const dir = L.giro === 0 ? 1 : -1;
    voarPara({alvo:new THREE.Vector3(L.x, 1.22, L.z), theta:dir > 0 ? Math.PI / 2 : -Math.PI / 2,
              phi:1.06, raio:4.4}, 900);
  }
  const VISTA_GERAL = () => ({alvo:new THREE.Vector3(0, .9, .3), theta:Math.PI * .60, phi:.98, raio:10});
  const VISTA_TOPO  = () => ({alvo:new THREE.Vector3(0, 0, .3), theta:Math.PI * .5, phi:.2, raio:11.5});

  /* ---- arranque ---- */
  function recado(txt){
    const d = document.createElement("div");
    d.className = "semwebgl"; d.textContent = txt;
    palco.appendChild(d);
    palco.querySelector(".cams").hidden = true;
    palco.querySelector(".hud").hidden = true;
  }
  function iniciar3D(){
    try{
      renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
    }catch(e){
      recado("Este navegador não está com WebGL disponível, então a sala 3D não abre aqui.");
      return false;
    }
    prepararVetores();
    orb = {alvo:new THREE.Vector3(0, .9, .3), theta:Math.PI * .60, phi:.98, raio:10};
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    palco.insertBefore(renderer.domElement, palco.firstChild);
    camera = new THREE.PerspectiveCamera(42, 16 / 9, .1, 100);
    raycaster = new THREE.Raycaster();
    escuro = detectarTema();
    montar();
    renderer.toneMappingExposure = P.expo;
    redimensionar();
    laco();
    return true;
  }
  function redimensionar(){
    if(!renderer) return;
    const w = palco.clientWidth, h = palco.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function laco(){
    requestAnimationFrame(laco);
    if(anim) anim(performance.now());
    const agora = performance.now() / 1000;
    if(cafe) atualizarCafe(agora);
    if(lanche) atualizarLanche(agora);
    atualizarFuga(agora);
    atualizarDisco(agora);
    posCamera();
    if(tetoGrupo) tetoGrupo.visible = camera.position.y < 2.95;
    paredes.forEach(w => {
      const c = camera.position[w.eixo];
      w.m.visible = !(w.sinal > 0 ? c > w.lim - .3 : c < w.lim + .3);
    });
    renderer.render(scene, camera);
  }

  /* ---- interação ---- */
  let arrastando = false, px = 0, py = 0, andou = 0;
  palco.addEventListener("pointerdown", e => {
    if(e.target.closest(".cams")) return;
    arrastando = true; andou = 0; px = e.clientX; py = e.clientY;
    palco.classList.add("arrastando"); palco.setPointerCapture(e.pointerId);
    $("#hud").style.opacity = "0";
  });
  palco.addEventListener("pointermove", e => {
    if(!arrastando || !orb) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    andou += Math.abs(dx) + Math.abs(dy);
    orb.theta -= dx * .006;
    orb.phi = Math.max(.12, Math.min(1.5, orb.phi - dy * .005));
    px = e.clientX; py = e.clientY; anim = null;
  });
  function soltar(e){
    if(!arrastando) return;
    arrastando = false; palco.classList.remove("arrastando");
    if(andou < 6 && renderer){
      const r = renderer.domElement.getBoundingClientRect();
      const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1,
                                 -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(v, camera);
      const hit = raycaster.intersectObjects(alvos, false)[0];
      if(hit && hit.object.userData.armario) abrirArmario();
      else if(hit && hit.object.userData.i !== undefined){
        const i = hit.object.userData.i;
        selecionar(i);
        if(PESSOAS[i].sanduiche) comerSanduiche(i);
      }
    }
  }
  palco.addEventListener("pointerup", soltar);
  palco.addEventListener("pointercancel", soltar);
  palco.addEventListener("wheel", e => {
    if(!orb) return;
    e.preventDefault(); anim = null;
    orb.raio = Math.max(2.2, Math.min(16, orb.raio * (1 + Math.sign(e.deltaY) * .12)));
  }, {passive:false});
  $("#pedir-cafe").addEventListener("click", pedirCafe);
  $("#discoteca").addEventListener("click", alternarDisco);
  $("#cam-orbita").addEventListener("click", () => { if(orb) voarPara(VISTA_GERAL(), 700); });
  $("#cam-topo").addEventListener("click", () => { if(orb) voarPara(VISTA_TOPO(), 700); });
  window.addEventListener("resize", redimensionar);
  /* acompanha o alternador de tema do site */
  new MutationObserver(() => {
    if(!renderer || detectarTema() === escuro) return;
    escuro = detectarTema(); montar(); renderer.toneMappingExposure = P.expo;
  }).observe(document.documentElement, {attributes:true, attributeFilter:["data-tema"]});

  /* ================= navegação ================= */
  function selecionar(i, semVoo){
    atual = i;
    if(renderer){ marcarSelecao(); if(!semVoo) olharPara(i); }
    $("#ant-nome").textContent = PESSOAS[(i - 1 + N) % N].nome;
    $("#prox-nome").textContent = PESSOAS[(i + 1) % N].nome;
    const h = "#mesa-" + String(i + 1).padStart(2, "0");
    if(history.replaceState) history.replaceState(null, "", h); else location.hash = h;
  }
  function pular(passo){ selecionar((atual + passo + N) % N); }

  $("#ant").addEventListener("click", () => pular(-1));
  $("#prox").addEventListener("click", () => pular(1));
  document.addEventListener("keydown", e => {
    if(e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target; if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if(e.key === "ArrowRight"){ e.preventDefault(); pular(1); }
    if(e.key === "ArrowLeft"){ e.preventDefault(); pular(-1); }
  });
  window.addEventListener("hashchange", () => {
    const m = /^#mesa-(\d{1,2})$/.exec(location.hash);
    if(m){ const i = +m[1] - 1; if(PESSOAS[i] && i !== atual) selecionar(i); }
  });

  const ini = /^#mesa-(\d{1,2})$/.exec(location.hash);
  const ok3d = iniciar3D();
  selecionar(ini && PESSOAS[+ini[1] - 1] ? +ini[1] - 1 : 12, true);
  if(ok3d) setTimeout(() => olharPara(atual), 500);
}
