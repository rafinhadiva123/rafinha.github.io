// Planta do andar como dados. É daqui que saem as zonas, as áreas e as
// bancadas; as cadeiras são geradas a partir das bancadas (lugares.js).
//
// Coordenadas em metros: x cresce para o leste (0 = fachada oeste, 67 =
// parede leste) e z cresce para o sul (-20 = parede do fundo, ao norte;
// 41,6 = fachada de vidro, ao sul). A recepção e a sala executiva ficam
// fora do retângulo, com x negativo.
//
// Para mudar o layout: mexa só em BANCADAS. Cada cadeira tem um nome fixo
// (zona-bancada-lado-posição); o teste de layout avisa se algum personagem
// salvo ficaria sem cadeira.

export const ANDAR = { largura: 67, profundidade: 41.6, norte: -20, altura: 3.2 };

/* r = [x0, z0, x1, z1] */
export const ZONAS = [
  { id: 'norte', nome: 'Norte', r: [1.6, -19.4, 48.9, -2.1] },
  { id: 'nordeste', nome: 'Nordeste', r: [50.1, -19.4, 58.2, -3.5] },
  { id: 'leste', nome: 'Leste', r: [59.5, -19.8, 66.9, 13.4] },
  { id: 'centro-oeste', nome: 'Centro-oeste', r: [1.8, 16.3, 31.9, 23.7] },
  { id: 'centro', nome: 'Centro', r: [35.3, 14, 44.2, 22.8] },
  { id: 'centro-leste', nome: 'Centro-leste', r: [58.7, 15.9, 66.4, 23.3] },
  { id: 'sul', nome: 'Sul', r: [1.8, 24.6, 65.2, 41.5] },
];

export const AREAS = [
  { id: 'recepcao', nome: 'Recepção', r: [-18.5, -3.6, 0, 16.5] },
  { id: 'sala-executiva', nome: 'Sala executiva Oeste', r: [-10, 16.5, 0, 28] },
  { id: 'aquario-centro-oeste', nome: 'Aquário Centro-oeste', r: [14.5, 7, 26.8, 11] },
  { id: 'armarios-centro-oeste', nome: 'Armários Centro-oeste', r: [26.8, 9, 33, 11] },
  { id: 'arquibancada', nome: 'Arquibancada', r: [36.5, 0.9, 43.5, 10.4] },
  { id: 'lounge-sofas', nome: 'Lounge dos sofás', r: [44, 0.9, 55.6, 10.4] },
  { id: 'palquinho', nome: 'Palquinho', r: [46.6, 11.6, 56.4, 20.4] },
  { id: 'saida-norte', nome: 'Saída Norte', r: [26, -20, 38.8, -10.1] },
  { id: 'aquario-norte', nome: 'Aquário Norte', r: [26, -9.9, 35, -6.3] },
  { id: 'armario-norte', nome: 'Armário Norte', r: [2.6, -0.8, 33, 0.3] },
  { id: 'armario-bancada-norte', nome: 'Armário bancada Norte', r: [10.4, -19.4, 11.6, -5.2] },
];

/* Pontos com nome que as piadas usam (nunca coordenadas soltas no código). */
export const PONTOS = {
  saida: { x: 36.9, z: -9.6 },               /* porta da Saída Norte */
  armarioJuridico: { x: 66.3, z: -15.7 },    /* armário alto na parede leste */
  cafe: { x: 18, z: 7.9 },                   /* bancada de café do Aquário Centro-oeste */
};

/* Bancadas: eixo 'z' = comprimento no sentido norte-sul (cadeiras a leste e
   a oeste); eixo 'x' = comprimento leste-oeste (cadeiras ao norte e ao sul).
   `lugares` é por lado. */
const linha = (zona, xs, zs, lugares, eixo) =>
  xs.flatMap(x => zs.map(z => ({ zona, x, z, lugares, eixo })));
const passoSul = i => 3.5 + (i * 60) / 9;

export const BANCADAS = [
  ...linha('norte', [3.5, 8.5, 13.5, 18.5, 23.5, 42.5, 47], [-16.2, -6.7], 4, 'z'),
  ...linha('nordeste', [51.95, 56.35], [-16.2, -6.7], 4, 'z'),
  ...linha('leste', [63.35], [-18.2, -13.2, -8.2, -3.2, 1.8, 6.8, 11.8], 5, 'x'),
  ...linha('centro-oeste', [0, 1, 2, 3, 4].map(passoSul), [20], 5, 'z'),
  ...linha('centro', [37, 42.5], [18.4], 6, 'z'),
  ...linha('centro-leste', [60.4, 64.6], [19.6], 5, 'z'),
  ...linha('sul', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(passoSul), [28.3, 37.8], 5, 'z'),
];

/* Cadeiras fora das bancadas, que também recebem personagens. O nome é a
   área + número. giro 0 = olhando para +z (sul); dy = assento mais alto. */
export const AVULSAS = [
  { id: 'recepcao-1', area: 'recepcao', x: -11.7, z: 4.3, giro: Math.PI / 2 },      /* atrás do balcão, olhando para o leste */
  { id: 'recepcao-2', area: 'recepcao', x: -11.7, z: 7.5, giro: Math.PI / 2 },
  { id: 'sala-executiva-1', area: 'sala-executiva', x: -5, z: 26.1, giro: Math.PI, dy: 0.06 }, /* cadeira de couro, de frente para a mesa e o quadro */
];

/* Medidas da bancada (iguais às da planta original). */
export const BANCADA = { passo: 1.4, afastamentoCadeira: 1.15, profundidade: 1.6, alturaTampo: 0.72 };
