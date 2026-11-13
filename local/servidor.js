/*
 * INOVACAR Tempos, a correr no computador, com um ficheiro Excel como base de dados.
 *
 *   npm install      (uma vez)
 *   npm start        (abre em http://localhost:3000/gestao/)
 *
 * Mostra a mesma página de public/gestao/ e responde ao que ela pede (listar e gravar) lendo e
 * escrevendo o ficheiro tempos.xlsx (abas Trabalhos, Carros e Clientes). O ficheiro é criado na
 * primeira vez. Pode abri-lo no Excel para ver os dados; enquanto o Excel o tiver aberto, o Windows
 * não deixa gravar: a página guarda as alterações e volta a tentar quando o ficheiro fechar.
 *
 * Opções (variáveis de ambiente): PORTA (3000), EXCEL (caminho do ficheiro).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');

const PORTA = Number(process.env.PORTA) || 3000;
const EXCEL = path.resolve(process.env.EXCEL || path.join(__dirname, 'tempos.xlsx'));
const PUBLICO = path.resolve(__dirname, '..', 'public');

// As mesmas colunas que a Google Sheet usava (sheets/Codigo.gs).
const TABELAS = {
  trabalhos: { aba: 'Trabalhos', campos: ['id', 'carro_id', 'servico', 'descricao', 'estado', 'entrada', 'inicio', 'pronto', 'entregue', 'previsto', 'pausado_em', 'pausa_min', 'pausa_motivo', 'valor', 'notas', 'criado_em'] },
  carros: { aba: 'Carros', campos: ['id', 'cliente_id', 'matricula', 'marca', 'modelo', 'ano', 'km', 'notas', 'criado_em'] },
  clientes: { aba: 'Clientes', campos: ['id', 'nome', 'telemovel', 'email', 'nif', 'notas', 'criado_em'] },
};

// ------------------------------------------------------------------ Excel
const texto = (v) => {
  if (v == null) return '';
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  if (typeof v === 'object') return String(v.text ?? v.result ?? (v.richText ? v.richText.map((r) => r.text).join('') : ''));
  return String(v);
};

async function abrir() {
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(EXCEL)) await wb.xlsx.readFile(EXCEL);
  for (const t of Object.values(TABELAS)) {
    let ws = wb.getWorksheet(t.aba);
    if (!ws) {
      ws = wb.addWorksheet(t.aba, { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.addRow(t.campos);
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((c) => { c.width = 18; });
    }
    // Colunas que faltem (ficheiro antigo ou editado à mão) vão para o fim.
    const cab = cabecalho(ws);
    t.campos.filter((c) => !cab.includes(c)).forEach((c) => {
      const col = ws.getRow(1).cellCount + 1;
      ws.getRow(1).getCell(col).value = c;
      ws.getRow(1).getCell(col).font = { bold: true };
    });
  }
  return wb;
}
const cabecalho = (ws) => { const r = []; ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { r[i - 1] = texto(c.value).trim(); }); return r; };

function linhas(ws) {
  const cab = cabecalho(ws);
  const out = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o = {};
    cab.forEach((c, i) => { if (c) o[c] = texto(row.getCell(i + 1).value); });
    if (o.id) out.push(o);
  });
  return out;
}

async function listar() {
  const wb = await abrir();
  const r = { ok: true };
  for (const [nome, t] of Object.entries(TABELAS)) r[nome] = linhas(wb.getWorksheet(t.aba));
  return r;
}

// Uma escrita de cada vez, para dois pedidos não se atropelarem no ficheiro.
let fila = Promise.resolve();
const emFila = (fn) => { const p = fila.then(fn, fn); fila = p.catch(() => {}); return p; };

function gravar(operacoes) {
  return emFila(async () => {
    const wb = await abrir();
    for (const o of operacoes) {
      const t = TABELAS[o.tabela];
      if (!t) continue; // tabelas que só existiam na Google Sheet (regras, prémios...)
      const ws = wb.getWorksheet(t.aba);
      const cab = cabecalho(ws);
      const colId = cab.indexOf('id') + 1;
      const id = String(o.id || '');
      if (!id) throw new Error('Operação sem id.');
      let linha = null;
      ws.eachRow((row, n) => { if (n > 1 && !linha && texto(row.getCell(colId).value) === id) linha = n; });
      if (o.op === 'apagar') { if (linha) ws.spliceRows(linha, 1); continue; }
      const dados = o.dados || {};
      if (o.op === 'criar' && !linha) {
        ws.addRow(cab.map((c) => (c === 'id' ? id : dados[c] != null ? String(dados[c]) : '')));
        continue;
      }
      if (!linha) continue; // apagado entretanto
      const row = ws.getRow(linha);
      Object.keys(dados).forEach((c) => { const i = cab.indexOf(c); if (i >= 0 && c !== 'id') row.getCell(i + 1).value = String(dados[c] ?? ''); });
      row.commit();
    }
    try {
      await wb.xlsx.writeFile(EXCEL);
    } catch (err) {
      if (['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) {
        throw Object.assign(new Error('O ficheiro Excel está aberto noutro programa. Feche-o no Excel; a página volta a tentar sozinha.'), { codigo: 'ocupado' });
      }
      throw err;
    }
    return { ok: true };
  });
}

// ------------------------------------------------------------------ servidor
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json' };

// O config.js da página, com a base de dados local em vez da Google Sheet.
function configLocal() {
  const original = fs.readFileSync(path.join(PUBLICO, 'gestao', 'config.js'), 'utf8');
  return `${original}\nwindow.GESTAO.apiUrl = '/api';\nwindow.GESTAO.local = true;\nwindow.GESTAO.ficheiro = ${JSON.stringify(EXCEL)};\n`;
}

const responder = (res, codigo, corpo, tipo = 'application/json; charset=utf-8') => {
  res.writeHead(codigo, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
  res.end(typeof corpo === 'string' || Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo));
};

const servidor = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (url === '/api' && req.method === 'POST') {
      let corpo = '';
      for await (const parte of req) corpo += parte;
      const pedido = JSON.parse(corpo || '{}');
      if (pedido.action === 'listar') return responder(res, 200, await listar());
      if (pedido.action === 'gravar') return responder(res, 200, await gravar(pedido.operacoes || []));
      if (pedido.action === 'ping') return responder(res, 200, { ok: true });
      return responder(res, 200, { ok: false, erro: 'Ação desconhecida.' });
    }
    if (url === '/' || url === '/gestao') { res.writeHead(302, { Location: '/gestao/' }); return res.end(); }
    if (url === '/gestao/config.js') return responder(res, 200, configLocal(), TIPOS['.js']);
    let ficheiro = path.join(PUBLICO, url.endsWith('/') ? url + 'index.html' : url);
    if (!ficheiro.startsWith(PUBLICO) || !fs.existsSync(ficheiro) || fs.statSync(ficheiro).isDirectory()) return responder(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
    responder(res, 200, fs.readFileSync(ficheiro), TIPOS[path.extname(ficheiro).toLowerCase()] || 'application/octet-stream');
  } catch (err) {
    console.error('[erro]', err.message);
    responder(res, 200, { ok: false, erro: err.message, codigo: err.codigo || 'servidor' });
  }
});

servidor.listen(PORTA, '0.0.0.0', async () => {
  await emFila(async () => { if (!fs.existsSync(EXCEL)) await (await abrir()).xlsx.writeFile(EXCEL); });
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('\n  INOVACAR Tempos a correr.\n');
  console.log(`  Neste computador:   http://localhost:${PORTA}/gestao/`);
  ips.forEach((ip) => console.log(`  Noutro aparelho:    http://${ip}:${PORTA}/gestao/   (mesma rede Wi-Fi)`));
  console.log(`\n  Excel:              ${EXCEL}`);
  console.log('\n  Para parar: feche esta janela ou carregue Ctrl+C.\n');
});
