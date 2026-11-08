/**
 * INOVACAR: um só script para a sheet «INOVACAR Pontos».
 *
 *   1. Site público (/pontos/): POST { telemovel } devolve o saldo, o histórico e os prémios.
 *   2. Gestão da oficina (/gestao/): POST { action, pin, ... } lê e grava carros, clientes,
 *      tempos, pontos e prémios. Precisa do PIN (menu INOVACAR > Definir PIN da gestão).
 *
 * Abas da gestão (criadas sozinhas na primeira vez):
 *   Gestão Clientes, Gestão Carros, Gestão Trabalhos, Gestão Movimentos, Gestão Prémios, Gestão Regras.
 * A aba «Pontos» passa a ser atualizada sozinha com o saldo de cada cliente da gestão
 * (as linhas de quem não está na gestão ficam como estão).
 *
 * Atualizar: colar este ficheiro em Extensões > Apps Script, Guardar, e depois
 * Implementar > Gerir implementações > lápis > Versão: Nova versão > Implementar (o URL fica igual).
 */

var SPREADSHEET_ID = '1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs';
var FOLHA = 'Pontos';
var COLS = ['telemovel', 'nome', 'pontos'];

var TABELAS = {
  clientes: { aba: 'Gestão Clientes', campos: ['id', 'nome', 'telemovel', 'email', 'nif', 'notas', 'criado_em'] },
  carros: { aba: 'Gestão Carros', campos: ['id', 'cliente_id', 'matricula', 'marca', 'modelo', 'ano', 'km', 'notas', 'criado_em'] },
  trabalhos: {
    aba: 'Gestão Trabalhos',
    campos: ['id', 'carro_id', 'servico', 'descricao', 'estado', 'entrada', 'inicio', 'pronto', 'entregue', 'previsto',
      'pausado_em', 'pausa_min', 'pausa_motivo', 'valor', 'notas', 'criado_em'],
  },
  movimentos: {
    aba: 'Gestão Movimentos',
    campos: ['id', 'data', 'cliente_id', 'tipo', 'valor_eur', 'pontos', 'premio_id', 'premio_nome', 'custo_eur', 'trabalho_id', 'nota', 'criado_em'],
  },
  premios: {
    aba: 'Gestão Prémios',
    campos: ['id', 'nome', 'pontos', 'custo_eur', 'stock', 'descricao', 'comprar', 'nota', 'ativo', 'criado_em'],
  },
  regras: { aba: 'Gestão Regras', campos: ['id', 'valor', 'nota'] },
};

var REGRAS_BASE = [
  ['pontos_por_euro', '1', 'Pontos que o cliente ganha por cada euro gasto'],
  ['retorno_percent', '3', 'Parte do que o cliente gasta que lhe volta em prémios (%)'],
  ['objetivo_semana', '12', 'Carros entregues por semana'],
  ['pontos_por_indicacao', '300', 'Pontos por trazer um cliente novo'],
];

// ------------------------------------------------------------------ entrada

function doGet() {
  return json_({ ok: true, servico: 'inovacar-pontos', metodo: 'POST' });
}

function doPost(e) {
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, erro: 'Pedido inválido.' });
  }
  try {
    if (body.action) return json_(gestao_(body));
    return json_(pontosPublico_(body));
  } catch (err) {
    return json_({ ok: false, erro: 'servidor', detalhe: String((err && err.message) || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('INOVACAR')
    .addItem('Definir PIN da gestão', 'definirPin')
    .addItem('Preparar abas da gestão', 'prepararGestao')
    .addItem('Atualizar a aba Pontos', 'sincronizarPontos')
    .addToUi();
}

function definirPin() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('PIN da gestão', 'Escreva o PIN que a equipa vai usar na página de gestão (4 ou mais caracteres).', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var pin = String(r.getResponseText() || '').trim();
  if (pin.length < 4) { ui.alert('O PIN tem de ter pelo menos 4 caracteres.'); return; }
  PropertiesService.getScriptProperties().setProperty('GESTAO_PIN', pin);
  ui.alert('PIN guardado. Escreva-o na página de gestão (engrenagem).');
}

function prepararGestao() {
  Object.keys(TABELAS).forEach(function (t) { aba_(t); });
  try { SpreadsheetApp.getUi().alert('Abas da gestão prontas.'); } catch (err) {}
}

// ------------------------------------------------------------------ site público (pontos)

function pontosPublico_(body) {
  var tel = normalizarTel_(body.telemovel || '');
  if (!tel || tel.length < 9) return { ok: false, erro: 'telemovel_invalido' };

  var premios = linhas_('premios')
    .filter(function (p) { return ativo_(p.ativo) && num_(p.pontos) > 0; })
    .map(function (p) { return { id: p.id, nome: p.nome, pontos: num_(p.pontos), descricao: p.descricao || '' }; });

  var cliente = linhas_('clientes').filter(function (c) { return normalizarTel_(c.telemovel) === tel; })[0];
  if (cliente) {
    var movs = linhas_('movimentos').filter(function (m) { return m.cliente_id === cliente.id; });
    var saldo = movs.reduce(function (s, m) { return s + num_(m.pontos); }, 0);
    movs.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    return {
      ok: true,
      nome: primeiroNome_(cliente.nome),
      saldo: Math.max(0, saldo),
      movimentos: movs.slice(0, 20).map(function (m) {
        return { data: String(m.data).slice(0, 10), tipo: m.tipo, pontos: num_(m.pontos), nota: notaPublica_(m) };
      }),
      premios: premios.length ? premios : null,
      regras: { pontosAMao: false },
    };
  }

  var antigo = acharCliente_(folha_(), tel);
  if (!antigo) return { ok: false, erro: 'nao_encontrado' };
  return {
    ok: true,
    nome: primeiroNome_(antigo.nome),
    saldo: Number(antigo.pontos) || 0,
    movimentos: [],
    premios: premios.length ? premios : null,
    regras: { pontosAMao: true },
  };
}

function notaPublica_(m) {
  if (m.tipo === 'resgate') return m.premio_nome || '';
  if (m.tipo === 'gasto') return m.valor_eur ? String(num_(m.valor_eur)).replace('.', ',') + ' €' : '';
  return '';
}

// ------------------------------------------------------------------ gestão

function gestao_(body) {
  if (body.action === 'ping') return { ok: true, servico: 'inovacar-gestao' };
  var pin = PropertiesService.getScriptProperties().getProperty('GESTAO_PIN');
  if (!pin) return { ok: false, codigo: 'sem-pin', erro: 'Ainda não há PIN. Na sheet: menu INOVACAR > Definir PIN da gestão.' };
  if (String(body.pin || '') !== pin) return { ok: false, codigo: 'pin', erro: 'PIN errado.' };
  if (body.action === 'listar') return listar_();
  if (body.action === 'gravar') return gravar_(body.operacoes || []);
  return { ok: false, erro: 'Ação desconhecida.' };
}

function listar_() {
  return {
    ok: true,
    clientes: linhas_('clientes'),
    carros: linhas_('carros'),
    trabalhos: linhas_('trabalhos'),
    movimentos: linhas_('movimentos'),
    premios: linhas_('premios'),
    regras: linhas_('regras'),
    lido_em: new Date().toISOString(),
  };
}

/** Grava um lote: { op: criar|atualizar|apagar, tabela, id, dados }. Depois atualiza a aba Pontos. */
function gravar_(operacoes) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var feitas = [];
    var mexeuPontos = false;
    operacoes.forEach(function (o) {
      if (o.tabela === 'movimentos' || o.tabela === 'clientes') mexeuPontos = true;
      var sh = aba_(o.tabela);
      var cab = cabecalho_(sh);
      var colId = cab.indexOf('id') + 1;
      var id = String(o.id || (o.dados && o.dados.id) || '');
      if (!id) throw new Error('Operação sem id.');
      var linha = acharLinha_(sh, colId, id);

      if (o.op === 'apagar') {
        if (linha) sh.deleteRow(linha);
        feitas.push(id);
        return;
      }
      var dados = o.dados || {};
      if (o.op === 'criar' && !linha) {
        var nova = cab.map(function (c) {
          if (c === 'id') return id;
          return dados[c] !== undefined ? texto_(dados[c]) : '';
        });
        var r = sh.getLastRow() + 1;
        if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
        // Como texto, para a sheet não transformar datas, telemóveis ou matrículas.
        sh.getRange(r, 1, 1, nova.length).setNumberFormat('@').setValues([nova]);
        feitas.push(id);
        return;
      }
      // Apagado entretanto noutro aparelho: não há o que atualizar.
      if (!linha) { feitas.push(id); return; }
      Object.keys(dados).forEach(function (c) {
        var col = cab.indexOf(c) + 1;
        if (col > 0 && c !== 'id') sh.getRange(linha, col).setNumberFormat('@').setValue(texto_(dados[c]));
      });
      feitas.push(id);
    });
    if (mexeuPontos) sincronizarPontos();
    return { ok: true, feitas: feitas };
  } finally {
    lock.releaseLock();
  }
}

/** A aba Pontos (lida pelo site público) com o saldo de cada cliente da gestão que tem telemóvel. */
function sincronizarPontos() {
  var saldo = {};
  linhas_('movimentos').forEach(function (m) { saldo[m.cliente_id] = (saldo[m.cliente_id] || 0) + num_(m.pontos); });
  var daGestao = {};
  linhas_('clientes').forEach(function (c) {
    var tel = normalizarTel_(c.telemovel);
    if (tel.length >= 9) daGestao[tel] = [tel, c.nome, Math.max(0, saldo[c.id] || 0)];
  });

  var sh = folha_();
  var ultima = sh.getLastRow();
  var antigas = ultima >= 3 ? sh.getRange(3, 1, ultima - 2, 3).getValues() : [];
  var linhas = [];
  antigas.forEach(function (l) {
    var tel = normalizarTel_(l[0]);
    if (tel.length < 9) return; // notas de teste e linhas vazias
    if (daGestao[tel]) { linhas.push(daGestao[tel]); delete daGestao[tel]; } else linhas.push([tel, l[1], l[2]]);
  });
  Object.keys(daGestao).forEach(function (t) { linhas.push(daGestao[t]); });

  sh.getRange('A1').setValue('PONTOS (atualizados pela página de gestão; não editar à mão)');
  sh.getRange(2, 1, 1, COLS.length).setValues([COLS]);
  if (ultima >= 3) sh.getRange(3, 1, ultima - 2, Math.max(sh.getLastColumn(), 3)).clearContent();
  if (linhas.length) sh.getRange(3, 1, linhas.length, 3).setNumberFormat('@').setValues(linhas.map(function (l) {
    return [String(l[0]), String(l[1] || ''), String(l[2])];
  }));
}

// ------------------------------------------------------------------ abas

function ss_() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** A aba de uma tabela, criada com os cabeçalhos se faltar; acrescenta colunas que faltem. */
function aba_(nome) {
  var t = TABELAS[nome];
  if (!t) throw new Error('Tabela desconhecida: ' + nome);
  var ss = ss_();
  var sh = ss.getSheetByName(t.aba);
  if (!sh) {
    sh = ss.insertSheet(t.aba);
    sh.getRange(1, 1, sh.getMaxRows(), t.campos.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, t.campos.length).setValues([t.campos]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (nome === 'regras') sh.getRange(2, 1, REGRAS_BASE.length, 3).setValues(REGRAS_BASE);
    return sh;
  }
  var cab = cabecalho_(sh);
  var faltam = t.campos.filter(function (c) { return cab.indexOf(c) < 0; });
  if (faltam.length) {
    var inicio = cab.filter(String).length + 1;
    sh.getRange(1, inicio, sh.getMaxRows(), faltam.length).setNumberFormat('@');
    sh.getRange(1, inicio, 1, faltam.length).setValues([faltam]).setFontWeight('bold');
  }
  return sh;
}

function cabecalho_(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
}

function texto_(v) {
  if (v instanceof Date) return v.toISOString();
  if (v === null || v === undefined) return '';
  return String(v);
}

function num_(v) {
  var n = Number(String(v == null ? '' : v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function ativo_(v) {
  return ['nao', 'não', 'false', '0', 'n'].indexOf(String(v).trim().toLowerCase()) < 0;
}

function linhas_(nome) {
  var sh = aba_(nome);
  var cab = cabecalho_(sh);
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var valores = sh.getRange(2, 1, n, cab.length).getValues();
  var out = [];
  valores.forEach(function (linha) {
    var o = {};
    cab.forEach(function (c, i) { if (c) o[c] = texto_(linha[i]); });
    if (o.id) out.push(o);
  });
  return out;
}

function acharLinha_(sh, colId, id) {
  var n = sh.getLastRow() - 1;
  if (n < 1 || colId < 1) return 0;
  var ids = sh.getRange(2, colId, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return 0;
}

// ------------------------------------------------------------------ aba Pontos (antiga, ainda lida pelo site)

function folha_() {
  var ss = ss_();
  var sh = ss.getSheetByName(FOLHA);
  if (!sh) {
    sh = ss.insertSheet(FOLHA, 0);
    sh.getRange(2, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
  }
  return sh;
}

function acharCliente_(sh, tel) {
  var last = Math.max(sh.getLastRow(), 2);
  var valores = sh.getRange(3, 1, last, COLS.length).getValues();
  for (var i = 0; i < valores.length; i++) {
    var rowTel = normalizarTel_(valores[i][0]);
    if (!rowTel) continue;
    if (rowTel === tel) return { telemovel: rowTel, nome: String(valores[i][1] || ''), pontos: valores[i][2] };
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
