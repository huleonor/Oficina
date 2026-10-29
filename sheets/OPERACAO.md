# O que a oficina preenche (cliente + carros + pontos)

## Forma fácil: menu «Pontos INOVACAR»

Não escreva nas linhas à mão.

1. Apps Script ligado a esta folha (`Extensões` → `Apps Script` a partir do Sheet).
2. Recarregue a folha → **Pontos INOVACAR** → **Preparar folha** (uma vez).
3. No dia a dia:
   - **Novo cliente…** — janela grande: nome + telemóvel + carro → `Clientes` e `Carros`
   - **Novo carro…** — janela grande: dono + matrícula/marca/modelo → `Carros`
   - **Outras entradas…** — chegou / pronto / gasto / indicação / resgate

HTML no projecto: `NovoCliente`, `NovoCarro`, `Formularios` + `Codigo.gs`.
Ver [COLOCAR-NO-SHEET.md](COLOCAR-NO-SHEET.md).

## Ideia-chave

| Entidade | Chave | Pontos? |
| --- | --- | --- |
| **Cliente** | telemóvel | **Sim** — o saldo é sempre da pessoa |
| **Carro** | matrícula | Não — só identifica o serviço / cronómetro |
| **Movimento** | linha nova | Soma ou tira pontos ao telemóvel |

Um cliente pode ter vários carros. Os pontos **não** se separam por carro.

```mermaid
flowchart LR
  form[Entrada_rapida]
  form --> Clientes
  form --> Carros
  form --> Movimentos
```

## Separadores (4)

### `Clientes`

| Campo | Obrigatório | Exemplo |
| --- | --- | --- |
| telemovel | sim | `934000001` |
| nome | sim | `Ana Sousa` |
| ativo | sim | `sim` |
| nota | não | livre |

### `Carros`

| Campo | Quem preenche | Exemplo |
| --- | --- | --- |
| matricula, telemovel, marca, modelo, ano | formulário | `AA-00-BB` … |
| feito | oficina / formulário | `nao` / `sim` |
| entrada_em, pronto_em, duracao_min | automático | cronómetro |

Ao criar o carro (ou «Carro chegou»): `feito=nao` e `entrada_em` = agora.
Em «Carro pronto»: `feito=sim` + duração em minutos.

### `Movimentos`

| tipo | O que preencher | Pontos |
| --- | --- | --- |
| gasto | valor € (+ matrícula) | = euros |
| indicacao | quem trouxe | +300 |
| resgate | prémio | negativo |
| ajuste | pontos à mão | o que escrever |

### `Premios`

Catálogo (`id`, `nome`, `pontos`, `activo`, `descricao`). Editável na folha;
o site actualiza na próxima consulta.

## Indicação (ordem)

1. Criar o **novo** cliente (+ carro se já trouxe o veículo).
2. Registar o **primeiro gasto** do novo.
3. Só então: **Indicação** no telemóvel de quem indicou.

## Site

O cliente mete **só o telemóvel**. O site devolve saldo + movimentos.
A lista de carros é só para a oficina.

### Números estrangeiros

- **Portugal (+351):** 9 algarismos, sem indicativo (`912345678`).
- **Outros:** com indicativo à frente, sem `+` nem `00` (`33612345678`).
