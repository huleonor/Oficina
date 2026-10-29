# Programa de pontos INOVACAR — Google Sheet (protótipo)

**Uma folha:** `Pontos`

| Lado | Tabela | Notas |
| --- | --- | --- |
| Esquerda | Clientes (`telemovel`, `nome`, `pontos`) | Pontos **à mão** |
| Direita | Gastos (`data`, `telemovel`, `valor_eur`, `nota`) | Cada gasto = linha nova |

Sem carros. O site consulta via Web App (POST `{ telemovel }`) — **não** partilhe a folha.

Modelos: [modelo-clientes.csv](modelo-clientes.csv) · [modelo-gastos.csv](modelo-gastos.csv)

Operação: [OPERACAO.md](OPERACAO.md) · Colar no Sheet: [COLOCAR-NO-SHEET.md](COLOCAR-NO-SHEET.md)

## Instalar o Apps Script

1. Extensões → Apps Script → cola [`Codigo.gs`](Codigo.gs) → Guarda
2. Menu **Pontos INOVACAR → Preparar protótipo**
3. Implementar → Nova implementação → Tipo **Aplicação Web**
   - Executar como: eu
   - Quem tem acesso: Qualquer pessoa
4. Copia o URL `/exec` para `PUBLIC_PONTOS_API` no site

Folha de demo:
https://docs.google.com/spreadsheets/d/1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs/edit
