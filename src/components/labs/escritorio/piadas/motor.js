// As piadas do simulador antigo, no andar novo. Regra da pasta: nenhuma piada
// guarda coordenada solta. Cada uma se prende a uma personagem (pelo apelido,
// e a cadeira dela é lida na hora) ou a um ponto nomeado (PONTOS). Por isso,
// se a personagem troca de cadeira ou o ponto muda de lugar, a piada vai junto.
import * as THREE from 'three';
import { caminho, maisPerto } from '../render/colisao.js';
import { LUGAR } from '../planta/lugares.js';
import { desenharQuadro } from './quadro.js';
import * as F from './figuras.js';

const { V, suaviza } = F;
const MESA_Y = 0.735;
const QUADRO_Y = 1.575;              /* o quadro da planta vai de 0,95 a 2,2 m de altura */               /* altura do tampo, em metros */
const DISCO = V(33.5, 2.6, 20.8);   /* globo: no meio do andar, pendurado do teto */
const SALA = { x0: 0, x1: 67, y0: 0, y1: 3.2, z0: -20, z1: 41.6 };
const CORES_DISCO = [0xFF2E88, 0x2EC4FF, 0xFFD23F, 0x7CFF4F, 0xB04BFF, 0xFF7A1A];
const BPM = 122;
/* tempos do sanduíche (iguais aos do simulador antigo) */
const INI = 0.55, CICLO = 0.85, MORDIDAS = 4, FIM = INI + MORDIDAS * CICLO;

function sorteio(semente) {
  let s = semente;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function texturaGlobo() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const x = cv.getContext('2d'), R = sorteio(3);
  for (let i = 0; i < 32; i++) for (let j = 0; j < 16; j++) {
    const v = 150 + ((R() * 105) | 0);
    x.fillStyle = `rgb(${v},${v},${Math.min(255, v + 8)})`;
    x.fillRect(i * 16, j * 16, 16, 16);
  }
  x.strokeStyle = 'rgba(40,44,52,.85)'; x.lineWidth = 2;
  for (let i = 0; i <= 32; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 256); x.stroke(); }
  for (let j = 0; j <= 16; j++) { x.beginPath(); x.moveTo(0, j * 16); x.lineTo(512, j * 16); x.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function texturaPonto() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/** Onde o raio que sai de B, na direção d, bate nas paredes, no chão ou no teto da sala. */
function bateNaSala(B, d, out) {
  const lim = [[SALA.x0, SALA.x1], [SALA.y0, SALA.y1], [SALA.z0, SALA.z1]], eixo = ['x', 'y', 'z'];
  let tMin = Infinity;
  for (let a = 0; a < 3; a++) {
    const v = d[eixo[a]];
    if (Math.abs(v) < 1e-5) continue;
    const t = ((v > 0 ? lim[a][1] : lim[a][0]) - B[eixo[a]]) / v;
    if (t > 0 && t < tMin) tMin = t;
  }
  return out.copy(B).addScaledVector(d, tMin);
}

/** Ponto (x, z) da frente, atrás ou do lado de uma cadeira (giro = para onde a pessoa olha). */
function ancora(l, d = 0, lat = 0) {
  const sx = Math.sin(l.giro), sz = Math.cos(l.giro);
  return { x: l.x + sx * d + sz * lat, z: l.z + sz * d - sx * lat };
}

export function criarMotor({ andar, pessoas, PONTOS, aoMudarLugar = () => {} }) {
  const cena = andar.cena;
  const grade = andar.colisao;
  const porNome = new Map(pessoas.map(p => [p.nome, p]));
  const passeios = [];
  let fuga = null, filmagemAtiva = null;
  const disco = { alvo: 0, mix: 0, t0: 0, ult: 0, piso: null, pisoMat: null, pontos: null, dirs: [], globo: null, cores: [] };
  const visitantesDancando = new Map();   /* rig do visitante -> altura do corpo parado */

  /* ------------------------------------------------------ lugares e rotas */

  /** Ponto livre atrás da cadeira, por onde a pessoa sai ou chega. */
  function entradaDe(l) {
    const q = ancora(l, -0.75, 0);
    return maisPerto(grade, q.x, q.z, 2) || q;
  }
  /** Rota de uma cadeira até outra, saindo pela frente das duas. */
  function rotaEntreCadeiras(de, para) {
    const Ae = entradaDe(de), Be = entradaDe(para);
    const meio = caminho(grade, Ae, Be) || [Be];
    return [ancora(de), Ae, ...meio, ancora(para)];
  }
  /** Rota de um ponto nomeado até outro (ou até uma cadeira, via entrada). */
  function rotaAte(a, b) {
    return [a, ...(caminho(grade, a, b) || [b])];
  }

  /* ----------------------------------------------------------- pose */

  function aplicarPose(p) {
    const e = p.est, r = p.rig;
    if (r.cab) r.cab.rotation.set(e.cabX || 0, e.cabY || 0, e.cabZ || 0);
    if (r.boca) r.boca.scale.y = e.boca || 1;
  }
  function resetarPose(p) {
    const e = p.est, r = p.rig;
    F.ik(r, r.T0);
    e.cabX = e.cabY = e.cabZ = 0;
    e.boca = 1;
    if (r.c) r.c.position.y = p.baseY;
    aplicarPose(p);
  }

  /* ----------------------------------------------- mesa: pilha e retrato */

  function reancorarMesa(p) {
    const l = LUGAR.get(p.lugar);
    if (p.pilha) {
      const a = ancora(l, 0.75);
      p.pilha.position.set(a.x, MESA_Y, a.z);
      p.pilha.rotation.y = l.giro;
    }
    if (p.retrato) {
      const a = ancora(l, 0.5, -0.45);      /* de lado, na borda do tampo: o monitor não tapa */
      p.retrato.position.set(a.x, MESA_Y, a.z);
      p.retrato.rotation.y = l.giro + Math.PI;     /* a foto olha para quem senta */
    }
  }

  /* -------------------------------------------------- figuras que andam */

  /** Põe uma figura para andar por `pontos`. Chama aoChegar ao fim da rota. */
  function criarPasseio({ c, pontos, vel, amp = 0.4, atraso = 0, esq = null, pulo = false, aoChegar }) {
    cena.add(c.g);
    const seg = [];
    let total = 0;
    for (let k = 1; k < pontos.length; k++) {
      const a = pontos[k - 1], b = pontos[k];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      if (l < 1e-6) continue;
      seg.push({ a, b, l, d0: total });
      total += l;
    }
    const w = { c, seg, total, vel, amp, esq, pulo, aoChegar, d: 0, t0: performance.now() / 1000 + atraso, fim: false };
    c.g.position.set(pontos[0].x, 0, pontos[0].z);
    passeios.push(w);
    return w;
  }
  function posicaoNoPasseio(w) {
    const s = w.seg.find(s => w.d <= s.d0 + s.l) || w.seg[w.seg.length - 1];
    const k = Math.min(1, (w.d - s.d0) / s.l);
    return { x: s.a.x + (s.b.x - s.a.x) * k, z: s.a.z + (s.b.z - s.a.z) * k, ang: Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z) };
  }
  function avancarPasseios(t, dt) {
    for (const w of passeios) {
      if (w.fim) continue;
      if (t < w.t0) { if (w.pulo) w.c.corpo.position.y = 0.22 * Math.sin(Math.PI * (1 - (w.t0 - t) / 0.35)); continue; }
      w.c.corpo.position.y = 0;
      w.d += w.vel * dt;
      const P = posicaoNoPasseio(w);
      w.c.g.position.set(P.x, 0, P.z);
      w.c.g.rotation.y = P.ang;
      const f = w.d * 3.4;
      F.correr(w.c, f, w.amp);
      if (w.esq) F.balancarEsqueleto(w.esq, f, t);
      if (w.d >= w.total) {
        w.fim = true;
        cena.remove(w.c.g);
        w.aoChegar && w.aoChegar();
      }
    }
    for (let k = passeios.length - 1; k >= 0; k--) if (passeios[k].fim) passeios.splice(k, 1);
  }
  /** A porta da Saída Norte abre quando alguém passa a menos de 2,2 m dela. */
  function alguemPertoDaSaida() {
    const S = PONTOS.saida;
    return passeios.some(w => {
      if (w.fim || w.d <= 0) return false;
      const P = posicaoNoPasseio(w);
      return Math.hypot(P.x - S.x, P.z - S.z) < 2.2;
    });
  }

  /* ------------------------------------------------------- cadeira */

  /** Sai da cadeira e anda até outra. A piada que estava nela é cancelada. */
  function andarPara(p, lugarId, aoSentar = () => {}) {
    if (p.est.busy === 'andando' || p.est.busy === 'fuga') return false;
    if (p.est.busy) cancelar(p);
    const de = LUGAR.get(p.lugar), para = LUGAR.get(lugarId);
    if (!de || !para) return false;
    p.est.busy = 'andando';
    p.est.destino = lugarId;
    p.g.visible = false;
    const c = F.fazCorredor({ pele: p.p.pele, camisa: p.p.camisa, calca: '#3A3F47', esc: p.p.altura || 0.86, cabeca: F.cabecaDe(p.rig.cab) });
    c.g.userData.pessoa = p.nome;
    criarPasseio({
      c, pontos: rotaEntreCadeiras(de, para), vel: 1.4, amp: 0.45,
      aoChegar: () => { sentar(p, lugarId); aoSentar(p); },
    });
    return true;
  }
  function sentar(p, lugarId) {
    const l = LUGAR.get(lugarId);
    p.lugar = lugarId;
    p.est.busy = null;
    p.est.destino = null;
    p.g.position.set(l.x, l.dy || 0, l.z);
    p.g.rotation.y = l.giro;
    p.g.visible = true;
    resetarPose(p);
    reancorarMesa(p);
    aoMudarLugar(p);
  }

  /* ----------------------------------------------- cancelar piadas */

  function cancelar(p) {
    const e = p.est;
    if (e.lanche) { e.lanche.s.parent && e.lanche.s.parent.remove(e.lanche.s); e.lanche = null; }
    if (e.filmagem) { e.filmagem.cel.parent && e.filmagem.cel.parent.remove(e.filmagem.cel); e.filmagem = null; filmagemAtiva = null; }
    e.busy = null;
    resetarPose(p);
  }

  /* ----------------------------------------------------- sanduíche */

  function comerSanduiche(p) {
    if (!p.flags.sanduiche) return { ok: false, msg: `${p.nome} não tem sanduíche.` };
    if (p.est.busy) return { ok: false, msg: `${p.nome} está ocupada agora.` };
    const s = F.fazSanduiche();
    s.scale.setScalar(0.001);
    p.rig.c.add(s);
    p.est.busy = 'lanche';
    p.est.lanche = { s, t0: performance.now() / 1000 };
    const filmadora = pessoas.find(x => x.flags.filma);
    if (filmadora) filmar(filmadora, p.nome);
    return { ok: true };
  }
  function atualizarLanche(p, t) {
    const L = p.est.lanche, r = p.rig, s = r.s, b = t - L.t0;
    const feitas = Math.max(0, Math.min(MORDIDAS, (b - INI) / CICLO));
    const inteiras = Math.floor(feitas), fr = feitas - inteiras;
    const resto = 1 - (inteiras + suaviza((fr - 0.4) / 0.15)) / MORDIDAS;
    const recuo = b < INI || b >= FIM ? 0.05 : 0.05 * (1 - Math.sin(Math.min(1, fr / 0.55) * Math.PI));
    const boca = V(s * 0.02, 1.37, 0.185 + F.LANCHE_COMP * Math.max(resto, 0.15) + recuo);
    let alvo, aparece = 1;
    if (b < INI) { const k = suaviza(b / INI); alvo = new THREE.Vector3().lerpVectors(r.T0, boca, k); aparece = k; }
    else if (b < FIM) alvo = boca;
    else if (b < FIM + 0.5) alvo = new THREE.Vector3().lerpVectors(boca, r.T0, suaviza((b - FIM) / 0.5));
    else {
      L.s.parent && L.s.parent.remove(L.s);
      p.est.lanche = null;
      p.est.busy = null;
      resetarPose(p);
      return;
    }
    const punho = F.ik(r, alvo);
    L.s.position.set(punho.x - s * 0.02, punho.y + 0.03, punho.z - 0.01);
    L.s.scale.set(aparece, aparece, aparece);
    L.s.userData.corpo.scale.z = Math.max(0.001, resto);
    L.s.visible = resto > 0.001;
    /* mastiga: boca abre e fecha, cabeça acompanha de leve */
    const mastigando = b > INI && b < FIM + 0.5;
    const mast = mastigando ? Math.abs(Math.sin(b * 11)) : 0;
    p.est.boca = 1 + mast * 1.8;
    p.est.cabX = mastigando ? 0.06 + mast * 0.04 : 0;
    aplicarPose(p);
  }

  /* ------------------------------------------------------ filmagem */

  function filmar(filmadora, alvoNome) {
    if (filmadora.est.busy || filmadora.est.filmagem) return;
    const cel = F.fazCelular();
    cel.visible = false;
    filmadora.rig.c.add(cel);
    filmadora.est.busy = 'filmar';
    filmadora.est.filmagem = { cel, t0: performance.now() / 1000, alvo: alvoNome };
    filmagemAtiva = filmadora.nome;
  }
  function atualizarFilmagem(p, t) {
    const Fm = p.est.filmagem, r = p.rig, b = t - Fm.t0;
    const SOBE = 0.15, NO_AR = 0.65, DESCE = FIM + 0.1, FIM_F = DESCE + 0.5;
    if (b >= FIM_F) {
      Fm.cel.parent && Fm.cel.parent.remove(Fm.cel);
      p.est.filmagem = null;
      p.est.busy = null;
      filmagemAtiva = null;
      resetarPose(p);
      return;
    }
    /* braço de fora, celular na altura do rosto */
    const alto = V(r.s * 0.3, 1.36, 0.34);
    const k = b < SOBE ? 0 : b < NO_AR ? suaviza((b - SOBE) / (NO_AR - SOBE)) : b < DESCE ? 1 : 1 - suaviza((b - DESCE) / (FIM_F - DESCE));
    const alvoP = new THREE.Vector3().lerpVectors(r.T0, alto, k);
    alvoP.y += k * Math.sin(b * 2.3) * 0.004;
    const punho = F.ik(r, alvoP);
    Fm.cel.visible = k > 0.02;
    Fm.cel.position.set(punho.x, punho.y + 0.09, punho.z + 0.01);
    /* a lente (atrás do celular) aponta para quem está comendo; a tela fica virada para a Jana */
    const alvoPessoa = porNome.get(Fm.alvo);
    let yaw = r.s * 0.45;
    if (alvoPessoa) {
      const mira = new THREE.Vector3(), cel = new THREE.Vector3();
      alvoPessoa.rig.cab.getWorldPosition(mira);
      Fm.cel.getWorldPosition(cel);
      Fm.cel.lookAt(cel.multiplyScalar(2).sub(mira));
      const loc = r.c.worldToLocal(mira.clone());
      yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(loc.x, loc.z)));   /* a Jana vira a cabeça para a Lika */
    } else {
      Fm.cel.lookAt(r.c.localToWorld(V(0, 1.47, 0.1)));
    }
    Fm.cel.scale.setScalar(1.3 * Math.max(0.001, Math.min(1, k * 1.5)));
    Fm.cel.userData.rec.visible = k > 0.9 && (b * 1.6) % 1 < 0.6;
    p.est.cabX = 0.1 * k;
    p.est.cabY = yaw * k;
    aplicarPose(p);
  }

  /* ----------------------------------------------------- fuga do armário */

  /* velocidades em m/s */
  const VEL_FUGITIVO = 3.5;
  const VEL_PERSEGUIDOR = 3.8;   /* teto: ele desacelera se for preciso para chegar depois do fugitivo */
  const VEL_VOLTA = 6;           /* o perseguidor volta disparado da saída até a cadeira (~5 s) */
  const CHEGA_DEPOIS = 0.6;      /* s: quanto depois do fugitivo o perseguidor chega na saída */

  function iniciarFuga() {
    if (fuga) return { ok: false, msg: 'A fuga ainda está acontecendo.' };
    const A = PONTOS.armarioJuridico, S = PONTOS.saida;
    const inicio = maisPerto(grade, A.x - 1.0, A.z, 2) || { x: A.x - 1.0, z: A.z };
    const c = F.fazCorredor({ pele: '#E9B99A', camisa: '#F2F0EA', calca: '#4A4F57', gordo: true, esc: 0.9, cabeca: F.cabecaGordo });
    const esq = F.carregarEsqueleto(c);
    c.g.userData.fugitivo = true;
    fuga = { pendentes: 0, t0: performance.now() / 1000 };
    fuga.pendentes++;
    const w0 = criarPasseio({
      c, pontos: rotaAte(inicio, S), vel: VEL_FUGITIVO, amp: 1, atraso: 0.4, esq,
      aoChegar: () => {
        fuga.pendentes--;
        if (fuga.espera) { fuga.espera.quem.est.busy = null; fuga.espera = null; fuga.pendentes--; }   /* nunca passou por ele */
        verificarFim();
      },
    });
    fuga.fugitivo = w0;
    /* o perseguidor espera sentado e só sai correndo quando o fugitivo passa por ele */
    const quem = pessoas.find(p => p.flags.perseguidor && !p.est.busy);
    if (quem) {
      quem.est.busy = 'fuga';
      fuga.espera = { quem, dMin: Infinity };
      fuga.pendentes++;
    }
    return { ok: true };
  }
  /** Solta o perseguidor: pulo, cabeça dele, corre até a saída. */
  function soltarPerseguidor(quem) {
    const l = LUGAR.get(quem.lugar), S = PONTOS.saida;
    quem.g.visible = false;
    const cp = F.fazCorredor({ pele: quem.p.pele, camisa: quem.p.camisa, calca: '#3A3F47', esc: quem.p.altura || 0.86, cabeca: F.cabecaDe(quem.rig.cab) });
    cp.g.userData.pessoa = quem.nome;
    const a = ancora(l), e0 = entradaDe(l);
    const atraso = 0.2;
    const w = criarPasseio({
      c: cp, pontos: [a, e0, ...(caminho(grade, e0, S) || [S])], vel: VEL_PERSEGUIDOR, amp: 1, atraso, pulo: true,
      aoChegar: () => { fuga.pendentes--; voltarParaCadeira(quem); verificarFim(); },
    });
    /* ele sempre chega na saída depois do fugitivo: se correndo no teto
       chegaria antes, corre um pouco mais devagar */
    const f = fuga.fugitivo;
    if (f && !f.fim) {
      const agora = performance.now() / 1000;
      const faltaFugitivo = Math.max(0, f.t0 - agora) + (f.total - f.d) / f.vel;
      const tempo = faltaFugitivo + CHEGA_DEPOIS - atraso;
      if (tempo > 0) w.vel = Math.min(VEL_PERSEGUIDOR, w.total / tempo);
    }
  }
  /** O fugitivo passou por trás dele? (a menos de 3 m, ou já passou do ponto mais perto) */
  function verificarPerseguidor() {
    const e = fuga && fuga.espera, w = fuga && fuga.fugitivo;
    if (!e || !w || w.d <= 0 || w.fim) return;
    const P = posicaoNoPasseio(w), l = LUGAR.get(e.quem.lugar);
    const d = Math.hypot(P.x - l.x, P.z - l.z);
    const jaPassou = d > e.dMin + 0.3 && e.dMin < 7;
    e.dMin = Math.min(e.dMin, d);
    if (d < 3 || jaPassou) { fuga.espera = null; soltarPerseguidor(e.quem); }
  }
  /** O perseguidor volta da Saída Norte até a cadeira dele. */
  function voltarParaCadeira(p) {
    const l = LUGAR.get(p.lugar);
    const c = F.fazCorredor({ pele: p.p.pele, camisa: p.p.camisa, calca: '#3A3F47', esc: p.p.altura || 0.86, cabeca: F.cabecaDe(p.rig.cab) });
    c.g.userData.pessoa = p.nome;
    const S = PONTOS.saida, e0 = entradaDe(l);
    fuga.pendentes++;
    criarPasseio({
      c, pontos: [S, ...(caminho(grade, S, e0) || [e0]), ancora(l)], vel: VEL_VOLTA, amp: 1,
      aoChegar: () => { sentar(p, p.lugar); fuga.pendentes--; verificarFim(); },
    });
  }
  function verificarFim() {
    if (fuga && fuga.pendentes <= 0) fuga = null;
  }

  /* -------------------------------------------------------- discoteca */

  function garantirDisco() {
    if (disco.piso) return;
    /* luz colorida no piso inteiro (do fundo da recepção à fachada): uma camada só, sem luzes novas, para não pesar no celular */
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const x = cv.getContext('2d');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const gr = x.createRadialGradient(i * 64 + 32, j * 64 + 32, 0, i * 64 + 32, j * 64 + 32, 36);
      gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(i * 64, j * 64, 64, 64);
    }
    const texPiso = new THREE.CanvasTexture(cv);
    texPiso.wrapS = texPiso.wrapT = THREE.RepeatWrapping;
    texPiso.repeat.set(17, 15);
    /* dois retângulos com o mesmo material, só onde há piso: o corpo do andar e a ala da recepção */
    disco.pisoMat = new THREE.MeshBasicMaterial({ map: texPiso, color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const piso = new THREE.Group();
    for (const [x0, z0, x1, z1] of [[SALA.x0, SALA.z0, SALA.x1, SALA.z1], [-18.5, -3.6, SALA.x0, 28]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), disco.pisoMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
      m.renderOrder = 1;
      piso.add(m);
    }
    piso.visible = false;
    cena.add(piso);
    disco.piso = piso;
    const tex = texturaGlobo();
    const globo = F.fazGlobo(tex);
    globo.grupo.position.copy(DISCO);
    globo.grupo.visible = false;
    cena.add(globo.grupo);
    disco.globo = globo;
    const N = 170, R = sorteio(11);
    for (let k = 0; k < N; k++) {
      let v;
      do { v = V(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.05);
      disco.dirs.push(v.normalize());
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    disco.pontos = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.35, map: texturaPonto(), vertexColors: true, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    disco.pontos.frustumCulled = false;
    disco.pontos.visible = false;
    cena.add(disco.pontos);
  }
  /** Escurece a luz geral do andar com a festa (como numa boate) e devolve ao desligar. */
  function escurecerAndar(m, tom) {
    if (!disco.base) {
      disco.base = [];
      cena.traverse(o => { if (o.isHemisphereLight || o.isDirectionalLight) disco.base.push([o, o.intensity, o.color.clone()]); });
    }
    disco.base.forEach(([o, v, c]) => {
      o.intensity = v * (1 - 0.7 * m);
      o.color.copy(c);
      if (tom) o.color.lerp(tom, 0.55 * m);
    });
  }
  function alternarDisco() {
    garantirDisco();
    const ligar = disco.alvo === 0;
    disco.alvo = ligar ? 1 : 0;
    if (ligar) {
      disco.t0 = performance.now() / 1000;
      andar.voar(V(33, 45, 40), V(33, 0, 20), 900);
    }
    return ligar;
  }
  function atualizarDisco(t) {
    if (!disco.piso) return false;
    const dt = Math.min(0.5, t - (disco.ult || t));
    disco.ult = t;
    disco.mix += (disco.alvo - disco.mix) * Math.min(1, dt * 2.2);
    if (Math.abs(disco.mix - disco.alvo) < 0.002) disco.mix = disco.alvo;
    const m = disco.mix;
    escurecerAndar(m, null);
    if (m <= 0.001 && disco.alvo === 0) {
      disco.globo.grupo.visible = false;
      disco.pontos.visible = false;
      disco.piso.visible = false;
      pessoas.forEach(p => { if (p.dancando) { p.dancando = false; if (!p.est.busy) resetarPose(p); } });
      pararVisitantes();
      return false;
    }
    const batida = (t - disco.t0) * BPM / 60;
    const pulso = Math.exp(-(batida % 1) * 5);
    const cor = CORES_DISCO[Math.floor(batida) % CORES_DISCO.length];
    disco.globo.grupo.visible = true;
    disco.globo.grupo.scale.setScalar(1.6);
    disco.pontos.visible = true;
    disco.globo.esfera.rotation.y += dt * 0.5;
    /* o piso inteiro pisca na cor da batida e a luz geral toma um tom dela */
    disco.piso.visible = true;
    disco.pisoMat.color.setHex(cor);
    disco.pisoMat.opacity = m * (0.55 + 0.35 * pulso);
    disco.pisoMat.map.offset.set((t * 0.08) % 1, Math.sin(t * 0.7) * 0.25);
    escurecerAndar(m, new THREE.Color(cor));
    /* pontinhos: o raio do globo que bate nas paredes, no chão e no teto */
    const pos = disco.pontos.geometry.attributes.position, col = disco.pontos.geometry.attributes.color;
    const hit = new THREE.Vector3(), c = new THREE.Color();
    const globoWorld = DISCO;
    disco.dirs.forEach((d, k) => {
      bateNaSala(globoWorld, d, hit);
      pos.setXYZ(k, hit.x, hit.y, hit.z);
      c.setHex(CORES_DISCO[(k + Math.floor(batida)) % CORES_DISCO.length]);
      col.setXYZ(k, c.r * m * (0.4 + 0.6 * pulso), c.g * m * (0.4 + 0.6 * pulso), c.b * m * (0.4 + 0.6 * pulso));
    });
    pos.needsUpdate = true; col.needsUpdate = true;
    disco.pontos.material.opacity = 0.7 * m;
    /* quem está sentado dança (os que estão com o sanduíche ou a xícara não) */
    pessoas.forEach(p => {
      if (p.est.busy) return;
      const e = p.est, r = p.rig;
      if (m < 0.5) return;
      const pu = Math.abs(Math.sin(batida * Math.PI));
      F.ik(r, V(r.s * 0.33, 1.1 + 0.28 * pu, 0.26));
      e.cabZ = 0.08 * Math.sin(batida * Math.PI * 2 + p.i);
      if (r.c) r.c.position.y = p.baseY + 0.02 * pu;
      aplicarPose(p);
      p.dancando = true;
    });
    pessoas.forEach(p => {
      if (p.dancando && (m < 0.5 || p.est.busy)) { p.dancando = false; if (!p.est.busy) resetarPose(p); }
    });
    /* os visitantes desenhados completos (perto da câmera) dançam igual aos fixos;
       os de longe são o boneco simples, sem braço solto */
    if (m < 0.5) pararVisitantes();
    else {
      const rigs = (andar.multidao && andar.multidao.rigsDetalhados) ? andar.multidao.rigsDetalhados() : [];
      const pu = Math.abs(Math.sin(batida * Math.PI));
      rigs.forEach((r, k) => {
        if (!visitantesDancando.has(r)) visitantesDancando.set(r, r.c ? r.c.position.y : 0);
        F.ik(r, V(r.s * 0.33, 1.1 + 0.28 * pu, 0.26));
        if (r.cab) r.cab.rotation.set(0, 0, 0.08 * Math.sin(batida * Math.PI * 2 + k));
        if (r.c) r.c.position.y = visitantesDancando.get(r) + 0.02 * pu;
      });
    }
    return true;
  }

  /** Volta à pose de trabalho todo visitante que dançou (inclusive os que já saíram de perto). */
  function pararVisitantes() {
    for (const [r, baseY] of visitantesDancando) {
      F.ik(r, r.T0);
      if (r.cab) r.cab.rotation.set(0, 0, 0);
      if (r.c) r.c.position.y = baseY;
    }
    visitantesDancando.clear();
  }

  /* ----------------------------------------------------- quadro e ponto */

  function criarMoveis() {
    /* porta da Saída Norte: a folha abre quando alguém passa */
    const porta = F.fazPorta();
    porta.grupo.position.set(PONTOS.saida.x, 0, PONTOS.saida.z);
    cena.add(porta.grupo);
    /* quadro: o desenho do quadrão fica por cima do quadro branco da planta */
    const cv = document.createElement('canvas');
    cv.width = 2048; cv.height = Math.round(2048 * 608 / 3360);   /* mesma proporção do quadro.js */
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    desenharQuadro(cv).then(() => { tex.needsUpdate = true; }).catch(() => {});
    const quadro = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.6 * 608 / 3360), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32 }));
    quadro.position.set(PONTOS.quadro.x, QUADRO_Y, PONTOS.quadro.z + 0.03);
    cena.add(quadro);
    /* área de clique do armário (o armário é parte do cenário mesclado, então a
       área é invisível e fica no ponto nomeado) */
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 1.4),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.set(PONTOS.armarioJuridico.x - 0.1, 1.05, PONTOS.armarioJuridico.z);
    hit.userData.acao = 'armario';
    cena.add(hit);
    return { porta, quadro, hit };
  }
  const moveis = criarMoveis();

  /** Reposiciona o que é preso a um ponto nomeado. */
  function reposicionarPontos() {
    moveis.porta.grupo.position.set(PONTOS.saida.x, 0, PONTOS.saida.z);
    moveis.quadro.position.set(PONTOS.quadro.x, QUADRO_Y, PONTOS.quadro.z + 0.03);
    moveis.hit.position.set(PONTOS.armarioJuridico.x - 0.1, 1.05, PONTOS.armarioJuridico.z);
  }

  /* ----------------------------------------------- preparação das pessoas */

  for (const p of pessoas) {
    p.est = { busy: null, destino: null, lanche: null, filmagem: null, cabX: 0, cabY: 0, cabZ: 0, boca: 1 };
    p.baseY = p.rig.c.position.y;
    p.g.userData.pessoa = p.nome;
    if (p.flags.acumulador) {
      p.pilha = F.fazPilha(sorteio(97 + p.i));
      cena.add(p.pilha);
    }
    if (p.flags.retrato) {
      p.retrato = F.fazPortaRetrato(p.flags.retrato);
      cena.add(p.retrato);
    }
    reancorarMesa(p);
    resetarPose(p);
  }

  /* ---------------------------------------------------- atualização */

  /** Avança tudo o que está animando. Devolve true se algo mexeu (para redesenhar). */
  function atualizar(t, dt) {
    let ativo = false;
    if (passeios.length) { ativo = true; avancarPasseios(t, dt); }
    for (const p of pessoas) {
      if (p.est.lanche) { ativo = true; atualizarLanche(p, t); }
      if (p.est.filmagem) { ativo = true; atualizarFilmagem(p, t); }
    }
    if (disco.piso) {
      const mexeu = atualizarDisco(t);
      if (mexeu || disco.alvo !== disco.mix) ativo = true;
    }
    if (fuga) {
      ativo = true;
      verificarPerseguidor();
      const alvo = alguemPertoDaSaida() ? 1 : 0;
      moveis.porta.pv.rotation.y += (-1.5 * alvo - moveis.porta.pv.rotation.y) * Math.min(1, dt * 6);
    } else if (Math.abs(moveis.porta.pv.rotation.y) > 0.001) {
      ativo = true;
      moveis.porta.pv.rotation.y += (0 - moveis.porta.pv.rotation.y) * Math.min(1, dt * 3);
    }
    return ativo;
  }

  /** Clique num objeto da cena. Devolve {ok, msg} para o painel mostrar. */
  function clicar(obj) {
    let o = obj;
    while (o && !o.userData.pessoa && !o.userData.acao) o = o.parent;
    if (!o) return null;
    if (o.userData.acao === 'armario') return iniciarFuga();
    const p = porNome.get(o.userData.pessoa);
    if (!p) return null;
    if (p.flags.sanduiche) return comerSanduiche(p);
    return { ok: false, msg: `${p.nome}: sem piada ao clicar.` };
  }

  /** O que cada piada está presa, para o painel mostrar e checar. */
  function resumo() {
    const pe = nome => { const p = porNome.get(nome); return p ? `${nome} · cadeira ${p.lugar}` : `${nome} · (sumiu)`; };
    const fmt = q => `(${q.x.toFixed(1)}, ${q.z.toFixed(1)})`;
    const dancando = pessoas.filter(p => p.dancando).length;
    return [
      { piada: 'Sanduíche + filmagem', onde: `${pe('Lika')} · filma: ${pe('Jana')}`, ok: porNome.has('Lika') && porNome.has('Jana') },
      { piada: 'Fuga do armário', onde: `armário ${fmt(PONTOS.armarioJuridico)} → Saída Norte ${fmt(PONTOS.saida)} · perseguidor: ${pe('Sem sangue')}`, ok: porNome.has('Sem sangue') },
      { piada: 'Pilha de papel', onde: pe('Elton'), ok: !!porNome.get('Elton')?.pilha },
      { piada: 'Porta-retrato "Dani"', onde: pe('Sem sangue'), ok: !!porNome.get('Sem sangue')?.retrato },
      { piada: 'Discoteca', onde: `globo ${fmt(DISCO)} · dançando agora: ${dancando}`, ok: true },
      { piada: 'Quadro branco', onde: `quadro em ${fmt(PONTOS.quadro)}`, ok: true },
    ];
  }

  return {
    atualizar, clicar, resumo, andarPara, comerSanduiche, alternarDisco, iniciarFuga,
    reposicionarPontos, reancorarMesa, sentar, resetarPose,
    get fugaAtiva() { return !!fuga; },
    get discoLigada() { return disco.alvo === 1; },
    get filmando() { return filmagemAtiva; },
    get pessoasAndando() { return passeios.length; },
    get alvosClique() { return [moveis.hit]; },
    get discoMix() { return disco.mix; },
    get dancando() { return pessoas.filter(p => p.dancando).length; },
    get passeiosInfo() { return passeios.map(w => ({ d: +w.d.toFixed(2), total: +w.total.toFixed(2), n: w.seg.length, t0: +w.t0.toFixed(2), fim: w.fim, vel: w.vel })); },
  };
}
