# Economia do programa de pontos

Números por omissão (editáveis na folha `Regras` e em `Premios`).
A página pública **não** mostra estes custos — são só para a oficina.

## Duas faces do mesmo ponto

| Para o cliente | Para a oficina |
| --- | --- |
| Gasta **1 €** → ganha **1 ponto** | Cada ponto resgatado custa cerca de **0,05 €** |
| Meta: devolver ~**5%** do que gastou em prémios | `custo_por_ponto_eur = 0.05` |

Exemplo: cliente gasta **500 €** → **500 pontos**.
Se trocar tudo, o custo da oficina é cerca de **25 €** (5%).

## Indicações (trazer clientes)

| Regra | Valor |
| --- | --- |
| Pontos por indicação | **300** (`pontos_por_indicacao`) |
| Custo à oficina (à meta de 5%) | **15 €** (300 × 0,05) |

Com 300 pontos o cliente chega perto de um desconto de 10 € (200 pts) ou
troca por lavagem + escovas + aromatizante.

Só contar a indicação quando o novo cliente **já fez o primeiro serviço**
(evita pontos por contactos que nunca vêm).

Se ainda for pouco: 500 pontos = ~25 €. Se apertar: 200 pontos = ~10 €.

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

Se pedirem **menos** pontos do que esta conta, o programa fica mais caro
que a meta de 5%. Se pedirem **mais**, fica mais barato (cliente precisa
de gastar mais para resgatar).

## Catálogo actual (universal + alinhado a 5%)

Só prémios que **servem a qualquer carro** — sem peças por modelo
(escovas, filtros, pastilhas, etc.).

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

**Evitar no catálogo:** escovas, óleo, filtros, lâmpadas, baterias — mudam de carro
para carro e geram discussão. Preferir serviço, limpeza ou desconto em €.

## Onde mudar

1. Folha **Regras** — `pontos_por_euro`, `custo_por_ponto_eur`, `pontos_por_indicacao`
2. Folha **Premios** — pontos e (opcional) `custo_oficina_eur` para vos lembrar
3. Cole o `Codigo.gs` actualizado e faça **Nova versão** da implantação
4. Menu **Pontos INOVACAR → Recalcular pontos de todos os movimentos**
5. Não é preciso republicar o site: o Web App lê a folha e as regras em cada consulta

O saldo no site **não** depende da coluna `pontos` estar correcta à mão:
gasto e indicação são sempre calculados pelas Regras. O recalcular serve
para a folha mostrar os números certos no dia a dia.
