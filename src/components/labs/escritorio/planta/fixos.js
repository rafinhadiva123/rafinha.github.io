// Os 15 personagens que já existem no simulador, cada um na sua cadeira.
// Viram personagens comuns (criados pela dona do site), com o apelido
// reservado e as piadas presas a eles, não à cadeira.
//
// Campos de visual iguais aos do boneco (render/boneco.js):
// cabelo: careca | calvoFrente | curto | medio | longo | coque | chanel | topete | baguncado
// Piadas: acumulador (pilha de papel), retrato (porta-retrato na mesa),
// perseguidor (corre atrás do fugitivo do armário), sanduiche (come quando
// clicam nela), filma (grava quem está comendo).

export const FIXOS = [
  /* Leste · bancada 1 · lado norte, de costas para o quadro (oeste → leste) */
  { apelido: 'Gabi', lugar: 'leste-1-N-1', pele: '#EFCDB0', cabelo: 'curto', cor: '#4A3322', camisa: '#3E5A7A', barba: 'barbinha' },
  { apelido: 'Shimono', lugar: 'leste-1-N-2', pele: '#F0D3B4', cabelo: 'curto', cor: '#15110F', camisa: '#F4F3EF', social: true, olhos: 'puxados' },
  { apelido: 'Formiga', lugar: 'leste-1-N-3', pele: '#EAC6A6', cabelo: 'curto', cor: '#3A2A1E', camisa: '#4E7A5E', altura: 1.09 },
  { apelido: 'Marlin', lugar: 'leste-1-N-4', pele: '#EFCDB0', cabelo: 'curto', cor: '#D2B06E', camisa: '#4C5B4A', barba: 'cheia', oculos: 'normal' },
  { apelido: 'Matias', lugar: 'leste-1-N-5', pele: '#F2D4BA', cabelo: 'curto', cor: '#6B4A2E', camisa: '#33373C', altura: 0.93 },

  /* Leste · bancada 1 · lado sul, de frente para eles */
  { apelido: 'João', lugar: 'leste-1-S-1', pele: '#EDC9A9', cabelo: 'curto', cor: '#3B2A1D', camisa: '#6D7B8C', barba: 'cheia', oculos: 'normal' },
  { apelido: 'Higuinho', lugar: 'leste-1-S-2', pele: '#F0CFB2', cabelo: 'curto', cor: '#1E1712', camisa: '#B08A3E', oculos: 'normal' },
  { apelido: 'Erik', lugar: 'leste-1-S-3', pele: '#F1D1B6', cabelo: 'calvoFrente', cor: '#CDAA6E', camisa: '#2C3E50' },
  { apelido: 'Wendel', lugar: 'leste-1-S-4', pele: '#E9C4A2', cabelo: 'curto', cor: '#2B1E15', camisa: '#C4633F' },
  { apelido: 'Elton', lugar: 'leste-1-S-5', pele: '#EFCCAE', cabelo: 'curto', cor: '#3E2B1D', camisa: '#4A5A6E', acumulador: true },

  /* Nordeste · bancada 2 · lado leste (norte → sul, a Jana encostada na parede) */
  { apelido: 'Jana', lugar: 'nordeste-2-L-1', pele: '#F0D0B4', cabelo: 'chanel', cor: '#141112', camisa: '#3D5C46', mulher: true, filma: true },
  { apelido: 'Heitor', lugar: 'nordeste-2-L-2', pele: '#EBC7A7', cabelo: 'topete', cor: '#5C3A22', camisa: '#3F4A5A' },
  { apelido: 'Lika', lugar: 'nordeste-2-L-3', pele: '#F2D6BC', cabelo: 'coque', cor: '#120E0C', camisa: '#8E5B7A', olhos: 'puxados', mulher: true, sanduiche: true },
  { apelido: 'Rafa', lugar: 'nordeste-2-L-4', pele: '#F1D2B8', cabelo: 'medio', cor: '#3A2517', camisa: '#2F6F5E', altura: 0.9, laco: '#E98AB0', mulher: true },

  /* Nordeste · bancada 4 · lado leste */
  { apelido: 'Sem sangue', lugar: 'nordeste-4-L-1', pele: '#F7E4D5', cabelo: 'baguncado', cor: '#121010', camisa: '#B5B1A8', oculos: 'redondo', retrato: 'Dani', perseguidor: true },
];

/** Normaliza um apelido para comparar: sem acento, minúsculo, espaços juntos. */
export function chaveApelido(apelido) {
  return String(apelido)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

export const APELIDOS_RESERVADOS = new Set(FIXOS.map(f => chaveApelido(f.apelido)));
