/**
 * INOVACAR Tempos: o script de uma Google Sheet simples, só para os tempos da oficina.
 *
 * A página de gestão (/gestao/) pede { action: 'listar' } e { action: 'gravar', operacoes: [...] }
 * e o script lê e escreve três abas, criadas sozinhas na primeira vez:
 *   Trabalhos, Carros e Clientes (as mesmas colunas do Excel do modo local).
 * Escreve também a aba Tempos, só para ler: matrícula, modelo, dono, serviço, estado e o tempo
 * (refeita depois de cada gravação; corrija os dados na página, não nesta aba).
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
  atualizarTempos_();
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
    try { atualizarTempos_(); } catch (err) { /* a aba de ler não pode estragar a gravação */ }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// A aba Tempos, para ler: o script escreve-a de novo depois de cada gravação. São valores, não
// fórmulas, para funcionar em qualquer idioma da sheet (as fórmulas mudam de separador com o idioma).
function atualizarTempos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Tempos');
  if (!sh) {
    sh = ss.insertSheet('Tempos', 0);
    sh.setFrozenRows(1);
  }
  var cab = ['Matrícula', 'Modelo', 'Dono', 'Serviço', 'Estado', 'Começou', 'Terminou', 'Tempo (h:mm)'];
  sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#26293c').setFontColor('#ffffff');

  var carros = {}, clientes = {};
  linhas_('carros').forEach(function (c) { carros[c.id] = c; });
  linhas_('clientes').forEach(function (c) { clientes[c.id] = c; });
  var data = function (s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    return m ? { txt: m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5], ms: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) } : null;
  };
  var trab = linhas_('trabalhos').sort(function (a, b) {
    return String(b.inicio || b.entrada || '').localeCompare(String(a.inicio || a.entrada || ''));
  });
  var linhas = trab.map(function (t) {
    var c = carros[t.carro_id] || {}, k = clientes[c.cliente_id] || {};
    var ini = data(t.inicio), fim = data(t.pronto);
    var estado = t.estado === 'curso' ? (t.pausado_em ? 'Em pausa' : 'Em curso') : (t.estado === 'pronto' || t.estado === 'entregue') ? 'Terminado' : 'Por começar';
    // Tempo em dias (o formato [h]:mm mostra horas e minutos), sem as pausas.
    var tempo = ini && fim ? Math.max(0, (fim.ms - ini.ms) / 86400000 - (Number(t.pausa_min) || 0) / 1440) : '';
    return [c.matricula || '', c.modelo || '', k.nome || '', t.servico || '', estado, ini ? ini.txt : '', fim ? fim.txt : '', tempo];
  });

  var max = Math.max(sh.getLastRow() - 1, 0);
  if (max) sh.getRange(2, 1, max, cab.length).clearContent();
  if (linhas.length) {
    sh.getRange(2, 1, linhas.length, cab.length - 1).setNumberFormat('@').setValues(linhas.map(function (l) { return l.slice(0, -1); }));
    sh.getRange(2, cab.length, linhas.length, 1).setNumberFormat('[h]:mm').setValues(linhas.map(function (l) { return [l[l.length - 1]]; }));
  }
}
