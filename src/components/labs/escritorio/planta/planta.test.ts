import { describe, expect, test } from 'vitest'
import { ZONAS, AREAS, BANCADAS, PONTOS, AVULSAS } from './dados.js'
import { LUGARES, LUGAR, TOTAL_LUGARES, gerarLugares, compararLayouts, descreverLugar } from './lugares.js'
import { FIXOS, APELIDOS_RESERVADOS, chaveApelido } from './fixos.js'

const dentro = (r: number[], x: number, z: number) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]

describe('cadeiras', () => {
  test('são 511: 508 nas bancadas e 3 avulsas, com a contagem aprovada por zona', () => {
    expect(TOTAL_LUGARES).toBe(511)
    expect(LUGARES.filter(l => !l.zona).map(l => l.id)).toEqual(['recepcao-1', 'recepcao-2', 'sala-executiva-1'])
    const porZona = Object.fromEntries(ZONAS.map(z => [z.id, LUGARES.filter(l => l.zona === z.id).length]))
    expect(porZona).toEqual({
      norte: 112, nordeste: 32, leste: 70, 'centro-oeste': 50, centro: 24, 'centro-leste': 20, sul: 200,
    })
  })

  test('todo nome é único e segue zona-bancada-lado-posição', () => {
    expect(LUGAR.size).toBe(LUGARES.length)
    for (const l of LUGARES) expect(l.id).toMatch(l.zona ? /^[a-z-]+-\d+-[NSLO]-\d+$/ : /^[a-z-]+-\d+$/)
  })

  test('cada cadeira fica dentro da própria zona (ou área) e de nenhuma outra zona', () => {
    for (const a of AVULSAS) {
      expect(dentro(AREAS.find(x => x.id === a.area)!.r, a.x, a.z)).toBe(true)
      expect(ZONAS.some(z => dentro(z.r, a.x, a.z))).toBe(false)
    }
    for (const l of LUGARES.filter(l => l.zona)) {
      const zonas = ZONAS.filter(z => dentro(z.r, l.x, l.z)).map(z => z.id)
      expect(zonas).toEqual([l.zona])
    }
  })

  test('nenhuma cadeira encosta em outra', () => {
    let menor = Infinity
    for (let i = 0; i < LUGARES.length; i++)
      for (let j = i + 1; j < LUGARES.length; j++)
        menor = Math.min(menor, Math.hypot(LUGARES[i].x - LUGARES[j].x, LUGARES[i].z - LUGARES[j].z))
    expect(menor).toBeGreaterThanOrEqual(1.39)
  })

  test('cada cadeira olha para o meio da própria bancada', () => {
    for (const l of LUGARES.filter(l => l.zona)) {
      const b = BANCADAS[l.banc]
      const frente = { x: Math.sin(l.giro), z: Math.cos(l.giro) }
      const paraMeio = b.eixo === 'z' ? { x: b.x - l.x, z: 0 } : { x: 0, z: b.z - l.z }
      expect(frente.x * paraMeio.x + frente.z * paraMeio.z).toBeGreaterThan(1)
    }
  })

  test('nomes que a gente já validou no artefato', () => {
    expect(descreverLugar('leste-1-N-1')).toBe('Leste · bancada 1 · lado norte · cadeira 1')
    expect(descreverLugar('recepcao-2')).toBe('Recepção · cadeira 2')
    expect(descreverLugar('sala-executiva-1')).toBe('Sala executiva Oeste · cadeira 1')
    const jana = LUGAR.get('nordeste-2-L-1')!
    expect(jana.x).toBeCloseTo(57.5)
    expect(jana.z).toBeCloseTo(-18.3)
  })
})

describe('mudança de layout', () => {
  test('mover uma bancada não muda o nome de nenhuma cadeira', () => {
    const movidas = BANCADAS.map(b => (b.zona === 'sul' ? { ...b, x: b.x + 0.4 } : b))
    const { removidas, novas } = compararLayouts(LUGARES, gerarLugares(movidas))
    expect(removidas).toEqual([])
    expect(novas).toEqual([])
  })

  test('cada bancada tem um número único dentro da zona', () => {
    for (const z of ZONAS) {
      const ns = BANCADAS.filter(b => b.zona === z.id).map(b => b.n)
      for (const n of ns) expect(Number.isInteger(n) && n > 0, `${z.id} ${n}`).toBe(true)
      expect(new Set(ns).size, z.id).toBe(ns.length)
    }
  })

  test('acrescentar uma bancada ao norte das outras não renomeia nem muda ninguém de lugar', () => {
    const centro = BANCADAS.filter(b => b.zona === 'centro')
    const nova = { ...centro[0], n: Math.max(...centro.map(b => b.n)) + 1, z: Math.min(...centro.map(b => b.z)) - 3 }
    const depois = new Map(gerarLugares([...BANCADAS, nova]).map(l => [l.id, l]))
    for (const l of LUGARES) {
      expect(depois.get(l.id)?.x, l.id).toBeCloseTo(l.x)
      expect(depois.get(l.id)?.z, l.id).toBeCloseTo(l.z)
    }
    expect(depois.size).toBe(LUGARES.length + nova.lugares * 2)
  })

  test('tirar uma bancada lista exatamente as cadeiras que somem', () => {
    const sem = BANCADAS.filter(b => !(b.zona === 'centro' && b.x === 42.5))
    const { removidas } = compararLayouts(LUGARES, gerarLugares(sem))
    expect(removidas.sort()).toEqual(LUGARES.filter(l => l.zona === 'centro' && l.bancada === 2).map(l => l.id).sort())
  })

  test('nenhum personagem fixo perde a cadeira no layout atual', () => {
    for (const f of FIXOS) expect(LUGAR.has(f.lugar), f.apelido).toBe(true)
  })
})

describe('personagens fixos', () => {
  test('são 15, cada um numa cadeira diferente', () => {
    expect(FIXOS).toHaveLength(15)
    expect(new Set(FIXOS.map(f => f.lugar)).size).toBe(15)
  })

  test('os apelidos ficam reservados, sem diferença de acento ou maiúscula', () => {
    expect(APELIDOS_RESERVADOS.size).toBe(15)
    expect(APELIDOS_RESERVADOS.has(chaveApelido('  JOAO '))).toBe(true)
    expect(APELIDOS_RESERVADOS.has(chaveApelido('líka'))).toBe(true)
    expect(APELIDOS_RESERVADOS.has(chaveApelido('sem   Sangue'))).toBe(true)
    expect(APELIDOS_RESERVADOS.has(chaveApelido('Visitante'))).toBe(false)
  })

  test('cada piada tem o personagem que ela precisa', () => {
    const com = (k: string) => FIXOS.filter(f => (f as Record<string, unknown>)[k]).map(f => f.apelido)
    expect(com('sanduiche')).toEqual(['Lika'])
    expect(com('filma')).toEqual(['Jana'])
    expect(com('perseguidor')).toEqual(['Sem sangue'])
    expect(com('acumulador')).toEqual(['Elton'])
    expect(com('retrato')).toEqual(['Sem sangue'])
  })
})

describe('áreas e pontos', () => {
  test('nomes de zona e de área não se repetem', () => {
    const nomes = [...ZONAS, ...AREAS].map(a => a.nome)
    expect(new Set(nomes).size).toBe(nomes.length)
  })

  test('os pontos das piadas ficam fora das bancadas', () => {
    /* o quadro é de parede (atrás das cadeiras do norte), não é ponto de piso */
    for (const [nome, p] of Object.entries(PONTOS))
      if (nome !== 'quadro') for (const l of LUGARES) expect(Math.hypot(p.x - l.x, p.z - l.z)).toBeGreaterThan(0.6)
  })

  test('os pontos que as piadas usam existem e o café saiu', () => {
    expect(Object.keys(PONTOS).sort()).toEqual(['armarioJuridico', 'quadro', 'saida'])
  })
})
