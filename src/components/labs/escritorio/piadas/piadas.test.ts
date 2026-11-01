import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as THREE from 'three'
import { criarPiadas } from './index.js'
import { FIXOS } from '../planta/fixos.js'
import { PONTOS } from '../planta/dados.js'
import { LUGAR, LUGARES } from '../planta/lugares.js'
import { criarGrade, lerMoveis, fecharGrade } from '../render/colisao.js'

/* sem navegador: um canvas de mentira basta para as texturas do porta-retrato e do quadro */
const lona: any = { width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true }) }
let grade: any

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => lona })
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  grade = grade || fecharGrade((() => { const g = criarGrade(); lerMoveis(g); return g })())
})
afterEach(() => { vi.unstubAllGlobals() })

function andarFalso() {
  const cena = new THREE.Scene()
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb7b0a2, 0.78)
  cena.add(hemi)
  return {
    cena, hemi, colisao: grade,
    voar: vi.fn(() => Promise.resolve()), marcar: vi.fn(), reservarLugares: vi.fn(),
    raioEm: vi.fn(), renderer: null,
  }
}

/** Monta as piadas com pontos próprios (cópia, para um teste não mudar o do outro). */
function montar(pontos: any = { ...PONTOS }) {
  const andar: any = andarFalso()
  const avisos: string[] = []
  const piadas = criarPiadas(andar, { avisar: m => avisos.push(m), pontos })
  const por = (nome: string) => piadas.pessoas.find((p: any) => p.nome === nome)
  let t = performance.now() / 1000
  /** Roda a animação por `seg` segundos de relógio, em passos de 0,1 s. */
  const passar = (seg: number, parar?: () => boolean) => {
    for (let k = 0; k < Math.round(seg * 10); k++) {
      t += 0.1
      piadas.motor.atualizar(t, 0.1)
      if (parar && parar()) return true
    }
    return false
  }
  return { piadas, andar, avisos, por, passar, pontos }
}

const cadeiraLivreMaisPerto = (id: string) => {
  const l = LUGAR.get(id)!
  const fixas = new Set(FIXOS.map(f => f.lugar))
  return LUGARES.filter(x => !fixas.has(x.id)).sort((a, b) => Math.hypot(a.x - l.x, a.z - l.z) - Math.hypot(b.x - l.x, b.z - l.z))[0].id
}

describe('os 15 fixos', () => {
  test('todos aparecem, cada um na cadeira dele, e a multidão pula essas cadeiras', () => {
    const { piadas, andar } = montar()
    expect(piadas.pessoas).toHaveLength(15)
    for (const f of FIXOS) {
      const p: any = piadas.pessoas.find((x: any) => x.nome === f.apelido)
      expect(p.lugar).toBe(f.lugar)
      expect(p.g.parent).toBe(andar.cena)
      expect(p.g.position.x).toBeCloseTo(LUGAR.get(f.lugar)!.x)
    }
    expect(andar.reservarLugares).toHaveBeenCalledWith(FIXOS.map(f => f.lugar))
  })

  test('pilha do Elton e retrato da Dani ficam na mesa de quem tem a piada', () => {
    const { por } = montar()
    expect(por('Elton').pilha).toBeTruthy()
    expect(por('Sem sangue').retrato).toBeTruthy()
    expect(por('Gabi').pilha).toBeUndefined()
    const l = LUGAR.get(por('Elton').lugar)!
    expect(Math.hypot(por('Elton').pilha.position.x - l.x, por('Elton').pilha.position.z - l.z)).toBeLessThan(1.2)
  })
})

describe('sanduíche e filmagem', () => {
  test('a Lika come e a Jana grava a Lika; depois cada uma volta ao normal', () => {
    const { piadas, por, passar } = montar()
    expect(piadas.sanduiche()).toBe(true)
    expect(por('Lika').est.busy).toBe('lanche')
    expect(por('Jana').est.filmagem.alvo).toBe('Lika')
    passar(8)
    expect(por('Lika').est.busy).toBeNull()
    expect(por('Jana').est.busy).toBeNull()
  })

  test('a lente do celular aponta para a Lika, não para a parede', () => {
    const { piadas, por, passar } = montar()
    piadas.sanduiche()
    passar(2)
    const cel = por('Jana').est.filmagem.cel
    cel.updateWorldMatrix(true, false)
    const lente = new THREE.Vector3(0, 0, -1).transformDirection(cel.matrixWorld)
    const cel3 = new THREE.Vector3(), lika = new THREE.Vector3()
    cel.getWorldPosition(cel3)
    por('Lika').rig.cab.getWorldPosition(lika)
    expect(lente.dot(lika.sub(cel3).normalize())).toBeGreaterThan(0.9)
  })

  test('quem está ocupada não começa outro sanduíche', () => {
    const { piadas, avisos } = montar()
    piadas.sanduiche()
    expect(piadas.sanduiche()).toBe(false)
    expect(avisos.at(-1)).toMatch(/ocupada/)
  })
})

describe('troca de cadeira', () => {
  test('a Lika troca de cadeira: a piada cancela, e na cadeira nova a Jana grava a Lika de novo', () => {
    const { piadas, por, passar } = montar()
    const nova = cadeiraLivreMaisPerto('nordeste-2-L-3')
    piadas.sanduiche()
    passar(1)
    expect(piadas.mudarLugar('Lika', nova)).toBe(true)
    expect(por('Lika').est.busy).toBe('andando')
    expect(por('Lika').est.lanche).toBeNull()
    expect(por('Lika').g.visible).toBe(false)
    expect(passar(60, () => por('Lika').est.busy === null)).toBe(true)
    expect(por('Lika').lugar).toBe(nova)
    expect(por('Lika').g.visible).toBe(true)
    passar(8)                                         /* a Jana termina a gravação antiga */
    expect(piadas.sanduiche()).toBe(true)
    expect(por('Jana').est.filmagem.alvo).toBe('Lika')   /* presa ao nome, não à cadeira */
  })

  test('a pilha do Elton e o retrato da Dani vão com eles', () => {
    const { piadas, por, passar } = montar()
    for (const [nome, antes] of [['Elton', 'leste-1-S-5'], ['Sem sangue', 'nordeste-4-L-1']]) {
      const nova = cadeiraLivreMaisPerto(antes)
      expect(piadas.mudarLugar(nome, nova)).toBe(true)
      expect(passar(60, () => por(nome).est.busy === null)).toBe(true)
      const l = LUGAR.get(nova)!
      const obj = nome === 'Elton' ? por(nome).pilha : por(nome).retrato
      expect(Math.hypot(obj.position.x - l.x, obj.position.z - l.z)).toBeLessThan(1.2)
    }
  })

  test('quem já está andando não recebe outra ordem', () => {
    const { piadas } = montar()
    expect(piadas.mudarLugar('Gabi', cadeiraLivreMaisPerto('leste-1-N-1'))).toBe(true)
    expect(piadas.mudarLugar('Gabi', cadeiraLivreMaisPerto('leste-1-N-2'))).toBe(false)
  })
})

describe('fuga do armário', () => {
  test('o Sem sangue só corre quando o fugitivo passa por ele, e volta para a cadeira', () => {
    const { piadas, por, passar } = montar()
    expect(piadas.fuga()).toBe(true)
    expect(piadas.motor.passeiosInfo).toHaveLength(1)          /* só o fugitivo */
    expect(por('Sem sangue').g.visible).toBe(true)             /* ainda sentado */
    passar(2)
    expect(piadas.motor.passeiosInfo).toHaveLength(1)
    expect(passar(60, () => piadas.motor.passeiosInfo.length === 2)).toBe(true)
    const fugitivo = piadas.motor.passeiosInfo[0]
    expect(fugitivo.d).toBeGreaterThan(2)                      /* já andou bastante */
    expect(por('Sem sangue').g.visible).toBe(false)            /* levantou e foi atrás */
    expect(passar(120, () => !piadas.motor.fugaAtiva)).toBe(true)
    expect(por('Sem sangue').g.visible).toBe(true)
    expect(por('Sem sangue').est.busy).toBeNull()
    expect(por('Sem sangue').lugar).toBe('nordeste-4-L-1')
  })

  test('a rota segue o ponto nomeado da saída (mudou o ponto, mudou o caminho)', () => {
    const a = montar()
    a.piadas.fuga()
    const rotaA = a.piadas.motor.passeiosInfo[0].total
    const b = montar({ ...PONTOS, saida: { x: 30.5, z: -12.5 } })
    b.piadas.fuga()
    expect(b.piadas.motor.passeiosInfo[0].total).not.toBeCloseTo(rotaA, 0)
  })

  test('não começa outra fuga com uma em andamento', () => {
    const { piadas, avisos } = montar()
    piadas.fuga()
    expect(piadas.fuga()).toBe(false)
    expect(avisos.at(-1)).toMatch(/fuga/i)
  })
})

describe('discoteca', () => {
  test('liga: o andar escurece, os 15 dançam; desliga: a luz volta ao normal', () => {
    const { piadas, andar, passar } = montar()
    const base = andar.hemi.intensity
    expect(piadas.discoteca()).toBe(true)
    passar(4)
    expect(piadas.motor.dancando).toBe(15)
    expect(andar.hemi.intensity).toBeLessThan(base * 0.5)
    expect(piadas.discoteca()).toBe(false)
    passar(8)
    expect(piadas.motor.dancando).toBe(0)
    expect(andar.hemi.intensity).toBeCloseTo(base, 1)
  })

  test('quem está comendo não dança junto', () => {
    const { piadas, por, passar } = montar()
    piadas.sanduiche()
    piadas.discoteca()
    passar(2)
    expect(por('Lika').dancando).toBeFalsy()
    expect(piadas.motor.dancando).toBeLessThan(15)
  })
})
