# Protótipo INOVACAR — operação

Protótipo para mostrar: **tabelas**, sem formulário Entrada.

## Fluxo

1. **Clientes** — regista a pessoa (`telemovel`, `nome`). A coluna `pontos` actualiza sozinha.
2. **Carros** — se tiver carro, uma linha com a mesma `telemovel`.
3. **Movimentos** — cada gasto / indicação / resgate = uma linha nova.

| tipo | O que escrever | Pontos |
| --- | --- | --- |
| gasto | `valor_eur` | = euros |
| indicacao | no telemóvel de quem trouxe | +300 |
| resgate | `nota` = id do prémio (ou pontos negativos) | negativo |
| ajuste | `pontos` à mão | o que escrever |

## Site

O cliente mete **só o telemóvel**. O site devolve saldo + movimentos (mesmos dados destas folhas).

## Menu

**Pontos INOVACAR → Preparar protótipo** (cria folhas + exemplos) · **Recalcular pontos**.
