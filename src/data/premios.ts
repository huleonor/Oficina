// Catálogo de prémios por omissão — só ofertas universais (servem a qualquer carro).
// Sem peças por modelo (escovas, filtros, etc.). Calibrado a 0,03 €/ponto (devolve 3% do que se gasta).
// Têm de ser tantos como os ativos da aba Gestão Prémios: o site só troca os valores quando o número coincide.
// A oficina edita o real na página de gestão (aba Gestão Prémios); o site recebe-os ao consultar o saldo.

export type Premio = {
  id: string;
  nome: string;
  pontos: number;
  descricao: string;
};

export const premiosDefault: Premio[] = [
  {
    id: 'lavagem',
    nome: 'Lavagem exterior',
    pontos: 65,
    descricao: 'Lavagem exterior do veículo',
  },
  {
    id: 'aromatizante',
    nome: 'Aromatizante',
    pontos: 100,
    descricao: 'Aromatizante para o habitáculo',
  },
  {
    id: 'protetor-para-brisas',
    nome: 'Protetor de para-brisas',
    pontos: 130,
    descricao: 'Protetor solar para o para-brisas',
  },
  {
    id: 'check-up',
    nome: 'Check-up rápido',
    pontos: 500,
    descricao: 'Verificação de níveis, luzes, pneus e bateria',
  },
  {
    id: 'limpeza-completa',
    nome: 'Limpeza interior e exterior',
    pontos: 750,
    descricao: 'Lavagem exterior e limpeza completa do habitáculo',
  },
  {
    id: 'pre-inspecao',
    nome: 'Pré-inspeção',
    pontos: 1000,
    descricao: 'Verificação do carro antes da inspeção periódica',
  },
];
