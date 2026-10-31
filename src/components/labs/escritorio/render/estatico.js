// Junta as peças estáticas de um grupo em poucas malhas, uma por material.
// O cenário do andar tem milhares de caixas; desenhadas uma a uma, cada
// quadro custaria milhares de chamadas à placa de vídeo. Mescladas, viram
// algumas dezenas.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* Mantém só os atributos que todas as peças têm em comum. */
function normalizar(geo, comUV) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const nome of Object.keys(g.attributes)) {
    if (nome === 'position' || nome === 'normal' || (comUV && nome === 'uv')) continue;
    g.deleteAttribute(nome);
  }
  if (comUV && !g.attributes.uv) return null;
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

/**
 * Troca o conteúdo de `grupo` por malhas mescladas. Peças com textura,
 * linhas e sprites ficam como estão.
 * @returns {{antes:number, depois:number}} quantidade de malhas
 */
export function mesclarEstatico(grupo) {
  grupo.updateMatrixWorld(true);
  const porMaterial = new Map();
  const manter = [];
  let antes = 0;

  grupo.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) {
      if (o !== grupo && (o.isLine || o.isPoints || o.isSprite || o.isInstancedMesh)) manter.push(o);
      return;
    }
    antes++;
    if (o.material.map) { manter.push(o); return; }
    const g = normalizar(o.geometry, false);
    if (!g) { manter.push(o); return; }
    g.applyMatrix4(o.matrixWorld);
    const chave = o.material.uuid + (o.castShadow ? ':s' : ':n');
    if (!porMaterial.has(chave)) porMaterial.set(chave, { material: o.material, sombra: o.castShadow, geos: [] });
    porMaterial.get(chave).geos.push(g);
  });

  /* quem fica separado é reposicionado direto no grupo, já com a posição de mundo */
  const soltos = manter.map(o => {
    o.updateMatrixWorld(true);
    const m = o.matrixWorld.clone();
    return { o, m };
  });

  grupo.clear();

  for (const { material, sombra, geos } of porMaterial.values()) {
    const geo = BufferGeometryUtils.mergeBufferGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!geo) continue;
    const malha = new THREE.Mesh(geo, material);
    malha.castShadow = sombra && !material.transparent;
    malha.receiveShadow = !material.transparent;
    malha.matrixAutoUpdate = false;
    grupo.add(malha);
  }
  for (const { o, m } of soltos) {
    o.matrix.copy(m);
    o.matrix.decompose(o.position, o.quaternion, o.scale);
    o.matrixAutoUpdate = false;
    o.updateMatrix();
    grupo.add(o);
  }
  return { antes, depois: grupo.children.length };
}
