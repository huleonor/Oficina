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
| Aromatizante | 50 | 1,50 € |
| Kit de limpeza | 100 | 3 € |
| Aspiração do habitáculo | 130 | 4 € |
| Lavagem exterior | 170 | 5 € |
| Lavagem completa | 300 | 9 € |
| Desconto 10 € | 330 | 10 € |
| Check-up rápido | 420 | 12,50 € |
| Desconto 25 € | 830 | 25 € |

Nos prémios que se compram (aromatizante, kit de limpeza) preencha o **stock** e o **link de compra**.
**Evitar no catálogo:** peças por modelo (escovas, filtros, etc.).
