import { describe, expect, test } from 'vitest'
import { lugaresComMais, PERTO, RETRATO, MAX_MAIS, raioDosMais } from './mais.js'
import { buscarApelido } from './busca.js'
import { LUGAR, LUGARES, nomeDaArea } from '../planta/lugares.js'
import { FIXOS } from '../planta/fixos.js'

describe('botões "+" das cadeiras livres', () => {
  const alvo = { x: 63.35, z: -18.2 }   /* bancada 1 do leste, onde estão os fixos */
  const ocupados = new Set(FIXOS.map(f => f.lugar))

  test('de longe não aparece nenhum', () => {
    expect(lugaresComMais({ ocupados, alvo, distancia: PERTO + 0.1 })).toEqual([])
    expect(lugaresComMais({ ocupados, alvo, distancia: 85 })).toEqual([])
  })

  test('na vista de retrato (busca, editor) também somem', () => {
    expect(lugaresComMais({ ocupados, alvo, distancia: RETRATO - 0.1 })).toEqual([])
    expect(lugaresComMais({ ocupados, alvo, distancia: RETRATO }).length).toBeGreaterThan(0)
  })

  test('de perto aparecem só cadeiras livres, perto do alvo, as mais próximas primeiro', () => {
    const ids = lugaresComMais({ ocupados, alvo, distancia: 12 })
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.length).toBeLessThanOrEqual(MAX_MAIS)
    for (const id of ids) {
      expect(ocupados.has(id)).toBe(false)
      const l = LUGAR.get(id)!
      expect(Math.hypot(l.x - alvo.x, l.z - alvo.z)).toBeLessThanOrEqual(raioDosMais(12))
    }
    const d = ids.map(id => { const l = LUGAR.get(id)!; return Math.hypot(l.x - alvo.x, l.z - alvo.z) })
    expect([...d].sort((a, b) => a - b)).toEqual(d)
  })

  test('nunca passa do limite, nem com o andar vazio', () => {
    const ids = lugaresComMais({ ocupados: new Set(), alvo: { x: 30, z: 33 }, distancia: PERTO })
    expect(ids.length).toBe(MAX_MAIS)
  })

  test('andar lotado: nenhum "+"', () => {
    const todos = new Set(LUGARES.map(l => l.id))
    expect(lugaresComMais({ ocupados: todos, alvo, distancia: 8 })).toEqual([])
  })
})

describe('busca por apelido', () => {
  const pessoas = [
    { apelido: 'João', lugar: 'leste-1-S-1' },
    { apelido: 'Joana Prado', lugar: 'sul-1-L-1' },
    { apelido: 'Mari Jô', lugar: 'sul-1-L-2' },
    { apelido: 'Benjo', lugar: 'sul-1-L-3' },
    { apelido: 'Sem sangue', lugar: 'nordeste-4-L-1' },
  ]
  const nomes = (t: string) => buscarApelido(pessoas, t).map(p => p.apelido)

  test('sem diferença de acento nem maiúscula', () => {
    expect(nomes('joao')).toEqual(['João'])
    expect(nomes('SEM SANGUE')).toEqual(['Sem sangue'])
  })

  test('começo do apelido, depois começo de palavra, depois o meio', () => {
    expect(nomes('jo')).toEqual(['Joana Prado', 'João', 'Mari Jô', 'Benjo'])
  })

  test('termo vazio ou sem ninguém', () => {
    expect(nomes('   ')).toEqual([])
    expect(nomes('zzz')).toEqual([])
  })
})

describe('nada de zona na tela', () => {
  test('cadeira de bancada não tem nome de área; avulsa tem', () => {
    expect(nomeDaArea('leste-1-N-1')).toBeNull()
    expect(nomeDaArea('recepcao-1')).toBe('Recepção')
    expect(nomeDaArea('sala-executiva-1')).toBe('Sala executiva Oeste')
  })
})
