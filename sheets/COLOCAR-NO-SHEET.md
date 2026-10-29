# Como usar (simples) + colar o script

Folha:
https://docs.google.com/spreadsheets/d/1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs/edit

## No dia a dia — só a folha «Entrada»

Não abras Clientes / Carros / Movimentos para registar.

1. Abre o separador **Entrada** (à esquerda).
2. Em **O que fazer?** escolhe: `Novo cliente` · `Novo carro` · `Gasto`
3. Preenche as células **amarelas** (nome, telemóvel, matrícula…).
4. Em **GUARDAR** escreve **SIM** e prima Enter.
5. Aparece o resultado em baixo; os dados vão sozinhos para as outras folhas.

| O que fazer | Campos |
| --- | --- |
| Novo cliente | Nome + Telemóvel + Matrícula + Marca + Modelo |
| Novo carro | Telemóvel (dono) + Matrícula + Marca + Modelo |
| Gasto | Telemóvel + Valor € (+ matrícula se quiseres) |

As outras folhas (`Clientes`, `Carros`…) são o arquivo — podes olhar, mas não precisas de escrever lá.

---

## Instalar / actualizar o script (uma vez)

1. Nesta folha: `Extensões` → `Apps Script`
2. Apaga o código antigo e cola [`Codigo.gs`](Codigo.gs)
3. (Opcional) HTML `NovoCliente`, `NovoCarro`, `Formularios` se quiseres também as janelas do menu
4. Guarda → volta ao Sheet e **recarrega**
5. Menu **Pontos INOVACAR → Preparar folha**  
   (cria/actualiza o separador **Entrada**)
6. A primeira vez o Google pede autorização — aceita

Se o menu não aparecer: recarrega outra vez; ou em Apps Script corre à mão a função `prepararFolha`.
