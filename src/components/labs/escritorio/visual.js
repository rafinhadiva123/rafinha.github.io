// O que cada visitante pode escolher ao montar o personagem, e a limpeza do
// que vem do banco. Como qualquer pessoa consegue gravar direto na API,
// nada do banco é usado sem passar por `sanearVisual` e `sanearApelido`.

export const APELIDO_MAX = 18;

export const OPCOES = {
  pele: ['#F6DDC7', '#F1D2B8', '#E9C4A2', '#D9AC86', '#C28D64', '#A06E48', '#7D5134', '#5A3825'],
  cabelo: [
    { v: 'curto', rot: 'Curto' },
    { v: 'topete', rot: 'Topete' },
    { v: 'medio', rot: 'Médio' },
    { v: 'longo', rot: 'Longo' },
    { v: 'coque', rot: 'Coque' },
    { v: 'calvoFrente', rot: 'Entradas' },
    { v: 'careca', rot: 'Careca' },
  ],
  corCabelo: ['#15110F', '#3A2517', '#6B4A2E', '#A0522D', '#D2B06E', '#B9B4AC'],
  /* camisa social de manga comprida: branca, verde, azul, rosa, rosa clara, preta e cinza */
  camisa: ['#F4F3EF', '#2F6F5E', '#3E5A7A', '#D9849B', '#F2C4CF', '#23262B', '#8A8F98'],
  barba: [
    { v: 'nenhuma', rot: 'Nenhuma' },
    { v: 'barbinha', rot: 'Barbinha' },
    { v: 'cheia', rot: 'Cheia' },
  ],
  oculos: [
    { v: 'nenhum', rot: 'Nenhum' },
    { v: 'normal', rot: 'Retangular' },
    { v: 'redondo', rot: 'Redondo' },
  ],
  silhueta: [
    { v: 'pequena', rot: 'Pequena' },
    { v: 'media', rot: 'Média' },
    { v: 'grande', rot: 'Grande' },
  ],
  acessorio: [
    { v: 'nenhum', rot: 'Nenhum' },
    { v: 'laco', rot: 'Laço' },
    { v: 'fone', rot: 'Headset' },
  ],
  corLaco: ['#E98AB0', '#D2334A', '#F2C14E', '#5B8DEF'],
  altura: [
    { v: 'baixa', rot: 'Baixa', esc: 0.92 },
    { v: 'media', rot: 'Média', esc: 0.965 },
    { v: 'alta', rot: 'Alta', esc: 1.03 },
  ],
};

const valores = lista => lista.map(o => (typeof o === 'string' ? o : o.v));

export const PADRAO = {
  pele: OPCOES.pele[1],
  cabelo: 'curto',
  corCabelo: OPCOES.corCabelo[1],
  camisa: OPCOES.camisa[0],
  barba: 'nenhuma',
  oculos: 'nenhum',
  silhueta: 'media',
  acessorio: 'nenhum',
  corLaco: OPCOES.corLaco[0],
  altura: 'media',
};

/** Mantém só valores do catálogo; o resto volta ao padrão. */
export function sanearVisual(bruto) {
  const v = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {};
  const limpo = {};
  for (const chave of Object.keys(PADRAO)) {
    const ok = valores(OPCOES[chave]);
    limpo[chave] = ok.includes(v[chave]) ? v[chave] : PADRAO[chave];
  }
  return limpo;
}

/** Tira caracteres de controle e invisíveis, junta espaços e corta no limite. */
export function sanearApelido(bruto) {
  if (typeof bruto !== 'string') return '';
  const s = bruto
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .trim();
  return [...s].slice(0, APELIDO_MAX).join('').trim();
}

/** Um visual sorteado, usando `aleatorio` (0..1) para dar para testar. */
export function sortearVisual(aleatorio = Math.random) {
  const pega = lista => {
    const vs = valores(lista);
    return vs[Math.floor(aleatorio() * vs.length) % vs.length];
  };
  return {
    pele: pega(OPCOES.pele),
    cabelo: pega(OPCOES.cabelo),
    corCabelo: pega(OPCOES.corCabelo),
    camisa: pega(OPCOES.camisa),
    barba: aleatorio() < 0.7 ? 'nenhuma' : pega(OPCOES.barba),
    oculos: aleatorio() < 0.6 ? 'nenhum' : pega(OPCOES.oculos),
    silhueta: pega(OPCOES.silhueta),
    acessorio: aleatorio() < 0.65 ? 'nenhum' : pega(OPCOES.acessorio),
    corLaco: pega(OPCOES.corLaco),
    altura: pega(OPCOES.altura),
  };
}

/** Converte apelido + visual no formato que a cena usa para montar o boneco. */
export function paraBoneco(apelido, visual) {
  const v = sanearVisual(visual);
  return {
    nome: apelido,
    pele: v.pele,
    cabelo: v.cabelo,
    cor: v.corCabelo,
    camisa: v.camisa,
    barba: v.barba === 'nenhuma' ? null : v.barba,
    oculos: v.oculos === 'nenhum' ? null : v.oculos,
    silhueta: v.silhueta,
    laco: v.acessorio === 'laco' ? v.corLaco : null,
    fone: v.acessorio === 'fone',
    altura: OPCOES.altura.find(a => a.v === v.altura).esc,
  };
}
