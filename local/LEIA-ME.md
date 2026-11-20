# INOVACAR Tempos no computador (com Excel)

A mesma página de gestão (Oficina e Tempos), a correr no computador da oficina, com um ficheiro
Excel como base de dados. Não precisa de internet nem da Google Sheet.

## Instalar (uma vez)

1. Instale o **Node.js** (versão LTS): https://nodejs.org
2. Descarregue o repositório (no GitHub: **Code > Download ZIP**) e descompacte-o.

## Sempre a correr (Windows, recomendado)

Para a página estar sempre ligada, mesmo depois de reiniciar e sem ninguém abrir nada:

1. Copie **um só ficheiro** para o computador da oficina:
   [`INOVACAR-INSTALAR.bat`](https://github.com/huleonor/Oficina/raw/main/local/INOVACAR-INSTALAR.bat)
   (por pen USB, email ou descarregado nesse computador).
2. Dois cliques nele e aceite o pedido de administrador. Precisa de internet nesse momento: descarrega o código
   para `C:\INOVACAR\Oficina`, instala o **Node.js** se faltar e prepara tudo.
3. Quando perguntar, deixe mudar o nome do computador para **INOVACAR** e reinicie.

(Com a pasta do código já no computador, `local\INSTALAR.bat` faz o mesmo sem descarregar.)

Fica assim:

| Onde | Endereço |
| --- | --- |
| Neste computador | http://localhost/gestao/ |
| Outros computadores Windows na mesma rede | http://inovacar/gestao/ |
| Telemóveis, tablets e Mac na mesma rede | http://inovacar.local/gestao/ |
| Se o nome não abrir | o endereço com o IP que o instalador mostra |

- O Excel fica em **`C:\INOVACAR\dados\tempos.xlsx`** e o registo do servidor em `C:\INOVACAR\dados\servidor.log`.
- A tarefa **INOVACAR Tempos** (Agendador de Tarefas) arranca com o Windows e volta a ligar o servidor se ele parar.
- O computador tem de estar ligado e na mesma rede que os telemóveis. Desative a suspensão
  (**Definições > Sistema > Energia > Suspender: Nunca**), senão a página deixa de responder quando ele adormece.
- Para tirar: `desinstalar-windows.ps1` (botão direito > Executar com o PowerShell). O Excel fica.
- Para atualizar o código: substitua a pasta e corra o `INSTALAR.bat` outra vez.

## Abrir à mão

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
