# Programa de pontos INOVACAR — Google Sheet

Fonte de verdade dos clientes, movimentos e prémios. O site consulta **só** via
este Web App — **não** partilhe a folha publicamente nem a publique como CSV.

## Regras

| Situação | Pontos / custo |
| --- | --- |
| Gasto na oficina | **1 € = 1 ponto** (se `pontos` estiver vazio, usa-se `valor_eur`) |
| Custo para a oficina | **~0,05 € por ponto** resgatado → meta **5%** do que o cliente gasta |
| Indicação (trouxe um cliente) | **300 pontos** (~**15 €** de custo à meta de 5%) |
| Resgate | valor negativo em `pontos` (ex. `-100` para lavagem) |

Saldo do cliente = soma de todos os `pontos` dos seus movimentos.

Detalhe da economia e como calibrar prémios: [ECONOMIA.md](ECONOMIA.md).

## 1. Criar a folha

1. Abra [Google Sheets](https://sheets.google.com) → folha em branco.
2. Crie **cinco** separadores com estes nomes exactos:
   - `Clientes` — a pessoa (telemóvel = chave dos pontos)
   - `Carros` — um ou mais carros por telemóvel
   - `Movimentos` — gastos, indicações, resgates
   - `Premios`
   - `Regras`
3. Em cada separador, importe o CSV correspondente desta pasta
   (`Ficheiro` → `Importar` → `Carregar` → «Substituir a folha actual»),
   ou copie os cabeçalhos da primeira linha dos ficheiros:
   - [modelo-clientes.csv](modelo-clientes.csv)
   - [modelo-carros.csv](modelo-carros.csv)
   - [modelo-movimentos.csv](modelo-movimentos.csv)
   - [modelo-premios.csv](modelo-premios.csv)
   - [modelo-regras.csv](modelo-regras.csv)
4. Apague as linhas de exemplo quando for a sério.
5. Copie o **ID** da folha na URL:
   `https://docs.google.com/spreadsheets/d/`**`ID_AQUI`**`/edit`

**Que campos preencher no dia a dia:** [OPERACAO.md](OPERACAO.md)
(cliente → carros → movimento; pontos são sempre da pessoa, não do carro).

## 2. Instalar o Apps Script

1. Na folha: `Extensões` → `Apps Script`.
2. Apague o conteúdo por omissão e cole o de [Codigo.gs](Codigo.gs).
3. Em `SPREADSHEET_ID`, cole o ID da folha.
4. `+` → **HTML** → nome do ficheiro exactamente `Formularios` (sem `.html`).
   Cole o conteúdo de [Formularios.html](Formularios.html).
5. Guarde o projecto (nome sugerido: `inovacar-pontos`).
6. **Importante:** o script tem de nascer **a partir da folha**
   (`Extensões` → `Apps Script`). Só assim aparece o menu **Pontos INOVACAR**
   e o painel **Entrada rápida…**. Um projecto autónomo serve a API do site,
   mas **não** abre sidebar na folha.
7. Recarregue a folha → **Pontos INOVACAR** → **Preparar folha**, depois
   **Entrada rápida…**.

## 3. Publicar o Web App (consulta no site)

1. No mesmo projecto ligado à folha: `Implantar` → `Nova implantação`.
2. Tipo: **Aplicação Web**.
3. Executar como: **Eu**.
4. Quem tem acesso: **Qualquer pessoa**.
   (Só devolve um cliente se o telemóvel existir — não lista a folha.)
5. Implantar e copiar o URL (`https://script.google.com/macros/s/…/exec`).

Sempre que alterar o `Codigo.gs`, faça **Nova versão** na mesma implantação.

## 4. Ligar ao site

No projecto do site (`Oficina/`), crie `.env` (não vai para o git):

```env
PUBLIC_PONTOS_API=https://script.google.com/macros/s/XXXX/exec
```

Reinicie `npm run dev`. Em produção (GitHub Pages), defina a mesma variável
no workflow de build.

## 5. Como a oficina trabalha no dia a dia

O script **preenche sozinho** a coluna `pontos` quando escreve `tipo` / `valor_eur`
(e há menu **Pontos INOVACAR → Recalcular pontos de todos os movimentos** se
mudar as regras). Em cada consulta no site o saldo é **sempre** recalculado
com a folha `Regras` actual:

| tipo | pontos |
| --- | --- |
| `gasto` | `valor_eur` × `pontos_por_euro` |
| `indicacao` | `pontos_por_indicacao` (agora 300) |
| `resgate` | negativo: escreva `-200` ou ponha o id do prémio em `nota` (ex. `lavagem`) |
| `ajuste` | valor explícito em `pontos` (correções) |

**Novo cliente** — `Clientes` + um ou mais `Carros` (ver [OPERACAO.md](OPERACAO.md)):

| telemovel | nome | ativo |
| --- | --- | --- |
| 934514368 | Ana Sousa | sim |

| matricula | telemovel | marca | modelo | ano | ativo |
| --- | --- | --- | --- | --- | --- |
| AA-00-BB | 934514368 | VW | Golf | 2018 | sim |

**Gasto** — `tipo` + `valor_eur` (+ `matricula` do carro); os pontos aparecem sozinhos:

| data | telemovel | tipo | valor_eur | pontos | matricula | nota |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-27 | 934514368 | gasto | 500 | 500 | AA-00-BB | revisão |

**Indicação** — `tipo=indicacao` → 300 pontos (folha Regras):

| data | telemovel | tipo | valor_eur | pontos | nota |
| --- | --- | --- | --- | --- | --- |
| 2026-10-27 | 934514368 | indicacao |  | 300 | trouxe o Pedro |

**Resgate** — pontos negativos, ou `nota` = id do prémio:

| data | telemovel | tipo | valor_eur | pontos | nota |
| --- | --- | --- | --- | --- | --- |
| 2026-10-28 | 934514368 | resgate |  | -100 | lavagem |

**Prémios** — edite `Premios`; o site actualiza no próximo pedido (sem novo deploy).

**Mudou a indicação de 100 para 300?** Actualize `Regras`, cole o `Codigo.gs`
novo, faça **Nova versão** da implantação, e no Sheets:
`Pontos INOVACAR` → `Recalcular pontos de todos os movimentos`.

## Privacidade

- Não partilhe o Sheet com «qualquer pessoa com o link».
- O Web App só responde a um telemóvel de cada vez.
- A consulta no site é só por telemóvel (MVP). PIN pode vir depois.
