export type Faq = { q: string; a: string };

export const faqSchema = (faqs: Faq[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

export const breadcrumbSchema = (site: URL, items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: new URL(import.meta.env.BASE_URL.replace(/\/$/, '') + item.path, site).toString(),
  })),
});

// Perguntas gerais da página inicial e de contactos. Respostas sem promessas de prazo ou preço.
export const homeFaqs: Faq[] = [
  {
    q: 'Onde fica a oficina?',
    a: 'Na R. da Paz, 3800-587 Aveiro, entre Cacia e o centro de Aveiro. A entrada é acessível a cadeira de rodas.',
  },
  {
    q: 'Qual é o horário?',
    a: 'De segunda a sexta, das 09:00 às 18:30. Ao sábado e domingo estamos fechados. Em feriados o horário pode ser diferente, por isso ligue antes de vir.',
  },
  {
    q: 'O pedido pelo formulário já é uma marcação?',
    a: 'Não. O formulário envia um pedido. A marcação só fica combinada depois de falarmos consigo e acertarmos o dia.',
  },
  {
    q: 'Quanto custa a reparação do meu carro?',
    a: 'Depende do carro e do trabalho necessário. Ligue para o 934 514 368 ou envie um pedido com a descrição do problema e damos-lhe uma estimativa.',
  },
  {
    q: 'Que informação devo ter à mão quando ligo?',
    a: 'A marca, o modelo, o ano e os quilómetros do carro, e uma descrição do que está a acontecer: quando começou, se acontece a frio ou a quente, e se acendeu alguma luz no painel.',
  },
];
