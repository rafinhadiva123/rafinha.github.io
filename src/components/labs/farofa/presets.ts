import type { Estado } from './modelo'

export type NomePreset = 'churrasco' | 'natalina' | 'banana' | 'nordestina' | 'vegana'

export const presets: Record<NomePreset, { nome: string; estado: Estado }> = {
  churrasco: {
    nome: 'Churrasco',
    estado: {
      farinha: 'mandioca-grossa',
      gramasFarinha: 300,
      ingredientes: { manteiga: 40, bacon: 80, cebola: 50, alho: 15, cheiroverde: 10 },
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
      ingredientes: { manteiga: 40, passas: 30, castanha: 50, ovo: 60, cebola: 50 },
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
      ingredientes: { manteiga: 70, banana: 80, cebola: 50 },
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
      ingredientes: { dende: 30, calabresa: 80, coalho: 60, pimenta: 20 },
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
      ingredientes: { dende: 30, cebola: 50, alho: 15, castanha: 50, couve: 30, cheiroverde: 10 },
      sal: 3,
      tostagem: 6,
      pessoas: 4,
    },
  },
}
