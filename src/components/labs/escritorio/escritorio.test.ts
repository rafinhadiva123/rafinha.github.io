import { describe, expect, test } from 'vitest'
import { LUGARES, TOTAL, EQUIPE, SALA, MESA } from './layout.js'
import { PESSOAS } from './pessoas.js'
import { PADRAO, OPCOES, sanearApelido, sanearVisual, sortearVisual, paraBoneco } from './visual.js'
import { sanearLista } from './banco.js'

describe('layout', () => {
  test('tem 40 cadeiras, todas dentro da sala', () => {
    expect(TOTAL).toBe(40)
    for (const l of LUGARES) {
      expect(l.x).toBeGreaterThan(SALA.x0 + 1)
      expect(l.x).toBeLessThan(SALA.x1 - 1)
      expect(l.z).toBeGreaterThan(SALA.z0 + 1)
      expect(l.z).toBeLessThan(SALA.z1 - 1)
    }
  })

  test('nenhuma cadeira encosta em outra', () => {
    for (let i = 0; i < TOTAL; i++)
      for (let j = i + 1; j < TOTAL; j++) {
        const d = Math.hypot(LUGARES[i].x - LUGARES[j].x, LUGARES[i].z - LUGARES[j].z)
        expect(d).toBeGreaterThan(1.2)
      }
  })

  test('a equipe inteira cabe nas cadeiras fixas', () => {
    expect(PESSOAS).toHaveLength(EQUIPE)
    expect(TOTAL - EQUIPE).toBe(25)
  })

  test('cada cadeira fica de frente para a mesa', () => {
    for (const l of LUGARES) {
      const frente = l.giro === 0 ? 1 : -1
      expect(Math.sign(l.posto.z - l.z)).toBe(frente)
      expect(Math.abs(l.posto.z - l.z)).toBeLessThan(MESA.profundidade)
    }
  })
})

describe('apelido', () => {
  test('corta espaços, controles e o excesso', () => {
    expect(sanearApelido('  Rafa  ')).toBe('Rafa')
    expect(sanearApelido('a\nb\tc')).toBe('a b c')
    expect(sanearApelido('x'.repeat(40))).toHaveLength(18)
    expect(sanearApelido('​‮')).toBe('')
    expect(sanearApelido(42)).toBe('')
  })

  test('não quebra emoji no meio', () => {
    const s = sanearApelido('🐟'.repeat(30))
    expect([...s]).toHaveLength(18)
    expect(s).toBe('🐟'.repeat(18))
  })
})

describe('visual', () => {
  test('valores fora do catálogo voltam ao padrão', () => {
    const v = sanearVisual({ pele: 'red', cabelo: 'careca', camisa: '<script>', extra: 1 })
    expect(v.pele).toBe(PADRAO.pele)
    expect(v.cabelo).toBe('careca')
    expect(v.camisa).toBe(PADRAO.camisa)
    expect(v).not.toHaveProperty('extra')
  })

  test('aceita lixo sem quebrar', () => {
    expect(sanearVisual(null)).toEqual(PADRAO)
    expect(sanearVisual([1, 2])).toEqual(PADRAO)
    expect(sanearVisual('oi')).toEqual(PADRAO)
  })

  test('sorteio sempre dá um visual válido', () => {
    for (let k = 0; k < 200; k++) {
      const v = sortearVisual()
      expect(sanearVisual(v)).toEqual(v)
    }
    expect(sanearVisual(sortearVisual(() => 0.9999))).toEqual(sortearVisual(() => 0.9999))
  })

  test('vira boneco com os campos que a cena espera', () => {
    const b = paraBoneco('Rafa', { ...PADRAO, acessorio: 'laco', corLaco: OPCOES.corLaco[2], tracos: 'suaves', altura: 'alta' })
    expect(b).toMatchObject({ nome: 'Rafa', laco: OPCOES.corLaco[2], fone: false, mulher: true, barba: null, oculos: null, altura: 1.03 })
  })
})

describe('lista do banco', () => {
  test('descarta lugar da equipe, inválido, repetido ou sem apelido', () => {
    const l = sanearLista([
      { lugar: 15, apelido: 'A', visual: {} },
      { lugar: 15, apelido: 'B', visual: {} },
      { lugar: 40, apelido: 'C', visual: {} },
      { lugar: 15.5, apelido: 'D', visual: {} },
      { lugar: 16, apelido: '   ', visual: {} },
      { lugar: '18', apelido: 'E', visual: null },
      { lugar: 12, apelido: 'Impostor', visual: {} },
      { lugar: 0, apelido: 'Outro', visual: {} },
      null,
    ])
    expect(l.map(p => [p.lugar, p.apelido])).toEqual([[15, 'A'], [18, 'E']])
    expect(sanearLista('não é lista')).toEqual([])
  })
})
