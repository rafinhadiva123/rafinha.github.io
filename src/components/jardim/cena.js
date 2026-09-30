// Jardim 3D da home: fim de tarde, lago com patos e borboletas com etiqueta
// que levam aos experimentos. Usa three.js r128 (fixado no package.json).
// `experimentos` vem da coleção, já em ordem de publicação:
// [{ id, titulo, resumo, href, rascunho }].
import * as THREE from 'three'

// Posição do voo [cx, cz, rx, rz, altura, velocidade] e espécie de cada experimento.
const VOO = {
  'simulador-de-farofa': { pos: [-2.6, 1.6, 2.4, 1.7, 1.2, .3], kind: 'monarch', tag: 'Farofa' },
  'simulador-de-escritorio': { pos: [-.4, -2.6, 2.6, 1.5, 1.7, .28], kind: 'morpho', tag: 'Escritório' },
  'atelie-de-notas': { pos: [3.3, .3, 2.2, 1.8, 1.1, .32], kind: 'lilac', tag: 'Perfumista' }
};
const ESPECIES = ['swallow', 'painted', 'monarch', 'morpho', 'lilac'];

export function iniciar(experimentos) {
  var boot = document.getElementById('boot');
  if (!document.createElement('canvas').getContext('webgl')) { boot.textContent = 'Este navegador não conseguiu abrir o 3D.'; return; }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lite = /lite/.test(location.hash) || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  /* ---------- utilidades ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var rand = rng(7301);
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function mat(hex, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: .9, metalness: 0 }, o || {})); }
  function srgb(t) { t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
  function pick(a) { return a[Math.floor(rand() * a.length)]; }
  function hash2(ix, iz) { var n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453; return n - Math.floor(n); }
  function vnoise(x, z) {
    var ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), u), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), u), v);
  }
  function fbm(x, z) { return vnoise(x, z) * .55 + vnoise(x * 2.1 + 5, z * 2.1 + 3) * .28 + vnoise(x * 4.3 + 11, z * 4.3 + 7) * .17; }

  /* ---------- renderer ---------- */
  var stage = document.getElementById('stage');
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(48, 1, .1, 400);

  /* ---------- céu (golden hour) ---------- */
  var SUN = new THREE.Vector3(-.42, .26, -.87).normalize();
  var HAZE = col(0xf0d6a4);
  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { sun: { value: SUN.clone() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'varying vec3 vD; uniform vec3 sun;',
      'void main(){',
      '  vec3 d = normalize(vD); float h = clamp(d.y, -0.2, 1.0);',
      '  vec3 zen = vec3(0.10, 0.26, 0.55); vec3 mid = vec3(0.55, 0.62, 0.72); vec3 hor = vec3(0.98, 0.72, 0.42);',
      '  vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h)); c = mix(c, zen, smoothstep(0.18, 0.85, h));',
      '  float s = max(dot(d, normalize(sun)), 0.0);',
      '  c += vec3(1.0, 0.62, 0.28) * pow(s, 6.0) * 0.55 + vec3(1.0, 0.85, 0.55) * pow(s, 48.0) * 0.9;',
      '  c += vec3(1.0, 0.95, 0.8) * smoothstep(0.9993, 0.9999, s) * 6.0;',
      '  c = mix(c, vec3(0.32, 0.30, 0.20), smoothstep(0.0, -0.18, d.y));',
      '  gl_FragColor = vec4(c, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <encodings_fragment>',
      '}'
    ].join('\n')
  });
  var skyMesh = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), skyMat); skyMesh.renderOrder = -10;
  var skyScene = new THREE.Scene(); skyScene.add(skyMesh.clone());
  scene.add(skyMesh);
  // luz ambiente a partir do céu (reflexos e iluminação difusa realistas)
  (function () {
    var pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(skyScene, .04);
    scene.environment = env.texture; pm.dispose();
  })();
  scene.fog = new THREE.FogExp2(HAZE.getHex(), .019);

  var sun = new THREE.DirectionalLight(col(0xffd39a), 3.1);
  sun.position.copy(SUN).multiplyScalar(40);
  sun.castShadow = true; sun.shadow.mapSize.set(lite ? 2048 : 4096, lite ? 2048 : 4096);
  var sc = sun.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 5; sc.far = 90;
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .05; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(col(0xa9c4e6), col(0x4d5a2a), .55));

  // brilho do sol
  function glowTex(inner, outer) {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  var sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,225,170,.9)', 'rgba(255,190,110,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sunGlow.scale.set(90, 90, 1); sunGlow.position.copy(SUN).multiplyScalar(170); scene.add(sunGlow);

  /* ---------- geometria do mundo ---------- */
  var POND = { x: 3.4, z: .2, r: 2.3 };
  var PONDY = -.12;
  function terrainH(x, z) {
    var r = Math.hypot(x, z), h = (fbm(x * .07, z * .07) - .5) * 1.1 * smooth(3, 14, r) + (fbm(x * .3 + 9, z * .3) - .5) * .12;
    h += smooth(16, 50, r) * (1.0 + fbm(x * .05 + 3, z * .05) * 3.5);
    var d = Math.hypot(x - POND.x, z - POND.z);
    h -= (1 - smooth(POND.r - .6, POND.r + 1.6, d)) * .65;
    return h;
  }
  var STONES = [[-2.6, 7.4], [-1.9, 5.7], [-1.0, 4.2], [-.2, 2.9], [.35, 1.5], [.5, .1], [.15, -1.3], [-.55, -2.6], [-1.4, -3.9], [-2.2, -5.2]];

  /* --- textura do solo --- */
  function noiseCanvas(size, base, blobs, strokes) {
    var c = document.createElement('canvas'); c.width = c.height = size; var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    var r2 = rng(99);
    for (var i = 0; i < blobs.n; i++) {
      var x = r2() * size, y = r2() * size, rad = blobs.r0 + r2() * blobs.r1;
      var gr = g.createRadialGradient(x, y, 0, x, y, rad); var cc = blobs.cols[Math.floor(r2() * blobs.cols.length)];
      gr.addColorStop(0, cc + 'aa'); gr.addColorStop(1, cc + '00'); g.fillStyle = gr;
      [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]].forEach(function (o) { g.save(); g.translate(o[0], o[1]); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); });
    }
    if (strokes) for (var j = 0; j < strokes.n; j++) {
      var x0 = r2() * size, y0 = r2() * size; g.strokeStyle = strokes.cols[Math.floor(r2() * strokes.cols.length)]; g.lineWidth = strokes.w;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (r2() - .5) * strokes.l * .4, y0 - r2() * strokes.l); g.stroke();
    }
    return c;
  }
  var groundTex = srgb(new THREE.CanvasTexture(noiseCanvas(512, '#3f5f24', { n: 260, r0: 10, r1: 44, cols: ['#54782c', '#2f4c1c', '#6a8a34', '#4a3f22', '#7a8f3c'] }, { n: 2600, l: 22, w: 1.4, cols: ['#2c4818aa', '#7ea03aaa', '#5a7a2aaa'] })));
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(70, 70);

  var ground = (function () {
    var S = 220, seg = lite ? 130 : 200, g = new THREE.PlaneGeometry(S, S, seg, seg); g.rotateX(-Math.PI / 2);
    var p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), z = p.getZ(i), y = terrainH(x, z); p.setY(i, y);
      var patch = fbm(x * .18 + 20, z * .18 + 7), dry = smooth(.6, .85, patch) * (1 - smooth(9, 16, Math.hypot(x, z))), lush = 1 - dry;
      c.copy(col(0x3f6424)).lerp(col(0x8f9448), dry * .6).lerp(col(0x2f5a22), lush * .3 * smooth(.3, .5, patch));
      c.lerp(col(0x1f4a1a), smooth(12, 30, Math.hypot(x, z)) * .92); var dd = Math.hypot(x - POND.x, z - POND.z); if (dd < POND.r + 1.3) c.lerp(col(0x3b3520), 1 - smooth(POND.r - .3, POND.r + 1.3, dd));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: .5 }));
    m.receiveShadow = true; scene.add(m); return m;
  })();

  /* ---------- árvores (copas: cartões de folhas) ---------- */
  var TREES = [
    { x: -12.5, z: -5.5, h: 6.8, cx: 0, cy: 7.0, cz: 0, rx: 4.2, ry: 3.0, rz: 4.2, kind: 'oak' },
    { x: 9.2, z: -6.5, h: 4.6, cx: .2, cy: 5.1, cz: 0, rx: 3, ry: 2.1, rz: 3, kind: 'cherry' },
    { x: -21, z: -17, h: 7.5, cx: 0, cy: 8.2, cz: 0, rx: 4.6, ry: 3.4, rz: 4.6, kind: 'oak' },
    { x: 15.5, z: -12, h: 6.8, cx: 0, cy: 7.4, cz: 0, rx: 4, ry: 3, rz: 4, kind: 'oak' },
    { x: 4, z: -25, h: 7, cx: 0, cy: 7.8, cz: 0, rx: 4.4, ry: 3.2, rz: 4.4, kind: 'oak' }
  ];
  TREES.forEach(function (t) { t.gy = terrainH(t.x, t.z); });

  function leafTexture(kind) {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), r2 = rng(kind === 'cherry' ? 5 : 3);
    var greens = kind === 'cherry' ? ['#f4b6c8', '#f7c9d6', '#ee9fb8', '#fbdde6', '#8fb35a'] : ['#2f5a1c', '#3f7326', '#4f8a2c', '#639a34', '#2a4d18', '#78a83c'];
    for (var i = 0; i < 130; i++) {
      var x = 20 + r2() * 216, y = 20 + r2() * 216; if (Math.hypot(x - 128, y - 128) > 118) continue;
      var a = r2() * 6.28, L = kind === 'cherry' ? 9 + r2() * 9 : 15 + r2() * 14, W = L * (kind === 'cherry' ? .8 : .42);
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = greens[Math.floor(r2() * greens.length)]; g.beginPath(); g.ellipse(0, 0, L, W, 0, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-L, 0); g.lineTo(L, 0); g.stroke();
      g.restore();
    }
    var t = srgb(new THREE.CanvasTexture(c)); return t;
  }
  var barkTex = (function () {
    var t = srgb(new THREE.CanvasTexture(noiseCanvas(256, '#4a3a2b', { n: 90, r0: 6, r1: 22, cols: ['#2c2118', '#6a5440', '#3a2c20'] }, { n: 900, l: 90, w: 2, cols: ['#1e1610aa', '#7a6450aa'] })));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); return t;
  })();
  var leafTex = { oak: leafTexture('oak'), cherry: leafTexture('cherry') };

  TREES.forEach(function (t, ti) {
    var g = new THREE.Group(); g.position.set(t.x, t.gy, t.z);
    // tronco
    var tg = new THREE.CylinderGeometry(.22 + t.h * .012, .5 + t.h * .04, t.h, 18, 14, true), p = tg.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var y = p.getY(i) + t.h / 2, x = p.getX(i), z = p.getZ(i), n = 1 + (vnoise(y * 3 + ti, Math.atan2(z, x) * 3) - .5) * .18 + Math.max(0, 1 - y / 1.1) * .35;
      p.setXYZ(i, x * n + Math.sin(y * .5 + ti) * .18, y, z * n);
    }
    tg.computeVertexNormals();
    var trunk = new THREE.Mesh(tg, mat(0xffffff, { map: barkTex, roughness: 1, side: THREE.DoubleSide })); trunk.castShadow = trunk.receiveShadow = true; g.add(trunk);
    // galhos
    for (var b = 0; b < 5; b++) {
      var len = t.rx * (.7 + rand() * .4), br = new THREE.Mesh(new THREE.CylinderGeometry(.05, .13, len, 8), trunk.material);
      br.geometry.translate(0, len / 2, 0);
      var a = b / 5 * 6.283 + rand(); br.position.set(Math.sin(ti + 0) * .18, t.h * (.7 + rand() * .25), 0);
      br.rotation.set(Math.cos(a) * .9, 0, -Math.sin(a) * .9); br.castShadow = true; g.add(br);
    }
    // copa
    var N = (lite ? .55 : 1) * (t.kind === 'cherry' ? 260 : 380) * (t.rx / 3.5), im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ map: leafTex[t.kind], alphaTest: .5, side: THREE.DoubleSide, roughness: .85, envMapIntensity: .4, color: 0xffffff }), Math.round(N));
    var d = new THREE.Object3D(), cc = new THREE.Color(), k = 0;
    while (k < im.count) {
      var u = rand() * 2 - 1, v = rand() * 2 - 1, w = rand() * 2 - 1; if (u * u + v * v + w * w > 1) continue;
      var rr = Math.sqrt(u * u + v * v + w * w); var s = (t.kind === 'cherry' ? .9 : 1.25) + rand() * .9;
      d.position.set(t.cx + u * t.rx, t.cy + v * t.ry, t.cz + w * t.rz); d.scale.setScalar(s);
      d.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28); d.updateMatrix(); im.setMatrixAt(k, d.matrix);
      var lightK = clamp(.7 + v * .25 + rr * .25 + rand() * .15, 0, 1.15); cc.setRGB(lightK, lightK, lightK * (.9 + rand() * .1)); im.setColorAt(k, cc); k++;
    }
    im.castShadow = true; im.receiveShadow = false; g.add(im); scene.add(g);
  });

  /* ---------- sombra analítica das copas nas lâminas de grama ---------- */
  function shadeAt(x, y, z) {
    var s = 1;
    for (var i = 0; i < TREES.length; i++) {
      var t = TREES[i], px = (x - t.x - t.cx) / t.rx, py = (y - t.gy - t.cy) / t.ry, pz = (z - t.z - t.cz) / t.rz;
      var dx = SUN.x / t.rx, dy = SUN.y / t.ry, dz = SUN.z / t.rz;
      var a = dx * dx + dy * dy + dz * dz, b = px * dx + py * dy + pz * dz, c = px * px + py * py + pz * pz - 1, disc = b * b - a * c;
      if (disc > 0 && -b + Math.sqrt(disc) > 0) s = Math.min(s, 1 - .68 * smooth(0, .5, disc / a));
    }
    return s;
  }

  /* ---------- grama ---------- */
  var grassUniforms = { time: { value: 0 }, sun: { value: SUN.clone() }, fogColor: { value: HAZE.clone() }, fogDensity: { value: .019 } };
  var grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: grassUniforms,
    vertexShader: [
      'attribute vec3 iPos; attribute vec4 iP; attribute vec4 iC;',  // iP: rot, height, width, bend ; iC: hue, dry, shade, seed
      'uniform float time; varying vec3 vCol; varying float vH; varying float vFog; varying float vBack; varying float vTip;',
      'uniform vec3 sun;',
      'void main(){',
      '  float y = position.y, h = iP.y;',
      '  float cr = cos(iP.x), sr = sin(iP.x);',
      '  float taper = pow(1.0 - y, 0.75); float x = position.x * iP.z * taper;',
      '  float bend = iP.w * y * y;',
      '  vec3 lp = vec3(x, y * h, bend * h);',
      '  vec3 wp = vec3(lp.x * cr + lp.z * sr, lp.y, -lp.x * sr + lp.z * cr) + iPos;',
      '  float w1 = sin(time * 1.6 + iPos.x * .45 + iPos.z * .3) * .5 + sin(time * 2.9 + iPos.x * 1.3 + iPos.z * .8) * .25;',
      '  float gust = sin(time * .55 + iPos.x * .12 - iPos.z * .1) * .5 + .5;',
      '  float amp = (.05 + .09 * gust) * y * y * h;',
      '  wp.x += w1 * amp * 1.0; wp.z += w1 * amp * .55;',
      '  vec3 base = mix(vec3(.04,.10,.025), vec3(.12,.28,.05), iC.x);',
      '  vec3 tip  = mix(vec3(.16,.38,.07), vec3(.36,.55,.12), iC.x);',
      '  tip = mix(tip, vec3(.55,.48,.20), iC.y * .7);',
      '  vec3 c = mix(base, tip, smoothstep(0., 1., y));',
      '  c *= mix(.35, 1., iC.z);',
      '  vec4 mv = modelViewMatrix * vec4(wp, 1.);',
      '  vec3 vd = normalize(-mv.xyz); vec3 sd = normalize((viewMatrix * vec4(sun, 0.)).xyz);',
      '  vBack = pow(clamp(dot(vd, -sd), 0., 1.), 2.5) * y * iC.z;',
      '  vCol = c * (.62 + .5 * clamp(dot(normalize(vec3(sr * .3, 1., cr * .3)), sun), 0., 1.));',
      '  vTip = y; float d = length(mv.xyz); vFog = 1. - exp(-d * d * fogDensity_ * fogDensity_);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n').replace('uniform vec3 sun;', 'uniform vec3 sun; uniform float fogDensity;').replace(/fogDensity_/g, 'fogDensity'),
    fragmentShader: [
      'uniform vec3 fogColor; varying vec3 vCol; varying float vFog; varying float vBack; varying float vTip;',
      'void main(){',
      '  vec3 c = vCol + vec3(.55, .5, .12) * vBack * .8;',
      '  c = mix(c, fogColor, vFog);',
      '  gl_FragColor = vec4(c, 1.);',
      '  #include <tonemapping_fragment>',
      '  #include <encodings_fragment>',
      '}'
    ].join('\n')
  });
  function buildGrass(N, R0, R, hMul, wMul, seed) {
    var seg = 4, pos = [], idx = [];
    for (var i = 0; i <= seg; i++) { var y = i / seg; pos.push(-.5, y, 0, .5, y, 0); }
    for (var j = 0; j < seg; j++) { var a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    var bg = new THREE.InstancedBufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx);
        var iPos = new Float32Array(N * 3), iP = new Float32Array(N * 4), iC = new Float32Array(N * 4), k = 0, tries = 0;
    while (k < N && tries++ < N * 3) {
      var a = rand() * 6.283, r = R0 + Math.pow(rand(), R0 ? 1 : .62) * (R - R0), x = Math.cos(a) * r, z = Math.sin(a) * r;
      var dp = Math.hypot(x - POND.x, z - POND.z); if (dp < POND.r + .15) continue;
      var skip = false; for (var s = 0; s < STONES.length; s++) if (Math.hypot(x - STONES[s][0], z - STONES[s][1]) < .5) { skip = true; break; } if (skip) continue;
      var y = terrainH(x, z), patch = fbm(x * .18 + 20, z * .18 + 7);
      iPos[k * 3] = x; iPos[k * 3 + 1] = y - .02; iPos[k * 3 + 2] = z;
      var hgt = (.13 + rand() * .2) * hMul * (1 + .7 * smooth(.6, .85, patch));
      iP[k * 4] = rand() * 6.283; iP[k * 4 + 1] = hgt; iP[k * 4 + 2] = (.03 + rand() * .022) * wMul; iP[k * 4 + 3] = .25 + rand() * .55;
      iC[k * 4] = clamp(rand() * .7 + (patch < .45 ? .3 : 0), 0, 1); iC[k * 4 + 1] = smooth(.55, .8, patch) * (.6 + rand() * .4); iC[k * 4 + 2] = shadeAt(x, y + .2, z); iC[k * 4 + 3] = rand(); if (R0 > 0) { iC[k * 4] = .55 + rand() * .45; iC[k * 4 + 1] *= .12; }
      k++;
    }
    bg.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3)); bg.setAttribute('iP', new THREE.InstancedBufferAttribute(iP, 4)); bg.setAttribute('iC', new THREE.InstancedBufferAttribute(iC, 4));
    bg.instanceCount = k;
    var m = new THREE.Mesh(bg, grassMat); m.frustumCulled = false; scene.add(m);
  }
  buildGrass(lite ? 24000 : 70000, 0, lite ? 14 : 17, 1, 1);
  buildGrass(lite ? 16000 : 45000, lite ? 14 : 17, 36, 2.1, 2.4);


  /* ---------- flores ---------- */
  function flowerTex(type) {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'); g.translate(64, 64);
    var P = {
      daisy:  { n: 16, len: 56, w: 5.5, col: ['#ffffff', '#f2f2ec'], center: '#f2b81c', cr: 12 },
      cosmos: { n: 8,  len: 58, w: 17,  col: ['#f06aa5', '#ff8fbf'], center: '#f2c21c', cr: 7 },
      poppy:  { n: 4,  len: 52, w: 34,  col: ['#e2381f', '#f0522e'], center: '#241612', cr: 11 },
      yellow: { n: 7,  len: 40, w: 15,  col: ['#ffd21a', '#ffe259'], center: '#d98a10', cr: 7 },
      aster:  { n: 21, len: 52, w: 4.5, col: ['#9a6bd6', '#b98cf0'], center: '#f2c21c', cr: 8 }
    }[type];
    for (var ring = 0; ring < 2; ring++) for (var i = 0; i < P.n; i++) {
      var a = i / P.n * 6.283 + ring * .2; g.save(); g.rotate(a);
      var gr = g.createLinearGradient(0, 0, P.len * (1 - ring * .18), 0); gr.addColorStop(0, P.col[1]); gr.addColorStop(1, P.col[0]);
      g.fillStyle = gr; g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(P.len * .5, -P.w, P.len * (1 - ring * .18), 0); g.quadraticCurveTo(P.len * .5, P.w, 4, 0); g.fill(); g.stroke(); g.restore();
    }
    var cg = g.createRadialGradient(0, 0, 0, 0, 0, P.cr); cg.addColorStop(0, P.center); cg.addColorStop(1, 'rgba(60,40,0,.9)');
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, P.cr, 0, 6.283); g.fill();
    return srgb(new THREE.CanvasTexture(c));
  }
  var FLOWER_TYPES = { daisy: { n: 640, size: .11 }, cosmos: { n: 420, size: .17 }, poppy: { n: 300, size: .15 }, yellow: { n: 420, size: .1 }, aster: { n: 360, size: .12 } };
  var DRIFTS = [[-3.4, 1.8, 2.3, 'cosmos'], [-.6, 3.6, 2.4, 'daisy'], [-1.7, -2.2, 2, 'poppy'], [2, -3.4, 2, 'yellow'], [-6.4, 2.4, 2.3, 'aster'], [6.4, 3.4, 2.2, 'daisy'], [3.4, 4.8, 1.8, 'cosmos'], [-3.2, -1.2, 1.6, 'yellow'], [.2, -4.6, 1.8, 'aster'], [7.2, -1.2, 1.6, 'poppy']];
  (function () {
    var stemGeo = new THREE.CylinderGeometry(.006, .009, 1, 5); stemGeo.translate(0, .5, 0);
    var stemAll = 0; for (var ft in FLOWER_TYPES) stemAll += Math.round(FLOWER_TYPES[ft].n * (lite ? .5 : 1));
    var stems = new THREE.InstancedMesh(stemGeo, mat(0x3a5f22, { roughness: .9 }), stemAll), d = new THREE.Object3D(), sk = 0;
    Object.keys(FLOWER_TYPES).forEach(function (type) {
      var F = FLOWER_TYPES[type], N = Math.round(F.n * (lite ? .5 : 1));
      var pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
      var im = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ map: flowerTex(type), alphaTest: .45, side: THREE.DoubleSide, roughness: .7, envMapIntensity: .7, emissive: 0x000000 }), N);
      im.material.emissiveMap = im.material.map; im.material.emissive = new THREE.Color(.18, .18, .18);
      var cc = new THREE.Color(), n = 0, tries = 0, dr = DRIFTS.filter(function (x) { return x[3] === type; }), all = DRIFTS;
      while (n < N && tries++ < N * 40) {
        var dd = pick(dr.length && rand() < .8 ? dr : all), a = rand() * 6.283, r = Math.pow(rand(), .8) * dd[2], x = dd[0] + Math.cos(a) * r, z = dd[1] + Math.sin(a) * r;
        if (Math.hypot(x - POND.x, z - POND.z) < POND.r + .4) continue;
        var bad = false; for (var s = 0; s < STONES.length; s++) if (Math.hypot(x - STONES[s][0], z - STONES[s][1]) < .55) { bad = true; break; } if (bad) continue;
        var y = terrainH(x, z), h = .32 + rand() * .5 + (type === 'poppy' || type === 'aster' ? .12 : 0), sz = F.size * (.8 + rand() * .5);
        d.position.set(x, y + h, z); d.scale.set(sz * 2, 1, sz * 2); d.rotation.set((rand() - .5) * .9, rand() * 6.283, (rand() - .5) * .9); d.updateMatrix(); im.setMatrixAt(n, d.matrix);
        var tint = .8 + rand() * .3; cc.setRGB(tint, tint, tint); im.setColorAt(n, cc); n++;
        if (sk < stems.count) { var st = new THREE.Object3D(); st.position.set(x, y - .02, z); st.scale.set(1, h + .02, 1); st.rotation.set((rand() - .5) * .08, 0, (rand() - .5) * .08); st.updateMatrix(); stems.setMatrixAt(sk++, st.matrix); }
      }
      im.count = n; im.castShadow = false; scene.add(im);
    });
    stems.count = sk; scene.add(stems);
    // lavanda
    var lg = new THREE.ConeGeometry(.022, .34, 6); lg.translate(0, .17, 0);
    var LN = lite ? 260 : 620, lav = new THREE.InstancedMesh(lg, mat(0x8a63c8, { roughness: .8 }), LN), lc = new THREE.Color(), ln = 0;
    while (ln < LN) {
      var cx = pick([[-4.8, -3.2], [-2.4, -4.4], [3.6, -4.2], [6.4, 1.8]]), a2 = rand() * 6.28, r2 = Math.pow(rand(), .7) * 1.4, x2 = cx[0] + Math.cos(a2) * r2, z2 = cx[1] + Math.sin(a2) * r2;
      if (Math.hypot(x2 - POND.x, z2 - POND.z) < POND.r + .4) continue;
      var y2 = terrainH(x2, z2), hh = .4 + rand() * .35; d.position.set(x2, y2 + hh - .3, z2); d.scale.set(1, .8 + rand() * .7, 1); d.rotation.set((rand() - .5) * .3, 0, (rand() - .5) * .3); d.updateMatrix(); lav.setMatrixAt(ln, d.matrix);
      lc.copy(col(0x8a63c8)).lerp(col(0xb894f0), rand()); lav.setColorAt(ln, lc); ln++;
    }
    lav.castShadow = false; scene.add(lav);
  })();

  /* ---------- pedras do caminho ---------- */
  var stoneTex = srgb(new THREE.CanvasTexture(noiseCanvas(256, '#8b867a', { n: 120, r0: 8, r1: 30, cols: ['#a39e90', '#6f6b60', '#b0aa9a', '#7a7466'] }, { n: 500, l: 20, w: 1, cols: ['#4a463caa'] })));
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  var stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: .92, bumpMap: stoneTex, bumpScale: .5, envMapIntensity: .5, flatShading: false });
  STONES.forEach(function (s, i) {
    var g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position;
    for (var v = 0; v < p.count; v++) { var n = 1 + (vnoise(p.getX(v) * 2 + i, p.getZ(v) * 2) - .5) * .35; p.setXYZ(v, p.getX(v) * n, p.getY(v) * n, p.getZ(v) * n); }
    g.computeVertexNormals(); var m = new THREE.Mesh(g, stoneMat); var sz = .38 + rand() * .16;
    m.scale.set(sz * 1.3, .1, sz); m.position.set(s[0], terrainH(s[0], s[1]) + .03, s[1]); m.rotation.y = rand() * 3; m.castShadow = m.receiveShadow = true; scene.add(m);
  });

  /* ---------- lago ---------- */
  var waterNormal = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), img = g.createImageData(256, 256);
    function hgt(x, y) { return Math.sin(x * .09) * Math.cos(y * .07) + Math.sin((x + y) * .13) * .6 + Math.sin(x * .21 - y * .17) * .3; }
    for (var y = 0; y < 256; y++) for (var x = 0; x < 256; x++) {
      var dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1), i = (y * 256 + x) * 4;
      img.data[i] = 128 + dx * 30; img.data[i + 1] = 128 + dy * 30; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
  })();
  var water = new THREE.Mesh(new THREE.CircleGeometry(POND.r + .5, 64), new THREE.MeshStandardMaterial({ color: col(0x2f6a66), roughness: .05, metalness: .25, normalMap: waterNormal, normalScale: new THREE.Vector2(.2, .2), envMapIntensity: 2.4 }));
  water.rotation.x = -Math.PI / 2; water.position.set(POND.x, PONDY, POND.z); water.receiveShadow = true; scene.add(water);
  // pedras da margem
  (function () {
    var g = new THREE.DodecahedronGeometry(1, 1), im = new THREE.InstancedMesh(g, stoneMat, 42), d = new THREE.Object3D();
    for (var i = 0; i < 42; i++) {
      var a = i / 42 * 6.283 + rand() * .1, r = POND.r + .35 + rand() * .35, x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r, s = .18 + rand() * .26;
      d.position.set(x, terrainH(x, z) + s * .15, z); d.scale.set(s * 1.3, s * .7, s); d.rotation.set(rand(), rand() * 6, rand() * .5); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    }
    im.castShadow = im.receiveShadow = true; scene.add(im);
  })();
  // vitórias-régias
  (function () {
    var lg = new THREE.CircleGeometry(1, 24, .35, 5.6); lg.rotateX(-Math.PI / 2);
    var lm = new THREE.MeshStandardMaterial({ color: col(0x3f7a2c), roughness: .55, side: THREE.DoubleSide, envMapIntensity: .8 }), im = new THREE.InstancedMesh(lg, lm, 14), d = new THREE.Object3D();
    for (var i = 0; i < 14; i++) {
      var a = rand() * 6.283, r = Math.sqrt(rand()) * (POND.r - .5); d.position.set(POND.x + Math.cos(a) * r, PONDY + .012, POND.z + Math.sin(a) * r); var s = .22 + rand() * .22; d.scale.set(s, 1, s); d.rotation.set(0, rand() * 6.28, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    }
    im.receiveShadow = true; scene.add(im);
    var pg = new THREE.SphereGeometry(1, 10, 6, 0, 6.283, 0, 1.4), pm = new THREE.MeshStandardMaterial({ color: col(0xf5a6c6), roughness: .5 });
    [[.6, .4], [-.9, -.3], [.1, -1.0]].forEach(function (p) { var f = new THREE.Mesh(pg, pm); f.scale.set(.1, .09, .1); f.position.set(POND.x + p[0], PONDY + .05, POND.z + p[1]); f.castShadow = true; scene.add(f); });
    // juncos
    var rg = new THREE.CylinderGeometry(.006, .014, 1, 4); rg.translate(0, .5, 0);
    var rc = new THREE.InstancedMesh(rg, mat(0x50702e), 130);
    for (var j = 0; j < 130; j++) { var a2 = rand() * 6.283, r2 = POND.r + .2 + rand() * .5, x = POND.x + Math.cos(a2) * r2, z = POND.z + Math.sin(a2) * r2, h = .7 + rand() * .9; d.position.set(x, terrainH(x, z), z); d.scale.set(1, h, 1); d.rotation.set((rand() - .5) * .25, 0, (rand() - .5) * .25); d.updateMatrix(); rc.setMatrixAt(j, d.matrix); }
    scene.add(rc);
  })();

  /* ---------- patos no lago ---------- */
  var ducks = [], rippleMat = function () { return new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }); };
  function makeDuck(kind, s) {
    var g = new THREE.Group(), M = function (h, r) { return mat(h, { roughness: r || .7, envMapIntensity: .6 }); };
    var male = kind === 'male', chick = kind === 'chick';
    var bodyC = chick ? 0xf3d54a : male ? 0xb7b3a8 : 0x8b6b45, headC = chick ? 0xf6dc5c : male ? 0x1d6d3d : 0x9a7a52, chestC = chick ? 0xf3d54a : male ? 0x6d4024 : 0x8b6b45;
    function add(geo, m, x, y, z, sx, sy, sz, rz) { var o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); if (rz) o.rotation.z = rz; o.castShadow = true; g.add(o); return o; }
    var sph = new THREE.SphereGeometry(1, 16, 12);
    if (chick) {
      add(sph, M(bodyC), 0, .06, 0, .13, .085, .09);
      add(sph, M(headC), .12, .13, 0, .06, .06, .055);
      add(sph, M(0xe58a1c), .175, .12, 0, .03, .014, .026);
      add(sph, M(0x000000), .15, .145, .035, .011, .011, .011); add(sph, M(0x000000), .15, .145, -.035, .011, .011, .011);
      g.scale.setScalar(s); return g;
    }
    add(sph, M(bodyC), 0, .11, 0, .31, .16, .2);
    add(sph, M(chestC), .17, .14, 0, .15, .14, .17);
    add(sph, M(male ? 0x8f8a7f : 0x6f5434), -.03, .16, .155, .17, .045, .085); add(sph, M(male ? 0x8f8a7f : 0x6f5434), -.03, .16, -.155, .17, .045, .085);
    if (male) { add(sph, M(0x2a4fa8, .4), -.1, .165, .19, .05, .012, .03); add(sph, M(0x2a4fa8, .4), -.1, .165, -.19, .05, .012, .03); }
    add(new THREE.CylinderGeometry(.05, .065, .17, 10), M(male ? 0x1d6d3d : 0x9a7a52), .25, .26, 0, 1, 1, 1, -.25);
    if (male) add(new THREE.CylinderGeometry(.062, .062, .02, 12), M(0xffffff), .235, .225, 0, 1, 1, 1, -.25);
    add(sph, M(headC), .295, .355, 0, .1, .088, .082);
    add(sph, M(0xe8a020, .5), .39, .335, 0, .075, .026, .05);
    add(sph, M(0x000000, .3), .33, .385, .055, .015, .015, .015); add(sph, M(0x000000, .3), .33, .385, -.055, .015, .015, .015);
    var tail = add(new THREE.ConeGeometry(.07, .17, 8), M(male ? 0x2b2b2b : 0x6a4f31), -.31, .18, 0, 1, 1, .7, 1.15);
    g.scale.setScalar(s); return g;
  }
  function addSwimmer(kind, s, o) {
    var g = makeDuck(kind, s); g.rotation.order = 'YZX'; scene.add(g);
    var d = Object.assign({ g: g, kind: kind, s: s, pos: new THREE.Vector3(), prev: new THREE.Vector3(), yaw: 0, ph: rand() * 20, rings: [] }, o || {});
    for (var i = 0; i < 2; i++) {
      var r = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 40), rippleMat()); r.rotation.x = -Math.PI / 2; r.position.y = PONDY + .02; r.userData = { off: i * .5, last: 1 }; scene.add(r); d.rings.push(r);
    }
    ducks.push(d); return d;
  }
  function duckPath(d, tt, out) {
    var a = tt * d.sp + d.ph;
    out.set(POND.x + d.rx * Math.sin(a) + .18 * Math.sin(a * 3.1 + d.ph), PONDY, POND.z + d.rz * Math.sin(a * 1.31 + d.ph2) * Math.cos(a * .5));
    return out;
  }
  var mother = addSwimmer('female', 1.15, { sp: .1, rx: 1.15, rz: 1.05, ph2: 2.1 });
  var drake = addSwimmer('male', 1.3, { sp: .085, rx: 1.3, rz: 1.1, ph2: 4.2 });
  var lone = addSwimmer('male', 1.2, { sp: .07, rx: .95, rz: .8, ph2: 1.3 });
  for (var ci = 0; ci < 4; ci++) addSwimmer('chick', 1.05, { follow: mother, delay: 1.1 + ci * .85, lat: (ci % 2 ? 1 : -1) * .04 });
  var dp1 = new THREE.Vector3(), dp2 = new THREE.Vector3();
  function updateDucks(t, dt) {
    for (var i = 0; i < ducks.length; i++) {
      var d = ducks[i], src = d.follow || d, tt = t - (d.delay || 0);
      duckPath(src, tt, dp1); duckPath(src, tt + .05, dp2);
      var vx = dp2.x - dp1.x, vz = dp2.z - dp1.z; if (d.follow) { var l = Math.hypot(vx, vz) || 1; dp1.x += -vz / l * d.lat; dp1.z += vx / l * d.lat; }
      var ty = Math.atan2(vz, vx); var dy = ty + d.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); d.yaw -= dy * Math.min(1, dt * 4);
      var bob = Math.sin(t * 1.9 + d.ph) * .008, pulse = d.kind === 'chick' ? 0 : smooth(.9, .99, Math.sin(t * .35 + d.ph * 3)), pitch = -.85 * pulse;
      d.g.position.set(dp1.x, PONDY + .012 + bob + pulse * .02, dp1.z); d.g.rotation.set(Math.sin(t * 1.3 + d.ph) * .03, -d.yaw, pitch + Math.sin(t * 1.9 + d.ph) * .02);
      for (var r = 0; r < 2; r++) {
        var ring = d.rings[r], p = (t * .32 + ring.userData.off + d.ph) % 1;
        if (p < ring.userData.last) ring.position.set(dp1.x - Math.cos(-d.yaw) * .05 * d.s, PONDY + .022, dp1.z - Math.sin(-d.yaw) * .05 * d.s);
        ring.userData.last = p; var sz = (.12 + p * .55) * d.s; ring.scale.set(sz, sz, sz); ring.material.opacity = .32 * (1 - p) * (1 - p);
      }
    }
  }
  updateDucks(0, .016);

  /* ---------- arbustos e hortênsias ---------- */
  [[-3.9, -.4, 1.1, 'blue'], [1.9, -5.6, 1.3, 'pink'], [7.4, -.6, 1.2, 'blue'], [-8.2, 3.6, 1.4, 'pink'], [-4.6, 5.8, 1, 'blue']].forEach(function (b, bi) {
    var g = new THREE.Group(), gy = terrainH(b[0], b[1]); g.position.set(b[0], gy, b[1]);
    var N = lite ? 36 : 70, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: leafTex.oak, alphaTest: .5, side: THREE.DoubleSide, roughness: .75 }), N), d = new THREE.Object3D(), cc = new THREE.Color(), k = 0;
    while (k < N) { var u = rand() * 2 - 1, v = rand(), w = rand() * 2 - 1; if (u * u + v * v + w * w > 1) continue; d.position.set(u * b[2], .1 + v * b[2] * .9, w * b[2]); d.scale.setScalar(.55 + rand() * .5); d.rotation.set(rand() * 6, rand() * 6, rand() * 6); d.updateMatrix(); im.setMatrixAt(k, d.matrix); var l = .6 + v * .4; cc.setRGB(l, l, l); im.setColorAt(k, cc); k++; }
    im.castShadow = true; g.add(im);
    var hc = b[3] === 'blue' ? [0x6a8fe0, 0x8aa8ef, 0x5a74c8, 0xa9b8f0] : [0xf08bb2, 0xf7a9c6, 0xe26f9c, 0xfbc1d6];
    var HN = lite ? 40 : 90, hm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat(0xffffff, { roughness: .7 }), HN), hcC = new THREE.Color(); k = 0;
    while (k < HN) { var u2 = rand() * 2 - 1, v2 = rand(), w2 = rand() * 2 - 1; if (u2 * u2 + v2 * v2 + w2 * w2 > 1) continue; d.position.set(u2 * b[2] * .95, .35 + v2 * b[2] * .95, w2 * b[2] * .95); var s = .05 + rand() * .045; d.scale.setScalar(s); d.rotation.set(rand(), rand(), rand()); d.updateMatrix(); hm.setMatrixAt(k, d.matrix); hcC.copy(col(pick(hc))); hm.setColorAt(k, hcC); k++; }
    hm.castShadow = true; g.add(hm); scene.add(g);
  });

  /* ---------- poeira dourada e pétalas ---------- */
  var MOTES = 180, motePos = new Float32Array(MOTES * 3), moteD = [];
  for (var mi = 0; mi < MOTES; mi++) moteD.push({ x: (rand() - .5) * 20, y: .3 + rand() * 4, z: (rand() - .5) * 20, s: .1 + rand() * .2, ph: rand() * 9 });
  var moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  var motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: glowTex('rgba(255,236,190,1)', 'rgba(255,236,190,0)'), size: .1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8, fog: false }));
  motes.frustumCulled = false; scene.add(motes);

  var PET = lite ? 30 : 70, petG = new THREE.CircleGeometry(.035, 6), petals = new THREE.InstancedMesh(petG, new THREE.MeshStandardMaterial({ color: col(0xf8c4d4), roughness: .6, side: THREE.DoubleSide, emissive: col(0x8a3a55), emissiveIntensity: .25 }), PET), petD = [];
  for (var pi = 0; pi < PET; pi++) petD.push({ x: TREES[1].x + (rand() - .5) * 6, y: rand() * 5, z: TREES[1].z + (rand() - .5) * 5, ph: rand() * 9, sp: .18 + rand() * .2, rot: rand() * 6 });
  scene.add(petals);
  var dummy = new THREE.Object3D();

  /* ---------- borboletas ---------- */
  function wingTexture(kind) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 200; var g = c.getContext('2d');
    var P = {
      monarch:  { a: '#f08a1c', b: '#d6560e', edge: '#1b120c', dots: '#fff6e0', vein: '#1b120c' },
      morpho:   { a: '#5aa0ff', b: '#1f4fd0', edge: '#0d1430', dots: '#cfe4ff', vein: '#0d1430' },
      swallow:  { a: '#ffe14a', b: '#f0b81a', edge: '#161208', dots: '#fff2a8', vein: '#161208' },
      white:    { a: '#ffffff', b: '#e8ecf2', edge: '#8e97a8', dots: '#ffffff', vein: '#9aa3b4' },
      lilac:    { a: '#d9a3f5', b: '#8a4fc0', edge: '#2a1240', dots: '#fbeaff', vein: '#2a1240' },
      painted:  { a: '#f2a45a', b: '#d8703a', edge: '#33261c', dots: '#fff', vein: '#33261c' }
    }[kind];
    function fore() { g.beginPath(); g.moveTo(3, 96); g.bezierCurveTo(24, 8, 130, -6, 252, 28); g.bezierCurveTo(248, 60, 200, 96, 120, 100); g.lineTo(3, 106); g.closePath(); }
    function hind() { g.beginPath(); g.moveTo(3, 104); g.bezierCurveTo(70, 100, 160, 100, 196, 140); g.bezierCurveTo(200, 190, 110, 204, 60, 176); g.bezierCurveTo(30, 154, 6, 130, 3, 118); g.closePath(); }
    [fore, hind].forEach(function (fn, wi) {
      g.save(); fn(); g.clip();
      var gr = g.createLinearGradient(0, 0, 250, 0); gr.addColorStop(0, P.b); gr.addColorStop(.6, P.a); gr.addColorStop(1, P.a); g.fillStyle = gr; g.fillRect(0, 0, 256, 220);
      g.strokeStyle = P.vein; g.lineWidth = 2.2; for (var i = 0; i < 8; i++) { g.beginPath(); g.moveTo(4, 102); g.quadraticCurveTo(80, wi ? 120 + i * 9 : 88 - i * 8, 250, wi ? 110 + i * 12 : 4 + i * 16); g.stroke(); }
      if (kind === 'swallow') { g.fillStyle = P.edge; for (var s2 = 0; s2 < 4; s2++) { g.beginPath(); g.moveTo(30 + s2 * 44, wi ? 105 : 20); g.lineTo(60 + s2 * 44, wi ? 190 : 100); g.lineTo(44 + s2 * 44, wi ? 190 : 100); g.closePath(); g.fill(); } }
      g.lineWidth = 16; g.strokeStyle = P.edge; fn(); g.stroke();
      g.fillStyle = P.dots; for (var d2 = 0; d2 < 9; d2++) { var t2 = d2 / 8; g.beginPath(); if (wi === 0) g.arc(60 + t2 * 180, 22 + t2 * 44 + Math.sin(t2 * 3) * 4, 3.4, 0, 6.28); else g.arc(30 + t2 * 140, 176 - Math.sin(t2 * 2) * 12 - t2 * 20, 3.2, 0, 6.28); g.fill(); }
      g.restore();
    });
    return srgb(new THREE.CanvasTexture(c));
  }
  var wingTex = { monarch: wingTexture('monarch'), morpho: wingTexture('morpho'), swallow: wingTexture('swallow'), white: wingTexture('white'), painted: wingTexture('painted'), lilac: wingTexture('lilac') };
  var wingGeoCache = {};
  function wingGeo(w, h) { var k = w + 'x' + h; if (!wingGeoCache[k]) { var g = new THREE.PlaneGeometry(w, h); g.rotateX(Math.PI / 2); g.translate(w / 2, 0, 0); wingGeoCache[k] = g; } return wingGeoCache[k]; }
  var bodyMat = mat(0x1a1410, { roughness: .8 });
  function makeButterfly(kind, size) {
    var g = new THREE.Group(), tex = wingTex[kind];
    var wm = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .35, side: THREE.DoubleSide, roughness: .75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: kind === 'white' ? .32 : .16, envMapIntensity: .5 });
    var wg = wingGeo(1, .8), R = new THREE.Group(), Lf = new THREE.Group(), Lin = new THREE.Group();
    var rw = new THREE.Mesh(wg, wm), lw = new THREE.Mesh(wg, wm); R.add(rw); Lin.add(lw); Lf.add(Lin); Lf.scale.x = -1;
    var body = new THREE.Mesh(new THREE.CylinderGeometry(.035, .028, .7, 6), bodyMat); body.rotation.x = Math.PI / 2; body.scale.set(1, 1, 1);
    var head = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), bodyMat); head.position.z = .38;
    var ant = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .3, 3), bodyMat); ant.position.set(.05, .05, .5); ant.rotation.set(1.1, 0, -.4);
    var ant2 = ant.clone(); ant2.position.x = -.05; ant2.rotation.z = .4;
    var inner = new THREE.Group(); inner.add(R, Lf, body, head, ant, ant2); inner.scale.setScalar(size); g.add(inner);
    g.userData = { R: R, Lin: Lin, inner: inner, flap: 0 };
    return g;
  }
  var INFO = {};
  experimentos.forEach(function (e, i) {
    var v = VOO[e.id], n = String(i + 1).padStart(2, '0');
    // experimento sem posição fixa ganha uma órbita própria ao redor do centro
    var a = i * 2.4, pos = v ? v.pos : [Math.cos(a) * 4.5, Math.sin(a) * 4.5, 1.8, 1.5, 1.2 + (i % 3) * .25, .3];
    INFO[e.id] = { n: n, tag: v ? v.tag : e.titulo, eyebrow: 'Experimento ' + n + (e.rascunho ? ' · rascunho' : ''), title: e.titulo, desc: e.resumo, href: e.href, kind: v ? v.kind : ESPECIES[i % ESPECIES.length], pos: pos, soon: e.rascunho };
  });
  var flyers = [], navs = {};
  function makeFlyer(kind, size, o) {
    var g = makeButterfly(kind, size); scene.add(g);
    var f = Object.assign({ g: g, cx: 0, cz: 0, rx: 2, rz: 1.6, h: 1.2, sp: .35, ph: rand() * 20, ph2: rand() * 20, flapHz: 9 + rand() * 4, slow: 1, size: size, pos: new THREE.Vector3(), prev: new THREE.Vector3(), yaw: 0, hover: 0, life: -1, age: 0 }, o || {});
    f.tt = f.ph; flyers.push(f); return f;
  }
  Object.keys(INFO).forEach(function (id) {
    var p = INFO[id].pos, f = makeFlyer(INFO[id].kind, .55, { cx: p[0], cz: p[1], rx: p[2], rz: p[3], h: p[4], sp: p[5] }); f.id = id; navs[id] = f;
    var hit = new THREE.Mesh(new THREE.SphereGeometry(.9, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.userData.exp = id; f.g.add(hit); f.hit = hit;
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,228,160,.8)', 'rgba(255,228,160,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })); halo.scale.set(1.5, 1.5, 1); f.g.add(halo); f.halo = halo;
  });
  var AMBIENT_KINDS = ['monarch', 'white', 'painted', 'morpho', 'swallow', 'white'];
  function spawnAmbient(x, z, rise) {
    var f = makeFlyer(pick(AMBIENT_KINDS), 0.26 + rand() * .08, { cx: x + (rand() - .5) * 3, cz: z + (rand() - .5) * 3, rx: 1.5 + rand() * 3, rz: 1.2 + rand() * 2, h: .7 + rand() * 1.4, sp: .3 + rand() * .3 });
    if (rise) { f.rise = 1; f.x0 = x; f.z0 = z; }
    return f;
  }
  for (var ai = 0; ai < 7; ai++) spawnAmbient((rand() - .5) * 10, (rand() - .5) * 8, false);

  function flyerPos(f, t, out) {
    var s = f.slow * f.sp, a = t * s + f.ph, b = t * s * 1.37 + f.ph2;
    var x = f.cx + f.rx * Math.sin(a) + .35 * Math.sin(a * 3.1), z = f.cz + f.rz * Math.sin(b) * Math.cos(a * .5), y = f.h + .3 * Math.sin(t * s * 2.3 + f.ph) + .12 * Math.sin(t * 5.1 + f.ph2);
    var gy = terrainH(x, z); out.set(x, Math.max(y, gy + .35), z); return out;
  }

  /* ---------- etiquetas ---------- */
  var tagsEl = document.getElementById('tags'), tagEls = {};
  Object.keys(INFO).forEach(function (id) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'tag' + (INFO[id].soon ? ' soon' : '');
    b.innerHTML = '<b>' + INFO[id].n + '</b>' + INFO[id].tag; b.setAttribute('aria-label', INFO[id].title);
    b.addEventListener('click', function () { select(id); });
    b.addEventListener('mouseenter', function () { setHover(id); }); b.addEventListener('mouseleave', function () { setHover(null); });
    tagsEl.appendChild(b); tagEls[id] = b;
  });

  /* ---------- câmera / seleção ---------- */
  var cam = { yaw: .2, pitch: .22, dist: 11, tx: 0, ty: 1.3, tz: 0 };
  var goal = { yaw: .2, pitch: .22, dist: 11, tx: 0, ty: 1.3, tz: 0 };
  var zoom = 1, selected = null, hovered = null, lastInput = 0, firstFrame = true;
  function baseDist() { return 12.5 / clamp(Math.pow(camera.aspect, .55), .55, 1.25); }
  function frame() { goal.dist = selected ? Math.max(3.2, baseDist() * .34) : baseDist() * zoom; }
  function resize() {
    var w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); frame(); if (firstFrame) cam.dist = goal.dist;
  }
  addEventListener('resize', resize);

  var card = document.getElementById('card'), openBtn = document.getElementById('open');
  function select(id) {
    selected = id; var info = INFO[id]; goal.pitch = .2; frame();
    document.getElementById('c-eyebrow').textContent = info.eyebrow; document.getElementById('c-title').textContent = info.title; document.getElementById('c-desc').textContent = info.desc;
    openBtn.hidden = !info.href; if (info.href) openBtn.setAttribute('href', info.href);
    card.classList.add('open'); if (window.__closeAbout) window.__closeAbout();
    Object.keys(tagEls).forEach(function (k) { tagEls[k].classList.toggle('on', k === id); tagEls[k].classList.toggle('dim', k !== id); });
    document.getElementById('hint').classList.add('gone'); lastInput = performance.now();
  }
  function deselect() {
    selected = null; goal.tx = 0; goal.ty = 1.3; goal.tz = 0; goal.pitch = .22; goal.ty = 1.3; frame(); card.classList.remove('open');
    Object.keys(tagEls).forEach(function (k) { tagEls[k].classList.remove('on', 'dim'); });
  }
  document.getElementById('close').addEventListener('click', deselect);
  addEventListener('keydown', function (e) { if (e.key === 'Escape') deselect(); });
  (function () {
    var ab = document.getElementById('about'), abBtn = document.getElementById('aboutBtn');
    function setAbout(o) { ab.classList.toggle('open', o); abBtn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    abBtn.addEventListener('click', function () { var o = !ab.classList.contains('open'); if (o) deselect(); setAbout(o); });
    document.getElementById('aboutClose').addEventListener('click', function () { setAbout(false); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') setAbout(false); });
    window.__closeAbout = function () { setAbout(false); };
  })();
  function setHover(id) { hovered = id; stage.classList.toggle('hot', !!id); if (!selected) Object.keys(tagEls).forEach(function (k) { tagEls[k].classList.toggle('on', k === id); }); }

  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), down = null, groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.2), hp = new THREE.Vector3();
  var hitTargets = Object.keys(navs).map(function (k) { return navs[k].hit; });
  function setRay(cx, cy) { var r = stage.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function pickAt(cx, cy) { setRay(cx, cy); var h = ray.intersectObjects(hitTargets, false); return h.length ? h[0].object.userData.exp : null; }
  stage.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, yaw: goal.yaw, pitch: goal.pitch, moved: false }; stage.setPointerCapture(e.pointerId); stage.classList.add('drag'); lastInput = performance.now(); });
  stage.addEventListener('pointermove', function (e) {
    if (down) {
      var dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 5) down.moved = true;
      if (down.moved) { goal.yaw = down.yaw - dx * .0055; goal.pitch = clamp(down.pitch + dy * .004, .03, 1.15); lastInput = performance.now(); document.getElementById('hint').classList.add('gone'); }
    } else if (e.pointerType === 'mouse') setHover(pickAt(e.clientX, e.clientY));
  });
  stage.addEventListener('pointerup', function (e) {
    stage.classList.remove('drag');
    if (down && !down.moved) {
      var id = pickAt(e.clientX, e.clientY);
      if (id) select(id);
      else {
        if (selected) deselect();
        setRay(e.clientX, e.clientY); if (ray.ray.intersectPlane(groundPlane, hp) && hp.length() < 14) { var n = flyers.length < 34 ? 3 : 0; for (var i = 0; i < n; i++) spawnAmbient(hp.x, hp.z, true); }
      }
    }
    down = null;
  });
  stage.addEventListener('pointerleave', function () { if (!down) setHover(null); });
  stage.addEventListener('wheel', function (e) { e.preventDefault(); if (selected) return; zoom = clamp(zoom * (1 + e.deltaY * .0012), .45, 1.3); frame(); lastInput = performance.now(); }, { passive: false });

  /* ---------- loop ---------- */
  var clock = new THREE.Clock(), v = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function tick() {
    var dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime; grassUniforms.time.value = reduce ? 0 : t;
    // borboletas
    for (var i = flyers.length - 1; i >= 0; i--) {
      var f = flyers[i], want = (f.id && (hovered === f.id || selected === f.id)) ? 1 : 0;
      if (f.id) { f.hover += (want - f.hover) * (1 - Math.exp(-dt * 6)); f.slow += ((selected === f.id ? .18 : hovered === f.id ? .35 : 1) - f.slow) * (1 - Math.exp(-dt * 3)); f.halo.material.opacity = f.hover * .7; }
      // avança o "tempo próprio" para não haver salto quando a velocidade muda
      f.tt += dt * f.slow; var s = f.sp;
      var a = f.tt * s, b = f.tt * s * 1.37 + f.ph2 - f.ph; // usa tempo próprio
      var x = f.cx + f.rx * Math.sin(a) + .35 * Math.sin(a * 3.1), z = f.cz + f.rz * Math.sin(b) * Math.cos(a * .5), y = f.h + .3 * Math.sin(f.tt * s * 2.3 + f.ph) + .12 * Math.sin(f.tt * 5.1 + f.ph2);
      var gy = terrainH(x, z); y = Math.max(y, gy + .35);
      if (f.rise) { f.age += dt; var k = clamp(f.age / 3.5, 0, 1); x = lerp(f.x0, x, k); z = lerp(f.z0, z, k); y = lerp(gy + .3 + f.age * .25, y, k); if (k >= 1) f.rise = 0; }
      f.prev.copy(f.pos); f.pos.set(x, y, z); var vx = f.pos.x - f.prev.x, vz = f.pos.z - f.prev.z, vy = f.pos.y - f.prev.y;
      if (vx * vx + vz * vz > 1e-8) { var ty = Math.atan2(vx, vz), dy = ty - f.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); f.yaw += dy * (1 - Math.exp(-dt * 5)); }
      f.g.position.copy(f.pos); f.g.rotation.set(-clamp(vy / Math.max(dt, .001) * .25, -.5, .5), f.yaw, Math.sin(f.tt * 2 + f.ph) * .12, 'YXZ');
      var burst = .5 + .5 * Math.sin(f.tt * 1.6 + f.ph), amp = .35 + .65 * smooth(.15, .5, burst), fl = Math.sin(t * f.flapHz * (f.slow < 1 ? .8 : 1) + f.ph);
      var ang = .12 + (fl * .5 + .5) * (.7 + .5 * amp) * 1.05; f.g.userData.R.rotation.z = ang; f.g.userData.Lin.rotation.z = ang;
      var sc = 1 + f.hover * .3; f.g.scale.setScalar(sc);
    }
    // câmera
    if (selected) { var nf = navs[selected]; goal.tx = nf.pos.x; goal.ty = nf.pos.y; goal.tz = nf.pos.z; var ty2 = Math.atan2(nf.pos.x - camera.position.x, nf.pos.z - camera.position.z); }
    if (!selected && !down && !reduce && performance.now() - lastInput > 4500) goal.yaw += dt * .045;
    var kk = 1 - Math.exp(-dt * (selected ? 3 : 4.5));
    cam.yaw += (goal.yaw - cam.yaw) * kk; cam.pitch += (goal.pitch - cam.pitch) * kk; cam.dist += (goal.dist - cam.dist) * kk;
    cam.tx += (goal.tx - cam.tx) * kk; cam.ty += (goal.ty - cam.ty) * kk; cam.tz += (goal.tz - cam.tz) * kk;
    var cp = Math.cos(cam.pitch);
    camera.position.set(cam.tx + cam.dist * Math.sin(cam.yaw) * cp, cam.ty + cam.dist * Math.sin(cam.pitch), cam.tz + cam.dist * Math.cos(cam.yaw) * cp);
    var gy2 = terrainH(camera.position.x, camera.position.z) + .45; if (camera.position.y < gy2) camera.position.y = gy2;
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    // partículas
    for (var m = 0; m < MOTES; m++) { var d = moteD[m]; motePos[m * 3] = d.x + Math.sin(t * d.s + d.ph) * .8; motePos[m * 3 + 1] = d.y + Math.sin(t * d.s * 1.3 + d.ph * 2) * .4 + ((t * d.s * .12) % 3); motePos[m * 3 + 2] = d.z + Math.cos(t * d.s * .8 + d.ph) * .8; if (motePos[m * 3 + 1] > 5) motePos[m * 3 + 1] -= 4.6; }
    moteGeo.attributes.position.needsUpdate = true;
    for (var q = 0; q < PET; q++) {
      var p = petD[q]; var yy = ((p.y - t * p.sp) % 5 + 5) % 5; var xx = p.x + Math.sin(t * .5 + p.ph) * .9 + (5 - yy) * .35, zz = p.z + Math.cos(t * .4 + p.ph) * .6;
      dummy.position.set(xx, yy + terrainH(xx, zz) * 0 + .05, zz); dummy.rotation.set(t * 1.3 + p.rot, t * .9 + p.ph, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); petals.setMatrixAt(q, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
    waterNormal.offset.set(t * .006, t * .004); updateDucks(t, dt);

    renderer.render(scene, camera);

    var w = stage.clientWidth, h = stage.clientHeight;
    for (var id in navs) {
      v.copy(navs[id].pos); v.y += .55; v.project(camera); var el = tagEls[id], behind = v.z > 1;
      el.style.transform = 'translate(' + ((v.x * .5 + .5) * w - 18).toFixed(1) + 'px,' + ((-v.y * .5 + .5) * h - 26).toFixed(1) + 'px)'; el.style.visibility = behind ? 'hidden' : 'visible';
    }
    if (firstFrame) { firstFrame = false; boot.classList.add('done'); }
    requestAnimationFrame(tick);
  }
  resize(); cam.dist = goal.dist; addEventListener('load', resize);
  requestAnimationFrame(tick);
}
