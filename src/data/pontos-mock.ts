// Dados de teste locais (PUBLIC_PONTOS_API=mock). Espelha sheets/modelo-*.csv.
// Saldos: Ana 700 · Bruno 120 · Carla 80  (1€=1pt, indicação=300, resgate lavagem=-100)

export const pontosMock = {
  '934000001': {
    ok: true as const,
    nome: 'Ana',
    saldo: 700,
    movimentos: [
      { data: '2026-10-20', tipo: 'resgate', valorEur: null, pontos: -100, nota: 'Lavagem exterior' },
      { data: '2026-10-15', tipo: 'indicacao', valorEur: null, pontos: 300, nota: 'trouxe o Bruno Martins' },
      { data: '2026-10-10', tipo: 'gasto', valorEur: 500, pontos: 500, nota: 'revisão e travões' },
    ],
    premios: null as null, // usa os do HTML / API default
  },
  '934000002': {
    ok: true as const,
    nome: 'Bruno',
    saldo: 120,
    movimentos: [
      { data: '2026-10-12', tipo: 'gasto', valorEur: 120, pontos: 120, nota: 'mudança de óleo' },
    ],
    premios: null,
  },
  '934000003': {
    ok: true as const,
    nome: 'Carla',
    saldo: 80,
    movimentos: [
      { data: '2026-10-18', tipo: 'gasto', valorEur: 80, pontos: 80, nota: 'diagnóstico' },
    ],
    premios: null,
  },
};
