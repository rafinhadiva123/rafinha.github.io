// Gera as cadeiras a partir das bancadas, cada uma com um nome fixo:
//   <zona>-<bancada>-<lado>-<posição>   ex.: leste-1-N-1, nordeste-2-L-4
// bancada: numerada dentro da zona, do norte para o sul e, empatando, do
//          oeste para o leste;
// lado:    N/S nas bancadas de eixo x, O/L nas de eixo z;
// posição: oeste→leste nas de eixo x, norte→sul nas de eixo z.
// Mover uma bancada só muda coordenadas: o nome das cadeiras continua.
import { BANCADAS, BANCADA, ZONAS, AREAS, AVULSAS } from './dados.js';

export function gerarLugares(bancadas = BANCADAS, avulsas = AVULSAS) {
  const porZona = new Map();
  bancadas.forEach((b, indice) => {
    if (!porZona.has(b.zona)) porZona.set(b.zona, []);
    porZona.get(b.zona).push({ ...b, indice });
  });

  const lugares = [];
  for (const [zona, lista] of porZona) {
    lista.sort((a, b) => a.z - b.z || a.x - b.x);
    lista.forEach((b, k) => {
      const n = k + 1;
      const comprimento = b.lugares * BANCADA.passo;
      for (const s of [-1, 1]) {
        for (let i = 0; i < b.lugares; i++) {
          const ao = -comprimento / 2 + BANCADA.passo / 2 + i * BANCADA.passo; /* ao longo do eixo */
          const fora = s * BANCADA.afastamentoCadeira;                         /* para fora da bancada */
          const x = b.eixo === 'z' ? b.x + fora : b.x + ao;
          const z = b.eixo === 'z' ? b.z + ao : b.z + fora;
          const lado = b.eixo === 'z' ? (s > 0 ? 'L' : 'O') : (s > 0 ? 'S' : 'N');
          /* olha para o meio da bancada; giro 0 = olhando para +z */
          const giro = b.eixo === 'z' ? -s * Math.PI / 2 : (s > 0 ? Math.PI : 0);
          lugares.push({ id: `${zona}-${n}-${lado}-${i + 1}`, zona, bancada: n, lado, pos: i + 1, x, z, giro, banc: b.indice });
        }
      }
    });
  }
  /* cadeiras avulsas (recepção, sala executiva): nome = área + número */
  for (const a of avulsas) lugares.push({ id: a.id, zona: null, area: a.area, x: a.x, z: a.z, giro: a.giro, dy: a.dy || 0 });
  return lugares;
}

export const LUGARES = gerarLugares();
export const LUGAR = new Map(LUGARES.map(l => [l.id, l]));
export const TOTAL_LUGARES = LUGARES.length;

const NOME_LADO = { N: 'norte', S: 'sul', L: 'leste', O: 'oeste' };
const NOME_ZONA = new Map([...ZONAS, ...AREAS].map(z => [z.id, z.nome]));

/** "Leste · bancada 1 · lado norte · cadeira 1" */
export function descreverLugar(id) {
  const l = LUGAR.get(id);
  if (!l) return null;
  if (!l.zona) return `${NOME_ZONA.get(l.area)} · cadeira ${l.id.split('-').pop()}`;
  return `${NOME_ZONA.get(l.zona)} · bancada ${l.bancada} · lado ${NOME_LADO[l.lado]} · cadeira ${l.pos}`;
}

/** O que dá para mostrar na tela sobre a cadeira, sem zona nem número de
    bancada: o nome da área para as avulsas ("Recepção"), null para as de
    bancada. As zonas existem só por dentro (nomes das cadeiras). */
export function nomeDaArea(id) {
  const l = LUGAR.get(id);
  return l && !l.zona ? NOME_ZONA.get(l.area) || null : null;
}

/** Compara dois layouts: quais cadeiras somem e quais aparecem. */
export function compararLayouts(antes, depois) {
  const a = new Set(antes.map(l => l.id));
  const d = new Set(depois.map(l => l.id));
  return {
    removidas: [...a].filter(id => !d.has(id)),
    novas: [...d].filter(id => !a.has(id)),
  };
}
