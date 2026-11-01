// Bancadas, monitores e cadeiras com instancing: as 508 cadeiras são
// desenhadas numa chamada só, os 54 tampos em outra, e assim por diante.
// Medidas iguais às da bancada da planta original.
import * as THREE from 'three';
import { BANCADAS, BANCADA } from '../planta/dados.js';
import { LUGARES } from '../planta/lugares.js';

const caixaUnit = new THREE.BoxGeometry(1, 1, 1);
const cilUnit = new THREE.CylinderGeometry(1, 1, 1, 10);

function instanciado(geo, material, total, sombra) {
  const m = new THREE.InstancedMesh(geo, material, total);
  m.castShadow = sombra;
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  m.frustumCulled = false; /* r128 não calcula o volume das instâncias */
  m.count = 0;
  return m;
}

/**
 * @param M materiais do cenário (woodLight, white, dark, chair)
 * @returns {THREE.Group}
 */
export function montarMoveis(M) {
  const nB = BANCADAS.length, nL = LUGARES.length;
  const tampos = instanciado(caixaUnit, M.woodLight, nB, true);
  const brancos = instanciado(caixaUnit, M.white, nB * 4, true);
  const telas = instanciado(caixaUnit, M.dark, nL * 2, true);
  const assentos = instanciado(caixaUnit, M.chair, nL * 2, true);
  const pes = instanciado(cilUnit, M.chair, nL * 2, false);

  const base = new THREE.Object3D(), peca = new THREE.Object3D();
  const por = (malha, lx, cy, lz, sx, sy, sz) => {
    peca.position.set(lx, cy, lz);
    peca.scale.set(sx, sy, sz);
    peca.updateMatrix();
    peca.matrix.premultiply(base.matrix);
    malha.setMatrixAt(malha.count++, peca.matrix);
  };

  for (const b of BANCADAS) {
    const len = b.lugares * BANCADA.passo;
    base.position.set(b.x, 0, b.z);
    base.rotation.set(0, b.eixo === 'z' ? Math.PI / 2 : 0, 0);
    base.updateMatrix();
    /* no referencial da bancada: comprimento em x, cadeiras em ±z */
    por(tampos, 0, 0.74, 0, len, 0.04, BANCADA.profundidade);
    for (const lx of [-len / 2 + 0.06, 0, len / 2 - 0.06]) por(brancos, lx, 0.36, 0, 0.06, 0.72, 1.5);
    por(brancos, 0, 0.94, 0, len, 0.36, 0.03);
    for (let i = 0; i < b.lugares; i++) {
      const x = -len / 2 + BANCADA.passo / 2 + i * BANCADA.passo;
      for (const s of [-1, 1]) {
        por(telas, x, 1.13, s * 0.22, 0.56, 0.34, 0.03);
        por(telas, x, 0.87, s * 0.22, 0.06, 0.22, 0.06);
        const cz = s * BANCADA.afastamentoCadeira;
        por(pes, x, 0.07, cz, 0.28, 0.04, 0.28);
        por(pes, x, 0.27, cz, 0.03, 0.38, 0.03);
        por(assentos, x, 0.48, cz, 0.5, 0.08, 0.5);
        por(assentos, x, 0.825, cz + s * 0.26, 0.48, 0.55, 0.06);
      }
    }
  }

  const g = new THREE.Group();
  for (const m of [tampos, brancos, telas, assentos, pes]) {
    m.instanceMatrix.needsUpdate = true;
    g.add(m);
  }
  return g;
}
