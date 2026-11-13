# INOVACAR Tempos no computador (com Excel)

A mesma página de gestão (Oficina e Tempos), a correr no computador da oficina, com um ficheiro
Excel como base de dados. Não precisa de internet nem da Google Sheet.

## Instalar (uma vez)

1. Instale o **Node.js** (versão LTS): https://nodejs.org
2. Descarregue o repositório (no GitHub: **Code > Download ZIP**) e descompacte-o.

## Abrir

- **Windows**: na pasta `local`, dê dois cliques em **`iniciar.bat`**.
- **Mac**: na pasta `local`, dê dois cliques em **`iniciar.command`**.

Da primeira vez instala o que falta (precisa de internet nesse momento). Depois abre o navegador em
http://localhost:3000/gestao/. A janela preta tem de ficar aberta enquanto usa a página; fechá-la desliga.

Pelo terminal: `cd local`, `npm install` (uma vez) e `npm start`.

## O Excel

- Os dados ficam em **`local/tempos.xlsx`**, criado na primeira vez, com as abas **Trabalhos**,
  **Carros** e **Clientes**.
- Pode abrir o ficheiro no Excel para ver ou corrigir dados. **Feche-o** para a página voltar a gravar:
  com o Excel aberto, o Windows bloqueia o ficheiro. Nesse tempo a página guarda as alterações e
  tenta de novo sozinha.
- Faça cópias do ficheiro de vez em quando (é a base de dados).
- Noutro sítio: `EXCEL="D:\Oficina\tempos.xlsx"` antes de `npm start` (no Windows: `set EXCEL=...`).

## No telemóvel ou noutro computador

Com o servidor a correr, a janela preta mostra um endereço como `http://192.168.1.20:3000/gestao/`.
Abra-o em qualquer aparelho ligado ao mesmo Wi-Fi. Se não abrir, autorize o Node.js na firewall do
Windows quando ele perguntar.

## Mudar a porta

`PORTA=3100 npm start` (no Windows: `set PORTA=3100` e depois `npm start`).
