# Colar no Google Sheet (versão simples)

Folha:
https://docs.google.com/spreadsheets/d/1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs/edit

## Como usar no dia a dia (depois de colar)

Menu **Pontos INOVACAR** (barra do Sheet):

1. **Novo cliente…** — janela grande: nome + telemóvel + carro → grava em `Clientes` e `Carros`
2. **Novo carro…** — janela grande: escolhe o dono + matrícula/marca/modelo
3. **Outras entradas…** — painel: chegou / pronto / gasto / indicação / resgate

Não precisas de escrever nas linhas das folhas à mão.

## 1. Actualizar o Apps Script

1. Folha → `Extensões` → `Apps Script`.
2. Ficheiro principal: apaga tudo e cola [`Codigo.gs`](Codigo.gs).
3. Apaga `PontosUI.gs` se ainda existir.
4. Ficheiros HTML (criar se faltarem — nome **exacto**, sem `.html`):
   - `Formularios` ← [`Formularios.html`](Formularios.html)
   - `NovoCliente` ← [`NovoCliente.html`](NovoCliente.html)
   - `NovoCarro` ← [`NovoCarro.html`](NovoCarro.html)
5. Guarda (Ctrl/Cmd+S).

## 2. Preparar a folha

1. Recarrega o Sheet.
2. **Pontos INOVACAR → Preparar folha**
3. Opcional: apaga o separador **Regras** (já não é usado).

## 3. Testar

1. **Pontos INOVACAR → Novo cliente…**
2. Preenche Ana + matrícula → Guardar
3. Confirma linha em `Clientes` e em `Carros`

## 4. Web App (site)

`Implantar` → `Gerir implantações` → **Nova versão** (só se mudaste a API).
O URL do site mantém-se.
