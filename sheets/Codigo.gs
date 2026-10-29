/**
 * INOVACAR — protótipo numa folha só.
 *
 * Folha «Pontos»: uma tabela — telemovel · nome · pontos (à mão).
 * Site: POST { telemovel } → saldo da coluna pontos.
 */

var SPREADSHEET_ID = '1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs';
var FOLHA = 'Pontos';
var COLS = ['telemovel', 'nome', 'pontos'];

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

    var cliente = acharCliente_(folha_(), tel);
    if (!cliente) return json_({ ok: false, erro: 'nao_encontrado' });

    return json_({
      ok: true,
      nome: primeiroNome_(cliente.nome),
      saldo: Number(cliente.pontos) || 0,
      movimentos: [],
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Pontos INOVACAR')
    .addItem('Preparar protótipo', 'prepararFolha')
    .addToUi();
}

/** Limpa a folha e põe exemplos (Ana / Bruno). */
function prepararFolha() {
  var ss = ss_();
  var sh = ss.getSheetByName(FOLHA);
  if (!sh) sh = ss.insertSheet(FOLHA, 0);
  ss.setActiveSheet(sh);
  try {
    ss.moveActiveSheet(1);
  } catch (err) {}

  ss.getSheets().forEach(function (outra) {
    if (outra.getName() === FOLHA) return;
    try {
      outra.hideSheet();
    } catch (err2) {}
  });

  sh.clear();
  sh.setHiddenGridlines(false);
  sh.setColumnWidths(1, 3, 160);

  sh.getRange('A1')
    .setValue('CLIENTES (pontos à mão)')
    .setFontWeight('bold')
    .setFontSize(12)
    .setFontColor('#ffffff')
    .setBackground('#1b7471');
  sh.getRange('A1:C1').merge();

  sh.getRange(2, 1, 1, COLS.length)
    .setValues([COLS])
    .setFontWeight('bold')
    .setBackground('#e7f6f5');

  sh.getRange(3, 1, 2, COLS.length).setValues([
    ['934000001', 'Ana Sousa', 420],
    ['934000002', 'Bruno Martins', 50],
  ]);

  sh.getRange('A6')
    .setValue(
      'Como testar: muda a coluna pontos · no site consulta 934000001 · acrescenta uma linha para uma pessoa nova',
    )
    .setFontColor('#4a4f63')
    .setWrap(true);
  sh.getRange('A6:C6').merge();

  try {
    SpreadsheetApp.getUi().alert(
      'Protótipo pronto.\n\n' +
        'Só uma tabela: telemóvel, nome, pontos (à mão).\n' +
        'Consulta no site: 934000001',
    );
  } catch (err3) {
    Logger.log('Protótipo preparado (só clientes).');
  }
}

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
  var valores = sh.getRange(3, 1, last, COLS.length).getValues();
  for (var i = 0; i < valores.length; i++) {
    var rowTel = normalizarTel_(valores[i][0]);
    if (!rowTel) continue;
    if (rowTel === tel) {
      return { telemovel: rowTel, nome: String(valores[i][1] || ''), pontos: valores[i][2] };
    }
  }
  return null;
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
