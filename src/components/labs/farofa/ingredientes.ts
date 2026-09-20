export type Farinha = 'mandioca-fina' | 'mandioca-grossa' | 'mandioca-torrada' | 'fuba'

export type DadosFarinha = {
  id: Farinha
  nome: string
  desc: string
  absorcao: number
  crocanciaBase: number
  gramasPorXicara: number
  cor: string
}

export const farinhas: Record<Farinha, DadosFarinha> = {
  'mandioca-fina': {
    id: 'mandioca-fina',
    nome: 'Mandioca fina',
    desc: 'absorve muito',
    absorcao: 1.0,
    crocanciaBase: 0,
    gramasPorXicara: 120,
    cor: '#efdfb8',
  },
  'mandioca-grossa': {
    id: 'mandioca-grossa',
    nome: 'Mandioca grossa (biju)',
    desc: 'leve, crocante',
    absorcao: 0.6,
    crocanciaBase: 2,
    gramasPorXicara: 90,
    cor: '#f2e4c2',
  },
  'mandioca-torrada': {
    id: 'mandioca-torrada',
    nome: 'Mandioca torrada/flocada',
    desc: 'meio-termo',
    absorcao: 0.8,
    crocanciaBase: 1,
    gramasPorXicara: 110,
    cor: '#e3caa0',
  },
  fuba: {
    id: 'fuba',
    nome: 'Fubá (milho)',
    desc: 'empapa fácil',
    absorcao: 1.2,
    crocanciaBase: -1,
    gramasPorXicara: 160,
    cor: '#f4d780',
  },
}

export type Categoria =
  | 'gordura'
  | 'salgado'
  | 'aromático'
  | 'crocante'
  | 'liga'
  | 'doce'
  | 'verde'
  | 'tempero'

export type Ingrediente = {
  id: string
  nome: string
  gordura: number
  agua: number
  sal: number
  acucar: number
  crocancia: number
  polemica: number
  categoria: Categoria
  gramasPadrao: number
  gramasPorXicara: number
  cor: string
}

export const ingredientes: Ingrediente[] = [
  {
    id: 'manteiga',
    nome: 'Manteiga',
    gordura: 82,
    agua: 16,
    sal: 0.0,
    acucar: 0,
    crocancia: 0,
    polemica: 0,
    categoria: 'gordura',
    gramasPadrao: 40,
    gramasPorXicara: 200,
    cor: '#f7d24e',
  },
  {
    id: 'dende',
    nome: 'Azeite de dendê',
    gordura: 100,
    agua: 0,
    sal: 0.0,
    acucar: 0,
    crocancia: 0,
    polemica: 1,
    categoria: 'gordura',
    gramasPadrao: 30,
    gramasPorXicara: 220,
    cor: '#e8721f',
  },
  {
    id: 'bacon',
    nome: 'Bacon',
    gordura: 45,
    agua: 15,
    sal: 2.5,
    acucar: 0,
    crocancia: 2,
    polemica: 0,
    categoria: 'salgado',
    gramasPadrao: 80,
    gramasPorXicara: 150,
    cor: '#e08a7a',
  },
  {
    id: 'calabresa',
    nome: 'Linguiça calabresa',
    gordura: 30,
    agua: 40,
    sal: 2.0,
    acucar: 0,
    crocancia: 1,
    polemica: 0,
    categoria: 'salgado',
    gramasPadrao: 80,
    gramasPorXicara: 140,
    cor: '#c8543f',
  },
  {
    id: 'coalho',
    nome: 'Queijo coalho',
    gordura: 25,
    agua: 40,
    sal: 1.8,
    acucar: 0,
    crocancia: 1,
    polemica: 1,
    categoria: 'salgado',
    gramasPadrao: 60,
    gramasPorXicara: 130,
    cor: '#f5ecd0',
  },
  {
    id: 'cebola',
    nome: 'Cebola',
    gordura: 0,
    agua: 89,
    sal: 0.0,
    acucar: 4,
    crocancia: -1,
    polemica: 0,
    categoria: 'aromático',
    gramasPadrao: 50,
    gramasPorXicara: 160,
    cor: '#dcab6e',
  },
  {
    id: 'alho',
    nome: 'Alho',
    gordura: 0,
    agua: 59,
    sal: 0.0,
    acucar: 1,
    crocancia: 0,
    polemica: 0,
    categoria: 'aromático',
    gramasPadrao: 15,
    gramasPorXicara: 150,
    cor: '#f6f0e0',
  },
  {
    id: 'cheiroverde',
    nome: 'Cheiro-verde',
    gordura: 0,
    agua: 90,
    sal: 0.0,
    acucar: 0,
    crocancia: 0,
    polemica: 0,
    categoria: 'aromático',
    gramasPadrao: 10,
    gramasPorXicara: 40,
    cor: '#5fae42',
  },
  {
    id: 'castanha',
    nome: 'Castanha-de-caju',
    gordura: 44,
    agua: 5,
    sal: 0.0,
    acucar: 6,
    crocancia: 3,
    polemica: 0,
    categoria: 'crocante',
    gramasPadrao: 50,
    gramasPorXicara: 140,
    cor: '#e8c98a',
  },
  {
    id: 'amendoim',
    nome: 'Amendoim torrado',
    gordura: 49,
    agua: 2,
    sal: 0.0,
    acucar: 4,
    crocancia: 3,
    polemica: 1,
    categoria: 'crocante',
    gramasPadrao: 50,
    gramasPorXicara: 150,
    cor: '#c9905a',
  },
  {
    id: 'ovo',
    nome: 'Ovo mexido',
    gordura: 10,
    agua: 75,
    sal: 0.3,
    acucar: 0,
    crocancia: -2,
    polemica: 0,
    categoria: 'liga',
    gramasPadrao: 60,
    gramasPorXicara: 120,
    cor: '#f6c63f',
  },
  {
    id: 'banana',
    nome: 'Banana-da-terra',
    gordura: 0,
    agua: 65,
    sal: 0.0,
    acucar: 20,
    crocancia: -2,
    polemica: 2,
    categoria: 'doce',
    gramasPadrao: 80,
    gramasPorXicara: 150,
    cor: '#e5b544',
  },
  {
    id: 'passas',
    nome: 'Uva-passa',
    gordura: 0,
    agua: 15,
    sal: 0.0,
    acucar: 59,
    crocancia: 0,
    polemica: 3,
    categoria: 'doce',
    gramasPadrao: 30,
    gramasPorXicara: 170,
    cor: '#6b3c5e',
  },
  {
    id: 'couve',
    nome: 'Couve fatiada',
    gordura: 0,
    agua: 90,
    sal: 0.0,
    acucar: 1,
    crocancia: -1,
    polemica: 0,
    categoria: 'verde',
    gramasPadrao: 30,
    gramasPorXicara: 50,
    cor: '#3f8c33',
  },
  {
    id: 'pimenta',
    nome: 'Pimenta-biquinho',
    gordura: 0,
    agua: 88,
    sal: 0.5,
    acucar: 2,
    crocancia: 0,
    polemica: 2,
    categoria: 'tempero',
    gramasPadrao: 20,
    gramasPorXicara: 140,
    cor: '#d83b2c',
  },
]

export const ingredientesPorId: Record<string, Ingrediente> = Object.fromEntries(
  ingredientes.map((ingrediente) => [ingrediente.id, ingrediente]),
)
