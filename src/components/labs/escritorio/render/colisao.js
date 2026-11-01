// Mapa de colisão do modo boneco: uma grade de 10 cm vista de cima, montada
// a partir da própria cena (nada de coordenada solta para manter em dia).
// - piso: as lajes do cenário (caixas finas com o topo em y = 0);
// - obstáculos: tudo que ocupa a altura do corpo (paredes, vidros, núcleos,
//   armários, sofás, plantas), pela pegada real de cada peça, girada ou não;
// - bancadas e cadeiras: dos dados da planta (são desenhadas instanciadas);
// - onde dá para subir (arquibancada, palquinho: SUBIR em planta/dados.js):
//   as peças largas dessas áreas viram chão mais alto, e cada célula guarda
//   a altura do chão. Degrau até DEGRAU sobe; mais que isso é parede.
// Depois a grade é "engordada" pelo raio do boneco, então andar é só olhar
// uma célula. Tem também o caminho mais curto (A*) para o clique-para-andar.
import * as THREE from 'three';
import { BANCADAS, BANCADA, AREAS, SUBIR } from '../planta/dados.js';
import { LUGARES } from '../planta/lugares.js';

export const PASSO = 0.1;            /* tamanho da célula, em metros */
export const RAIO_BONECO = 0.25;
const LIMITES = { x0: -20, z0: -21, x1: 68, z1: 43 };
const CORPO = { baixo: 0.12, alto: 1.75 };   /* faixa de altura que bate no corpo */
const RAIO_CADEIRA = 0.3;
export const DEGRAU = 0.45;          /* o degrau mais alto que o boneco sobe */
const LARGURA_PISO = 1.2;            /* peça mais estreita que isso não vira chão */

/* ------------------------------------------------------------- grade */

export function criarGrade(lim = LIMITES, passo = PASSO) {
  const w = Math.ceil((lim.x1 - lim.x0) / passo), h = Math.ceil((lim.z1 - lim.z0) / passo);
  return { ...lim, passo, w, h, chao: new Uint8Array(w * h), bloq: new Uint8Array(w * h), alt: new Float32Array(w * h), andavel: null };
}

const celX = (g, x) => Math.floor((x - g.x0) / g.passo);
const celZ = (g, z) => Math.floor((z - g.z0) / g.passo);
const centroX = (g, i) => g.x0 + (i + 0.5) * g.passo;
const centroZ = (g, j) => g.z0 + (j + 0.5) * g.passo;

/** Fecho convexo de pontos [x, z] (cadeia monótona). */
function fecho(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo = [], cima = [];
  for (const p of pts) { while (baixo.length >= 2 && cruz(baixo.at(-2), baixo.at(-1), p) <= 0) baixo.pop(); baixo.push(p); }
  for (const p of pts.reverse()) { while (cima.length >= 2 && cruz(cima.at(-2), cima.at(-1), p) <= 0) cima.pop(); cima.push(p); }
  return baixo.slice(0, -1).concat(cima.slice(0, -1));
}

/** Chama fn(k) para cada célula cujo centro cai dentro do polígono convexo. */
export function celulasDoPoligono(g, poli, fn) {
  if (poli.length < 3) {
    /* peça fininha (vidro de 4 cm visto de cima vira quase uma linha): marca a faixa */
    if (poli.length === 2) celulasDoPoligono(g, engrossar(poli), fn);
    return;
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of poli) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  /* garante pelo menos uma célula de espessura */
  if (Math.min(x1 - x0, z1 - z0) < g.passo) poli = engrossar(poli);
  const i0 = Math.max(0, celX(g, x0 - g.passo)), i1 = Math.min(g.w - 1, celX(g, x1 + g.passo));
  const j0 = Math.max(0, celZ(g, z0 - g.passo)), j1 = Math.min(g.h - 1, celZ(g, z1 + g.passo));
  const n = poli.length;
  for (let j = j0; j <= j1; j++) {
    const z = centroZ(g, j);
    for (let i = i0; i <= i1; i++) {
      const x = centroX(g, i);
      let dentro = true;
      for (let k = 0; k < n && dentro; k++) {
        const a = poli[k], b = poli[(k + 1) % n];
        if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) dentro = false;
      }
      if (dentro) fn(j * g.w + i);
    }
  }
}

/** Marca em `arr` as células cujo centro cai dentro do polígono convexo. */
export function preencherPoligono(g, arr, poli) {
  celulasDoPoligono(g, poli, k => { arr[k] = 1; });
}

/* polígono degenerado (linha) vira um retângulo de 1 célula de largura */
function engrossar(poli) {
  let a = poli[0], b = poli[0], d = -1;
  for (const p of poli) for (const q of poli) { const e = Math.hypot(p[0] - q[0], p[1] - q[1]); if (e > d) { d = e; a = p; b = q; } }
  const len = d || 1e-6, nx = -(b[1] - a[1]) / len * PASSO * 0.6, nz = (b[0] - a[0]) / len * PASSO * 0.6;
  return fecho([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]]);
}

export function marcarCirculo(g, arr, x, z, r) {
  const i0 = Math.max(0, celX(g, x - r)), i1 = Math.min(g.w - 1, celX(g, x + r));
  const j0 = Math.max(0, celZ(g, z - r)), j1 = Math.min(g.h - 1, celZ(g, z + r));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (Math.hypot(centroX(g, i) - x, centroZ(g, j) - z) <= r) arr[j * g.w + i] = 1;
  }
}

/* --------------------------------------------------- de onde vem o mapa */

const v = new THREE.Vector3(), c0 = new THREE.Vector3(), c1 = new THREE.Vector3(), c2 = new THREE.Vector3();
const dentroDe = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

/** Pegada (fecho convexo visto de cima), alturas e menor largura de uma peça. */
function medir(o) {
  const geo = o.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox, pos = geo.attributes.position;
  const pts = [];
  let y0 = Infinity, y1 = -Infinity;
  /* peça redonda (palco sextavado, vaso) pelos vértices; o resto pelos cantos da caixa */
  if (pos && pos.count <= 400) {
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
      pts.push([v.x, v.z]); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
  } else {
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld);
      pts.push([v.x, v.z]); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
  }
  c0.set(bb.min.x, bb.min.y, bb.min.z).applyMatrix4(o.matrixWorld);
  c1.set(bb.max.x, bb.min.y, bb.min.z).applyMatrix4(o.matrixWorld);
  c2.set(bb.min.x, bb.min.y, bb.max.z).applyMatrix4(o.matrixWorld);
  const largura = Math.min(Math.hypot(c1.x - c0.x, c1.z - c0.z), Math.hypot(c2.x - c0.x, c2.z - c0.z));
  const meio = [(c1.x + c2.x) / 2, (c1.z + c2.z) / 2];
  return { poli: fecho(pts), y0, y1, largura, meio };
}

/** Lê piso, chão alto e obstáculos das peças do cenário. Chame ANTES de mesclar. */
export function lerCenario(g, grupo, subir = AREAS.filter(a => SUBIR.includes(a.id)).map(a => a.r)) {
  grupo.updateMatrixWorld(true);
  const pecas = [];
  grupo.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry) pecas.push(medir(o)); });

  /* 1. lajes do piso */
  for (const p of pecas) if (p.y1 <= 0.02 && p.y1 >= -0.02 && p.y0 < -0.04) { p.laje = true; preencherPoligono(g, g.chao, p.poli); }

  /* 2. chão alto: peça larga, numa área de subir, apoiada no chão ou em outro
        chão alto; de baixo para cima, para o degrau de cima se apoiar no de baixo */
  const altA = k => g.alt[k];
  const candidatas = pecas.filter(p => !p.laje && p.y1 > 0.02 && p.y1 <= CORPO.alto && p.largura >= LARGURA_PISO &&
    subir.some(r => dentroDe(r, p.meio[0], p.meio[1]))).sort((a, b) => a.y0 - b.y0);
  for (const p of candidatas) {
    const k = celZ(g, p.meio[1]) * g.w + celX(g, p.meio[0]);
    const apoio = k >= 0 && k < g.alt.length ? altA(k) : 0;
    if (Math.abs(p.y0 - apoio) > 0.06 && p.y0 > 0.05) continue;
    p.piso = true;
    celulasDoPoligono(g, p.poli, c => { if (p.y1 > g.alt[c]) g.alt[c] = p.y1; });
  }

  /* 3. obstáculos: o que bate no corpo de quem está no chão daquela célula */
  for (const p of pecas) {
    if (p.laje || p.piso) continue;
    celulasDoPoligono(g, p.poli, c => {
      const a = g.alt[c];
      if (p.y1 > a + CORPO.baixo && p.y0 < a + CORPO.alto) g.bloq[c] = 1;
    });
  }
}

/** Bancadas (tampo inteiro) e cadeiras (círculo), dos dados da planta. */
export function lerMoveis(g, bancadas = BANCADAS, lugares = LUGARES) {
  for (const b of bancadas) {
    const meio = (b.lugares * BANCADA.passo) / 2, prof = BANCADA.profundidade / 2;
    const [dx, dz] = b.eixo === 'z' ? [prof, meio] : [meio, prof];
    preencherPoligono(g, g.bloq, [[b.x - dx, b.z - dz], [b.x + dx, b.z - dz], [b.x + dx, b.z + dz], [b.x - dx, b.z + dz]]);
  }
  for (const l of lugares) if (l.zona) marcarCirculo(g, g.bloq, l.x, l.z, RAIO_CADEIRA);
}

/** Andável = piso sem obstáculo, com folga do raio do boneco em volta de tudo. */
export function fecharGrade(g, raio = RAIO_BONECO) {
  const { w, h } = g;
  const andavel = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) andavel[k] = g.chao[k] && !g.bloq[k] ? 1 : 0;
  /* a beirada da grade conta como parede */
  for (let i = 0; i < w; i++) andavel[i] = andavel[(h - 1) * w + i] = 0;
  for (let j = 0; j < h; j++) andavel[j * w] = andavel[j * w + w - 1] = 0;
  /* ao pé de um degrau alto demais (a lateral da arquibancada), é parede */
  const alt = g.alt, alto = (k, n) => alt[n] - alt[k] > DEGRAU;
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const k = j * w + i;
    if (andavel[k] && (alto(k, k - 1) || alto(k, k + 1) || alto(k, k - w) || alto(k, k + w))) andavel[k] = 0;
  }
  /* engorda: tudo que não é andável apaga um disco do raio do boneco */
  const r = Math.ceil(raio / g.passo), disco = [];
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (di * di + dj * dj <= r * r) disco.push([di, dj]);
  const saida = andavel.slice();
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (andavel[j * w + i]) continue;
    /* só a borda do bloqueio precisa espalhar */
    const borda = (i > 0 && andavel[j * w + i - 1]) || (i < w - 1 && andavel[j * w + i + 1]) ||
      (j > 0 && andavel[(j - 1) * w + i]) || (j < h - 1 && andavel[(j + 1) * w + i]);
    if (!borda) continue;
    for (const [di, dj] of disco) {
      const a = i + di, b = j + dj;
      if (a >= 0 && a < w && b >= 0 && b < h) saida[b * w + a] = 0;
    }
  }
  g.andavel = saida;
  return g;
}

/** Monta o mapa inteiro: cenário (antes de mesclar) + móveis da planta. */
export function montarColisao(grupoCenario) {
  const g = criarGrade();
  lerCenario(g, grupoCenario);
  lerMoveis(g);
  return fecharGrade(g);
}

/* ------------------------------------------------------------ consultas */

export function podeFicar(g, x, z) {
  const i = celX(g, x), j = celZ(g, z);
  return i >= 0 && j >= 0 && i < g.w && j < g.h && g.andavel[j * g.w + i] === 1;
}

/** Altura do chão em (x, z): 0 no piso, mais na arquibancada e no palquinho. */
export function altura(g, x, z) {
  const i = celX(g, x), j = celZ(g, z);
  return i >= 0 && j >= 0 && i < g.w && j < g.h ? g.alt[j * g.w + i] : 0;
}

/** Dá para ir de (x1, z1) a (x2, z2), vizinhos? (andável e sem degrau alto) */
export function podePassar(g, x1, z1, x2, z2) {
  return podeFicar(g, x2, z2) && Math.abs(altura(g, x2, z2) - altura(g, x1, z1)) <= DEGRAU;
}

/** Anda de (x, z) por (dx, dz); se bater, desliza ao longo da parede. */
export function mover(g, x, z, dx, dz) {
  /* passos pequenos para não atravessar parede fina andando rápido */
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (g.passo * 0.5)));
  const sx = dx / n, sz = dz / n;
  for (let k = 0; k < n; k++) {
    if (podePassar(g, x, z, x + sx, z + sz)) { x += sx; z += sz; }
    else if (podePassar(g, x, z, x + sx, z)) x += sx;
    else if (podePassar(g, x, z, x, z + sz)) z += sz;
    else break;
  }
  return { x, z };
}

/** Onde o raio da tela (origem, direção) encosta no chão, contando o chão alto. */
export function pontoNaSuperficie(g, o, d, max = 160) {
  if (d.y >= 0) return null;
  /* começa onde o raio desce abaixo do chão alto mais alto possível */
  let t = o.y > CORPO.alto ? (o.y - CORPO.alto) / -d.y : 0;
  const fim = Math.min(max, o.y / -d.y + 0.01);
  for (; t <= fim; t += 0.04) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y <= altura(g, x, z)) return { x, z };
  }
  return { x: o.x + d.x * fim, z: o.z + d.z * fim };
}

/** Ponto andável mais perto de (x, z), até `max` metros; null se não achar. */
export function maisPerto(g, x, z, max = 2) {
  if (podeFicar(g, x, z)) return { x, z };
  for (let r = g.passo; r <= max; r += g.passo) {
    const passos = Math.max(8, Math.ceil((2 * Math.PI * r) / g.passo));
    for (let k = 0; k < passos; k++) {
      const a = (k / passos) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (podeFicar(g, px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}

/** Quantos metros dá para andar em linha reta de (x, z) na direção `giro` (até `max`). */
export function distanciaLivre(g, x, z, giro, max = 8) {
  const dx = Math.sin(giro), dz = Math.cos(giro);
  let px = x, pz = z;
  for (let d = g.passo; d <= max; d += g.passo) {
    const nx = x + dx * d, nz = z + dz * d;
    if (!podePassar(g, px, pz, nx, nz)) return d - g.passo;
    px = nx; pz = nz;
  }
  return max;
}

/** Ponto andável com folga em volta (bom para cair de paraquedas) perto de (x, z). */
export function pontoEspacoso(g, x, z, max = 8, folga = 0.9) {
  const espacoso = (px, pz) => {
    if (!podeFicar(g, px, pz)) return false;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; if (!podeFicar(g, px + Math.sin(a) * folga, pz + Math.cos(a) * folga)) return false; }
    return true;
  };
  if (espacoso(x, z)) return { x, z };
  for (let r = 0.25; r <= max; r += 0.25) {
    const passos = Math.max(8, Math.ceil((2 * Math.PI * r) / 0.25));
    for (let k = 0; k < passos; k++) {
      const a = (k / passos) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (espacoso(px, pz)) return { x: px, z: pz };
    }
  }
  return maisPerto(g, x, z, max);
}

/** Mantém a direção preferida se houver espaço à frente; senão, a mais aberta. */
export function direcaoAberta(g, x, z, preferida, minimo = 3) {
  if (distanciaLivre(g, x, z, preferida) >= minimo) return preferida;
  let melhor = preferida, dist = -1;
  for (let k = 0; k < 24; k++) {
    const a = preferida + (k / 24) * Math.PI * 2, d = distanciaLivre(g, x, z, a);
    if (d > dist + 0.01) { dist = d; melhor = a; }
  }
  return melhor;
}

function linhaLivre(g, a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / (g.passo * 0.5)));
  let px = a.x, pz = a.z;
  for (let k = 1; k <= n; k++) {
    const nx = a.x + ((b.x - a.x) * k) / n, nz = a.z + ((b.z - a.z) * k) / n;
    if (!podePassar(g, px, pz, nx, nz)) return false;
    px = nx; pz = nz;
  }
  return true;
}

/** Caminho andável de a até b ([{x,z}...], já sem zigue-zague) ou null. */
export function caminho(g, a, b, limite = 400000) {
  const { w, h } = g;
  const ini = celZ(g, a.z) * w + celX(g, a.x), fim = celZ(g, b.z) * w + celX(g, b.x);
  if (!g.andavel[ini] || !g.andavel[fim]) return null;
  if (linhaLivre(g, a, b)) return [{ x: b.x, z: b.z }];
  const custo = new Float32Array(w * h).fill(Infinity), veio = new Int32Array(w * h).fill(-1), fechado = new Uint8Array(w * h);
  const fi = fim % w, fj = (fim / w) | 0;
  const heur = k => { const dx = Math.abs((k % w) - fi), dz = Math.abs(((k / w) | 0) - fj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  /* fila de prioridade binária */
  const heap = [], prio = [];
  const por = (k, p) => { heap.push(k); prio.push(p); let c = heap.length - 1; while (c > 0) { const pai = (c - 1) >> 1; if (prio[pai] <= prio[c]) break; [heap[pai], heap[c]] = [heap[c], heap[pai]]; [prio[pai], prio[c]] = [prio[c], prio[pai]]; c = pai; } };
  const tirar = () => { const k = heap[0], ultK = heap.pop(), ultP = prio.pop(); if (heap.length) { heap[0] = ultK; prio[0] = ultP; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && prio[l] < prio[m]) m = l; if (r < heap.length && prio[r] < prio[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [prio[m], prio[c]] = [prio[c], prio[m]]; c = m; } } return k; };
  const viz = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  custo[ini] = 0; por(ini, heur(ini));
  let abertos = 0, achou = false;
  while (heap.length && abertos < limite) {
    const k = tirar();
    if (fechado[k]) continue;
    if (k === fim) { achou = true; break; }
    fechado[k] = 1; abertos++;
    const i = k % w, j = (k / w) | 0;
    for (const [di, dj, c] of viz) {
      const a2 = i + di, b2 = j + dj;
      if (a2 < 0 || b2 < 0 || a2 >= w || b2 >= h) continue;
      const n = b2 * w + a2;
      if (!g.andavel[n] || fechado[n] || Math.abs(g.alt[n] - g.alt[k]) > DEGRAU) continue;
      if (di && dj && (!g.andavel[j * w + a2] || !g.andavel[b2 * w + i])) continue; /* não corta quina */
      const nc = custo[k] + c;
      if (nc < custo[n]) { custo[n] = nc; veio[n] = k; por(n, nc + heur(n)); }
    }
  }
  if (!achou) return null;
  const celulas = [];
  for (let k = fim; k !== -1; k = veio[k]) celulas.push({ x: centroX(g, k % w), z: centroZ(g, (k / w) | 0) });
  celulas.reverse();
  celulas[celulas.length - 1] = { x: b.x, z: b.z };
  /* puxa o barbante: pula os pontos que dá para ver em linha reta */
  const liso = [];
  let atual = { x: a.x, z: a.z }, k = 0;
  while (k < celulas.length - 1) {
    let m = celulas.length - 1;
    while (m > k + 1 && !linhaLivre(g, atual, celulas[m])) m--;
    liso.push(celulas[m]); atual = celulas[m]; k = m;
  }
  if (!liso.length) liso.push(celulas.at(-1));
  return liso;
}
