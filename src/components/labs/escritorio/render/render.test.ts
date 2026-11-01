import { describe, expect, test } from 'vitest'
import * as THREE from 'three'
import { montarMoveis } from './moveis.js'
import { criarMultidao } from './multidao.js'
import { fazBoneco, compactar } from './boneco.js'
import { mesclarEstatico } from './estatico.js'
import { BANCADAS } from '../planta/dados.js'
import { LUGARES } from '../planta/lugares.js'
import { FIXOS } from '../planta/fixos.js'

const M = {
  woodLight: new THREE.MeshLambertMaterial(), white: new THREE.MeshLambertMaterial(),
  dark: new THREE.MeshLambertMaterial(), chair: new THREE.MeshLambertMaterial(),
}

describe('móveis instanciados', () => {
  test('todas as bancadas e cadeiras em 5 malhas', () => {
    const g = montarMoveis(M)
    expect(g.children).toHaveLength(5)
    const contagens = g.children.map(m => (m as THREE.InstancedMesh).count)
    const naBancada = LUGARES.filter(l => l.zona).length
    expect(contagens).toEqual([BANCADAS.length, BANCADAS.length * 4, naBancada * 2, naBancada * 2, naBancada * 2])
  })
})

describe('cenário mesclado', () => {
  test('junta caixas do mesmo material numa malha só', () => {
    const g = new THREE.Group()
    const mat = new THREE.MeshLambertMaterial()
    for (let i = 0; i < 50; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat)
      m.position.set(i, 0, 0)
      m.castShadow = true
      g.add(m)
    }
    const r = mesclarEstatico(g)
    expect(r).toEqual({ antes: 50, depois: 1 })
    const geo = (g.children[0] as THREE.Mesh).geometry
    geo.computeBoundingBox()
    expect(geo.boundingBox!.max.x).toBeCloseTo(49.5)
  })
})

describe('boneco detalhado', () => {
  test('compactado fica com bem menos peças e mantém o braço e a boca soltos', () => {
    const conta = (o: THREE.Object3D) => { let n = 0; o.traverse(x => { if ((x as THREE.Mesh).isMesh) n++ }); return n }
    const cheio = fazBoneco(FIXOS[0], 0)
    const antes = conta(cheio.grupo)
    const { grupo, rig } = compactar(fazBoneco(FIXOS[0], 0))
    expect(conta(grupo)).toBeLessThan(antes / 2)
    for (const peca of [rig.sup, rig.ant, rig.mao, rig.boca]) {
      let achou = false
      grupo.traverse(x => { if (x === peca) achou = true })
      expect(achou).toBe(true)
    }
  })
})

describe('multidão', () => {
  test('ignora cadeira que não existe mais no layout, sem quebrar', () => {
    const cena = new THREE.Scene()
    const m = criarMultidao(cena)
    const mapa = new Map(FIXOS.map(f => [f.lugar, f] as [string, typeof f]))
    mapa.set('norte-99-L-1', FIXOS[0])
    m.definir(mapa)
    expect(m.total).toBe(15)
  })
})
