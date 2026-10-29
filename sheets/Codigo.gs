/**
 * INOVACAR — protótipo numa folha só.
 *
 * Folha «Pontos»:
 *   Esquerda  — clientes (telemovel, nome, pontos) → pontos editam-se à mão
 *   Direita   — gastos (data, telemovel, valor_eur, nota) → cada gasto = linha nova
 *
 * Site: POST { telemovel } → saldo (coluna pontos) + lista de gastos
 */

var SPREADSHEET_ID = '1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs';
var FOLHA = 'Pontos';

// Clientes: colunas A–C · Gastos: colunas E–H
var CLI = { inicio: 1, cols: ['telemovel', 'nome', 'pontos'] };
var GAS = { inicio: 5, cols: ['data', 'telemovel', 'valor_eur', 'nota'] };

function ss_() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet() {
  return json_({ ok: true, servico: 'inovacar-pontos', metodo: 'POST' });
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var tel = normalizarTel_(body.telemovel || '');
    if (!tel || tel.length < 9) return json_({ ok: false, erro: 'telemovel_invalido' });

    var sh = folha_();
    var cliente = acharCliente_(sh, tel);
    if (!cliente) return json_({ ok: false, erro: 'nao_encontrado' });

    return json_({
      ok: true,
      nome: primeiroNome_(cliente.nome),
      saldo: Number(cliente.pontos) || 0,
      movimentos: gastosDo_(sh, tel),
      premios: null,
      regras: { pontosAMao: true },
    });
  } catch (err) {
    return json_({ ok: false, erro: 'servidor', detalhe: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/* ========== Menu ========== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Pontos INOVACAR')
    .addItem('Preparar protótipo', 'prepararFolha')
    .addToUi();
}

/**
 * Uma folha limpa + 2 clientes + alguns gastos de exemplo.
 */
function prepararFolha() {
  var ss = ss_();
  var sh = ss.getSheetByName(FOLHA);
  if (!sh) sh = ss.insertSheet(FOLHA, 0);
  ss.setActiveSheet(sh);
  try {
    ss.moveActiveSheet(1);
  } catch (err) {}

  // Esconde o resto — o protótipo vive só aqui.
  ss.getSheets().forEach(function (outra) {
    if (outra.getName() === FOLHA) return;
    try {
      outra.hideSheet();
    } catch (err2) {}
  });

  sh.clear();
  sh.setHiddenGridlines(false);
  sh.setColumnWidths(1, 3, 140);
  sh.setColumnWidth(4, 24);
  sh.setColumnWidths(5, 4, 130);
  sh.setColumnWidth(7, 100);
  sh.setColumnWidth(8, 200);

  // Título
  sh.getRange('A1')
    .setValue('CLIENTES (pontos à mão)')
    .setFontWeight('bold')
    .setFontSize(12)
    .setFontColor('#ffffff')
    .setBackground('#1b7471');
  sh.getRange('A1:C1').merge();
  sh.getRange('E1')
    .setValue('GASTOS (cada linha = dinheiro gasto)')
    .setFontWeight('bold')
    .setFontSize(12)
    .setFontColor('#ffffff')
    .setBackground('#1b7471');
  sh.getRange('E1:H1').merge();

  // Cabeçalhos
  sh.getRange(2, CLI.inicio, 1, CLI.cols.length)
    .setValues([CLI.cols])
    .setFontWeight('bold')
    .setBackground('#e7f6f5');
  sh.getRange(2, GAS.inicio, 1, GAS.cols.length)
    .setValues([GAS.cols])
    .setFontWeight('bold')
    .setBackground('#e7f6f5');

  // Exemplos — pontos à mão (não calculados)
  sh.getRange(3, CLI.inicio, 2, CLI.cols.length).setValues([
    ['934000001', 'Ana Sousa', 420],
    ['934000002', 'Bruno Martins', 50],
  ]);

  var hoje = hoje_();
  sh.getRange(3, GAS.inicio, 3, GAS.cols.length).setValues([
    [hoje, '934000001', 120, 'revisão'],
    [hoje, '934000001', 300, 'indicação (registo)'],
    [hoje, '934000002', 50, 'óleo'],
  ]);

  sh.getRange('A12')
    .setValue(
      'Como testar: 1) muda os pontos da Ana à mão · 2) em GASTOS acrescenta uma linha (telemovel + valor_eur) · 3) no site consulta 934000001',
    )
    .setFontColor('#4a4f63')
    .setWrap(true);
  sh.getRange('A12:H12').merge();

  try {
    SpreadsheetApp.getUi().alert(
      'Protótipo numa folha só.\n\n' +
        'Esquerda: clientes — edita a coluna pontos à mão.\n' +
        'Direita: gastos — cada gasto é uma linha nova.\n\n' +
        'Consulta no site: 934000001',
    );
  } catch (err3) {
    Logger.log('Protótipo preparado (uma folha).');
  }
}

/* ========== Leitura ========== */

function folha_() {
  var ss = ss_();
  var sh = ss.getSheetByName(FOLHA);
  if (!sh) {
    prepararFolha();
    sh = ss.getSheetByName(FOLHA);
  }
  return sh;
}

function acharCliente_(sh, tel) {
  var last = Math.max(sh.getLastRow(), 2);
  var valores = sh.getRange(3, CLI.inicio, last, CLI.cols.length).getValues();
  for (var i = 0; i < valores.length; i++) {
    var rowTel = normalizarTel_(valores[i][0]);
    if (!rowTel) continue;
    if (rowTel === tel) {
      return { telemovel: rowTel, nome: String(valores[i][1] || ''), pontos: valores[i][2] };
    }
  }
  return null;
}

function gastosDo_(sh, tel) {
  var last = Math.max(sh.getLastRow(), 2);
  var valores = sh.getRange(3, GAS.inicio, last, GAS.cols.length).getValues();
  var out = [];
  for (var i = 0; i < valores.length; i++) {
    var rowTel = normalizarTel_(valores[i][1]);
    if (rowTel !== tel) continue;
    var valor = Number(valores[i][2]);
    if (!valor && valores[i][2] !== 0) continue;
    out.push({
      data: formatData_(valores[i][0]),
      tipo: 'gasto',
      valorEur: valor || 0,
      pontos: 0,
      nota: String(valores[i][3] || '') + (valor ? ' · ' + valor + ' €' : ''),
    });
  }
  return out.reverse();
}

function normalizarTel_(v) {
  var s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.indexOf('351') === 0 && s.length > 9) s = s.slice(3);
  return s;
}

function primeiroNome_(nome) {
  var p = String(nome || '').trim().split(/\s+/)[0];
  return p || 'cliente';
}

function hoje_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Lisbon', 'yyyy-MM-dd');
}

function formatData_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Europe/Lisbon', 'yyyy-MM-dd');
  }
  return String(v || '').slice(0, 10);
}
