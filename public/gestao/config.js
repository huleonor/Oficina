/*
 * Configuração da gestão da INOVACAR.
 *
 * apiUrl: o URL /exec do Apps Script da sheet dos tempos (sheets/Tempos.gs, ver sheets/TEMPOS-SHEET.md).
 *   Sem PIN: a página liga-se sozinha.
 *   Vazio: a página abre em modo de demonstração, com dados só neste navegador.
 */
window.GESTAO = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbxp8IXjzHlfL99C9JImf7s-4jqkv9P70azZ4HrQjtTwvVd9-ls_mmW8TaeCI9ZziCPL/exec',

  // Horário de abertura: os tempos contam só as horas em que a oficina está aberta.
  horario: { dias: [1, 2, 3, 4, 5], abre: '09:00', fecha: '18:30' },

  // Os serviços do site, pela mesma ordem.
  servicos: [
    'Manutenção e mudança de óleo',
    'Travões',
    'Diagnóstico de avarias',
    'Bateria e arranque',
    'Suspensão e direção',
    'Embraiagem e caixa de velocidades',
    'Motor e correia de distribuição',
    'Pré-inspeção e mecânica geral',
    'Outro',
  ],

  // Atualiza os dados da sheet de tanto em tanto (segundos), com a página à vista.
  atualizarCada: 60,
};
