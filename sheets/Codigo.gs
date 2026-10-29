/**
 * INOVACAR — pontos + carros (Apps Script ligado à folha).
 *
 * Folhas: Clientes · Carros · Movimentos · Premios
 * Menu: Pontos INOVACAR → Entrada rápida… / Preparar folha
 * Site: Implantar → Aplicação Web (POST com { telemovel })
 *
 * Regras fixas no código: 1 € = 1 pt · indicação = 300 pts
 */

var SPREADSHEET_ID = '1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs';

var FOLHAS = {
  clientes: 'Clientes',
  carros: 'Carros',
  movimentos: 'Movimentos',
  premios: 'Premios',
};

var REGRAS = {
  pontosPorEuro: 1,
  pontosPorIndicacao: 300,
  custoPorPontoEur: 0.05,
  metaCustoPercentagem: 5,
};

function ss_() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/* ========== Web App (site) ========== */

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

    var ss = ss_();
    var cliente = acharCliente_(ss, tel);
    if (!cliente) return json_({ ok: false, erro: 'nao_encontrado' });

    var movs = movimentosDo_(ss, tel);
    var saldo = 0;
    for (var i = 0; i < movs.length; i++) saldo += movs[i].pontos;

    return json_({
      ok: true,
      nome: primeiroNome_(cliente.nome),
      saldo: saldo,
      movimentos: movs,
      premios: premiosActivos_(ss),
      regras: {
        pontosPorEuro: REGRAS.pontosPorEuro,
        pontosPorIndicacao: REGRAS.pontosPorIndicacao,
        custoPorPontoEur: REGRAS.custoPorPontoEur,
        metaCustoPercentagem: REGRAS.metaCustoPercentagem,
      },
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
    .addItem('Novo cliente…', 'abrirNovoCliente')
    .addItem('Novo carro…', 'abrirNovoCarro')
    .addSeparator()
    .addItem('Outras entradas…', 'abrirEntradaRapida')
    .addSeparator()
    .addItem('Preparar folha', 'prepararFolha')
    .addItem('Recalcular pontos', 'recalcularPontos')
    .addToUi();
}

/** Janela grande: só cliente (+ carro). O fluxo do dia a dia. */
function abrirNovoCliente() {
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutputFromFile('NovoCliente').setWidth(440).setHeight(620),
    'Novo cliente',
  );
}

/** Janela grande: carro para um cliente que já existe. */
function abrirNovoCarro() {
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutputFromFile('NovoCarro').setWidth(440).setHeight(520),
    'Novo carro',
  );
}

/** Painel lateral: gasto, indicação, resgate, chegou/pronto. */
function abrirEntradaRapida() {
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutputFromFile('Formularios').setTitle('Outras entradas').setWidth(360),
  );
}

function prepararFolha() {
  var ss = ss_();
  garantir_(ss, FOLHAS.clientes, ['telemovel', 'nome', 'ativo', 'nota']);
  garantir_(ss, FOLHAS.carros, [
    'matricula',
    'telemovel',
    'marca',
    'modelo',
    'ano',
    'feito',
    'entrada_em',
    'pronto_em',
    'duracao_min',
  ]);
  garantir_(ss, FOLHAS.movimentos, [
    'data',
    'telemovel',
    'tipo',
    'valor_eur',
    'pontos',
    'matricula',
    'nota',
  ]);
  garantir_(ss, FOLHAS.premios, ['id', 'nome', 'pontos', 'activo', 'descricao']);

  var mov = ss.getSheetByName(FOLHAS.movimentos);
  var iTipo = col_(mov, 'tipo');
  if (iTipo >= 0) {
    mov
      .getRange(2, iTipo + 1, Math.max(mov.getMaxRows() - 1, 1), 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['gasto', 'indicacao', 'resgate', 'ajuste'], true)
          .setAllowInvalid(false)
          .build(),
      );
  }
  var dv = SpreadsheetApp.newDataValidation()
    .requireValueInList(['sim', 'nao'], true)
    .setAllowInvalid(false)
    .build();
  var cli = ss.getSheetByName(FOLHAS.clientes);
  var car = ss.getSheetByName(FOLHAS.carros);
  var iAtivo = col_(cli, 'ativo');
  var iFeito = col_(car, 'feito');
  if (iAtivo >= 0) cli.getRange(2, iAtivo + 1, Math.max(cli.getMaxRows() - 1, 1), 1).setDataValidation(dv);
  if (iFeito >= 0) car.getRange(2, iFeito + 1, Math.max(car.getMaxRows() - 1, 1), 1).setDataValidation(dv);

  try {
    SpreadsheetApp.getUi().alert('Folha pronta. Use Pontos INOVACAR → Entrada rápida…');
  } catch (err) {
    Logger.log('Folha preparada.');
  }
}

/* ========== Formulário ========== */

function listarParaFormulario() {
  var ss = ss_();
  var clientes = [];
  valores_(ss, FOLHAS.clientes).forEach(function (r) {
    if (!sim_(r.ativo == null ? 'sim' : r.ativo)) return;
    var t = normalizarTel_(r.telemovel);
    if (!t) return;
    clientes.push({ telemovel: t, nome: String(r.nome || t).trim() });
  });
  clientes.sort(function (a, b) {
    return a.nome.localeCompare(b.nome, 'pt');
  });
  var oficina = listarCarrosOficina();
  return {
    clientes: clientes,
    premios: premiosActivos_(ss),
    carrosEmTrabalho: oficina.emTrabalho,
    carros: oficina.todos,
  };
}

function carrosDoCliente(telemovel) {
  var t = normalizarTel_(telemovel || '');
  var out = [];
  if (!t) return out;
  valores_(ss_(), FOLHAS.carros).forEach(function (r) {
    if (normalizarTel_(r.telemovel) !== t) return;
    out.push({
      matricula: String(r.matricula || '').trim().toUpperCase(),
      marca: String(r.marca || '').trim(),
      modelo: String(r.modelo || '').trim(),
    });
  });
  return out;
}

function formNovoCliente(p) {
  var ss = ss_();
  var tel = normalizarTel_(p.telemovel || '');
  var nome = String(p.nome || '').trim();
  if (!tel || tel.length < 9) return { ok: false, erro: 'Telemóvel inválido.' };
  if (!nome) return { ok: false, erro: 'Indique o nome.' };
  if (acharCliente_(ss, tel)) return { ok: false, erro: 'Já existe um cliente com este telemóvel.' };

  append_(ss, FOLHAS.clientes, { telemovel: tel, nome: nome, ativo: 'sim', nota: String(p.nota || '').trim() });

  var mat = String(p.matricula || '').trim().toUpperCase();
  if (mat) {
    if (!String(p.marca || '').trim() || !String(p.modelo || '').trim()) {
      return { ok: false, erro: 'Com matrícula, indique marca e modelo.' };
    }
    append_(ss, FOLHAS.carros, novoCarroCampos_(tel, mat, p));
    return { ok: true, msg: 'Cliente ' + nome + ' + carro ' + mat + ' criados. Cronómetro a contar.' };
  }
  return { ok: true, msg: 'Cliente ' + nome + ' criado. Pode acrescentar o carro depois.' };
}

function formNovoCarro(p) {
  var ss = ss_();
  var tel = normalizarTel_(p.telemovel || '');
  var mat = String(p.matricula || '').trim().toUpperCase();
  if (!acharCliente_(ss, tel)) return { ok: false, erro: 'Cliente não encontrado.' };
  if (!mat) return { ok: false, erro: 'Indique a matrícula.' };
  if (!String(p.marca || '').trim() || !String(p.modelo || '').trim()) {
    return { ok: false, erro: 'Indique marca e modelo.' };
  }
  if (
    carrosDoCliente(tel).some(function (c) {
      return c.matricula === mat;
    })
  ) {
    return { ok: false, erro: 'Esta matrícula já está neste cliente.' };
  }
  append_(ss, FOLHAS.carros, novoCarroCampos_(tel, mat, p));
  return { ok: true, msg: 'Carro ' + mat + ' adicionado. Cronómetro a contar.' };
}

function formCarroChegou(p) {
  var mat = String(p.matricula || '').trim().toUpperCase();
  if (!mat) return { ok: false, erro: 'Escolha o carro.' };
  var hit = acharCarro_(ss_(), mat);
  if (!hit) return { ok: false, erro: 'Matrícula não encontrada.' };
  actualizarCarro_(ss_(), hit.row, {
    feito: 'nao',
    entrada_em: agora_(),
    pronto_em: '',
    duracao_min: '',
  });
  return { ok: true, msg: mat + ' entrou. Tempo a contar desde agora.' };
}

function formCarroPronto(p) {
  var mat = String(p.matricula || '').trim().toUpperCase();
  if (!mat) return { ok: false, erro: 'Escolha o carro.' };
  var ss = ss_();
  var hit = acharCarro_(ss, mat);
  if (!hit) return { ok: false, erro: 'Matrícula não encontrada.' };
  var entrada = parseData_(hit.rowData.entrada_em);
  var fim = new Date();
  var mins = entrada ? Math.max(0, Math.round((fim.getTime() - entrada.getTime()) / 60000)) : '';
  actualizarCarro_(ss, hit.row, {
    feito: 'sim',
    pronto_em: agora_(),
    duracao_min: mins,
  });
  var texto = mins === '' ? 'sem hora de entrada' : formatDuracao_(mins);
  return { ok: true, msg: mat + ' pronto. Demorou ' + texto + '.' };
}

function listarCarrosOficina() {
  var todos = [];
  var emTrabalho = [];
  valores_(ss_(), FOLHAS.carros).forEach(function (r) {
    var mat = String(r.matricula || '').trim().toUpperCase();
    if (!mat) return;
    var item = {
      matricula: mat,
      marca: String(r.marca || '').trim(),
      modelo: String(r.modelo || '').trim(),
      entrada_em: formatDataHora_(r.entrada_em),
      feito: sim_(r.feito) ? 'sim' : 'nao',
    };
    todos.push(item);
    if (!sim_(r.feito)) emTrabalho.push(item);
  });
  return { todos: todos, emTrabalho: emTrabalho };
}

function formGasto(p) {
  var ss = ss_();
  var tel = normalizarTel_(p.telemovel || '');
  var valor = Number(p.valorEur);
  if (!acharCliente_(ss, tel)) return { ok: false, erro: 'Cliente não encontrado.' };
  if (!(valor > 0)) return { ok: false, erro: 'Indique o valor da fatura.' };
  var pts = arred_(valor * REGRAS.pontosPorEuro);
  append_(ss, FOLHAS.movimentos, {
    data: hoje_(),
    telemovel: tel,
    tipo: 'gasto',
    valor_eur: valor,
    pontos: pts,
    matricula: String(p.matricula || '').trim().toUpperCase(),
    nota: String(p.nota || '').trim(),
  });
  return { ok: true, msg: '+' + pts + ' pontos (gasto ' + valor + ' €).' };
}

function formIndicacao(p) {
  var ss = ss_();
  var quem = normalizarTel_(p.quemIndicou || '');
  var novo = normalizarTel_(p.novoTelemovel || '');
  var nomeNovo = String(p.novoNome || '').trim();
  if (!acharCliente_(ss, quem)) return { ok: false, erro: 'Quem indicou não está em Clientes.' };
  if (!novo || novo.length < 9) return { ok: false, erro: 'Telemóvel do novo inválido.' };
  if (!acharCliente_(ss, novo)) {
    if (!nomeNovo) return { ok: false, erro: 'Indique o nome do novo cliente.' };
    append_(ss, FOLHAS.clientes, { telemovel: novo, nome: nomeNovo, ativo: 'sim', nota: 'indicado por ' + quem });
  }
  var pts = REGRAS.pontosPorIndicacao;
  append_(ss, FOLHAS.movimentos, {
    data: hoje_(),
    telemovel: quem,
    tipo: 'indicacao',
    valor_eur: '',
    pontos: pts,
    matricula: '',
    nota: 'trouxe ' + novo + (nomeNovo ? ' ' + nomeNovo : ''),
  });
  return { ok: true, msg: '+' + pts + ' pontos de indicação.' };
}

function formResgate(p) {
  var ss = ss_();
  var tel = normalizarTel_(p.telemovel || '');
  if (!acharCliente_(ss, tel)) return { ok: false, erro: 'Cliente não encontrado.' };
  var premios = mapaPremios_(ss);
  var premio = premios[String(p.premioId || '').trim()];
  if (!premio) return { ok: false, erro: 'Escolha um prémio.' };
  var pts = -Math.abs(Number(premio.pontos) || 0);
  append_(ss, FOLHAS.movimentos, {
    data: hoje_(),
    telemovel: tel,
    tipo: 'resgate',
    valor_eur: '',
    pontos: pts,
    matricula: String(p.matricula || '').trim().toUpperCase(),
    nota: premio.id,
  });
  return { ok: true, msg: 'Resgate: ' + premio.nome + ' (' + pts + ' pts).' };
}

/* ========== Pontos automáticos ========== */

function recalcularPontos() {
  var ss = ss_();
  var sh = ss.getSheetByName(FOLHAS.movimentos);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  var h = data[0].map(function (x) {
    return String(x).trim().toLowerCase();
  });
  var iTipo = h.indexOf('tipo');
  var iValor = h.indexOf('valor_eur');
  var iPts = h.indexOf('pontos');
  var iNota = h.indexOf('nota');
  if (iPts < 0) return;
  var premios = mapaPremios_(ss);
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (linhaVazia_(row)) continue;
    var pts = calcularPontos_(
      String(row[iTipo] || '').trim().toLowerCase(),
      row[iValor],
      row[iPts],
      iNota >= 0 ? row[iNota] : '',
      premios,
    );
    if (pts !== '' && pts !== row[iPts]) sh.getRange(r + 1, iPts + 1).setValue(pts);
  }
  try {
    SpreadsheetApp.getUi().alert('Pontos recalculados.');
  } catch (err) {
    Logger.log('Pontos recalculados.');
  }
}

function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== FOLHAS.movimentos) return;
  var row = e.range.getRow();
  if (row < 2) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) {
    return String(x).trim().toLowerCase();
  });
  var iTipo = headers.indexOf('tipo');
  var iValor = headers.indexOf('valor_eur');
  var iPts = headers.indexOf('pontos');
  var iNota = headers.indexOf('nota');
  if (iPts < 0) return;
  var vals = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  var pts = calcularPontos_(
    String(vals[iTipo] || '').trim().toLowerCase(),
    vals[iValor],
    vals[iPts],
    iNota >= 0 ? vals[iNota] : '',
    mapaPremios_(ss_()),
  );
  if (pts !== '' && pts !== vals[iPts]) sh.getRange(row, iPts + 1).setValue(pts);
}

function calcularPontos_(tipo, valorEur, ptsCelula, nota, premios) {
  if (tipo === 'gasto') {
    var v = Number(valorEur);
    return v > 0 ? arred_(v * REGRAS.pontosPorEuro) : numOuVazio_(ptsCelula);
  }
  if (tipo === 'indicacao') return REGRAS.pontosPorIndicacao;
  if (tipo === 'resgate') {
    var n = Number(ptsCelula);
    if (n < 0) return arred_(n);
    var id = String(nota || '').trim();
    if (premios[id]) return -Math.abs(Number(premios[id].pontos) || 0);
    return n > 0 ? -arred_(n) : '';
  }
  if (tipo === 'ajuste') return numOuVazio_(ptsCelula);
  return numOuVazio_(ptsCelula);
}

/* ========== Helpers ========== */

function novoCarroCampos_(tel, mat, p) {
  return {
    matricula: mat,
    telemovel: tel,
    marca: String(p.marca || '').trim(),
    modelo: String(p.modelo || '').trim(),
    ano: p.ano || '',
    feito: 'nao',
    entrada_em: agora_(),
    pronto_em: '',
    duracao_min: '',
  };
}

function acharCarro_(ss, matricula) {
  var sh = ss.getSheetByName(FOLHAS.carros);
  if (!sh) return null;
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return null;
  var h = data[0].map(function (x) {
    return String(x).trim().toLowerCase();
  });
  var iMat = h.indexOf('matricula');
  if (iMat < 0) return null;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][iMat] || '').trim().toUpperCase() === matricula) {
      var obj = {};
      for (var c = 0; c < h.length; c++) obj[h[c]] = data[r][c];
      return { row: r + 1, rowData: obj };
    }
  }
  return null;
}

function actualizarCarro_(ss, rowNumber, updates) {
  var sh = ss.getSheetByName(FOLHAS.carros);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) {
    return String(x).trim().toLowerCase();
  });
  Object.keys(updates).forEach(function (k) {
    var i = headers.indexOf(k);
    if (i >= 0) sh.getRange(rowNumber, i + 1).setValue(updates[k]);
  });
}

function garantir_(ss, nome, headers) {
  var sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  var actual = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) {
    return String(x).trim().toLowerCase();
  });
  headers.forEach(function (h) {
    if (actual.indexOf(h) < 0) {
      var col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue(h);
      actual.push(h);
    }
  });
}

function col_(sh, nome) {
  if (!sh || sh.getLastColumn() < 1) return -1;
  var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var i = 0; i < h.length; i++) {
    if (String(h[i]).trim().toLowerCase() === nome) return i;
  }
  return -1;
}

function append_(ss, sheetName, obj) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    garantir_(ss, sheetName, Object.keys(obj));
    sh = ss.getSheetByName(sheetName);
  }
  var headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (x) {
    return String(x).trim().toLowerCase();
  });
  var row = headers.map(function (h) {
    return obj[h] != null ? obj[h] : '';
  });
  sh.appendRow(row);
}

function valores_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var h = data[0].map(function (x) {
    return String(x).trim().toLowerCase();
  });
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (linhaVazia_(data[r])) continue;
    var obj = {};
    for (var c = 0; c < h.length; c++) obj[h[c]] = data[r][c];
    out.push(obj);
  }
  return out;
}

function acharCliente_(ss, tel) {
  var rows = valores_(ss, FOLHAS.clientes);
  for (var i = 0; i < rows.length; i++) {
    if (normalizarTel_(rows[i].telemovel) === tel && sim_(rows[i].ativo == null ? 'sim' : rows[i].ativo)) {
      return { telemovel: tel, nome: String(rows[i].nome || '').trim() };
    }
  }
  return null;
}

function movimentosDo_(ss, tel) {
  var premios = mapaPremios_(ss);
  var out = [];
  valores_(ss, FOLHAS.movimentos).forEach(function (r) {
    if (normalizarTel_(r.telemovel) !== tel) return;
    var tipo = String(r.tipo || '').trim().toLowerCase();
    var pts = calcularPontos_(tipo, r.valor_eur, r.pontos, r.nota, premios);
    if (pts === '') pts = 0;
    out.push({
      data: formatData_(r.data),
      tipo: tipo,
      valorEur: r.valor_eur === '' || r.valor_eur == null ? null : Number(r.valor_eur),
      pontos: Number(pts) || 0,
      nota: String(r.nota || '').trim(),
    });
  });
  out.sort(function (a, b) {
    return a.data < b.data ? 1 : a.data > b.data ? -1 : 0;
  });
  return out;
}

function premiosActivos_(ss) {
  return valores_(ss, FOLHAS.premios)
    .filter(function (r) {
      return sim_(r.activo == null ? 'sim' : r.activo) && r.id;
    })
    .map(function (r) {
      return {
        id: String(r.id).trim(),
        nome: String(r.nome || '').trim(),
        pontos: Number(r.pontos) || 0,
        descricao: String(r.descricao || '').trim(),
      };
    });
}

function mapaPremios_(ss) {
  var map = {};
  premiosActivos_(ss).forEach(function (p) {
    map[p.id] = p;
  });
  return map;
}

function normalizarTel_(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function sim_(v) {
  var s = String(v == null ? '' : v)
    .trim()
    .toLowerCase();
  return s === 'sim' || s === 'yes' || s === 'true' || s === '1';
}

function linhaVazia_(row) {
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== '' && row[i] != null) return false;
  }
  return true;
}

function arred_(n) {
  return Math.round(Number(n) || 0);
}

function numOuVazio_(v) {
  if (v === '' || v == null) return '';
  var n = Number(v);
  return isNaN(n) ? '' : arred_(n);
}

function hoje_() {
  return Utilities.formatDate(new Date(), 'Europe/Lisbon', 'yyyy-MM-dd');
}

function agora_() {
  return Utilities.formatDate(new Date(), 'Europe/Lisbon', 'yyyy-MM-dd HH:mm:ss');
}

function formatData_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Lisbon', 'yyyy-MM-dd');
  return String(v || '').trim().slice(0, 10);
}

function formatDataHora_(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Lisbon', 'yyyy-MM-dd HH:mm');
  return String(v).trim();
}

function parseData_(raw) {
  if (raw instanceof Date) return raw;
  var s = String(raw || '').trim();
  if (!s) return null;
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] || 0),
    Number(m[5] || 0),
    Number(m[6] || 0),
  );
}

function formatDuracao_(mins) {
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  if (h <= 0) return m + ' min';
  return h + ' h ' + m + ' min';
}

function primeiroNome_(nome) {
  var p = String(nome || '').trim().split(/\s+/)[0];
  return p || 'Cliente';
}
