// Horário da oficina, sempre calculado a partir de business.hours (semanal + épocas), na hora de Lisboa.
// O site é estático: as páginas trazem o horário semanal e, no browser, aplicarHorario() troca-o
// pelo da época em vigor, marca o dia de hoje e mostra o estado "Aberto agora / Fechado agora".
// Não conhece feriados: o site avisa que o horário pode ser diferente nesses dias.

import { business, type Epoca, type Semana, type Turno } from '../data/business';

type Dia = keyof Semana;
const NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const SCHEMA_DIAS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Ordem portuguesa da semana: segunda a domingo. */
export const ORDEM: Dia[] = [1, 2, 3, 4, 5, 6, 0];

const minutos = (h: string) => {
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
};
const mesmo = (a: Turno, b: Turno) => (a === null || b === null ? a === b : a[0] === b[0] && a[1] === b[1]);

/** Data (AAAA-MM-DD), dia da semana e minutos do dia em Lisboa. */
function lisboa(agora: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    data: `${get('year')}-${get('month')}-${get('day')}`,
    dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')) as Dia,
    mins: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Soma dias a uma data AAAA-MM-DD e devolve a nova data e o dia da semana. */
function somarDias(data: string, n: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return { data: d.toISOString().slice(0, 10), dia: d.getUTCDay() as Dia };
}

export function epocaEm(data: string): Epoca | undefined {
  return business.hours.epocas.find((e) => e.de <= data && data <= e.ate);
}

/** Horário de um dia concreto: o da época em vigor nesse dia ou, se não houver, o semanal. */
function turnoEm(data: string, dia: Dia): Turno {
  const e = epocaEm(data);
  return e && dia in e.dias ? (e.dias[dia] ?? null) : business.hours.semanal[dia];
}

/** A semana em vigor numa data (época sobreposta ao semanal). */
export function semanaEm(data: string): { semana: Semana; epoca?: Epoca } {
  const epoca = epocaEm(data);
  return { semana: { ...business.hours.semanal, ...(epoca?.dias ?? {}) }, epoca };
}

export const textoTurno = (t: Turno, sep = ' – ') => (t ? `${t[0]}${sep}${t[1]}` : 'Fechado');

/** Linhas da tabela semanal, de segunda a domingo. */
export const linhas = (semana: Semana = business.hours.semanal) =>
  ORDEM.map((d) => ({ d, nome: NOMES[d], curto: CURTOS[d], h: textoTurno(semana[d]), fechado: semana[d] === null }));

/** Dias seguidos (segunda a domingo) com o mesmo horário. */
export function grupos(semana: Semana = business.hours.semanal) {
  const out: { dias: Dia[]; turno: Turno }[] = [];
  for (const d of ORDEM) {
    const last = out[out.length - 1];
    if (last && mesmo(last.turno, semana[d])) last.dias.push(d);
    else out.push({ dias: [d], turno: semana[d] });
  }
  return out;
}

const nomeGrupo = (dias: Dia[], nomes: string[]) => {
  const a = nomes[dias[0]];
  const b = nomes[dias[dias.length - 1]];
  if (dias.length === 1) return a;
  return `${a} ${dias.length === 2 ? 'e' : 'a'} ${nomes === NOMES ? b.toLowerCase() : b}`;
};
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Textos do horário: curto ("Seg a Sex, 09:00 às 18:30"), por grupos e uma frase completa. */
export function resumo(semana: Semana = business.hours.semanal) {
  const g = grupos(semana);
  const abertos = g.filter((x) => x.turno);
  const fechados = g.filter((x) => !x.turno);
  const turno = (t: Turno) => textoTurno(t, ' às ');
  return {
    curto: abertos.map((x) => `${nomeGrupo(x.dias, CURTOS)}, ${turno(x.turno)}`).join(' · ') || 'Fechado',
    fechadoCurto: fechados.map((x) => nomeGrupo(x.dias, CURTOS)).join(', '),
    grupos: g.map((x) => ({ dias: nomeGrupo(x.dias, NOMES), h: turno(x.turno) })),
    frase:
      [
        ...abertos.map((x) => `${x.dias.length > 1 ? 'De' : x.dias[0] === 6 || x.dias[0] === 0 ? 'Ao' : 'À'} ${minuscula(nomeGrupo(x.dias, NOMES))}, das ${textoTurno(x.turno, ' às ')}.`),
        ...(fechados.length ? [`Fechado: ${fechados.map((x) => minuscula(nomeGrupo(x.dias, NOMES))).join(', ')}.`] : []),
      ].join(' '),
  };
}

/** openingHoursSpecification do schema.org: semanal e, com datas, cada época. */
export function schemaHorario() {
  const spec = (semana: Partial<Semana>, extra = {}) =>
    grupos({ ...business.hours.semanal, ...semana } as Semana)
      .filter((x) => x.turno && x.dias.some((d) => d in semana))
      .map((x) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: x.dias.filter((d) => d in semana).map((d) => SCHEMA_DIAS[d]),
        opens: x.turno![0],
        closes: x.turno![1],
        ...extra,
      }));
  const epocas = business.hours.epocas.flatMap((e) => {
    const extra = { validFrom: e.de, validThrough: e.ate };
    const fechados = (Object.keys(e.dias).map(Number) as Dia[]).filter((d) => e.dias[d] === null);
    return [
      ...spec(e.dias, extra),
      // Dias fechados na época: o schema.org usa 00:00–00:00.
      ...(fechados.length ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: fechados.map((d) => SCHEMA_DIAS[d]), opens: '00:00', closes: '00:00', ...extra }] : []),
    ];
  });
  return [...spec(business.hours.semanal), ...epocas];
}

export type Estado = { aberto: boolean; dia: number; titulo: string; detalhe: string };

export function estadoAgora(agora = new Date()): Estado {
  const { data, dia, mins } = lisboa(agora);
  const hoje = turnoEm(data, dia);
  if (hoje && mins >= minutos(hoje[0]) && mins < minutos(hoje[1])) {
    return { aberto: true, dia, titulo: 'Aberto agora', detalhe: `Fecha às ${hoje[1]}` };
  }
  let detalhe = 'Ligue para confirmar';
  if (hoje && mins < minutos(hoje[0])) detalhe = `Abre hoje às ${hoje[0]}`;
  else {
    // Próximo dia aberto, já com as épocas que comecem ou acabem pelo caminho.
    for (let n = 1; n <= 60; n++) {
      const f = somarDias(data, n);
      const t = turnoEm(f.data, f.dia);
      if (!t) continue;
      const quando = n === 1 ? 'amanhã' : n < 7 ? NOMES[f.dia].toLowerCase() : `a ${f.data.slice(8, 10)}/${f.data.slice(5, 7)}`;
      detalhe = `Abre ${quando} às ${t[0]}`;
      break;
    }
  }
  return { aberto: false, dia, titulo: 'Fechado agora', detalhe };
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * No browser: põe nas páginas o horário em vigor hoje.
 * - [data-horario="curto"] e [data-horario="fechado"]: textos resumidos
 * - [data-horario="frase"]: frase completa
 * - [data-horario-dia="1"]: linha da tabela (hora em [data-horario-h]); recebe .is-today e .is-closed
 * - [data-horario-grupos]: lista dt/dd por grupos de dias
 * - [data-horario-epoca]: aviso com o nome e as datas da época (escondido fora de época)
 * - [data-open-status]: estado ao vivo, com [data-open-label] e [data-open-value]
 */
export function aplicarHorario(agora = new Date()) {
  const { data } = lisboa(agora);
  const { semana, epoca } = semanaEm(data);
  const r = resumo(semana);
  const e = estadoAgora(agora);
  const set = (sel: string, txt: string) => document.querySelectorAll(sel).forEach((el) => (el.textContent = txt));

  set('[data-horario="curto"]', r.curto);
  set('[data-horario="fechado"]', r.fechadoCurto ? `${r.fechadoCurto} fechado` : '');
  set('[data-horario="frase"]', r.frase);
  document.querySelectorAll<HTMLElement>('[data-horario-dia]').forEach((li) => {
    const d = Number(li.dataset.horarioDia) as Dia;
    const h = li.querySelector('[data-horario-h]');
    if (h) h.textContent = textoTurno(semana[d]);
    li.classList.toggle('is-closed', semana[d] === null);
    li.classList.toggle('is-today', d === e.dia);
  });
  document.querySelectorAll<HTMLElement>('[data-horario-grupos]').forEach((dl) => {
    if (dl.textContent === r.grupos.map((g) => g.dias + g.h).join('')) return;
    dl.replaceChildren(
      ...r.grupos.map((g) => {
        const div = document.createElement('div');
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = g.dias;
        dd.textContent = g.h;
        div.append(dt, dd);
        return div;
      }),
    );
  });
  document.querySelectorAll<HTMLElement>('[data-horario-epoca]').forEach((el) => {
    el.hidden = !epoca;
    if (epoca) el.textContent = `${epoca.nome}: horário especial de ${dataCurta(epoca.de)} a ${dataCurta(epoca.ate)}.`;
  });
  document.querySelectorAll<HTMLElement>('[data-open-status]').forEach((el) => {
    el.classList.toggle('is-open', e.aberto);
    el.classList.toggle('is-closed', !e.aberto);
    const label = el.querySelector('[data-open-label]');
    const value = el.querySelector('[data-open-value]');
    if (label) label.textContent = e.titulo;
    if (value) value.textContent = e.detalhe;
  });
}
