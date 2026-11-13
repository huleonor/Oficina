# INOVACAR Gestão

Uma página para contar quanto tempo demora cada arranjo, por modelo de carro.
A Google Sheet **INOVACAR Pontos** é a base de dados. A página não tem servidor próprio: fala com a sheet por um
Apps Script.

Vive em `public/gestao/`: HTML, CSS e JavaScript simples, que o Astro copia tal como está. Fica em
https://huleonor.github.io/Oficina/gestao/ (não aparece no menu nem no sitemap).

## O que faz

Conta quanto tempo cada carro está em trabalho, num quadro com três fases:

- **Por começar**: **Adicionar carro** (no canto) pede a matrícula, o modelo, o dono e, se se quiser, o serviço.
  O carro fica aqui, sem contar. Uma matrícula que já existe preenche o modelo e o dono.
- **Em curso**: o relógio começa quando se carrega em **Começar** ou se arrasta o cartão para esta fase
  (no telemóvel: carregar e segurar, e arrastar). Tem **Pausar** / **Retomar**.
- **Terminados**: **Terminar** (ou arrastar para aqui) para o relógio e guarda o tempo. Mostra os 3 mais
  recentes; **Ver mais** mostra outros 10. **Voltar a Em curso** (ou arrastar) reabre o carro e o relógio continua
  de onde parou.

O lápis de cada cartão edita a matrícula, o modelo, o dono, o serviço e, num carro terminado, o tempo.
Não se volta a Por começar. O **Relatório** tem todos os tempos (carros terminados, tempo total, média por
carro, média por serviço e a lista por dia).

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
