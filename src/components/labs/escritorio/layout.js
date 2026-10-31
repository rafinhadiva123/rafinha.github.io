// Planta do escritório colaborativo, em metros. Quatro ilhas de mesa (2 × 2),
// cinco cadeiras de cada lado. Para crescer, acrescente ilhas em ILHAS e
// atualize o limite de `lugar` no supabase/escritorio.sql.
//
//        parede norte (quadro branco)
//   ┌───────────────────────────────────┐
//   │  [ilha 1]            [ilha 2]     │  ← armário (leste)
//   │                                   │
//   porta ── corredor do café ────────── │  TV
//   │                                   │
//   │  [ilha 3]            [ilha 4]     │
//   └───────────────────────────────────┘

export const SALA = { x0: -9.6, x1: 9.6, z0: -5.8, z1: 5.8, altura: 3 };

/* centro de cada ilha: cx no eixo x, zc no eixo z */
export const ILHAS = [
  { cx: -4.4, zc: -2.2 },
  { cx: 4.4, zc: -2.2 },
  { cx: -4.4, zc: 2.9 },
  { cx: 4.4, zc: 2.9 },
];

export const MESA = { meia: 3.5, profundidade: 1.7 };
export const COLUNAS = [-2.7, -1.35, 0, 1.35, 2.7];

/* corredor horizontal entre as fileiras de ilhas */
export const CORREDOR = { cafe: 0.55, fuga: -0.05 };

/* Lado A olha para +z (de costas para o norte); lado B olha para -z.
   `posto` é onde fica o monitor na mesa, virado para quem senta. */
export const LUGARES = [];
ILHAS.forEach((ilha, n) => {
  [
    { lado: 'A', dz: -1.45, dp: -0.38, giro: 0 },
    { lado: 'B', dz: 1.45, dp: 0.38, giro: Math.PI },
  ].forEach(l => {
    COLUNAS.forEach(dx => {
      LUGARES.push({
        x: ilha.cx + dx,
        z: ilha.zc + l.dz,
        giro: l.giro,
        ilha: n,
        lado: l.lado,
        posto: { x: ilha.cx + dx, z: ilha.zc + l.dp, giro: l.giro },
      });
    });
  });
});

export const TOTAL = LUGARES.length;
