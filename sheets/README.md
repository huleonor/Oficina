# Programa de pontos INOVACAR — Google Sheet

Fonte de verdade dos clientes, carros, movimentos e prémios. O site consulta
**só** via este Web App — **não** partilhe a folha publicamente.

## Regras (fixas no script)

| Situação | Pontos |
| --- | --- |
| Gasto na oficina | **1 € = 1 ponto** |
| Indicação (trouxe um cliente) | **300 pontos** |
| Resgate | valor negativo (= pontos do prémio) |

Saldo do cliente = soma dos pontos dos seus movimentos.
Detalhe da economia: [ECONOMIA.md](ECONOMIA.md).

## 1. Criar a folha

1. Abra [Google Sheets](https://sheets.google.com) → folha em branco.
2. Crie **quatro** separadores com estes nomes exactos:
   - `Clientes` — a pessoa (telemóvel = chave dos pontos)
   - `Carros` — um ou mais carros por telemóvel + cronómetro
   - `Movimentos` — gastos, indicações, resgates
   - `Premios`
3. Em cada separador, importe o CSV correspondente
   (`Ficheiro` → `Importar` → «Substituir a folha actual»), ou copie os
   cabeçalhos:
   - [modelo-clientes.csv](modelo-clientes.csv)
   - [modelo-carros.csv](modelo-carros.csv)
   - [modelo-movimentos.csv](modelo-movimentos.csv)
   - [modelo-premios.csv](modelo-premios.csv)
4. Apague as linhas de exemplo quando for a sério.
5. Copie o **ID** da folha na URL:
   `https://docs.google.com/spreadsheets/d/`**`ID_AQUI`**`/edit`

**Dia a dia:** menu **Pontos INOVACAR → Novo cliente…** / **Novo carro…**
(ver [OPERACAO.md](OPERACAO.md) e [COLOCAR-NO-SHEET.md](COLOCAR-NO-SHEET.md)).
Não precisa de escrever nas folhas à mão.

## 2. Instalar o Apps Script

1. Na folha: `Extensões` → `Apps Script` (tem de nascer **a partir da folha**).
2. Apague o conteúdo por omissão e cole o de [Codigo.gs](Codigo.gs).
3. Em `SPREADSHEET_ID`, confirme o ID da folha.
4. Crie ficheiros HTML (nome exacto, sem `.html`) e cole:
   - `NovoCliente` ← [NovoCliente.html](NovoCliente.html)
   - `NovoCarro` ← [NovoCarro.html](NovoCarro.html)
   - `Formularios` ← [Formularios.html](Formularios.html)
5. Guarde o projecto (nome sugerido: `inovacar-pontos`).
6. Recarregue a folha → **Pontos INOVACAR** → **Preparar folha**, depois
   **Novo cliente…**.

Só há **um** ficheiro `.gs`. Não use `PontosUI.gs` (foi removido).

## 3. Publicar o Web App (consulta no site)

1. `Implantar` → `Nova implantação` → tipo **Aplicação Web**.
2. Executar como: **Eu**. Quem tem acesso: **Qualquer pessoa**.
3. Copie o URL (`https://script.google.com/macros/s/…/exec`).

Sempre que alterar o `Codigo.gs`, faça **Nova versão** na mesma implantação.

## 4. Ligar ao site

No projecto do site (`Oficina/`), `.env` (não vai para o git):

```env
PUBLIC_PONTOS_API=https://script.google.com/macros/s/XXXX/exec
```

Em produção (GitHub Pages), a mesma variável no workflow de build.

## 5. Exemplos (se editar à mão)

**Clientes**

| telemovel | nome | ativo | nota |
| --- | --- | --- | --- |
| 934514368 | Ana Sousa | sim | |

**Carros**

| matricula | telemovel | marca | modelo | ano | feito | entrada_em | pronto_em | duracao_min |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AA-00-BB | 934514368 | VW | Golf | 2018 | nao | 2026-10-28 09:10:00 |  |  |

**Movimentos** — o script preenche `pontos` (ou use Entrada rápida):

| data | telemovel | tipo | valor_eur | pontos | matricula | nota |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-27 | 934514368 | gasto | 500 | 500 | AA-00-BB | revisão |
| 2026-10-27 | 934514368 | indicacao |  | 300 |  | trouxe o Pedro |
| 2026-10-28 | 934514368 | resgate |  | -100 | AA-00-BB | lavagem |

## Privacidade

- Não partilhe o Sheet com «qualquer pessoa com o link».
- O Web App só responde a um telemóvel de cada vez.
