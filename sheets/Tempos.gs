/**
 * INOVACAR Tempos: o script de uma Google Sheet simples, só para os tempos da oficina.
 *
 * A página de gestão (/gestao/) pede { action: 'listar' } e { action: 'gravar', operacoes: [...] }
 * e o script lê e escreve três abas, criadas sozinhas na primeira vez:
 *   Trabalhos, Carros e Clientes (as mesmas colunas do Excel do modo local).
 * Cria também a aba Tempos, só para ler: matrícula, modelo, dono, serviço, estado e o tempo.
 *
 * Sem PIN: quem tiver o URL /exec lê e grava. Instalação em sheets/TEMPOS-SHEET.md.
 */

var TABELAS = {
  trabalhos: { aba: 'Trabalhos', campos: ['id', 'carro_id', 'servico', 'descricao', 'estado', 'entrada', 'inicio', 'pronto', 'entregue', 'previsto', 'pausado_em', 'pausa_min', 'pausa_motivo', 'valor', 'notas', 'criado_em'] },
  carros: { aba: 'Carros', campos: ['id', 'cliente_id', 'matricula', 'marca', 'modelo', 'ano', 'km', 'notas', 'criado_em'] },
  clientes: { aba: 'Clientes', campos: ['id', 'nome', 'telemovel', 'email', 'nif', 'notas', 'criado_em'] },
};

function doGet() {
  return json_({ ok: true, servico: 'inovacar-tempos', metodo: 'POST' });
}

function doPost(e) {
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, erro: 'Pedido inválido.' });
  }
  try {
    if (body.action === 'ping') return json_({ ok: true, servico: 'inovacar-tempos' });
    if (body.action === 'listar') return json_(listar_());
    if (body.action === 'gravar') return json_(gravar_(body.operacoes || []));
    return json_({ ok: false, erro: 'Ação desconhecida.' });
  } catch (err) {
    return json_({ ok: false, erro: String((err && err.message) || err), codigo: 'servidor' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Corra uma vez no editor (botão Executar) para criar as abas e dar as autorizações.
function configurar() {
  Object.keys(TABELAS).forEach(function (t) { aba_(t); });
  abaTempos_();
}

function aba_(nome) {
  var t = TABELAS[nome];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(t.aba);
  if (!sh) {
    sh = ss.insertSheet(t.aba);
    sh.getRange(1, 1, 1, t.campos.length).setValues([t.campos]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  // Colunas que faltem (aba editada à mão) vão para o fim.
  var cab = cabecalho_(sh);
  t.campos.filter(function (c) { return cab.indexOf(c) < 0; }).forEach(function (c) {
    var col = sh.getLastColumn() + 1;
    sh.getRange(1, col).setValue(c).setFontWeight('bold');
  });
  return sh;
}

function cabecalho_(sh) {
  var n = sh.getLastColumn();
  if (n < 1) return [];
  return sh.getRange(1, 1, 1, n).getValues()[0].map(function (v) { return String(v).trim(); });
}

function texto_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return String(v);
}

function linhas_(nome) {
  var sh = aba_(nome);
  var n = sh.getLastRow();
  if (n < 2) return [];
  var cab = cabecalho_(sh);
  return sh.getRange(2, 1, n - 1, cab.length).getValues()
    .map(function (row) {
      var o = {};
      cab.forEach(function (c, i) { if (c) o[c] = texto_(row[i]); });
      return o;
    })
    .filter(function (o) { return o.id; });
}

function listar_() {
  var r = { ok: true };
  Object.keys(TABELAS).forEach(function (t) { r[t] = linhas_(t); });
  return r;
}

function acharLinha_(sh, colId, id) {
  var n = sh.getLastRow();
  if (n < 2) return 0;
  var ids = sh.getRange(2, colId, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function gravar_(operacoes) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    operacoes.forEach(function (o) {
      if (!TABELAS[o.tabela]) return; // tabelas que esta sheet não tem (prémios, regras...)
      var sh = aba_(o.tabela);
      var cab = cabecalho_(sh);
      var id = String(o.id || (o.dados && o.dados.id) || '');
      if (!id) throw new Error('Operação sem id.');
      var linha = acharLinha_(sh, cab.indexOf('id') + 1, id);
      if (o.op === 'apagar') { if (linha) sh.deleteRow(linha); return; }
      var dados = o.dados || {};
      if (o.op === 'criar' && !linha) {
        var nova = cab.map(function (c) { return c === 'id' ? id : dados[c] !== undefined ? texto_(dados[c]) : ''; });
        // Como texto, para a sheet não transformar datas nem matrículas.
        sh.getRange(sh.getLastRow() + 1, 1, 1, nova.length).setNumberFormat('@').setValues([nova]);
        return;
      }
      if (!linha) return; // apagado entretanto noutro aparelho
      Object.keys(dados).forEach(function (c) {
        var col = cab.indexOf(c) + 1;
        if (col > 0 && c !== 'id') sh.getRange(linha, col).setNumberFormat('@').setValue(texto_(dados[c]));
      });
    });
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// A aba Tempos: fórmulas que leem as outras três (escritas na sintaxe inglesa, como o Apps Script pede).
function abaTempos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName('Tempos')) return;
  var sh = ss.insertSheet('Tempos', 0);
  var T = 'Trabalhos!', C = 'Carros!', K = 'Clientes!';
  var vazio = T + 'A2:A=""';
  sh.getRange(1, 1, 1, 8).setValues([['Matrícula', 'Modelo', 'Dono', 'Serviço', 'Estado', 'Começou', 'Terminou', 'Tempo (h:mm)']]).setFontWeight('bold');
  sh.getRange(2, 1, 1, 8).setFormulas([[
    '=ARRAYFORMULA(IF(' + vazio + ',"",IFERROR(VLOOKUP(' + T + 'B2:B,{' + C + 'A2:A,' + C + 'C2:C},2,FALSE),"")))',
    '=ARRAYFORMULA(IF(' + vazio + ',"",IFERROR(VLOOKUP(' + T + 'B2:B,{' + C + 'A2:A,' + C + 'E2:E},2,FALSE),"")))',
    '=ARRAYFORMULA(IF(' + vazio + ',"",IFERROR(VLOOKUP(VLOOKUP(' + T + 'B2:B,{' + C + 'A2:A,' + C + 'B2:B},2,FALSE),{' + K + 'A2:A,' + K + 'B2:B},2,FALSE),"")))',
    '=ARRAYFORMULA(IF(' + vazio + ',"",' + T + 'C2:C))',
    '=ARRAYFORMULA(IF(' + vazio + ',"",IF((' + T + 'E2:E="curso")*(' + T + 'K2:K<>""),"Em pausa",IF(' + T + 'E2:E="curso","Em curso",IF((' + T + 'E2:E="pronto")+(' + T + 'E2:E="entregue"),"Terminado","Por começar")))))',
    '=ARRAYFORMULA(IF(' + T + 'G2:G="","",IFERROR(VALUE(' + T + 'G2:G),"")))',
    '=ARRAYFORMULA(IF(' + T + 'H2:H="","",IFERROR(VALUE(' + T + 'H2:H),"")))',
    '=ARRAYFORMULA(IF((' + T + 'G2:G="")+(' + T + 'H2:H=""),"",IFERROR(VALUE(' + T + 'H2:H)-VALUE(' + T + 'G2:G)-IFERROR(VALUE(' + T + 'L2:L),0)/1440,"")))',
  ]]);
  sh.getRange('F2:G').setNumberFormat('dd/mm/yyyy hh:mm');
  sh.getRange('H2:H').setNumberFormat('[h]:mm');
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, 8).setBackground('#26293c').setFontColor('#ffffff');
}
