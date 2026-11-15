# Google Sheet dos tempos (sem PIN)

Uma sheet só para os tempos da oficina, ligada à página de gestão (`/gestao/`). O script é
[`Tempos.gs`](Tempos.gs). A página grava e edita lá cada carro: adicionar, começar, pausar, terminar,
editar e reabrir.

| Aba | O que tem |
| --- | --- |
| **Tempos** | para ler: matrícula, modelo, dono, serviço, estado, começou, terminou, tempo (h:mm, sem pausas) |
| Trabalhos | um por carro na oficina: `inicio`, `pronto`, `pausa_min`... (a página escreve aqui) |
| Carros | matrícula e modelo |
| Clientes | o nome do dono |

Não edite as abas à mão enquanto a página está aberta: use o lápis de cada cartão.

## Criar (uma vez, 5 minutos)

1. Crie uma Google Sheet nova e vazia (por exemplo, **INOVACAR Tempos**).
2. **Extensões > Apps Script**. Apague o que lá está, cole o conteúdo de `Tempos.gs` e guarde.
3. Escolha a função **configurar** e carregue em **Executar**. Autorize (é a sua conta). Cria as quatro abas.
4. **Implementar > Nova implementação > Tipo: Aplicação Web**.
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
5. Copie o URL que acaba em `/exec` e ponha-o em `public/gestao/config.js` (`apiUrl`).

Para mudar o script mais tarde: **Implementar > Gerir implementações > lápis > Versão: Nova versão**. O URL fica igual.

## Sem PIN

Quem tiver o URL `/exec` pode ler e gravar os tempos. O URL fica no código do site, que é público, por isso
não guarde nesta sheet nada além de matrícula, modelo, nome do dono e tempos (nada de telemóveis, emails ou NIF).
