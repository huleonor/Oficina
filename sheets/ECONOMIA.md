# Economia do programa de pontos

Números fixos no `Codigo.gs` (e catálogo na folha `Premios`).
A página pública **não** mostra estes custos — são só para a oficina.

## Duas faces do mesmo ponto

| Para o cliente | Para a oficina |
| --- | --- |
| Gasta **1 €** → ganha **1 ponto** | Cada ponto resgatado custa cerca de **0,05 €** |
| Meta: devolver ~**5%** do que gastou em prémios | `custoPorPontoEur = 0.05` |

Exemplo: cliente gasta **500 €** → **500 pontos**.
Se trocar tudo, o custo da oficina é cerca de **25 €** (5%).

## Indicações (trazer clientes)

| Regra | Valor |
| --- | --- |
| Pontos por indicação | **300** |
| Custo à oficina (à meta de 5%) | **15 €** (300 × 0,05) |

Só contar a indicação quando o novo cliente **já fez o primeiro serviço**.

## Calibrar um prémio novo

```
pontos_do_premio ≈ custo_real_para_a_oficina ÷ 0.05
```

| Custo real na oficina | Pontos a pedir |
| --- | --- |
| 1,50 € | 30 |
| 5 € | 100 |
| 10 € | 200 |
| 25 € | 500 |

## Catálogo actual (universal + alinhado a 5%)

| Prémio | Pontos | Custo oficina |
| --- | --- | --- |
| Aromatizante | 30 | ~1,50 € |
| Kit de limpeza | 60 | ~3 € |
| Aspiração do habitáculo | 80 | ~4 € |
| Lavagem exterior | 100 | ~5 € |
| Lavagem completa | 180 | ~9 € |
| Desconto 10 € | 200 | 10 € |
| Check-up rápido | 250 | ~12,50 € |
| Desconto 25 € | 500 | 25 € |

**Evitar no catálogo:** peças por modelo (escovas, filtros, etc.).

## Onde mudar

1. Constantes no topo de `Codigo.gs` (`REGRAS`) — indicação / € por ponto
2. Folha **Premios** — pontos e nomes
3. Cole o `Codigo.gs` actualizado e faça **Nova versão** da implantação
4. Menu **Pontos INOVACAR → Recalcular pontos** (se mudou a indicação)
5. Não é preciso republicar o site
