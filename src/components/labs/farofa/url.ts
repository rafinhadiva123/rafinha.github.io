import type { Estado } from './modelo'
import type { Farinha } from './ingredientes'

const codigoPorFarinha: Record<Farinha, string> = {
  'mandioca-fina': 'mf',
  'mandioca-grossa': 'mg',
  'mandioca-torrada': 'mt',
  fuba: 'fb',
}

const farinhaPorCodigo: Record<string, Farinha> = Object.fromEntries(
  Object.entries(codigoPorFarinha).map(([farinha, codigo]) => [codigo, farinha as Farinha]),
)

export function codificarEstado(estado: Estado): string {
  const params = new URLSearchParams()
  params.set('f', codigoPorFarinha[estado.farinha])
  params.set('g', String(estado.gramasFarinha))

  const ingredientesAtivos = Object.entries(estado.ingredientes).filter(([, gramas]) => gramas > 0)
  if (ingredientesAtivos.length > 0) {
    params.set('i', ingredientesAtivos.map(([id, gramas]) => `${id}-${gramas}`).join('.'))
  }

  if (estado.sal > 0) {
    params.set('s', String(estado.sal))
  }

  params.set('t', String(estado.tostagem))
  params.set('p', String(estado.pessoas))

  return params.toString()
}

export function decodificarEstado(query: string): Estado | null {
  const params = new URLSearchParams(query)

  const codigoFarinha = params.get('f')
  const farinha = codigoFarinha ? farinhaPorCodigo[codigoFarinha] : undefined
  const gramasFarinha = Number(params.get('g'))
  const tostagem = Number(params.get('t'))
  const pessoas = Number(params.get('p'))

  if (!farinha || !Number.isFinite(gramasFarinha) || !Number.isFinite(tostagem) || !Number.isFinite(pessoas)) {
    return null
  }

  const ingredientes: Record<string, number> = {}
  const bruto = params.get('i')
  if (bruto) {
    for (const par of bruto.split('.')) {
      const [id, gramasTexto] = par.split('-')
      const gramas = Number(gramasTexto)
      if (id && Number.isFinite(gramas) && gramas > 0) {
        ingredientes[id] = gramas
      }
    }
  }

  const salTexto = params.get('s')
  const sal = salTexto ? Number(salTexto) : 0

  return {
    farinha,
    gramasFarinha,
    ingredientes,
    sal: Number.isFinite(sal) ? sal : 0,
    tostagem,
    pessoas,
  }
}
