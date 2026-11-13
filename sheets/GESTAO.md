# INOVACAR Gestão

Uma página para contar quanto tempo demora cada arranjo, por modelo de carro.
A Google Sheet **INOVACAR Pontos** é a base de dados. A página não tem servidor próprio: fala com a sheet por um
Apps Script.

Vive em `public/gestao/`: HTML, CSS e JavaScript simples, que o Astro copia tal como está. Fica em
https://huleonor.github.io/Oficina/gestao/ (não aparece no menu nem no sitemap).

## O que faz

Conta quanto tempo cada carro está em trabalho.

- **Contar**: os carros a contar ficam no meio, pela ordem em que entraram. **Adicionar carro** (no canto) abre a janela onde se escreve a **matrícula**, o **modelo**, o **nome do dono** e, se se quiser, o **serviço**, e carrega-se em **Começar a contar**.
  Uma matrícula que já existe preenche o modelo e o dono. Cada carro a contar tem **Pausar** / **Retomar** e
  **Terminar**.
- **Relatório**: carros terminados, tempo total, média por carro e a lista dos tempos por dia (com pesquisa por
  matrícula, modelo ou dono, e apagar).

O tempo é o do relógio, desde Começar até Terminar, sem as pausas.
Se a ligação falhar, os tempos ficam guardados no aparelho e seguem quando a sheet voltar a responder.

## A sheet

A página usa três abas: **Gestão Clientes** (o dono, na coluna `nome`), **Gestão Carros** (`matricula`, `modelo`,
`cliente_id`) e **Gestão Trabalhos** (um por tempo: `inicio`, `pronto`, `pausa_min`). As outras abas ficam como estão.

| Aba | Colunas |
| --- | --- |
| Gestão Clientes | id, nome, telemovel, email, nif, notas, criado_em |
| Gestão Carros | id, cliente_id, matricula, marca, modelo, ano, km, notas, criado_em |
| Gestão Trabalhos | id, carro_id, servico, descricao, estado, entrada, inicio, pronto, entregue, previsto, pausado_em, pausa_min, pausa_motivo, valor, notas, criado_em |
| Gestão Movimentos | id, data, cliente_id, tipo (gasto, resgate, indicacao, ajuste), valor_eur, pontos, premio_id, premio_nome, custo_eur, trabalho_id, nota, criado_em |
| Gestão Prémios | id, nome, pontos, custo_eur, stock, descricao, comprar, nota, ativo, criado_em |
| Gestão Regras | id, valor, nota |

O saldo de um cliente é a soma dos seus movimentos. A aba **Pontos** (a que o site lia) passa a ser atualizada
sozinha com esse saldo; não a edite à mão. Os clientes que estavam nela foram passados para a gestão com um
movimento "Saldo de antes".

## Ligar (uma vez)

O script é o mesmo do site dos pontos, com o mesmo URL (já está em `public/gestao/config.js`).

1. Na sheet: **Extensões > Apps Script**. Substitua o código pelo de [`Codigo.gs`](Codigo.gs) e guarde.
2. Volte à sheet e recarregue. No menu **INOVACAR**, escolha **Definir PIN da gestão**.
3. No Apps Script: **Implementar > Gerir implementações > lápis > Versão: Nova versão > Implementar**. O URL fica igual.
4. Na página de gestão, escreva o PIN e carregue em **Testar e ligar**.

## Sem ligação

Na engrenagem, **Ver a demonstração** abre a página com dados de exemplo guardados só no navegador.

## Ficheiros

- `public/gestao/index.html`, `app.css`, `app.js`: a página. Usa o logo e o favicon do site.
- `public/gestao/config.js`: o URL do script, o horário e a lista de serviços (os mesmos do site).
- `public/gestao/icones.js`: ícones Phosphor (MIT).
- `public/gestao/fonts/`: a letra Figtree (SIL Open Font License, `OFL.txt`).
- `sheets/Codigo.gs`: o script da sheet, para o site e para a gestão.
