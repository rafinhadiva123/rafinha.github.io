import { describe, expect, test } from 'vitest'
import { simular, type Estado } from './modelo'
import { presets } from './presets'
import { codificarEstado, decodificarEstado } from './url'

function estadoBase(sobrescrever: Partial<Estado> = {}): Estado {
  return {
    farinha: 'mandioca-fina',
    gramasFarinha: 300,
    ingredientes: {},
    sal: 0,
    tostagem: 5,
    pessoas: 4,
    ...sobrescrever,
  }
}

describe('simular', () => {
  test('farofa vazia (só farinha) é seca e sem graça, com G = 0', () => {
    const resultado = simular(estadoBase())
    expect(resultado.metricas.G).toBe(0)
    expect(resultado.veredito.titulo).toBe('Seca e sem graça. Aumenta a gordura.')
  })

  test('preset de churrasco dá "no ponto"', () => {
    const resultado = simular(presets.churrasco.estado)
    expect(resultado.veredito.titulo).toBe('No ponto.')
  })

  test('300 g de farinha + 300 g de ovo mexido vira pirão', () => {
    const resultado = simular(
      estadoBase({ ingredientes: { ovo: 300 }, tostagem: 2 }),
    )
    expect(resultado.metricas.U).toBeGreaterThan(0.45)
    expect(resultado.veredito.titulo).toBe('Isso virou pirão.')
  })

  test('tostagem 10 queima a farofa', () => {
    const resultado = simular(estadoBase({ tostagem: 10 }))
    expect(resultado.metricas.Q).toBeGreaterThan(0)
    expect(resultado.veredito.titulo).toBe('Queimou. Começa de novo.')
  })

  test('30 g de sal em 300 g de farinha fica salgada demais', () => {
    const resultado = simular(
      estadoBase({ ingredientes: { manteiga: 60 }, sal: 30 }),
    )
    expect(resultado.veredito.titulo).toBe('Salgada demais.')
  })

  test('monotonicidade: subir a tostagem nunca aumenta U', () => {
    const estado = estadoBase({ ingredientes: { cebola: 80, ovo: 60 } })
    const valoresU = Array.from({ length: 11 }, (_, tostagem) =>
      simular({ ...estado, tostagem }).metricas.U,
    )
    for (let i = 1; i < valoresU.length; i++) {
      expect(valoresU[i]).toBeLessThanOrEqual(valoresU[i - 1])
    }
  })

  test('monotonicidade: subir a castanha nunca diminui C', () => {
    const estado = estadoBase({ tostagem: 5 })
    const valoresC = Array.from({ length: 16 }, (_, passo) =>
      simular({ ...estado, ingredientes: { castanha: passo * 10 } }).metricas.C,
    )
    for (let i = 1; i < valoresC.length; i++) {
      expect(valoresC[i]).toBeGreaterThanOrEqual(valoresC[i - 1])
    }
  })
})

describe('receita', () => {
  test('escalar de 2 para 10 pessoas mantém as proporções', () => {
    const base = presets.churrasco.estado
    const receita2 = simular({ ...base, pessoas: 2 }).receita
    const receita10 = simular({ ...base, pessoas: 10 }).receita

    // com poucas pessoas, ingredientes usados em pouca quantidade podem
    // arredondar pra 0 g e sumir da receita — isso é esperado, não um bug.
    // e o arredondamento pra múltiplos de 5 g pesa proporcionalmente mais em
    // quantidades pequenas, então a checagem de proporção vale pros itens
    // com uma quantidade de base razoável (>= 20 g pra 2 pessoas).
    for (const linha2 of receita2) {
      if (linha2.gramas < 20) continue
      const linha10 = receita10.find((linha) => linha.id === linha2.id)
      if (!linha10) continue
      const proporcao = linha10.gramas / linha2.gramas
      expect(proporcao).toBeGreaterThan(4.5)
      expect(proporcao).toBeLessThan(5.5)
    }
  })
})

describe('codificarEstado / decodificarEstado', () => {
  for (const [chave, { nome, estado }] of Object.entries(presets)) {
    test(`preset ${nome} sobrevive ao round-trip da URL`, () => {
      const query = codificarEstado(estado)
      const decodificado = decodificarEstado(query)
      expect(decodificado).toEqual(estado)
    })
  }
})
