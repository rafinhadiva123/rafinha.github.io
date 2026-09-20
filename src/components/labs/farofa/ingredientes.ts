export type Farinha = 'mandioca-fina' | 'mandioca-grossa' | 'mandioca-torrada' | 'fuba'

export type DadosFarinha = {
  id: Farinha
  nome: string
  absorcao: number
  crocanciaBase: number
  gramasPorXicara: number
}

export const farinhas: Record<Farinha, DadosFarinha> = {
  'mandioca-fina': {
    id: 'mandioca-fina',
    nome: 'Mandioca fina',
    absorcao: 1.0,
    crocanciaBase: 0,
    gramasPorXicara: 120,
  },
  'mandioca-grossa': {
    id: 'mandioca-grossa',
    nome: 'Mandioca grossa (biju)',
    absorcao: 0.6,
    crocanciaBase: 2,
    gramasPorXicara: 90,
  },
  'mandioca-torrada': {
    id: 'mandioca-torrada',
    nome: 'Mandioca torrada/flocada',
    absorcao: 0.8,
    crocanciaBase: 1,
    gramasPorXicara: 110,
  },
  fuba: {
    id: 'fuba',
    nome: 'Fubá (milho)',
    absorcao: 1.2,
    crocanciaBase: -1,
    gramasPorXicara: 160,
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
}

export const ingredientes: Ingrediente[] = [
  {
    id: '1',
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
  },
  {
    id: '2',
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
  },
  {
    id: '3',
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
  },
  {
    id: '4',
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
  },
  {
    id: '5',
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
  },
  {
    id: '6',
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
  },
  {
    id: '7',
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
  },
  {
    id: '8',
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
  },
  {
    id: '9',
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
  },
  {
    id: '10',
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
  },
  {
    id: '11',
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
  },
  {
    id: '12',
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
  },
  {
    id: '13',
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
  },
  {
    id: '14',
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
  },
  {
    id: '15',
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
  },
]

export const ingredientesPorId: Record<string, Ingrediente> = Object.fromEntries(
  ingredientes.map((ingrediente) => [ingrediente.id, ingrediente]),
)
