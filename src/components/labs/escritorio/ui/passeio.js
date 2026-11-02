// Modo boneco (tipo o bonequinho do Street View): arrasta o boneco para o
// chão e a câmera desce para a altura dos olhos. Anda com setas/WASD ou
// clicando no chão (no computador) e com o joystick ou tocando no chão (no
// celular); arrastar a tela olha em volta. Paredes, vidros, bancadas e
// cadeiras seguram o passo (render/colisao.js); degraus baixos (arquibancada,
// palquinho) ele sobe, e a câmera acompanha a altura do chão. Esc ou "Sair"
// volta à planta.
// Noclip (ligado de saída; N ou o botão alterna, vale também na câmera
// orbital — ver render/andar.js): a visão atravessa paredes
// e móveis e voa livre — anda para onde olha (inclusive para cima e para
// baixo), Espaço/E sobe e Q/C desce. Desligando, o boneco volta ao chão
// livre mais perto.
import * as THREE from 'three';
import { mover, maisPerto, caminho, podeFicar, pontoEspacoso, direcaoAberta, altura, pontoNaSuperficie } from '../render/colisao.js';

export const OLHOS = 1.55;        /* altura da câmera, em metros */
const VEL = 1.7, CORRENDO = 3.4;  /* m/s */
const GIRO = 1.9;                 /* rad/s nas setas e no joystick */
const OLHAR = 0.0055;             /* rad por pixel arrastado com o dedo */
const OLHAR_MOUSE = 0.0042;       /* rad por pixel que o mouse anda (sem apertar) */
const SALTO = 250;                /* px num evento só com o cursor travado: acima disso é salto falso */
const BORDA = 0.1;                /* faixa de cada lado da tela onde o olhar continua virando */
const GIRO_BORDA = 1.5;           /* rad/s no fundo da faixa */
const ALCANCE = 6;                /* o "+" aparece em volta deste ponto à frente */

const FIGURA = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.2" r="3.2"/><path d="M7.6 10.4c0-1.2 1-2.1 2.2-2.1h4.4c1.2 0 2.2.9 2.2 2.1v5.2c0 .7-.6 1.2-1.2 1.2h-.6l-.5 4.6c-.1.6-.6 1-1.2 1h-1.8c-.6 0-1.1-.4-1.2-1l-.5-4.6h-.6c-.7 0-1.2-.5-1.2-1.2z"/></svg>';

function el(tag, attrs = {}, html) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'texto') e.textContent = v;
    else if (k === 'classe') e.className = v;
    else e.setAttribute(k, v);
  }
  if (html) e.innerHTML = html;
  return e;
}

/**
 * @param palco   elemento do andar (o canvas está dentro)
 * @param andar   o que criarAndar devolve
 * @param opcoes.avisar(texto)  mensagem curta na tela
 * @param opcoes.aoMudar(ativo) entrou ou saiu do modo boneco
 * @param opcoes.aoClicar(cx, cy) clique sem arrastar; true se ele foi usado
 *                        (o armário da fuga, por exemplo)
 */
export function criarPasseio(palco, andar, { avisar = () => {}, aoMudar = () => {}, aoClicar = () => false } = {}) {
  const g = andar.colisao, camera = andar.camera, alvo = andar.controles.target;
  const toqueFino = matchMedia('(pointer: fine)');

  /* ---- marca no chão (onde vai cair / para onde está indo) ---- */
  const corDestaque = () => getComputedStyle(palco).getPropertyValue('--accent').trim() || '#24306b';
  const marca = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 32), new THREE.MeshBasicMaterial({ color: corDestaque(), transparent: true, opacity: 0.95, depthWrite: false }));
  marca.rotation.x = -Math.PI / 2;
  marca.renderOrder = 3;
  marca.visible = false;
  andar.cena.add(marca);
  function mostrarMarca(p) {
    marca.visible = Boolean(p);
    if (p) { marca.position.set(p.x, altura(g, p.x, p.z) + 0.03, p.z); marca.material.color.set(corDestaque()); }
    andar.marcar();
  }

  /* ---- interface ---- */
  const boneco = el('button', { type: 'button', classe: 'pegman', 'aria-label': 'Modo boneco: arraste para o chão para andar pelo escritório', title: 'Arraste para o chão para andar' }, FIGURA);
  const fantasma = el('div', { classe: 'pegman-fantasma', 'aria-hidden': 'true' }, FIGURA);
  fantasma.hidden = true;
  const sair = el('button', { type: 'button', classe: 'pa-sair', texto: 'Sair do modo boneco' });
  sair.hidden = true;
  const noclip = el('button', { type: 'button', classe: 'pa-noclip', 'aria-pressed': 'true', title: 'Atravessar paredes e voar (N)' });
  const ajuda = el('p', { classe: 'pa-ajuda' });
  ajuda.hidden = true;
  /* no computador: as teclas no meio da tela, até apertar qualquer uma */
  const tecla = (t, seta, extra = '') => `<span class="pa-tecla${extra}"><b>${t}</b>${seta ? `<i aria-hidden="true">${seta}</i>` : ''}</span>`;
  const teclasAjuda = el('div', {
    classe: 'pa-teclas', role: 'img',
    'aria-label': 'Teclas do modo boneco: W para frente, A para a esquerda, S para trás, D para a direita, Shift corre, Esc solta o mouse e, de novo, sai',
  }, `<div class="pa-wasd">${tecla('W', '↑', ' pa-w')}${tecla('A', '←', ' pa-a')}${tecla('S', '↓')}${tecla('D', '→')}</div>`
    + `<div class="pa-extra"><span>${tecla('Shift', '', ' pa-larga')} corre</span><span>${tecla('Esc', '', ' pa-larga')} solta o mouse · de novo sai</span></div>`
    + `<div class="pa-extra"><span>${tecla('N', '', ' pa-larga')} noclip</span><span>${tecla('Espaço', '', ' pa-larga')} sobe</span><span>${tecla('Q', '', ' pa-larga')} desce</span></div>`);
  teclasAjuda.hidden = true;
  const joy = el('div', { classe: 'pa-joy', 'aria-hidden': 'true' });
  const pino = el('div', { classe: 'pa-pino' });
  joy.appendChild(pino);
  joy.hidden = true;
  /* mirinha no centro (mouse): o cursor some e o clique vale onde ela aponta */
  const mira = el('div', { classe: 'pa-mira', 'aria-hidden': 'true' });
  mira.hidden = true;
  palco.append(boneco, fantasma, sair, noclip, ajuda, teclasAjuda, joy, mira);

  /* ---- estado ---- */
  let ativo = false;
  const atravessa = () => andar.noclip;   /* noclip: sem colisão, voo livre */
  let x = 0, z = 0, y = OLHOS, giro = 0, inclina = -0.08;
  const teclas = new Set();
  let joyX = 0, joyY = 0;
  let rota = null;           /* [{x,z}] para onde está indo (irAte) */
  let mexido = true;

  function aplicarCamera() {
    camera.position.set(x, y, z);
    const c = Math.cos(inclina);
    camera.lookAt(x + Math.sin(giro) * c, y + Math.sin(inclina), z + Math.cos(giro) * c);
    /* o alvo da órbita fica no chão à frente: é em volta dele que surgem os "+" */
    alvo.set(x + Math.sin(giro) * ALCANCE, 0, z + Math.cos(giro) * ALCANCE);
  }

  function quadro(dt) {
    let mudou = mexido;
    mexido = false;
    const corre = teclas.has('Shift');
    const frente = (teclas.has('ArrowUp') || teclas.has('w') ? 1 : 0) - (teclas.has('ArrowDown') || teclas.has('s') ? 1 : 0) + joyY;
    const lado = (teclas.has('d') ? 1 : 0) - (teclas.has('a') ? 1 : 0);
    const vira = (teclas.has('ArrowLeft') ? 1 : 0) - (teclas.has('ArrowRight') ? 1 : 0) - joyX;
    const sobe = atravessa() ? (teclas.has('sobe') ? 1 : 0) - (teclas.has('desce') ? 1 : 0) : 0;
    if (frente || lado || vira || sobe) { rota = null; mostrarMarca(null); }

    if (vira) { giro += vira * GIRO * dt; mudou = true; }
    if (borda) { giro -= borda * GIRO_BORDA * dt; mudou = true; }
    if (atravessa() && (frente || lado || sobe)) {
      /* noclip: anda para onde olha, atravessando tudo */
      const v = (corre ? CORRENDO * 2 : VEL * 1.6) * dt;
      const f = Math.max(-1, Math.min(1, frente)), l = Math.max(-1, Math.min(1, lado));
      const c = Math.cos(inclina);
      x += (Math.sin(giro) * c * f - Math.cos(giro) * l) * v;
      z += (Math.cos(giro) * c * f + Math.sin(giro) * l) * v;
      y += (Math.sin(inclina) * f + sobe) * v;
      mudou = true;
    } else if (frente || lado) {
      const v = (corre ? CORRENDO : VEL) * dt;
      const f = Math.max(-1, Math.min(1, frente)), l = Math.max(-1, Math.min(1, lado));
      const dx = (Math.sin(giro) * f - Math.cos(giro) * l) * v;
      const dz = (Math.cos(giro) * f + Math.sin(giro) * l) * v;
      const p = mover(g, x, z, dx, dz);
      if (p.x !== x || p.z !== z) { x = p.x; z = p.z; mudou = true; }
    } else if (rota) {
      /* segue o caminho, virando aos poucos para onde anda */
      const p = rota[0], dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      const passo = VEL * 1.2 * dt;
      const quer = Math.atan2(dx, dz);
      let dif = Math.atan2(Math.sin(quer - giro), Math.cos(quer - giro));
      giro += Math.max(-GIRO * 2 * dt, Math.min(GIRO * 2 * dt, dif));
      if (d <= passo) { x = p.x; z = p.z; rota.shift(); if (!rota.length) { rota = null; mostrarMarca(null); } }
      else {
        const q = mover(g, x, z, (dx / d) * passo, (dz / d) * passo);
        if (q.x === x && q.z === z) { rota = null; mostrarMarca(null); }   /* travou: desiste */
        x = q.x; z = q.z;
      }
      mudou = true;
    }
    /* sobe e desce degrau com suavidade (no noclip a altura é livre) */
    if (!atravessa()) {
      const yAlvo = altura(g, x, z) + OLHOS;
      if (Math.abs(yAlvo - y) > 0.002) { y += (yAlvo - y) * Math.min(1, dt * 9); mudou = true; }
      else if (y !== yAlvo) { y = yAlvo; mudou = true; }
    }
    if (mudou) aplicarCamera();
    return mudou;
  }

  /* ---- noclip ---- */
  function mostrarNoclip() {
    noclip.textContent = atravessa() ? 'Noclip: ligado' : 'Noclip: desligado';
    noclip.setAttribute('aria-pressed', String(atravessa()));
  }
  mostrarNoclip();
  /* o estado é do andar: vale na órbita e no modo boneco */
  function alternarNoclip(liga = !atravessa()) { andar.definirNoclip(liga); }
  andar.aoMudarNoclip(liga => {
    teclas.delete('sobe'); teclas.delete('desce');
    mostrarNoclip();
    if (!ativo) { avisar(liga ? 'Noclip ligado: a câmera passa por baixo do chão e atravessa tudo.' : 'Noclip desligado.'); return; }
    if (!liga) {
      /* volta para o chão livre mais perto; a altura desce suave no quadro */
      const p = maisPerto(g, x, z, 40) || pontoEspacoso(g, x, z, 40);
      if (p) { x = p.x; z = p.z; }
      inclina = Math.max(-1.0, Math.min(0.9, inclina));
      rota = null; mostrarMarca(null);
    }
    mexido = true;
    avisar(liga ? 'Noclip ligado: atravessa paredes e voa.' : 'Noclip desligado: as paredes seguram de novo.');
  });
  noclip.addEventListener('click', () => { alternarNoclip(); andar.renderer.domElement.focus({ preventScroll: true }); });

  /* ---- entrar e sair ---- */
  async function entrar(p) {
    if (ativo) return;
    const d = new THREE.Vector3().subVectors(alvo, camera.position);
    /* continua olhando para onde a câmera olhava, a menos que dê de cara com a parede */
    giro = direcaoAberta(g, p.x, p.z, Math.atan2(d.x, d.z));
    inclina = -0.08;
    x = p.x; z = p.z; y = altura(g, x, z) + OLHOS;
    ativo = true;
    rota = null; teclas.clear(); joyX = joyY = 0; ultimo = null; borda = 0;
    boneco.hidden = true;
    mostrarMarca(null);
    palco.classList.add('em-passeio');
    aoMudar(true);
    await andar.voar(new THREE.Vector3(x, y, z), new THREE.Vector3(x + Math.sin(giro) * ALCANCE, 0, z + Math.cos(giro) * ALCANCE), 1100);
    if (!ativo) return;
    mexido = true;
    andar.assumirCamera(quadro);
    sair.hidden = false;
    teclasAjuda.hidden = !toqueFino.matches;
    ajuda.hidden = toqueFino.matches;
    ajuda.textContent = 'Joystick para andar · arraste para olhar (no noclip, olhe para cima ou para baixo para voar)';
    joy.hidden = toqueFino.matches;
    mira.hidden = !toqueFino.matches;
    andar.renderer.domElement.focus({ preventScroll: true });
    travar();
  }

  function sairDoPasseio({ voar = true } = {}) {
    if (!ativo) return;
    ativo = false;
    soltar();
    rota = null; teclas.clear(); joyX = joyY = 0; ultimo = null; borda = 0;
    mostrarMarca(null);
    sair.hidden = ajuda.hidden = teclasAjuda.hidden = joy.hidden = mira.hidden = true;
    boneco.hidden = false;
    palco.classList.remove('em-passeio');
    andar.assumirCamera(null);
    if (voar) {
      const fx = Math.sin(giro), fz = Math.cos(giro);
      const chao = atravessa() ? Math.max(0, y - OLHOS) : altura(g, x, z);
      andar.voar(new THREE.Vector3(x - fx * 7, chao + 9, z - fz * 7), new THREE.Vector3(x + fx * 2, chao, z + fz * 2), 1000);
    }
    aoMudar(false);
  }
  sair.addEventListener('click', () => sairDoPasseio());

  /* ---- arrastar o boneco para o chão ---- */
  let arrasto = null;
  function soltarEm(cx, cy) {
    /* acerta o chão alto também: soltar em cima da arquibancada põe o boneco lá */
    const r = andar.raioEm(cx, cy);
    const p = pontoNaSuperficie(g, r.origem, r.direcao);
    return p && maisPerto(g, p.x, p.z, 0.8);
  }
  boneco.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    boneco.setPointerCapture(e.pointerId);
    arrasto = { x0: e.clientX, y0: e.clientY, longe: false, ponto: null };
  });
  boneco.addEventListener('pointermove', e => {
    if (!arrasto) return;
    if (!arrasto.longe && Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) > 6) {
      arrasto.longe = true; fantasma.hidden = false; boneco.classList.add('arrastando');
    }
    if (!arrasto.longe) return;
    const r = palco.getBoundingClientRect();
    fantasma.style.transform = `translate(${e.clientX - r.left}px,${e.clientY - r.top}px) translate(-50%,-92%)`;
    arrasto.ponto = soltarEm(e.clientX, e.clientY);
    fantasma.classList.toggle('valido', Boolean(arrasto.ponto));
    mostrarMarca(arrasto.ponto);
  });
  const fimDoArrasto = e => {
    if (!arrasto) return;
    const a = arrasto;
    arrasto = null;
    fantasma.hidden = true;
    boneco.classList.remove('arrastando');
    if (!a.longe) { entrarNoMeio(); return; }      /* só clicou: entra onde a câmera olha */
    if (e.type === 'pointerup' && a.ponto) entrar(a.ponto);
    else { mostrarMarca(null); if (e.type === 'pointerup') avisar('Solte o boneco num pedaço livre do chão.'); }
  };
  boneco.addEventListener('pointerup', fimDoArrasto);
  boneco.addEventListener('pointercancel', fimDoArrasto);
  boneco.addEventListener('click', e => { if (e.detail === 0) entrarNoMeio(); });  /* teclado/leitor de tela */

  function entrarNoMeio() {
    const p = pontoEspacoso(g, alvo.x, alvo.z, 10);
    if (p) entrar(p); else avisar('Aproxime de um corredor e tente de novo.');
  }

  /* ---- olhar ----
     Mouse: o cursor fica travado na mira (Pointer Lock) e o olhar segue o
     movimento do mouse, sem fim de tela. Esc solta o cursor (o navegador
     come esse Esc); clicar na cena trava de novo e um segundo Esc sai.
     Sem trava (navegador que não deixa), o olhar segue o cursor solto e,
     perto da borda esquerda ou direita, continua virando. Dedo: arrasta
     para olhar. Clique/toque sem arrastar só serve para as coisas da cena
     (aoClicar) e para os "+" que estiverem embaixo da mira; no chão, não
     faz nada. */
  const canvas = andar.renderer.domElement;
  let olhar = null;          /* dedo arrastando */
  let ultimo = null;         /* última posição do mouse em cima do canvas */
  let borda = 0;             /* -1..1: quanto o cursor está dentro da faixa da borda */
  let apertou = null;        /* onde o botão desceu, para separar clique de arrasto */

  const travado = () => document.pointerLockElement === canvas;
  function travar() {
    if (!ativo || !toqueFino.matches || travado() || !canvas.requestPointerLock) return;
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => mostrarTrava());
    } catch { mostrarTrava(); }
  }
  function soltar() { if (travado() && document.exitPointerLock) document.exitPointerLock(); }
  /* com o mouse: aviso fixo quando o cursor não está travado */
  function mostrarTrava() {
    if (!ativo || !toqueFino.matches) return;
    ajuda.hidden = travado();
    ajuda.textContent = 'Clique na cena para travar o mouse na mira · Esc sai';
  }
  document.addEventListener('pointerlockchange', () => {
    ultimo = null; borda = 0; apertou = null;
    mostrarTrava();
  });
  document.addEventListener('pointerlockerror', mostrarTrava);

  function virar(dx, dy, sens) {
    giro -= dx * sens;
    /* no noclip dá para olhar quase reto para cima e para baixo */
    const lim = atravessa() ? 1.5 : 1.0, limCima = atravessa() ? 1.5 : 0.9;
    inclina = Math.max(-lim, Math.min(limCima, inclina - dy * sens));
    mexido = true;
  }

  canvas.addEventListener('pointermove', e => {
    if (!ativo) return;
    if (e.pointerType === 'mouse') {
      if (travado()) {
        const mx = e.movementX || 0, my = e.movementY || 0;
        /* o Chrome às vezes manda um salto falso num evento só: ignora */
        if (Math.abs(mx) > SALTO || Math.abs(my) > SALTO) return;
        virar(mx, my, OLHAR_MOUSE);
        /* com a trava o clientX não muda: soma o quanto andou com o botão apertado */
        if (apertou) apertou.andou += Math.abs(mx) + Math.abs(my);
        return;
      }
      if (ultimo) virar(e.clientX - ultimo.x, e.clientY - ultimo.y, OLHAR_MOUSE);
      ultimo = { x: e.clientX, y: e.clientY };
      const r = canvas.getBoundingClientRect(), faixa = r.width * BORDA;
      const dx = e.clientX - r.left;
      borda = dx < faixa ? -(1 - dx / faixa) : dx > r.width - faixa ? 1 - (r.width - dx) / faixa : 0;
      return;
    }
    if (!olhar || olhar.id !== e.pointerId) return;
    virar(e.clientX - olhar.x, e.clientY - olhar.y, OLHAR);
    olhar.x = e.clientX; olhar.y = e.clientY;
  });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { ultimo = null; borda = 0; } });
  canvas.addEventListener('pointerdown', e => {
    if (!ativo || e.button !== 0) return;
    /* mouse solto: este clique só trava o cursor de novo, não vale como clique */
    if (e.pointerType === 'mouse' && toqueFino.matches && !travado() && canvas.requestPointerLock) { apertou = null; travar(); return; }
    apertou = { x: e.clientX, y: e.clientY, andou: 0 };
    if (e.pointerType !== 'mouse') {
      olhar = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (!ativo || !apertou) return;
    const clique = Math.hypot(e.clientX - apertou.x, e.clientY - apertou.y) + apertou.andou < 8;
    apertou = null; olhar = null;
    if (!clique) return;
    /* com o mouse o cursor está escondido: o clique vale no centro, onde está a mira */
    if (e.pointerType === 'mouse') {
      const r = canvas.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const mais = maisNaMira(cx, cy);
      if (mais) { mais.click(); return; }
      aoClicar(cx, cy);
    } else aoClicar(e.clientX, e.clientY);
  });
  /** O botão "+" embaixo da mira (com folga de uns pixels), ou null. */
  function maisNaMira(cx, cy, folga = 6) {
    for (const b of palco.querySelectorAll('button.mais')) {
      if (b.hidden) continue;
      const q = b.getBoundingClientRect();
      if (q.width && cx >= q.left - folga && cx <= q.right + folga && cy >= q.top - folga && cy <= q.bottom + folga) return b;
    }
    return null;
  }
  canvas.addEventListener('pointercancel', () => { olhar = null; apertou = null; });

  /* ---- teclado ---- */
  const MAPA = {
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
    w: 'w', a: 'a', s: 's', d: 'd', W: 'w', A: 'a', S: 's', D: 'd', Shift: 'Shift',
    ' ': 'sobe', e: 'sobe', E: 'sobe', q: 'desce', Q: 'desce', c: 'desce', C: 'desce',
  };
  const digitando = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const fim = new AbortController();   /* parar() solta os ouvintes da janela */
  /* fora do modo boneco o N só vale com o mouse ou o foco no andar */
  let mouseNoPalco = false;
  palco.addEventListener('pointerenter', () => { mouseNoPalco = true; });
  palco.addEventListener('pointerleave', () => { mouseNoPalco = false; });
  window.addEventListener('keydown', e => {
    if (digitando(e.target)) return;
    if ((e.key === 'n' || e.key === 'N') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey
        && (ativo || mouseNoPalco || palco.contains(document.activeElement))) {
      e.preventDefault(); teclasAjuda.hidden = true; alternarNoclip(); return;
    }
    if (!ativo) return;
    teclasAjuda.hidden = true;
    if (e.key === 'Escape') { e.preventDefault(); sairDoPasseio(); return; }
    const k = MAPA[e.key];
    if (k) { teclas.add(k); if (k !== 'Shift') e.preventDefault(); }
  }, { signal: fim.signal });
  window.addEventListener('keyup', e => { const k = MAPA[e.key]; if (k) teclas.delete(k); }, { signal: fim.signal });
  window.addEventListener('blur', () => teclas.clear(), { signal: fim.signal });

  /* ---- joystick (celular) ---- */
  let dedo = null;
  const RAIO = 44;
  const moverPino = (dx, dy) => { pino.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  joy.addEventListener('pointerdown', e => {
    e.preventDefault();
    joy.setPointerCapture(e.pointerId);
    const r = joy.getBoundingClientRect();
    dedo = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    joy.dispatchEvent(new PointerEvent('pointermove', e));
  });
  joy.addEventListener('pointermove', e => {
    if (!dedo || e.pointerId !== dedo.id) return;
    let dx = e.clientX - dedo.cx, dy = e.clientY - dedo.cy;
    const d = Math.hypot(dx, dy);
    if (d > RAIO) { dx = (dx / d) * RAIO; dy = (dy / d) * RAIO; }
    moverPino(dx, dy);
    /* zona morta pequena para não andar torto sem querer */
    const zona = v => (Math.abs(v) < 0.18 ? 0 : v);
    joyX = zona(dx / RAIO) * 0.8; joyY = zona(-dy / RAIO);
  });
  const soltarJoy = () => { dedo = null; joyX = joyY = 0; moverPino(0, 0); };
  joy.addEventListener('pointerup', soltarJoy);
  joy.addEventListener('pointercancel', soltarJoy);

  return {
    get ativo() { return ativo; },
    get posicao() { return { x, z, giro }; },
    get noclip() { return atravessa(); },
    alternarNoclip,
    entrar, sair: sairDoPasseio,
    parar() { sairDoPasseio({ voar: false }); fim.abort(); },
    /** Para testes e para a "piada" de mandar o boneco a um ponto. */
    irAte(p) { const q = maisPerto(g, p.x, p.z, 1); const r = q && caminho(g, { x, z }, q); if (r) { rota = r; mostrarMarca(q); } return Boolean(r); },
    podeFicar: (px, pz) => podeFicar(g, px, pz),
  };
}
