import type { Estado } from './modelo'

export type NomePreset = 'churrasco' | 'natalina' | 'banana' | 'nordestina' | 'vegana'

export const presets: Record<NomePreset, { nome: string; estado: Estado }> = {
  churrasco: {
    nome: 'Churrasco',
    estado: {
      farinha: 'mandioca-grossa',
      gramasFarinha: 300,
      ingredientes: { '1': 40, '3': 80, '6': 50, '7': 15, '8': 10 },
      sal: 3,
      tostagem: 6,
      pessoas: 4,
    },
  },
  natalina: {
    nome: 'Natalina',
    estado: {
      farinha: 'mandioca-fina',
      gramasFarinha: 300,
      ingredientes: { '1': 40, '13': 30, '9': 50, '11': 60, '6': 50 },
      sal: 3,
      tostagem: 5,
      pessoas: 4,
    },
  },
  banana: {
    nome: 'De banana',
    estado: {
      farinha: 'mandioca-fina',
      gramasFarinha: 300,
      ingredientes: { '1': 70, '12': 80, '6': 50 },
      sal: 3,
      tostagem: 6,
      pessoas: 4,
    },
  },
  nordestina: {
    nome: 'Nordestina',
    estado: {
      farinha: 'mandioca-torrada',
      gramasFarinha: 300,
      ingredientes: { '2': 30, '4': 80, '5': 60, '15': 20 },
      sal: 2,
      tostagem: 7,
      pessoas: 4,
    },
  },
  vegana: {
    nome: 'Vegana',
    estado: {
      farinha: 'mandioca-grossa',
      gramasFarinha: 300,
      ingredientes: { '2': 30, '6': 50, '7': 15, '9': 50, '14': 30, '8': 10 },
      sal: 3,
      tostagem: 6,
      pessoas: 4,
    },
  },
}
