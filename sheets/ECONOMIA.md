# Economia do programa de pontos

As regras vivem na sheet (aba **Gestão Regras**) e mudam-se na página de gestão: **Prémios, Mudar regras**.
A página pública **não** mostra estes custos: são só para a oficina.

## Duas faces do mesmo ponto

| Para o cliente | Para a oficina |
| --- | --- |
| Gasta **1 €** → ganha **1 ponto** (`pontos_por_euro`) | Cada ponto trocado custa **0,03 €** |
| Recebe de volta **3%** do que gasta, em prémios (`retorno_percent`) | 1 ponto = 3% ÷ 1 ponto por euro |

Exemplo: o cliente gasta **500 €** → **500 pontos**, que valem cerca de **15 €** em prémios (3%).

Os pontos ganham-se sozinhos: ao **Entregar** um carro, a página pergunta quanto pagou e dá os pontos.
As trocas tiram os pontos e uma unidade do stock do prémio.

## Indicações (trazer clientes)

| Regra | Valor |
| --- | --- |
| Pontos por indicação (`pontos_por_indicacao`) | **300** |
| Custo à oficina a 3% | **9 €** (300 × 0,03) |

Só contar a indicação quando o novo cliente **já fez o primeiro serviço** (ficha do cliente, Dar pontos, Trouxe um amigo).

## Calibrar um prémio

```
pontos_do_premio ≈ custo_real_para_a_oficina ÷ 0,03
```

A página faz a conta: ao escrever o custo de um prémio, sugere os pontos, e o botão **Ajustar aos 3%** acerta todos.

## Catálogo inicial (a 3%)

| Prémio | Pontos | Custo oficina |
| --- | --- | --- |
| Lavagem exterior | 65 | 2 € |
| Aromatizante | 100 | 3 € |
| Protetor de para-brisas | 130 | 3,97 € |
| Check-up rápido | 500 | 15 € |
| Limpeza interior e exterior | 750 | 22,5 € |
| Pré-inspeção | 1000 | 30 € |

Nos prémios que se compram (aromatizante, protetor de para-brisas) preencha o **stock** e o **link de compra**.
**Evitar no catálogo:** peças por modelo (escovas, filtros, etc.).
