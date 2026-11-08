/**
 * INOVACAR Gestão: a ponte entre a página de gestão e a Google Sheet.
 *
 * Um projeto Apps Script à parte do dos pontos (sheets/Codigo.gs). Da aba Pontos só lê o saldo,
 * para a ficha do cliente; não lhe escreve nada.
 * Escreve só em três abas próprias, criadas na primeira vez:
 *   Gestão Clientes, Gestão Carros, Gestão Trabalhos
 *
 * Instalar (uma vez): ver sheets/GESTAO.md.
 *   1. script.google.com > Novo projeto, colar este ficheiro.
 *   2. Mudar o PIN abaixo.
 *   3. Implementar > Nova implementação > Aplicação Web:
 *      Executar como: Eu. Quem tem acesso: Qualquer pessoa.
 *   4. Copiar o URL /exec para a página (engrenagem, Ligação à sheet).
 */

// O PIN que a equipa escreve na página. Mude-o antes de implementar.
const PIN = 'mude-este-pin';

const SHEET_ID = '1Y4kAFBR1wPxucrGMxHn6jyOFDQi50SGtrAhb7XHWlFs';

const TABELAS = {
  clientes: {
    aba: 'Gestão Clientes',
    campos: ['id', 'nome', 'telemovel', 'email', 'nif', 'notas', 'criado_em'],
  },
  carros: {
    aba: 'Gestão Carros',
    campos: ['id', 'cliente_id', 'matricula', 'marca', 'modelo', 'ano', 'km', 'notas', 'criado_em'],
  },
  trabalhos: {
    aba: 'Gestão Trabalhos',
    campos: [
      'id', 'carro_id', 'servico', 'descricao', 'estado',
      'entrada', 'inicio', 'pronto', 'entregue', 'previsto',
      'notas', 'criado_em',
    ],
  },
};

function doGet() {
  return responder({ ok: true, servico: 'inovacar-gestao' });
}

function doPost(e) {
  let pedido;
  try {
    pedido = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return responder({ ok: false, erro: 'Pedido inválido.' });
  }
  if (pedido.action === 'ping') return responder({ ok: true, servico: 'inovacar-gestao' });
  if (!PIN || PIN === 'mude-este-pin') {
    return responder({ ok: false, erro: 'Defina o PIN no Apps Script antes de usar.', codigo: 'sem-pin' });
  }
  if (String(pedido.pin || '') !== PIN) {
    return responder({ ok: false, erro: 'PIN errado.', codigo: 'pin' });
  }
  try {
    if (pedido.action === 'listar') return responder(listar());
    if (pedido.action === 'gravar') return responder(gravar(pedido.operacoes || []));
    return responder({ ok: false, erro: 'Ação desconhecida.' });
  } catch (err) {
    return responder({ ok: false, erro: String(err && err.message || err) });
  }
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function livro() {
  return SpreadsheetApp.openById(SHEET_ID);
}

/** A aba de uma tabela, criada com os cabeçalhos se faltar; acrescenta colunas que faltem. */
function aba(nome) {
  const t = TABELAS[nome];
  if (!t) throw new Error('Tabela desconhecida: ' + nome);
  const ss = livro();
  let sh = ss.getSheetByName(t.aba);
  if (!sh) {
    sh = ss.insertSheet(t.aba);
    sh.getRange(1, 1, 1, t.campos.length).setValues([t.campos]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // Tudo como texto: datas e matrículas ficam exatamente como a página as escreve.
    sh.getRange(1, 1, sh.getMaxRows(), t.campos.length).setNumberFormat('@');
    return sh;
  }
  const largura = Math.max(sh.getLastColumn(), 1);
  const cab = sh.getRange(1, 1, 1, largura).getValues()[0].map(String);
  const faltam = t.campos.filter(function (c) { return cab.indexOf(c) < 0; });
  if (faltam.length) {
    const inicio = cab.filter(String).length + 1;
    sh.getRange(1, inicio, 1, faltam.length).setValues([faltam]).setFontWeight('bold');
    sh.getRange(1, inicio, sh.getMaxRows(), faltam.length).setNumberFormat('@');
  }
  return sh;
}

function cabecalho(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
}

function texto(v) {
  if (v instanceof Date) return v.toISOString();
  if (v === null || v === undefined) return '';
  return String(v);
}

function linhas(nome) {
  const sh = aba(nome);
  const cab = cabecalho(sh);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const valores = sh.getRange(2, 1, n, cab.length).getValues();
  const out = [];
  valores.forEach(function (linha) {
    const o = {};
    cab.forEach(function (c, i) { if (c) o[c] = texto(linha[i]); });
    if (o.id) out.push(o);
  });
  return out;
}

/** Só leitura: o saldo de cada telemóvel na aba Pontos do programa de pontos, se existir. */
function pontos() {
  const sh = livro().getSheetByName('Pontos');
  if (!sh || sh.getLastRow() < 2) return {};
  const valores = sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), 1)).getValues();
  // O cabeçalho pode não estar na primeira linha (a folha de demo tem um título por cima).
  let h = valores.findIndex(function (l) { return l.map(String).indexOf('telemovel') >= 0; });
  if (h < 0) return {};
  const cab = valores[h].map(String), ct = cab.indexOf('telemovel'), cp = cab.indexOf('pontos');
  if (cp < 0) return {};
  const out = {};
  valores.slice(h + 1).forEach(function (l) {
    const tel = String(l[ct]).replace(/\D/g, '').slice(-9);
    if (tel.length === 9 && l[cp] !== '') out[tel] = Number(l[cp]) || 0;
  });
  return out;
}

function listar() {
  return {
    ok: true,
    clientes: linhas('clientes'),
    carros: linhas('carros'),
    trabalhos: linhas('trabalhos'),
    pontos: pontos(),
    lido_em: new Date().toISOString(),
  };
}

/** Grava um lote de operações de uma vez: { op: criar|atualizar|apagar, tabela, id, dados }. */
function gravar(operacoes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const feitas = [];
    operacoes.forEach(function (o) {
      const sh = aba(o.tabela);
      const cab = cabecalho(sh);
      const colId = cab.indexOf('id') + 1;
      const id = String(o.id || (o.dados && o.dados.id) || '');
      if (!id) throw new Error('Operação sem id.');
      const linha = acharLinha(sh, colId, id);

      if (o.op === 'apagar') {
        if (linha) sh.deleteRow(linha);
        feitas.push(id);
        return;
      }
      const dados = o.dados || {};
      if (o.op === 'criar' && !linha) {
        const nova = cab.map(function (c) {
          if (c === 'id') return id;
          return dados[c] !== undefined ? texto(dados[c]) : '';
        });
        const r = sh.getLastRow() + 1;
        if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
        // Como texto, para a sheet não transformar datas, telemóveis ou matrículas.
        sh.getRange(r, 1, 1, nova.length).setNumberFormat('@').setValues([nova]);
        feitas.push(id);
        return;
      }
      // Apagado entretanto noutro aparelho: não há o que atualizar.
      if (!linha) { feitas.push(id); return; }
      Object.keys(dados).forEach(function (c) {
        const col = cab.indexOf(c) + 1;
        if (col > 0 && c !== 'id') sh.getRange(linha, col).setNumberFormat('@').setValue(texto(dados[c]));
      });
      feitas.push(id);
    });
    return { ok: true, feitas: feitas };
  } finally {
    lock.releaseLock();
  }
}

function acharLinha(sh, colId, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1 || colId < 1) return 0;
  const ids = sh.getRange(2, colId, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return 0;
}
