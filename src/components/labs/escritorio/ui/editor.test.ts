import { describe, expect, test } from 'vitest'
import { modoEditor } from './editor.js'

describe('quando o editor abre', () => {
  const meu = { lugar: 'sul-1-L-1', apelido: 'Ana', visual: {} }

  test('quem já tem personagem só abre o editor na própria cadeira', () => {
    expect(modoEditor('sul-1-L-1', meu)).toBe('editar')
    expect(modoEditor('sul-1-L-2', meu)).toBe(null)
    expect(modoEditor('sul-1-L-3', meu, { ocupada: true })).toBe(null)
  })

  test('depois de apertar "Mudar de cadeira", só cadeira livre aceita a troca', () => {
    expect(modoEditor('sul-1-L-2', meu, { mudando: true })).toBe('mudar')
    expect(modoEditor('sul-1-L-3', meu, { mudando: true, ocupada: true })).toBe(null)
    expect(modoEditor('sul-1-L-1', meu, { mudando: true })).toBe('editar')
  })

  test('quem ainda não sentou monta o personagem numa cadeira livre', () => {
    expect(modoEditor('sul-1-L-1', null)).toBe('novo')
    expect(modoEditor('sul-1-L-1', null, { ocupada: true })).toBe(null)
  })
})
