import { describe, expect, test, beforeAll } from 'vitest'
import * as THREE from 'three'
import { criarGrade, preencherPoligono, celulasDoPoligono, fecharGrade, mover, caminho, podeFicar, maisPerto, montarColisao, lerMoveis, direcaoAberta, pontoEspacoso, distanciaLivre, altura, pontoNaSuperficie, DEGRAU } from './colisao.js'
import { SUBIR, AREAS } from '../planta/dados.js'
import { LUGARES } from '../planta/lugares.js'
import { BANCADAS } from '../planta/dados.js'

/* sala de 10 x 10 m com uma parede no meio (x = 5) e uma porta em z 4..5 */
function sala() {
  const g = criarGrade({ x0: 0, z0: 0, x1: 10, z1: 10 })
  preencherPoligono(g, g.chao, [[0, 0], [10, 0], [10, 10], [0, 10]])
  preencherPoligono(g, g.bloq, [[4.95, 0], [5.05, 0], [5.05, 4], [4.95, 4]])
  preencherPoligono(g, g.bloq, [[4.95, 5], [5.05, 5], [5.05, 10], [4.95, 10]])
  return fecharGrade(g)
}

describe('grade de colisão', () => {
  test('folga do raio do boneco em volta das paredes e da borda do piso', () => {
    const g = sala()
    expect(podeFicar(g, 2, 2)).toBe(true)
    expect(podeFicar(g, 4.85, 2)).toBe(false)   /* encostado na parede */
    expect(podeFicar(g, 0.1, 2)).toBe(false)    /* beirada do piso */
    expect(podeFicar(g, 20, 2)).toBe(false)     /* fora da grade */
  })

  test('andar contra a parede não atravessa; desliza ao longo dela', () => {
    const g = sala()
    const p = mover(g, 4, 2, 3, 0.5)
    expect(p.x).toBeLessThan(4.95)
    expect(p.z).toBeGreaterThan(2)
  })

  test('caminho passa pela porta', () => {
    const g = sala()
    const r = caminho(g, { x: 2, z: 8 }, { x: 8, z: 8 })!
    expect(r).not.toBeNull()
    const pela = r.some(p => p.x > 4.5 && p.x < 5.5 && p.z > 3.9 && p.z < 5.1)
    expect(pela).toBe(true)
    expect(r.at(-1)).toEqual({ x: 8, z: 8 })
  })

  test('entra num lugar com folga e virado para onde dá para andar', () => {
    const g = sala()
    const p = pontoEspacoso(g, 4.7, 2)!
    expect(Math.hypot(p.x - 4.7, p.z - 2)).toBeGreaterThan(0.3)
    expect(podeFicar(g, p.x + 0.9, p.z)).toBe(true)
    /* de cara para a parede (leste) a 0,5 m: vira para um lado aberto */
    const giro = direcaoAberta(g, 4.4, 2, Math.PI / 2)
    expect(distanciaLivre(g, 4.4, 2, giro)).toBeGreaterThanOrEqual(3)
    /* com espaço à frente, mantém a direção */
    expect(direcaoAberta(g, 2, 2, 0)).toBe(0)
  })

  test('sem porta, não tem caminho', () => {
    const g = criarGrade({ x0: 0, z0: 0, x1: 10, z1: 10 })
    preencherPoligono(g, g.chao, [[0, 0], [10, 0], [10, 10], [0, 10]])
    preencherPoligono(g, g.bloq, [[4.9, 0], [5.1, 0], [5.1, 10], [4.9, 10]])
    fecharGrade(g)
    expect(caminho(g, { x: 2, z: 8 }, { x: 8, z: 8 })).toBeNull()
  })

  test('peça girada bloqueia pela pegada real, não pela caixa em volta', () => {
    const g = criarGrade({ x0: 0, z0: 0, x1: 10, z1: 10 })
    preencherPoligono(g, g.chao, [[0, 0], [10, 0], [10, 10], [0, 10]])
    /* parede diagonal fina de (1,1) a (9,9) */
    preencherPoligono(g, g.bloq, [[1, 0.95], [9, 8.95], [9, 9.05], [1, 1.05]])
    fecharGrade(g)
    expect(podeFicar(g, 5, 5)).toBe(false)
    expect(podeFicar(g, 7, 3)).toBe(true)
  })

  test('bancadas e cadeiras da planta viram obstáculo; o corredor entre elas fica livre', () => {
    const g = criarGrade()
    preencherPoligono(g, g.chao, [[0, -20], [67, -20], [67, 41.6], [0, 41.6]])
    lerMoveis(g)
    fecharGrade(g)
    const b = BANCADAS[0]
    expect(podeFicar(g, b.x, b.z)).toBe(false)
    const l = LUGARES[0]
    expect(podeFicar(g, l.x, l.z)).toBe(false)
    expect(podeFicar(g, (3.5 + 8.5) / 2, -16.2)).toBe(true)  /* entre as duas primeiras bancadas do norte */
  })
})

describe('degraus', () => {
  /* piso de 10 x 4 m com degraus de 0,4 m subindo para o leste a partir de x = 4,
     e um bloco de 1 m de altura (alto demais) em z 3..4 */
  function escada() {
    const g = criarGrade({ x0: 0, z0: 0, x1: 10, z1: 4 })
    preencherPoligono(g, g.chao, [[0, 0], [10, 0], [10, 4], [0, 4]])
    for (let k = 0; k < 3; k++) celulasDoPoligono(g, [[4 + k * 2, 0], [6 + k * 2, 0], [6 + k * 2, 2.6], [4 + k * 2, 2.6]], c => { g.alt[c] = 0.4 * (k + 1) })
    celulasDoPoligono(g, [[4, 2.6], [10, 2.6], [10, 4], [4, 4]], c => { g.alt[c] = 1 })
    return fecharGrade(g)
  }

  test('sobe degrau por degrau e a altura acompanha', () => {
    const g = escada()
    const r = caminho(g, { x: 1, z: 1.2 }, { x: 9, z: 1.2 })
    expect(r).not.toBeNull()
    expect(altura(g, 9, 1.2)).toBeCloseTo(1.2)
    const p = mover(g, 3, 1.2, 4, 0)
    expect(p.x).toBeCloseTo(7, 0)
  })

  test('degrau alto demais segura como parede', () => {
    const g = escada()
    expect(DEGRAU).toBeLessThan(1)
    const p = mover(g, 2, 3.4, 4, 0)       /* andando em direção ao bloco de 1 m */
    expect(p.x).toBeLessThan(4)
    expect(podeFicar(g, 3.95, 3.4)).toBe(false) /* nem encosta na lateral */
  })

  test('o clique acerta o chão alto, não o piso embaixo dele', () => {
    const g = escada()
    /* olhando de cima para baixo, na vertical, sobre o terceiro degrau */
    expect(pontoNaSuperficie(g, { x: 9, y: 10, z: 1 }, { x: 0, y: -1, z: 0 })).toEqual({ x: 9, z: 1 })
    /* raio inclinado vindo do oeste encosta na frente do degrau, antes de chegar ao piso atrás */
    const p = pontoNaSuperficie(g, { x: 0, y: 3, z: 1 }, { x: 0.8, y: -0.6, z: 0 })!
    expect(p.x).toBeLessThan(4.1)
  })
})

describe('mapa do andar de verdade', () => {
  let g: ReturnType<typeof montarColisao>
  beforeAll(async () => {
    /* o cenário carrega a textura do logo; em node basta um document de mentira */
    ;(globalThis as any).document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {} }) }
    const { montarCenario } = await import('./cenario.js')
    const grupo = new THREE.Group()
    montarCenario(grupo)
    g = montarColisao(grupo)
  })

  test('quase todas as cadeiras dá para alcançar a pé a partir do corredor sul', () => {
    const ini = maisPerto(g, 30, 24.6, 3)!
    expect(ini).not.toBeNull()
    const falhas: string[] = []
    LUGARES.filter((_, k) => k % 7 === 0).forEach(l => {
      /* ponto de chegada: logo atrás da cadeira */
      const p = maisPerto(g, l.x - Math.sin(l.giro) * 0.7, l.z - Math.cos(l.giro) * 0.7, 0.8)
      if (!p || !caminho(g, ini, p)) falhas.push(l.id)
    })
    /* só as encostadas na parede do fundo (lado norte da bancada 1 do leste) podem ficar de fora */
    expect(falhas.every(id => id.startsWith('leste-1-N-'))).toBe(true)
  }, 60000)

  test('sobe a arquibancada até o último degrau e o palquinho', () => {
    expect(SUBIR.every(id => AREAS.some(a => a.id === id))).toBe(true)
    const embaixo = maisPerto(g, 44.6, 5.6, 2)!
    const topo = maisPerto(g, 37.6, 5.6, 1)!
    expect(altura(g, topo.x, topo.z)).toBeCloseTo(1.68, 2)
    expect(caminho(g, embaixo, topo)).not.toBeNull()
    const palco = maisPerto(g, 51.5, 13.8, 1)!
    expect(altura(g, palco.x, palco.z)).toBeGreaterThan(0.2)
    expect(caminho(g, { x: 44.6, z: 14 }, palco)).not.toBeNull()
    /* as poltronas e a mesinha de cima do palco continuam sendo obstáculo */
    expect(podeFicar(g, 51.5, 16)).toBe(false)
  })

  test('não sobe na arquibancada pela lateral alta', () => {
    /* do corredor ao sul, encostado no último degrau (1,68 m), não entra */
    const p = mover(g, 38, 11.2, 0, -3)
    expect(altura(g, p.x, p.z)).toBe(0)
  })

  test('não dá para sair pela fachada de vidro nem entrar no núcleo dos elevadores', () => {
    expect(podeFicar(g, 30, 42.5)).toBe(false)   /* lá fora, ao sul */
    expect(podeFicar(g, 20.4, 3.65)).toBe(false) /* núcleo central */
    const p = mover(g, 30, 40, 0, 5)
    expect(p.z).toBeLessThan(41.6)
  })
})
