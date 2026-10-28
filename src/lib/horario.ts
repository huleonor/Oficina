// Estado "aberto agora" a partir do horário regular (segunda a sexta, 09:00–18:30), na hora de Lisboa.
// Não conhece feriados: o site avisa que o horário pode ser diferente nesses dias.

export type Estado = { aberto: boolean; dia: number; titulo: string; detalhe: string };

const ABRE = 9 * 60;
const FECHA = 18 * 60 + 30;

export function estadoAgora(agora = new Date()): Estado {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const mins = Number(get('hour')) * 60 + Number(get('minute'));
  const util = dia >= 1 && dia <= 5;
  if (util && mins >= ABRE && mins < FECHA) return { aberto: true, dia, titulo: 'Aberto agora', detalhe: 'Fecha às 18:30' };
  const detalhe =
    util && mins < ABRE ? 'Abre hoje às 09:00' : dia === 5 || dia === 6 || dia === 0 ? 'Abre segunda às 09:00' : 'Abre amanhã às 09:00';
  return { aberto: false, dia, titulo: 'Fechado agora', detalhe };
}
