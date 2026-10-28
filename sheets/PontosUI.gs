/**
 * INOVACAR — Menu e Entrada rápida na folha (script ligado ao Sheet).
 *
 * As regras vivem na folha «Regras». Em cada consulta (e ao editar Movimentos)
 * o script recalcula os pontos:
 *   gasto      → valor_eur × pontos_por_euro
 *   indicacao  → pontos_por_indicacao
 *   resgate    → valor negativo explícito em «pontos» (ou −pontos do prémio)
 *   ajuste     → valor explícito em «pontos» (correções manuais)
 *
 * Deploy: Extensões > Apps Script > Implantar > Nova implantação >
 * tipo «Aplicação Web», executar como «Eu», acesso «Qualquer pessoa».
 * Depois de alterar este ficheiro: Implantar > Gerir implantações > Nova versão.
 *
 * A folha NÃO deve ser partilhada publicamente. Só este Web App.
 */

function pontosSs_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

var FOLHAS = {
  clientes: 'Clientes',
  carros: 'Carros',
  movimentos: 'Movimentos',
  premios: 'Premios',
  regras: 'Regras',
};

/* Web App (consulta no site) fica no projecto autónomo — este ficheiro é só menu/formulário na folha. */

/* ========== Menu na folha ========== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Pontos INOVACAR')
    .addItem('Entrada rápida…', 'abrirEntradaRapida')
    .addSeparator()
    .addItem('Preparar folha (validações + separadores)', 'prepararFolha')
    .addItem('Recalcular pontos de todos os movimentos', 'recalcularPontosMovimentos')
    .addToUi();
}

/** Painel lateral com formulários (cliente, carro, gasto, indicação, resgate). */
function abrirEntradaRapida() {
  var html = HtmlService.createHtmlOutputFromFile('Formularios')
    .setTitle('Pontos INOVACAR')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Cria separadores em falta, cabeçalhos e listas suspensas (tipo, activo, prémios).
 * Correr uma vez depois de importar os CSV.
 */
function prepararFolha() {
  var ss = pontosSs_();
  garantirFolha_(ss, FOLHAS.clientes, ['telemovel', 'nome', 'ativo', 'nota']);
  garantirFolha_(ss, FOLHAS.carros, [
    'matricula',
    'telemovel',
    'marca',
    'modelo',
    'ano',
    'ativo',
    'nota',
    'feito',
    'entrada_em',
    'pronto_em',
    'duracao_min',
  ]);
  garantirFolha_(ss, FOLHAS.movimentos, [
    'data',
    'telemovel',
    'tipo',
    'valor_eur',
    'pontos',
    'matricula',
    'nota',
  ]);
  garantirFolha_(ss, FOLHAS.premios, [
    'id',
    'nome',
    'pontos',
    'activo',
    'descricao',
    'custo_oficina_eur',
  ]);
  garantirFolha_(ss, FOLHAS.regras, ['chave', 'valor', 'nota']);

  var mov = ss.getSheetByName(FOLHAS.movimentos);
  var cli = ss.getSheetByName(FOLHAS.clientes);
  var car = ss.getSheetByName(FOLHAS.carros);
  var iTipo = cabecalhoIndex_(mov, 'tipo');
  var iAtivoC = cabecalhoIndex_(cli, 'ativo');
  var iAtivoK = cabecalhoIndex_(car, 'ativo');
  var iFeito = cabecalhoIndex_(car, 'feito');

  if (iTipo >= 0) {
    mov.getRange(2, iTipo + 1, Math.max(mov.getMaxRows() - 1, 1), 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(['gasto', 'indicacao', 'resgate', 'ajuste'], true)
        .setAllowInvalid(false)
        .build(),
    );
  }
  var dvSimNao = SpreadsheetApp.newDataValidation()
    .requireValueInList(['sim', 'nao'], true)
    .setAllowInvalid(false)
    .build();
  if (iAtivoC >= 0) {
    cli.getRange(2, iAtivoC + 1, Math.max(cli.getMaxRows() - 1, 1), 1).setDataValidation(dvSimNao);
  }
  if (iAtivoK >= 0) {
    car.getRange(2, iAtivoK + 1, Math.max(car.getMaxRows() - 1, 1), 1).setDataValidation(dvSimNao);
  }
  if (iFeito >= 0) {
    car.getRange(2, iFeito + 1, Math.max(car.getMaxRows() - 1, 1), 1).setDataValidation(dvSimNao);
  }

  try {
    SpreadsheetApp.getUi().alert(
      'Folha preparada.\nUse o menu Pontos INOVACAR → Entrada rápida… para inserir dados.',
    );
  } catch (err) {
    /* Executar no editor Apps Script não tem UI da folha — as separadores já foram criados. */
    Logger.log('Folha preparada (sem UI).');
  }
}

/**
 * Carrega dados de exemplo (corre no editor Apps Script, sem UI).
 * Substitui o conteúdo das 5 folhas (mantém cabeçalhos).
 */
function carregarDadosTeste() {
  prepararFolha();
  var ss = pontosSs_();
  escreverFolha_(ss, FOLHAS.clientes, [
    ['telemovel', 'nome', 'ativo', 'nota'],
    ['934000001', 'Ana Sousa', 'sim', ''],
    ['934000002', 'Bruno Martins', 'sim', 'indicado pela Ana'],
    ['934000003', 'Carla Reis', 'sim', ''],
  ]);
  escreverFolha_(ss, FOLHAS.carros, [
    [
      'matricula',
      'telemovel',
      'marca',
      'modelo',
      'ano',
      'ativo',
      'nota',
      'feito',
      'entrada_em',
      'pronto_em',
      'duracao_min',
    ],
    ['AA-00-BB', '934000001', 'Volkswagen', 'Golf', 2018, 'sim', '', 'sim', '2026-10-27 09:00:00', '2026-10-27 11:15:00', 135],
    ['CC-11-DD', '934000001', 'Renault', 'Clio', 2012, 'sim', 'segundo carro', 'nao', '2026-10-28 08:30:00', '', ''],
    ['EE-22-FF', '934000002', 'Peugeot', '208', 2020, 'sim', '', 'nao', '2026-10-28 09:10:00', '', ''],
    ['GG-33-HH', '934000003', 'Seat', 'Ibiza', 2016, 'sim', '', 'sim', '2026-10-26 14:00:00', '2026-10-26 16:40:00', 160],
  ]);
  escreverFolha_(ss, FOLHAS.movimentos, [
    ['data', 'telemovel', 'tipo', 'valor_eur', 'pontos', 'matricula', 'nota'],
    ['2026-10-10', '934000001', 'gasto', 500, '', 'AA-00-BB', 'revisão e travões'],
    ['2026-10-15', '934000001', 'indicacao', '', '', '', 'trouxe 934000002 Bruno Martins'],
    ['2026-10-20', '934000001', 'resgate', '', -100, 'AA-00-BB', 'lavagem'],
    ['2026-10-12', '934000002', 'gasto', 120, '', 'EE-22-FF', 'mudança de óleo'],
    ['2026-10-18', '934000003', 'gasto', 80, '', 'GG-33-HH', 'diagnóstico'],
  ]);
  escreverFolha_(ss, FOLHAS.premios, [
    ['id', 'nome', 'pontos', 'activo', 'descricao', 'custo_oficina_eur'],
    ['aromatizante', 'Aromatizante', 30, 'sim', 'Aromatizante para o habitáculo', 1.5],
    ['kit-limpeza', 'Kit de limpeza', 60, 'sim', 'Panos de microfibra e limpa-vidros para o carro', 3],
    ['aspiracao', 'Aspiração do habitáculo', 80, 'sim', 'Aspiração completa do interior', 4],
    ['lavagem', 'Lavagem exterior', 100, 'sim', 'Lavagem exterior do veículo', 5],
    [
      'lavagem-completa',
      'Lavagem completa',
      180,
      'sim',
      'Lavagem exterior e limpeza do habitáculo',
      9,
    ],
    ['desconto10', 'Desconto 10 €', 200, 'sim', 'Desconto de 10 euros na próxima fatura', 10],
    [
      'check-up',
      'Check-up rápido',
      250,
      'sim',
      'Verificação de níveis luzes pneus e bateria',
      12.5,
    ],
    ['desconto25', 'Desconto 25 €', 500, 'sim', 'Desconto de 25 euros na próxima fatura', 25],
  ]);
  escreverFolha_(ss, FOLHAS.regras, [
    ['chave', 'valor', 'nota'],
    ['pontos_por_euro', 1, 'Cliente: 1 euro gasto = 1 ponto'],
    [
      'custo_por_ponto_eur',
      0.05,
      'Oficina: cada ponto resgatado custa ~0.05 € (meta 5% do gasto)',
    ],
    [
      'meta_custo_percentagem',
      5,
      'Meta de custo do programa em % do que o cliente gasta',
    ],
    [
      'pontos_por_indicacao',
      300,
      'Pontos por trazer um cliente novo (= 15 € de custo à meta de 5%)',
    ],
  ]);
  Logger.log('Dados de teste carregados. Experimente telemóvel 934000001.');
}

function escreverFolha_(ss, nome, matriz) {
  var sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  sh.clearContents();
  sh.getRange(1, 1, matriz.length, matriz[0].length).setValues(matriz);
}

/* ========== Formulários (chamados pelo Formularios.html) ========== */

function listarParaFormulario() {
  var ss = pontosSs_();
  var clientes = [];
  sheetValues_(ss, FOLHAS.clientes).rows.forEach(function (row) {
    if (!sim_(row.ativo == null ? 'sim' : row.ativo)) return;
    var t = normalizarTelemovel_(row.telemovel);
    if (!t) return;
    clientes.push({ telemovel: t, nome: String(row.nome || t).trim() });
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
  var ss = pontosSs_();
  var t = normalizarTelemovel_(telemovel || '');
  var out = [];
  if (!t) return out;
  try {
    sheetValues_(ss, FOLHAS.carros).rows.forEach(function (row) {
      if (normalizarTelemovel_(row.telemovel) !== t) return;
      if (!sim_(row.ativo == null ? 'sim' : row.ativo)) return;
      out.push({
        matricula: String(row.matricula || '')
          .trim()
          .toUpperCase(),
        marca: String(row.marca || '').trim(),
        modelo: String(row.modelo || '').trim(),
      });
    });
  } catch (err) {
    /* sem folha Carros */
  }
  return out;
}

function formNovoCliente(p) {
  var ss = pontosSs_();
  var tel = normalizarTelemovel_(p.telemovel || '');
  var nome = String(p.nome || '').trim();
  if (!tel || tel.length < 9) return { ok: false, erro: 'Telemóvel inválido.' };
  if (!nome) return { ok: false, erro: 'Indique o nome.' };
  if (encontrarCliente_(ss, tel)) {
    return { ok: false, erro: 'Já existe um cliente com este telemóvel.' };
  }
  appendByHeaders_(ss, FOLHAS.clientes, {
    telemovel: tel,
    nome: nome,
    ativo: 'sim',
    nota: String(p.nota || '').trim(),
  });
  var mat = String(p.matricula || '')
    .trim()
    .toUpperCase();
  if (mat) {
    appendByHeaders_(ss, FOLHAS.carros, camposNovoCarroOficina_({
      matricula: mat,
      telemovel: tel,
      marca: String(p.marca || '').trim(),
      modelo: String(p.modelo || '').trim(),
      ano: p.ano || '',
      nota: '',
    }));
  }
  return {
    ok: true,
    msg: mat
      ? 'Cliente e carro guardados (' + nome + '). Cronómetro a contar desde agora.'
      : 'Cliente guardado (' + nome + '). Pode acrescentar o carro depois.',
  };
}

function formNovoCarro(p) {
  var ss = pontosSs_();
  var tel = normalizarTelemovel_(p.telemovel || '');
  var mat = String(p.matricula || '')
    .trim()
    .toUpperCase();
  if (!encontrarCliente_(ss, tel)) return { ok: false, erro: 'Cliente não encontrado.' };
  if (!mat) return { ok: false, erro: 'Indique a matrícula.' };
  if (!String(p.marca || '').trim() || !String(p.modelo || '').trim()) {
    return { ok: false, erro: 'Indique marca e modelo.' };
  }
  var ja = carrosDoCliente(tel).some(function (c) {
    return c.matricula === mat;
  });
  if (ja) return { ok: false, erro: 'Esta matrícula já está neste cliente.' };
  appendByHeaders_(
    ss,
    FOLHAS.carros,
    camposNovoCarroOficina_({
      matricula: mat,
      telemovel: tel,
      marca: String(p.marca || '').trim(),
      modelo: String(p.modelo || '').trim(),
      ano: p.ano || '',
      nota: String(p.nota || '').trim(),
    }),
  );
  return { ok: true, msg: 'Carro ' + mat + ' adicionado. Cronómetro a contar desde agora.' };
}

/** Campos de oficina: ao aparecer, feito=nao e o tempo começa a contar. */
function camposNovoCarroOficina_(base) {
  return {
    matricula: base.matricula,
    telemovel: base.telemovel,
    marca: base.marca,
    modelo: base.modelo,
    ano: base.ano || '',
    ativo: 'sim',
    nota: base.nota || '',
    feito: 'nao',
    entrada_em: agoraDateTimeIso_(),
    pronto_em: '',
    duracao_min: '',
  };
}

/** Reinicia o cronómetro: o carro voltou a entrar na oficina. */
function formCarroChegou(p) {
  var ss = pontosSs_();
  var mat = String(p.matricula || '')
    .trim()
    .toUpperCase();
  if (!mat) return { ok: false, erro: 'Escolha a matrícula.' };
  var row = encontrarLinhaCarro_(ss, mat);
  if (!row) return { ok: false, erro: 'Matrícula não encontrada em Carros.' };
  actualizarLinhaCarro_(ss, row.rowNumber, {
    feito: 'nao',
    entrada_em: agoraDateTimeIso_(),
    pronto_em: '',
    duracao_min: '',
  });
  return { ok: true, msg: mat + ' em trabalho — cronómetro a contar desde agora.' };
}

/** Marca o carro como feito e devolve o tempo desde a entrada. */
function formCarroPronto(p) {
  var ss = pontosSs_();
  var mat = String(p.matricula || '')
    .trim()
    .toUpperCase();
  if (!mat) return { ok: false, erro: 'Escolha a matrícula.' };
  var row = encontrarLinhaCarro_(ss, mat);
  if (!row) return { ok: false, erro: 'Matrícula não encontrada em Carros.' };
  var entrada = parseDateTimeFlex_(row.entrada_em);
  if (!entrada) {
    return {
      ok: false,
      erro: 'Este carro não tem hora de entrada. Use «Carro chegou» primeiro.',
    };
  }
  var agora = new Date();
  var mins = Math.max(0, Math.round((agora.getTime() - entrada.getTime()) / 60000));
  actualizarLinhaCarro_(ss, row.rowNumber, {
    feito: 'sim',
    pronto_em: agoraDateTimeIso_(),
    duracao_min: mins,
  });
  return {
    ok: true,
    msg: mat + ' pronto em ' + formatDuracao_(mins) + ' (' + mins + ' min).',
    duracaoMin: mins,
    duracaoTexto: formatDuracao_(mins),
  };
}

function listarCarrosOficina() {
  var ss = pontosSs_();
  var emTrabalho = [];
  var todos = [];
  try {
    sheetValues_(ss, FOLHAS.carros).rows.forEach(function (row) {
      if (!sim_(row.ativo == null ? 'sim' : row.ativo)) return;
      var mat = String(row.matricula || '')
        .trim()
        .toUpperCase();
      if (!mat) return;
      var feito = String(row.feito || '')
        .trim()
        .toLowerCase();
      var item = {
        matricula: mat,
        marca: String(row.marca || '').trim(),
        modelo: String(row.modelo || '').trim(),
        feito: feito === 'sim' ? 'sim' : 'nao',
        entrada_em: String(row.entrada_em || '').trim(),
        pronto_em: String(row.pronto_em || '').trim(),
        duracao_min: row.duracao_min === '' || row.duracao_min == null ? null : num_(row.duracao_min, null),
      };
      todos.push(item);
      if (item.feito !== 'sim' && item.entrada_em) emTrabalho.push(item);
    });
  } catch (err) {
    /* sem folha */
  }
  return { emTrabalho: emTrabalho, todos: todos };
}

function formGasto(p) {
  var ss = pontosSs_();
  var tel = normalizarTelemovel_(p.telemovel || '');
  var valor = num_(p.valorEur, NaN);
  if (!encontrarCliente_(ss, tel)) return { ok: false, erro: 'Cliente não encontrado.' };
  if (isNaN(valor) || valor < 0) return { ok: false, erro: 'Valor da fatura inválido.' };
  var regras = lerRegras_(ss);
  var pontos = arred_(valor * (regras.pontos_por_euro || 1));
  appendByHeaders_(ss, FOLHAS.movimentos, {
    data: hojeIso_(),
    telemovel: tel,
    tipo: 'gasto',
    valor_eur: valor,
    pontos: pontos,
    matricula: String(p.matricula || '')
      .trim()
      .toUpperCase(),
    nota: String(p.nota || '').trim(),
  });
  return { ok: true, msg: 'Gasto registado: +' + pontos + ' pontos.' };
}

function formIndicacao(p) {
  var ss = pontosSs_();
  var quem = normalizarTelemovel_(p.quemIndicou || '');
  var novo = normalizarTelemovel_(p.novoTelemovel || '');
  var novoNome = String(p.novoNome || '').trim() || novo;
  if (!encontrarCliente_(ss, quem)) {
    return { ok: false, erro: 'Quem indicou não está em Clientes.' };
  }
  if (!novo || novo.length < 9) return { ok: false, erro: 'Telemóvel do novo cliente inválido.' };
  if (quem === novo) return { ok: false, erro: 'Quem indicou e o novo têm de ser pessoas diferentes.' };
  if (!encontrarCliente_(ss, novo)) {
    appendByHeaders_(ss, FOLHAS.clientes, {
      telemovel: novo,
      nome: novoNome,
      ativo: 'sim',
      nota: 'indicado por ' + quem,
    });
  }
  var regras = lerRegras_(ss);
  var pts = arred_(regras.pontos_por_indicacao || 300);
  appendByHeaders_(ss, FOLHAS.movimentos, {
    data: hojeIso_(),
    telemovel: quem,
    tipo: 'indicacao',
    valor_eur: '',
    pontos: pts,
    matricula: '',
    nota: 'trouxe ' + novo + (novoNome ? ' ' + novoNome : ''),
  });
  return { ok: true, msg: 'Indicação: +' + pts + ' pts para quem trouxe. Novo cliente em Clientes.' };
}

function formResgate(p) {
  var ss = pontosSs_();
  var tel = normalizarTelemovel_(p.telemovel || '');
  var premioId = String(p.premioId || '')
    .trim()
    .toLowerCase();
  if (!encontrarCliente_(ss, tel)) return { ok: false, erro: 'Cliente não encontrado.' };
  var premios = mapaPremios_(ss);
  if (!premioId || premios[premioId] == null) {
    return { ok: false, erro: 'Escolha um prémio do catálogo.' };
  }
  var pts = -Math.abs(premios[premioId]);
  var nomePremio = premioId;
  premiosActivos_(ss).forEach(function (pr) {
    if (pr.id === premioId) nomePremio = pr.nome;
  });
  appendByHeaders_(ss, FOLHAS.movimentos, {
    data: hojeIso_(),
    telemovel: tel,
    tipo: 'resgate',
    valor_eur: '',
    pontos: pts,
    matricula: String(p.matricula || '')
      .trim()
      .toUpperCase(),
    nota: premioId,
  });
  return { ok: true, msg: 'Resgate «' + nomePremio + '»: ' + pts + ' pontos.' };
}

/**
 * Percorre Movimentos e escreve a coluna «pontos» com as regras actuais.
 * Correr depois de mudar Regras (ex.: indicação 100 → 300).
 */
function recalcularPontosMovimentos() {
  var ss = pontosSs_();
  var sh = ss.getSheetByName(FOLHAS.movimentos);
  if (!sh) throw new Error('Folha em falta: Movimentos');

  var regras = lerRegras_(ss);
  var premios = mapaPremios_(ss);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) {
    SpreadsheetApp.getUi().alert('Não há movimentos para recalcular.');
    return;
  }

  var headers = values[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  var iTipo = headers.indexOf('tipo');
  var iValor = headers.indexOf('valor_eur');
  var iPontos = headers.indexOf('pontos');
  var iNota = headers.indexOf('nota');
  if (iTipo < 0 || iPontos < 0) {
    SpreadsheetApp.getUi().alert('A folha Movimentos precisa das colunas tipo e pontos.');
    return;
  }

  var actualizados = 0;
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (linhaVazia_(row)) continue;
    var tipo = String(row[iTipo] || '')
      .trim()
      .toLowerCase();
    var valorEur = iValor >= 0 ? row[iValor] : '';
    var nota = iNota >= 0 ? String(row[iNota] || '') : '';
    var actual = row[iPontos];

    var calculado = calcularPontos_(tipo, valorEur, actual, nota, regras, premios);
    // Em resgate/ajuste sem valor calculável, não apagar o que já está
    if (calculado === null) continue;
    if (Number(actual) === calculado) continue;
    sh.getRange(r + 1, iPontos + 1).setValue(calculado);
    actualizados++;
  }

  SpreadsheetApp.getUi().alert(
    'Recalculado com as regras actuais.\n' +
      'Pontos por euro: ' +
      regras.pontos_por_euro +
      '\n' +
      'Pontos por indicação: ' +
      regras.pontos_por_indicacao +
      '\n' +
      'Linhas actualizadas: ' +
      actualizados,
  );
}

/**
 * Ao editar tipo / valor_eur / nota em Movimentos, preenche «pontos» logo.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== FOLHAS.movimentos) return;
  if (e.range.getRow() === 1) return; // cabeçalho

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  var col = e.range.getColumn() - 1;
  var nomeCol = headers[col];
  if (['tipo', 'valor_eur', 'nota', 'pontos'].indexOf(nomeCol) < 0) return;

  var iTipo = headers.indexOf('tipo');
  var iValor = headers.indexOf('valor_eur');
  var iPontos = headers.indexOf('pontos');
  var iNota = headers.indexOf('nota');
  if (iTipo < 0 || iPontos < 0) return;

  // Se a oficina escreveu «pontos» à mão num resgate/ajuste, não sobrescrever
  if (nomeCol === 'pontos') {
    var tipoManual = String(sh.getRange(e.range.getRow(), iTipo + 1).getValue() || '')
      .trim()
      .toLowerCase();
    if (tipoManual === 'resgate' || tipoManual === 'ajuste') return;
  }

  var ss = e.source;
  var regras = lerRegras_(ss);
  var premios = mapaPremios_(ss);
  var row = e.range.getRow();
  var tipo = String(sh.getRange(row, iTipo + 1).getValue() || '')
    .trim()
    .toLowerCase();
  var valorEur = iValor >= 0 ? sh.getRange(row, iValor + 1).getValue() : '';
  var nota = iNota >= 0 ? String(sh.getRange(row, iNota + 1).getValue() || '') : '';
  var actual = sh.getRange(row, iPontos + 1).getValue();

  var calculado = calcularPontos_(tipo, valorEur, actual, nota, regras, premios);
  if (calculado === null) return;
  sh.getRange(row, iPontos + 1).setValue(calculado);
}

/* ========== Cálculo de pontos (fonte de verdade = Regras) ========== */

/**
 * Devolve o número de pontos a gravar / a somar ao saldo.
 * null = não alterar a célula (resgate/ajuste sem dados suficientes).
 */
function calcularPontos_(tipo, valorEur, pontosCelula, nota, regras, premios) {
  tipo = String(tipo || '')
    .trim()
    .toLowerCase();

  if (tipo === 'gasto') {
    return arred_(num_(valorEur, 0) * (regras.pontos_por_euro || 1));
  }

  if (tipo === 'indicacao') {
    return arred_(regras.pontos_por_indicacao || 300);
  }

  if (tipo === 'resgate') {
    // 1) pontos já negativos na célula
    if (pontosCelula !== '' && pontosCelula != null && !isNaN(Number(pontosCelula))) {
      var p = Number(pontosCelula);
      return p > 0 ? -p : p; // garante débito
    }
    // 2) nota = id do prémio (ex.: "lavagem") → −pontos do catálogo
    var id = String(nota || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)[0];
    if (id && premios[id] != null) {
      return -Math.abs(premios[id]);
    }
    return null;
  }

  if (tipo === 'ajuste') {
    if (pontosCelula !== '' && pontosCelula != null && !isNaN(Number(pontosCelula))) {
      return Number(pontosCelula);
    }
    return null;
  }

  // tipo desconhecido: se houver número, usa-o
  if (pontosCelula !== '' && pontosCelula != null && !isNaN(Number(pontosCelula))) {
    return Number(pontosCelula);
  }
  return 0;
}

function pontosDoMovimento_(row, regras, premios) {
  var tipo = String(row.tipo || '')
    .trim()
    .toLowerCase();
  var calculado = calcularPontos_(
    tipo,
    row.valor_eur,
    row.pontos,
    row.nota,
    regras,
    premios || {},
  );
  if (calculado === null) return 0;
  return calculado;
}

/* ---------- helpers ---------- */

function hojeIso_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || 'Europe/Lisbon',
    'yyyy-MM-dd',
  );
}

function agoraDateTimeIso_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || 'Europe/Lisbon',
    'yyyy-MM-dd HH:mm:ss',
  );
}

function formatDuracao_(mins) {
  var m = Math.max(0, Math.round(Number(mins) || 0));
  var h = Math.floor(m / 60);
  var r = m % 60;
  if (h <= 0) return r + ' min';
  if (r === 0) return h + ' h';
  return h + ' h ' + r + ' min';
}

/** Aceita Date da folha ou texto «yyyy-MM-dd HH:mm:ss» / ISO. */
function parseDateTimeFlex_(raw) {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  var s = String(raw || '').trim();
  if (!s) return null;
  var m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0),
    );
  }
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function encontrarLinhaCarro_(ss, matricula) {
  var mat = String(matricula || '')
    .trim()
    .toUpperCase();
  var sh = ss.getSheetByName(FOLHAS.carros);
  if (!sh || sh.getLastRow() < 2) return null;
  var values = sh.getDataRange().getValues();
  var headers = values[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  var iMat = headers.indexOf('matricula');
  if (iMat < 0) return null;
  for (var r = 1; r < values.length; r++) {
    var cell = String(values[r][iMat] || '')
      .trim()
      .toUpperCase();
    if (cell !== mat) continue;
    var obj = { rowNumber: r + 1 };
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[r][c];
    }
    return obj;
  }
  return null;
}

function actualizarLinhaCarro_(ss, rowNumber, updates) {
  var sh = ss.getSheetByName(FOLHAS.carros);
  if (!sh) throw new Error('Folha Carros em falta.');
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  Object.keys(updates).forEach(function (key) {
    var i = headers.indexOf(String(key).toLowerCase());
    if (i < 0) return;
    sh.getRange(rowNumber, i + 1).setValue(updates[key]);
  });
}

function garantirFolha_(ss, nome, headers) {
  var sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    return sh;
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    return sh;
  }
  // Acrescenta colunas em falta à direita (folhas já existentes).
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  var missing = [];
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim().toLowerCase();
    if (existing.indexOf(h) < 0) missing.push(headers[i]);
  }
  if (missing.length) {
    sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function cabecalhoIndex_(sh, nome) {
  if (!sh || sh.getLastColumn() < 1) return -1;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === nome) return i;
  }
  return -1;
}

/** Acrescenta uma linha alinhada aos cabeçalhos da folha (colunas em falta = vazio). */
function appendByHeaders_(ss, sheetName, obj) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Folha em falta: ' + sheetName);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  if (!headers.length || headers[0] === '') {
    throw new Error('Folha ' + sheetName + ' sem cabeçalhos na linha 1.');
  }
  var row = headers.map(function (h) {
    return obj[h] != null ? obj[h] : '';
  });
  sh.appendRow(row);
}

/* normalizarTelemovel_ — usa a do script de Inscrições */

function sheetValues_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Folha em falta: ' + name);
  var values = sh.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };
  var headers = values[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      var v = values[r][c];
      if (v !== '' && v !== null && v !== undefined) empty = false;
      obj[headers[c]] = v;
    }
    if (!empty) rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

function linhaVazia_(row) {
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== '' && row[i] != null) return false;
  }
  return true;
}

function sim_(v) {
  var s = String(v == null ? '' : v)
    .trim()
    .toLowerCase();
  return s === 'sim' || s === 's' || s === 'yes' || s === 'true' || s === '1';
}

function num_(v, fallback) {
  if (v === '' || v === null || v === undefined) return fallback;
  var n = Number(v);
  return isNaN(n) ? fallback : n;
}

function arred_(n) {
  return Math.round(Number(n) * 100) / 100;
}

function lerRegras_(ss) {
  var out = {
    pontos_por_euro: 1,
    pontos_por_indicacao: 300,
    custo_por_ponto_eur: 0.05,
    meta_custo_percentagem: 5,
  };
  try {
    var data = sheetValues_(ss, FOLHAS.regras);
    data.rows.forEach(function (row) {
      var k = String(row.chave || '')
        .trim()
        .toLowerCase();
      if (k && row.valor !== '' && row.valor != null) {
        out[k] = num_(row.valor, out[k]);
      }
    });
  } catch (err) {
    /* Regras opcional — usa defaults */
  }
  return out;
}

function mapaPremios_(ss) {
  var map = {};
  try {
    var data = sheetValues_(ss, FOLHAS.premios);
    data.rows.forEach(function (row) {
      if (!sim_(row.activo == null ? 'sim' : row.activo)) return;
      var id = String(row.id || '')
        .trim()
        .toLowerCase();
      if (id) map[id] = Math.abs(num_(row.pontos, 0));
    });
  } catch (err) {
    /* Premios opcional */
  }
  return map;
}

function encontrarCliente_(ss, telemovel) {
  var data = sheetValues_(ss, FOLHAS.clientes);
  for (var i = 0; i < data.rows.length; i++) {
    var row = data.rows[i];
    var t = normalizarTelemovel_(row.telemovel);
    if (t === telemovel && sim_(row.ativo == null ? 'sim' : row.ativo)) {
      return { telemovel: t, nome: String(row.nome || '').trim() };
    }
  }
  return null;
}

function formatData_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Europe/Lisbon', 'yyyy-MM-dd');
  }
  return String(v || '').slice(0, 10);
}

function movimentosDoCliente_(ss, telemovel, regras) {
  var premios = mapaPremios_(ss);
  var data = sheetValues_(ss, FOLHAS.movimentos);
  var list = [];
  for (var i = 0; i < data.rows.length; i++) {
    var row = data.rows[i];
    if (normalizarTelemovel_(row.telemovel) !== telemovel) continue;
    var tipo = String(row.tipo || '')
      .trim()
      .toLowerCase();
    list.push({
      data: formatData_(row.data),
      tipo: tipo,
      valorEur: num_(row.valor_eur, null),
      pontos: pontosDoMovimento_(row, regras, premios),
      nota: String(row.nota || '').trim(),
    });
  }
  list.sort(function (a, b) {
    return a.data < b.data ? 1 : a.data > b.data ? -1 : 0;
  });
  return list;
}

function premiosActivos_(ss) {
  var data = sheetValues_(ss, FOLHAS.premios);
  var list = [];
  for (var i = 0; i < data.rows.length; i++) {
    var row = data.rows[i];
    if (!sim_(row.activo == null ? 'sim' : row.activo)) continue;
    list.push({
      id: String(row.id || '').trim(),
      nome: String(row.nome || '').trim(),
      pontos: num_(row.pontos, 0),
      descricao: String(row.descricao || '').trim(),
    });
  }
  list.sort(function (a, b) {
    return a.pontos - b.pontos;
  });
  return list;
}

function primeiroNome_(nome) {
  var n = String(nome || '').trim();
  if (!n) return 'Cliente';
  return n.split(/\s+/)[0];
}
