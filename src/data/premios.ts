// Catálogo de prémios por omissão — só ofertas universais (servem a qualquer carro).
// Sem peças por modelo (escovas, filtros, etc.). Calibrado a 0,05 €/ponto (meta 5%).
// A oficina edita o real no Google Sheet — ver sheets/ECONOMIA.md.

export type Premio = {
  id: string;
  nome: string;
  pontos: number;
  descricao: string;
};

export const premiosDefault: Premio[] = [
  {
    id: 'aromatizante',
    nome: 'Aromatizante',
    pontos: 30,
    descricao: 'Aromatizante para o habitáculo',
  },
  {
    id: 'kit-limpeza',
    nome: 'Kit de limpeza',
    pontos: 60,
    descricao: 'Panos de microfibra e limpa-vidros para o carro',
  },
  {
    id: 'aspiracao',
    nome: 'Aspiração do habitáculo',
    pontos: 80,
    descricao: 'Aspiração completa do interior',
  },
  {
    id: 'lavagem',
    nome: 'Lavagem exterior',
    pontos: 100,
    descricao: 'Lavagem exterior do veículo',
  },
  {
    id: 'lavagem-completa',
    nome: 'Lavagem completa',
    pontos: 180,
    descricao: 'Lavagem exterior e limpeza do habitáculo',
  },
  {
    id: 'desconto10',
    nome: 'Desconto 10 €',
    pontos: 200,
    descricao: 'Desconto de 10 euros na próxima fatura',
  },
  {
    id: 'check-up',
    nome: 'Check-up rápido',
    pontos: 250,
    descricao: 'Verificação de níveis, luzes, pneus e bateria',
  },
  {
    id: 'desconto25',
    nome: 'Desconto 25 €',
    pontos: 500,
    descricao: 'Desconto de 25 euros na próxima fatura',
  },
];
