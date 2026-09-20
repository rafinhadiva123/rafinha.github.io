import { farinhas, ingredientesPorId, type DadosFarinha, type Farinha, type Categoria } from './ingredientes'
import type { Ingrediente } from './ingredientes'

export type Estado = {
  farinha: Farinha
  gramasFarinha: number
  ingredientes: Record<string, number>
  sal: number
  tostagem: number
  pessoas: number
}

export type Faixa = 'baixo' | 'ideal' | 'alto'

export type Veredito = {
  titulo: string
  tom: 'sucesso' | 'alerta' | 'erro'
  dica: string
}

export type LinhaReceita = {
  id: string
  nome: string
  gramas: number
  medidaCaseira: string
}

export type Resultado = {
  metricas: { G: number; U: number; S: number; C: number; Q: number }
  faixas: Record<'G' | 'U' | 'S', Faixa>
  veredito: Veredito
  porcoes: number
  pesoFinal: number
  polemica: number
  receita: LinhaReceita[]
  preparo: string[]
}

type ItemAtivo = { ingrediente: Ingrediente; gramas: number }

function clamp(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor))
}

export function pct(valor: number): string {
  return `${Math.round(valor * 100)}%`
}

export function pct1(valor: number): string {
  return `${(valor * 100).toFixed(1).replace('.', ',')}%`
}

function faixaDe(valor: number, minimo: number, maximo: number): Faixa {
  if (valor < minimo) return 'baixo'
  if (valor > maximo) return 'alto'
  return 'ideal'
}

function arredondarPara5(valor: number): number {
  return Math.max(0, Math.round(valor / 5) * 5)
}

const FRACOES_OITAVOS: Record<number, string> = {
  1: '⅛',
  2: '¼',
  3: '⅜',
  4: '½',
  5: '⅝',
  6: '¾',
  7: '⅞',
}

function formatarFracao(valor: number): string {
  const oitavos = Math.round(valor * 8)
  const inteiro = Math.floor(oitavos / 8)
  const resto = oitavos % 8
  const parteFracao = FRACOES_OITAVOS[resto]

  if (inteiro === 0) return parteFracao ?? '0'
  if (!parteFracao) return String(inteiro)
  return `${inteiro} ${parteFracao}`
}

export function formatarMedidaCaseira(gramas: number, gramasPorXicara: number): string {
  if (gramas <= 0) return ''

  const xicaras = gramas / gramasPorXicara
  if (xicaras >= 0.2) {
    return `${formatarFracao(xicaras)} xícara${xicaras >= 1.5 ? 's' : ''}`
  }

  const gramasPorColher = gramasPorXicara / 16
  const colheres = Math.max(0.5, Math.round((gramas / gramasPorColher) * 2) / 2)
  return `${formatarFracao(colheres)} colher${colheres > 1 ? 'es' : ''} de sopa`
}

function itensAtivos(ingredientesEstado: Record<string, number>): ItemAtivo[] {
  return Object.entries(ingredientesEstado)
    .filter(([, gramas]) => gramas > 0)
    .map(([id, gramas]) => ({ ingrediente: ingredientesPorId[id], gramas }))
    .filter((item): item is ItemAtivo => Boolean(item.ingrediente))
}

type MetricasVeredito = {
  G: number
  U: number
  S: number
  C: number
  Q: number
  F: number
  gorduraTotal: number
  salTotal: number
  pesoFinal: number
  tostagem: number
}

function decidirVeredito(m: MetricasVeredito): Veredito {
  const { G, U, S, C, Q, F, gorduraTotal, salTotal, pesoFinal, tostagem } = m

  if (Q > 0.8) {
    return {
      titulo: 'Queimou. Começa de novo.',
      tom: 'erro',
      dica: `Baixa a tostagem pra ${Math.max(0, Math.round(tostagem - 3))} da próxima vez.`,
    }
  }

  if (U > 0.45) {
    return {
      titulo: 'Isso virou pirão.',
      tom: 'erro',
      dica: `Aumenta a farinha em uns ${arredondarPara5(F * 0.3)} g ou reduz os ingredientes mais aquosos.`,
    }
  }

  if (U > 0.25) {
    return {
      titulo: 'Farofa molhada. Tem gente que gosta.',
      tom: 'alerta',
      dica: `Sobe a tostagem pra ${Math.min(10, Math.round(tostagem + 2))} ou reduz um ingrediente aquoso.`,
    }
  }

  if (C < 3) {
    return {
      titulo: 'Farofa murcha. Faltou tostar.',
      tom: 'alerta',
      dica: `Sobe a tostagem pra ${Math.min(10, Math.round(tostagem + 2))}.`,
    }
  }

  if (U < 0.05 && C > 6) {
    return {
      titulo: 'Areia da praia. Beba água.',
      tom: 'alerta',
      dica: 'Adiciona uns 40 g de cebola ou ovo mexido pra dar umidade.',
    }
  }

  if (G < 0.15) {
    const falta = arredondarPara5(0.28 * F - gorduraTotal)
    return {
      titulo: 'Seca e sem graça. Aumenta a gordura.',
      tom: 'alerta',
      dica: `Acrescenta mais ${falta > 0 ? falta : 20} g de manteiga ou dendê.`,
    }
  }

  if (G > 0.55) {
    const excesso = arredondarPara5(gorduraTotal - 0.4 * F)
    return {
      titulo: 'Encharcada de gordura.',
      tom: 'alerta',
      dica: `Tira uns ${excesso > 0 ? excesso : 20} g de manteiga ou dendê.`,
    }
  }

  if (S > 0.016) {
    const excesso = Math.max(1, Math.round(salTotal - 0.01 * pesoFinal))
    return {
      titulo: 'Salgada demais.',
      tom: 'alerta',
      dica: `Reduz o sal em uns ${excesso} g.`,
    }
  }

  if (S < 0.005) {
    const falta = Math.max(1, Math.round(0.01 * pesoFinal - salTotal))
    return {
      titulo: 'Faltou sal.',
      tom: 'alerta',
      dica: `Acrescenta uns ${falta} g de sal.`,
    }
  }

  return {
    titulo: 'No ponto.',
    tom: 'sucesso',
    dica: 'Essa aí tá equilibrada — guarda a receita.',
  }
}

function montarReceita(estado: Estado, itens: ItemAtivo[], pesoFinal: number, dadosFarinha: DadosFarinha): LinhaReceita[] {
  const fatorEscala = (estado.pessoas * 60) / pesoFinal
  const linhas: LinhaReceita[] = []

  const gramasFarinhaEscalados = arredondarPara5(estado.gramasFarinha * fatorEscala)
  linhas.push({
    id: 'farinha',
    nome: dadosFarinha.nome,
    gramas: gramasFarinhaEscalados,
    medidaCaseira: formatarMedidaCaseira(gramasFarinhaEscalados, dadosFarinha.gramasPorXicara),
  })

  for (const { ingrediente, gramas } of itens) {
    const gramasEscalados = arredondarPara5(gramas * fatorEscala)
    if (gramasEscalados <= 0) continue
    linhas.push({
      id: ingrediente.id,
      nome: ingrediente.nome,
      gramas: gramasEscalados,
      medidaCaseira: formatarMedidaCaseira(gramasEscalados, ingrediente.gramasPorXicara),
    })
  }

  if (estado.sal > 0) {
    const salEscalado = arredondarPara5(estado.sal * fatorEscala)
    if (salEscalado > 0) {
      linhas.push({ id: 'sal', nome: 'Sal', gramas: salEscalado, medidaCaseira: '' })
    }
  }

  return linhas
}

function montarPreparo(itens: ItemAtivo[], dadosFarinha: DadosFarinha): string[] {
  const passos: string[] = []
  const porCategoria = (categoria: Categoria) => itens.filter((item) => item.ingrediente.categoria === categoria)
  const nomes = (lista: ItemAtivo[]) => lista.map((item) => item.ingrediente.nome.toLowerCase()).join(', ')

  const gorduras = porCategoria('gordura')
  passos.push(
    gorduras.length > 0
      ? `Derreta ${nomes(gorduras)} em fogo médio.`
      : 'Aqueça a panela em fogo médio, sem gordura.',
  )

  const aromaticos = porCategoria('aromático')
  if (aromaticos.length > 0) {
    passos.push(`Refogue ${nomes(aromaticos)} até dourar.`)
  }

  const salgados = porCategoria('salgado')
  if (salgados.length > 0) {
    passos.push(`Adicione ${nomes(salgados)} e frite até soltar a gordura.`)
  }

  passos.push(`Junte a ${dadosFarinha.nome.toLowerCase()} aos poucos, mexendo sempre para não empelotar.`)

  const crocantes = porCategoria('crocante')
  if (crocantes.length > 0) {
    passos.push(`Misture ${nomes(crocantes)} fora do fogo, só no final, pra manter a crocância.`)
  }

  const finalizacao = [
    ...porCategoria('liga'),
    ...porCategoria('doce'),
    ...porCategoria('verde'),
    ...porCategoria('tempero'),
  ]
  passos.push(
    finalizacao.length > 0
      ? `Finalize com ${nomes(finalizacao)} e ajuste o sal.`
      : 'Ajuste o sal e sirva quente.',
  )

  return passos
}

export function simular(estado: Estado): Resultado {
  const dadosFarinha = farinhas[estado.farinha]
  const F = estado.gramasFarinha
  const itens = itensAtivos(estado.ingredientes)

  const gorduraTotal = itens.reduce((soma, { ingrediente, gramas }) => soma + (gramas * ingrediente.gordura) / 100, 0)
  const aguaTotal = itens.reduce((soma, { ingrediente, gramas }) => soma + (gramas * ingrediente.agua) / 100, 0)
  const salDosIngredientes = itens.reduce((soma, { ingrediente, gramas }) => soma + (gramas * ingrediente.sal) / 100, 0)
  const salTotal = estado.sal + salDosIngredientes
  const somaIngredientes = itens.reduce((soma, { gramas }) => soma + gramas, 0)
  const pesoBruto = F + somaIngredientes + estado.sal

  const G = gorduraTotal / F

  const fatorEvap = 0.1 + 0.08 * estado.tostagem
  const aguaResidual = aguaTotal * (1 - fatorEvap)
  const U = aguaResidual / (F * dadosFarinha.absorcao)

  const pesoFinal = pesoBruto - aguaTotal * fatorEvap
  const S = salTotal / pesoFinal

  const somaCrocancia = itens.reduce(
    (soma, { ingrediente, gramas }) => soma + ingrediente.crocancia * (gramas / F) * 3,
    0,
  )
  const C = clamp(
    5 +
      dadosFarinha.crocanciaBase +
      somaCrocancia +
      (estado.tostagem - 5) * 0.4 -
      Math.max(0, U - 0.2) * 12 -
      Math.max(0, G - 0.55) * 6,
    0,
    10,
  )

  const Q = Math.max(0, estado.tostagem - 8.5)

  const porcoes = pesoFinal / 60

  const somaPolemica = itens.reduce(
    (soma, { ingrediente, gramas }) => soma + ingrediente.polemica * Math.min(gramas / F, 0.5) * 8,
    0,
  )
  const polemica = clamp(somaPolemica, 0, 10)

  const faixas: Resultado['faixas'] = {
    G: faixaDe(G, 0.25, 0.4),
    U: faixaDe(U, 0.08, 0.2),
    S: faixaDe(S, 0.008, 0.012),
  }

  const veredito = decidirVeredito({
    G,
    U,
    S,
    C,
    Q,
    F,
    gorduraTotal,
    salTotal,
    pesoFinal,
    tostagem: estado.tostagem,
  })

  const receita = montarReceita(estado, itens, pesoFinal, dadosFarinha)
  const preparo = montarPreparo(itens, dadosFarinha)

  return {
    metricas: { G, U, S, C, Q },
    faixas,
    veredito,
    porcoes,
    pesoFinal,
    polemica,
    receita,
    preparo,
  }
}
