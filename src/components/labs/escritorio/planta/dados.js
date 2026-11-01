// Planta do andar como dados. É daqui que saem as zonas, as áreas e as
// bancadas; as cadeiras são geradas a partir das bancadas (lugares.js).
//
// Coordenadas em metros: x cresce para o leste (0 = fachada oeste, 67 =
// parede leste) e z cresce para o sul (-20 = parede do fundo, ao norte;
// 41,6 = fachada de vidro, ao sul). A recepção e a sala executiva ficam
// fora do retângulo, com x negativo.
//
// Para mudar o layout: mexa só em BANCADAS. Cada cadeira tem um nome fixo
// (zona-bancada-lado-posição). Depois rode npm run layout:escritorio (mostra
// o que muda no banco), npm test e npm run sql:escritorio.

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

/* Áreas onde o boneco sobe (modo boneco): as peças largas delas viram chão. */
export const SUBIR = ['arquibancada', 'palquinho'];

/* Pontos com nome que as piadas usam (nunca coordenadas soltas no código). */
export const PONTOS = {
  saida: { x: 36.9, z: -9.6 },               /* porta da Saída Norte */
  armarioJuridico: { x: 66.3, z: -15.7 },    /* armário alto na parede leste */
  quadro: { x: 63.35, z: -19.85 },           /* centro do quadro branco, na parede norte (ele fica de 0,95 a 2,2 m de altura) */
};

/* Bancadas: eixo 'z' = comprimento no sentido norte-sul (cadeiras a leste e
   a oeste); eixo 'x' = comprimento leste-oeste (cadeiras ao norte e ao sul).
   `lugares` é por lado.

   n = número da bancada dentro da zona. Ele vai no nome das cadeiras
   (leste-1-N-1) e por isso é escrito à mão e nunca muda: mover a bancada
   só muda x/z; bancada nova recebe o próximo número livre da zona; bancada
   tirada leva o número junto (não reaproveite). O teste da planta confere
   que nenhum número se repete na zona; npm run layout:escritorio mostra o
   que muda em relação ao layout publicado. */
const b = (zona, n, x, z, lugares, eixo) => ({ zona, n, x, z, lugares, eixo });
const passoSul = i => 3.5 + (i * 60) / 9;

export const BANCADAS = [
  /* norte */
  b('norte', 1, 3.5, -16.2, 4, 'z'),
  b('norte', 2, 8.5, -16.2, 4, 'z'),
  b('norte', 3, 13.5, -16.2, 4, 'z'),
  b('norte', 4, 18.5, -16.2, 4, 'z'),
  b('norte', 5, 23.5, -16.2, 4, 'z'),
  b('norte', 6, 42.5, -16.2, 4, 'z'),
  b('norte', 7, 47, -16.2, 4, 'z'),
  b('norte', 8, 3.5, -6.7, 4, 'z'),
  b('norte', 9, 8.5, -6.7, 4, 'z'),
  b('norte', 10, 13.5, -6.7, 4, 'z'),
  b('norte', 11, 18.5, -6.7, 4, 'z'),
  b('norte', 12, 23.5, -6.7, 4, 'z'),
  b('norte', 13, 42.5, -6.7, 4, 'z'),
  b('norte', 14, 47, -6.7, 4, 'z'),
  /* nordeste */
  b('nordeste', 1, 51.95, -16.2, 4, 'z'),
  b('nordeste', 2, 56.35, -16.2, 4, 'z'),
  b('nordeste', 3, 51.95, -6.7, 4, 'z'),
  b('nordeste', 4, 56.35, -6.7, 4, 'z'),
  /* leste */
  b('leste', 1, 63.35, -18.2, 5, 'x'),
  b('leste', 2, 63.35, -13.2, 5, 'x'),
  b('leste', 3, 63.35, -8.2, 5, 'x'),
  b('leste', 4, 63.35, -3.2, 5, 'x'),
  b('leste', 5, 63.35, 1.8, 5, 'x'),
  b('leste', 6, 63.35, 6.8, 5, 'x'),
  b('leste', 7, 63.35, 11.8, 5, 'x'),
  /* centro-oeste */
  b('centro-oeste', 1, passoSul(0), 20, 5, 'z'),
  b('centro-oeste', 2, passoSul(1), 20, 5, 'z'),
  b('centro-oeste', 3, passoSul(2), 20, 5, 'z'),
  b('centro-oeste', 4, passoSul(3), 20, 5, 'z'),
  b('centro-oeste', 5, passoSul(4), 20, 5, 'z'),
  /* centro */
  b('centro', 1, 37, 18.4, 6, 'z'),
  b('centro', 2, 42.5, 18.4, 6, 'z'),
  /* centro-leste */
  b('centro-leste', 1, 60.4, 19.6, 5, 'z'),
  b('centro-leste', 2, 64.6, 19.6, 5, 'z'),
  /* sul */
  b('sul', 1, passoSul(0), 28.3, 5, 'z'),
  b('sul', 2, passoSul(1), 28.3, 5, 'z'),
  b('sul', 3, passoSul(2), 28.3, 5, 'z'),
  b('sul', 4, passoSul(3), 28.3, 5, 'z'),
  b('sul', 5, passoSul(4), 28.3, 5, 'z'),
  b('sul', 6, passoSul(5), 28.3, 5, 'z'),
  b('sul', 7, passoSul(6), 28.3, 5, 'z'),
  b('sul', 8, passoSul(7), 28.3, 5, 'z'),
  b('sul', 9, passoSul(8), 28.3, 5, 'z'),
  b('sul', 10, passoSul(9), 28.3, 5, 'z'),
  b('sul', 11, passoSul(0), 37.8, 5, 'z'),
  b('sul', 12, passoSul(1), 37.8, 5, 'z'),
  b('sul', 13, passoSul(2), 37.8, 5, 'z'),
  b('sul', 14, passoSul(3), 37.8, 5, 'z'),
  b('sul', 15, passoSul(4), 37.8, 5, 'z'),
  b('sul', 16, passoSul(5), 37.8, 5, 'z'),
  b('sul', 17, passoSul(6), 37.8, 5, 'z'),
  b('sul', 18, passoSul(7), 37.8, 5, 'z'),
  b('sul', 19, passoSul(8), 37.8, 5, 'z'),
  b('sul', 20, passoSul(9), 37.8, 5, 'z'),
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
