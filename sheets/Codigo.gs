/**
 * INOVACAR — protótipo de pontos (Apps Script).
 *
 * Dia a dia (fácil de testar):
 *   1. Folha «Clientes» — uma linha = uma pessoa (vê os pontos)
 *   2. Folha «Carros»   — uma linha = um carro (liga pelo telemóvel)
 *   3. Folha «Movimentos» — uma linha = um gasto / indicação / resgate
 *
 * Site: Web App POST { telemovel } → saldo + movimentos
 * Regras: 1 € = 1 pt · indicação = 300 pts
 */

var SPREADSHEET_ID = '1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs';

var FOLHAS = {
  demo: 'Demo',
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
    .addItem('Preparar protótipo', 'prepararFolha')
    .addItem('Recalcular pontos', 'recalcularPontos')
    .addItem('Ir a Clientes', 'irClientes')
    .addToUi();
}

function irClientes() {
  var ss = ss_();
  var sh = ss.getSheetByName(FOLHAS.clientes) || montarClientes_(ss);
  ss.setActiveSheet(sh);
}

/**
 * Monta folhas limpas + dados de exemplo para demonstrar em 30 s.
 */
function prepararFolha() {
  var ss = ss_();

  // Já não usamos a Entrada — esconde se existir.
  var antiga = ss.getSheetByName('Entrada');
  if (antiga) {
    try {
      antiga.hideSheet();
    } catch (err) {}
  }

  montarDemo_(ss);
  montarClientes_(ss);
  montarCarros_(ss);
  montarMovimentos_(ss);
  montarPremios_(ss);
  semearDemoSeVazio_(ss);
  actualizarSaldos_(ss);

  try {
    SpreadsheetApp.getUi().alert(
      'Protótipo pronto.\n\n' +
        '1) Abre «Clientes» — cada linha é uma pessoa (coluna pontos).\n' +
        '2) Em «Movimentos» acrescenta um gasto (telemovel + tipo=gasto + valor_eur).\n' +
        '3) Os pontos actualizam sozinhos.\n' +
        '4) No site, consulta com o telemóvel (ex. 934000001).',
    );
  } catch (err) {
    Logger.log('Protótipo preparado.');
  }
}

function montarDemo_(ss) {
  var sh = ss.getSheetByName(FOLHAS.demo);
  if (!sh) sh = ss.insertSheet(FOLHAS.demo, 0);
  try {
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(1);
  } catch (err) {}

  sh.clear();
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 640);
  sh.getRange('A1')
    .setValue('INOVACAR — protótipo (fácil de testar)')
    .setFontWeight('bold')
    .setFontSize(16)
    .setFontColor('#ffffff')
    .setBackground('#1b7471');
  sh.setRowHeight(1, 40);
  sh.getRange('A3').setValue('Como testar em 30 segundos').setFontWeight('bold').setFontSize(13);
  sh.getRange('A5').setValue(
    '1. Abre a folha «Clientes» — já há 2 pessoas de exemplo (Ana e Bruno).\n' +
      '2. Vê a coluna «pontos» (saldo de cada um).\n' +
      '3. Abre «Movimentos» e acrescenta uma linha:\n' +
      '      data = hoje · telemovel = 934000001 · tipo = gasto · valor_eur = 50\n' +
      '4. Volta a «Clientes» — os pontos da Ana sobem (+50).\n' +
      '5. No site da oficina, consulta pontos com 934000001.\n\n' +
      'Indicação: em Movimentos põe tipo = indicacao no telemóvel de quem trouxe (+300 pts).\n' +
      'Carro novo: uma linha em «Carros» com a mesma telemovel do dono.',
  );
  sh.getRange('A5').setWrap(true);
  sh.setRowHeight(5, 180);
  sh.getRange('A7')
    .setValue('Números de teste: 934000001 (Ana) · 934000002 (Bruno)')
    .setFontColor('#4a4f63');
  return sh;
}

function montarClientes_(ss) {
  var headers = ['telemovel', 'nome', 'pontos', 'indicado_por', 'ativo', 'nota'];
  garantir_(ss, FOLHAS.clientes, headers);
  var sh = ss.getSheetByName(FOLHAS.clientes);
  sh.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#e7f6f5');
  var iAtivo = col_(sh, 'ativo');
  if (iAtivo >= 0) {
    sh.getRange(2, iAtivo + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(['sim', 'nao'], true)
        .setAllowInvalid(false)
        .build(),
    );
  }
  // pontos é calculado — fundo cinza claro
  var iPts = col_(sh, 'pontos');
  if (iPts >= 0) {
    sh.getRange(2, iPts + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setBackground('#f4f6f6');
  }
  return sh;
}

function montarCarros_(ss) {
  var headers = ['matricula', 'telemovel', 'marca', 'modelo', 'ano'];
  garantir_(ss, FOLHAS.carros, headers);
  var sh = ss.getSheetByName(FOLHAS.carros);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e7f6f5');
  return sh;
}

function montarMovimentos_(ss) {
  var headers = ['data', 'telemovel', 'tipo', 'valor_eur', 'pontos', 'matricula', 'nota'];
  garantir_(ss, FOLHAS.movimentos, headers);
  var sh = ss.getSheetByName(FOLHAS.movimentos);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e7f6f5');
  var iTipo = col_(sh, 'tipo');
  if (iTipo >= 0) {
    sh.getRange(2, iTipo + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(['gasto', 'indicacao', 'resgate', 'ajuste'], true)
        .setAllowInvalid(false)
        .build(),
    );
  }
  return sh;
}

function montarPremios_(ss) {
  var headers = ['id', 'nome', 'pontos', 'activo', 'descricao'];
  garantir_(ss, FOLHAS.premios, headers);
  var sh = ss.getSheetByName(FOLHAS.premios);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e7f6f5');
  return sh;
}

function semearDemoSeVazio_(ss) {
  var cli = ss.getSheetByName(FOLHAS.clientes);
  if (cli.getLastRow() < 2) {
    append_(ss, FOLHAS.clientes, {
      telemovel: '934000001',
      nome: 'Ana Sousa',
      pontos: 0,
      indicado_por: '',
      ativo: 'sim',
      nota: 'exemplo',
    });
    append_(ss, FOLHAS.clientes, {
      telemovel: '934000002',
      nome: 'Bruno Martins',
      pontos: 0,
      indicado_por: '934000001',
      ativo: 'sim',
      nota: 'exemplo — indicado pela Ana',
    });
  }

  var car = ss.getSheetByName(FOLHAS.carros);
  if (car.getLastRow() < 2) {
    append_(ss, FOLHAS.carros, {
      matricula: 'AA-00-BB',
      telemovel: '934000001',
      marca: 'VW',
      modelo: 'Golf',
      ano: 2018,
    });
    append_(ss, FOLHAS.carros, {
      matricula: 'EE-22-FF',
      telemovel: '934000002',
      marca: 'Renault',
      modelo: 'Clio',
      ano: 2020,
    });
  }

  var mov = ss.getSheetByName(FOLHAS.movimentos);
  if (mov.getLastRow() < 2) {
    append_(ss, FOLHAS.movimentos, {
      data: hoje_(),
      telemovel: '934000001',
      tipo: 'gasto',
      valor_eur: 120,
      pontos: 120,
      matricula: 'AA-00-BB',
      nota: 'revisão (exemplo)',
    });
    append_(ss, FOLHAS.movimentos, {
      data: hoje_(),
      telemovel: '934000001',
      tipo: 'indicacao',
      valor_eur: '',
      pontos: REGRAS.pontosPorIndicacao,
      matricula: '',
      nota: 'trouxe 934000002 Bruno Martins',
    });
    append_(ss, FOLHAS.movimentos, {
      data: hoje_(),
      telemovel: '934000002',
      tipo: 'gasto',
      valor_eur: 50,
      pontos: 50,
      matricula: 'EE-22-FF',
      nota: 'óleo (exemplo)',
    });
  }

  var prem = ss.getSheetByName(FOLHAS.premios);
  if (prem.getLastRow() < 2) {
    append_(ss, FOLHAS.premios, {
      id: 'lavagem',
      nome: 'Lavagem exterior',
      pontos: 100,
      activo: 'sim',
      descricao: 'Lavagem exterior do veículo',
    });
    append_(ss, FOLHAS.premios, {
      id: 'desconto10',
      nome: 'Desconto 10 €',
      pontos: 200,
      activo: 'sim',
      descricao: 'Desconto de 10 euros na próxima fatura',
    });
  }
}

/* ========== Pontos ========== */

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
  actualizarSaldos_(ss);
  try {
    SpreadsheetApp.getUi().alert('Pontos e saldos actualizados.');
  } catch (err) {
    Logger.log('Pontos recalculados.');
  }
}

/** Escreve o saldo em Clientes!pontos (soma dos movimentos). */
function actualizarSaldos_(ss) {
  var cli = ss.getSheetByName(FOLHAS.clientes);
  if (!cli || cli.getLastRow() < 2) return;
  var iTel = col_(cli, 'telemovel');
  var iPts = col_(cli, 'pontos');
  if (iTel < 0 || iPts < 0) return;

  var saldos = {};
  valores_(ss, FOLHAS.movimentos).forEach(function (r) {
    var t = normalizarTel_(r.telemovel);
    if (!t) return;
    var pts = calcularPontos_(
      String(r.tipo || '').trim().toLowerCase(),
      r.valor_eur,
      r.pontos,
      r.nota,
      mapaPremios_(ss),
    );
    if (pts === '') pts = 0;
    saldos[t] = (saldos[t] || 0) + (Number(pts) || 0);
  });

  var n = cli.getLastRow() - 1;
  var tels = cli.getRange(2, iTel + 1, n, 1).getValues();
  var out = tels.map(function (row) {
    var t = normalizarTel_(row[0]);
    return [t ? saldos[t] || 0 : 0];
  });
  cli.getRange(2, iPts + 1, n, 1).setValues(out).setBackground('#f4f6f6');
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
  var iData = headers.indexOf('data');
  if (iPts < 0) return;

  // Data por omissão = hoje
  if (iData >= 0 && !sh.getRange(row, iData + 1).getValue()) {
    sh.getRange(row, iData + 1).setValue(hoje_());
  }

  var vals = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  var pts = calcularPontos_(
    String(vals[iTipo] || '').trim().toLowerCase(),
    vals[iValor],
    vals[iPts],
    iNota >= 0 ? vals[iNota] : '',
    mapaPremios_(ss_()),
  );
  if (pts !== '' && pts !== vals[iPts]) sh.getRange(row, iPts + 1).setValue(pts);
  actualizarSaldos_(ss_());
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
  // Se a 1.ª linha não parece cabeçalho (ex. folha antiga), reescreve.
  if (actual.indexOf(headers[0]) < 0 && sh.getLastRow() <= 1) {
    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
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

function formatData_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Lisbon', 'yyyy-MM-dd');
  return String(v || '').trim().slice(0, 10);
}

function primeiroNome_(nome) {
  var p = String(nome || '').trim().split(/\s+/)[0];
  return p || 'Cliente';
}
