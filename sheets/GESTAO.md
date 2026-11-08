# INOVACAR Gestão

Uma página para gerir a oficina: os carros que estão lá dentro, os clientes e quanto tempo demora cada carro.
A Google Sheet **INOVACAR Pontos** é a base de dados. A página não tem servidor próprio: fala com a sheet por um
Apps Script.

Vive em `public/gestao/`: HTML, CSS e JavaScript simples, que o Astro copia tal como está. Fica em
https://huleonor.github.io/Oficina/gestao/ (não aparece no menu nem no sitemap).

## O que faz

- **Oficina**: o objetivo da semana (por omissão 12 carros entregues, uma barra que enche a cada entrega) e o quadro
  dos carros lá dentro: À espera, Em trabalho, Pronto a levantar. Cada carro em trabalho tem um relógio grande que
  conta o tempo de trabalho (só nas horas de abertura) e uma barra contra a média desse serviço. **Pausar** é um
  toque e para o relógio; **Retomar** volta a contar. O carro começado mais recente fica no topo, os em pausa no fim.
  Os cartões arrastam-se entre colunas (no telemóvel: carregar e segurar, e largar no separador).
- **Anular**: cada ação rápida (começar, pausar, arrastar, entregar, trocar pontos, apagar) mostra um aviso com
  **Anular** (ou Ctrl/⌘ Z) durante 6 segundos, que desfaz também na sheet. Os formulários têm o botão Guardar.
- **Fichas**: tocar na pessoa abre o cliente; tocar na matrícula abre o carro.
- **Entregar**: pergunta quanto o cliente pagou, mostra os pontos que ganha e o saldo com que fica, e o carro
  sai do cartão.
- **Dar entrada**: a matrícula encontra o carro e o dono; um carro novo pede marca e cliente (com sugestões de
  clientes que já existem). Dá para começar o trabalho logo.
- **Clientes**: saldo de pontos, **Trocar pontos** (escolhe o prémio, tira os pontos e uma unidade do stock),
  **Dar pontos** (um gasto sem trabalho, uma indicação, um ajuste), os movimentos (que se podem anular), os carros
  e as visitas.
- **Prémios**: as regras (pontos por euro, 3% de retorno, quanto custa um ponto, a indicação) e cada prémio com
  os pontos, o custo à oficina, o retorno real, o stock (aviso quando há 3 ou menos) e o link de compra.
  **Ajustar aos 3%** acerta os pontos de todos.
- **Relatórios** (semana, mês, 3 meses, ano, comparados com o período anterior): carros entregues, faturado,
  tempos médios, prontos no dia prometido, pontos dados e trocados, custo dos prémios; carros por semana contra o
  objetivo, um mapa de atividade por dia, pontos por mês, tempos por serviço, prémios mais trocados, alertas de
  stock e os melhores clientes.

Os tempos contam só as horas de abertura (seg a sex, 09:00 às 18:30; muda-se em `public/gestao/config.js`).
Se a ligação falhar, as alterações ficam guardadas no aparelho e seguem quando a sheet voltar a responder.

## A sheet

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
