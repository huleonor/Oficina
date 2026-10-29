# Protótipo — fácil de testar

Folha:
https://docs.google.com/spreadsheets/d/1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs/edit

## Como testar (30 segundos)

1. Abre **Clientes** — cada linha é uma pessoa (vê a coluna **pontos**).
2. Abre **Movimentos** e acrescenta uma linha:
   - `telemovel` = `934000001`
   - `tipo` = `gasto`
   - `valor_eur` = `50`
3. Volta a **Clientes** — os pontos sobem.
4. No site, consulta com `934000001`.

Números de exemplo: `934000001` (Ana) · `934000002` (Bruno).

| Folha | Uma linha = |
| --- | --- |
| Clientes | uma pessoa (+ saldo de pontos) |
| Carros | um carro (liga pelo telemóvel) |
| Movimentos | um gasto / indicação / resgate |

## Instalar / actualizar o script

1. Extensões → Apps Script
2. Cola [`Codigo.gs`](Codigo.gs) · Guarda
3. Menu **Pontos INOVACAR → Preparar protótipo**
