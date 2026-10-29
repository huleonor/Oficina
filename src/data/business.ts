// Dados da empresa: um único sítio para nome, morada, telefone e horário.
// Tudo o que está aqui aparece no cabeçalho, rodapé, páginas e schema.

export type Turno = readonly [string, string] | null;
export type Semana = Record<0 | 1 | 2 | 3 | 4 | 5 | 6, Turno>;
export type Epoca = { nome: string; de: string; ate: string; dias: Partial<Semana> };
export type Horario = { semanal: Semana; epocas: Epoca[]; note: string };

export const business = {
  name: 'INOVACAR - Oficina Automóvel',
  shortName: 'INOVACAR',
  phoneDisplay: '934 514 368',
  phoneIntl: '+351 934 514 368',
  phoneHref: 'tel:+351934514368',
  // [A CONFIRMAR] Email lido na arte do logótipo. Confirmar ortografia e se a caixa está ativa.
  email: 'geralinovacar@gmail.com',
  showEmail: true,
  address: {
    street: 'R. da Paz',
    postalCode: '3800-587',
    locality: 'Aveiro',
    region: 'Aveiro',
    country: 'PT',
    full: 'R. da Paz, 3800-587 Aveiro, Portugal',
  },
  hours: {
    // Horário semanal normal. Fonte única: estado "aberto agora", tabela dos contactos, rodapé, FAQ e schema saem daqui.
    // [abre, fecha] ou null quando está fechado. 0 = domingo, 1 = segunda … 6 = sábado.
    // [A CONFIRMAR] Horário regular indicado na ficha Google.
    semanal: {
      1: ['09:00', '18:30'],
      2: ['09:00', '18:30'],
      3: ['09:00', '18:30'],
      4: ['09:00', '18:30'],
      5: ['09:00', '18:30'],
      6: null,
      0: null,
    },
    // Horários de época (verão, férias, Natal…). Entre `de` e `ate` (inclusive) substituem o semanal
    // em todo o site; os dias que não estiverem em `dias` mantêm o horário semanal.
    // Exemplo:
    // { nome: 'Férias de verão', de: '2026-08-10', ate: '2026-08-21', dias: { 1: null, 2: null, 3: null, 4: null, 5: null } },
    epocas: [],
    note: 'Em feriados o horário pode ser diferente. Confirme com a oficina.',
  } as Horario,
  directionsHref:
    'https://www.google.com/maps/dir/?api=1&destination=INOVACAR%20-%20Oficina%20Autom%C3%B3vel%2C%20R.%20da%20Paz%2C%203800-587%20Aveiro',
  // Mapa sem chave de API, a partir do nome e da morada da ficha Google.
  mapSrc:
    'https://www.google.com/maps?q=INOVACAR%20-%20Oficina%20Autom%C3%B3vel%2C%20R.%20da%20Paz%2C%203800-587%20Aveiro&output=embed',
  googleProfile:
    'https://www.google.com/maps/place/INOVACAR+-+OFICINA+AUTOM%C3%93VEL/@40.6664827,-8.6043977,17z/data=!4m2!3m1!1s0xd23998e8b0029d7:0x2b7dd3cba7177a2',
  // [A FORNECER] Redes sociais oficiais. Deixe vazio se não existirem.
  social: [] as { label: string; href: string }[],
};

// [A FORNECER] Cole aqui o código completo do widget de avaliações Google (script + div),
// exatamente como foi fornecido. Enquanto estiver vazio, a página mostra um bloco identificado.
export const reviewsEmbed = '';

// [A FORNECER] Cole aqui o iframe completo de Partilhar > Incorporar mapa, exatamente como foi fornecido.
export const mapEmbed = '';

// [A FORNECER] Avaliações individuais coladas à mão. Copie o texto e o nome tal como aparecem no Google.
export const pastedReviews: { text: string; author: string }[] = [
  { text: '', author: '' },
  { text: '', author: '' },
  { text: '', author: '' },
];

// Sem vídeo no hero — foto da oficina. Para voltar ao filme: '/video/portao.mp4'.
export const gateVideo = '';

