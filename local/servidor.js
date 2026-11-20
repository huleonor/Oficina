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

// Colunas do Excel. As visíveis vêm primeiro, com nomes legíveis; as técnicas (ids e pausas), que a
// página precisa para ligar os dados, ficam escondidas no fim. "derivada" = só para ler no Excel
// (o nome do dono, a matrícula...), calculada a cada gravação e ignorada ao ler.
const TABELAS = {
  trabalhos: {
    aba: 'Trabalhos',
    colunas: [
      { campo: 'matricula', titulo: 'Matrícula', largura: 12, derivada: true },
      { campo: 'modelo', titulo: 'Modelo', largura: 20, derivada: true },
      { campo: 'dono', titulo: 'Dono', largura: 24, derivada: true },
      { campo: 'servico', titulo: 'Serviço', largura: 28 },
      { campo: 'estado', titulo: 'Estado', largura: 13 },
      { campo: 'entrada', titulo: 'Entrada', largura: 19 },
      { campo: 'inicio', titulo: 'Início', largura: 19 },
      { campo: 'pronto', titulo: 'Pronto', largura: 19 },
      { campo: 'tempo', titulo: 'Tempo', largura: 10, derivada: true },
      { campo: 'id', oculta: true },
      { campo: 'carro_id', oculta: true },
      { campo: 'pausado_em', oculta: true },
      { campo: 'pausa_min', oculta: true },
      { campo: 'criado_em', oculta: true },
    ],
  },
  carros: {
    aba: 'Carros',
    colunas: [
      { campo: 'matricula', titulo: 'Matrícula', largura: 12 },
      { campo: 'modelo', titulo: 'Modelo', largura: 20 },
      { campo: 'dono', titulo: 'Dono', largura: 24, derivada: true },
      { campo: 'id', oculta: true },
      { campo: 'cliente_id', oculta: true },
      { campo: 'marca', oculta: true },
      { campo: 'criado_em', oculta: true },
    ],
  },
  clientes: {
    aba: 'Clientes',
    colunas: [
      { campo: 'nome', titulo: 'Nome', largura: 28 },
      { campo: 'carros', titulo: 'Carros', largura: 30, derivada: true },
      { campo: 'id', oculta: true },
      { campo: 'criado_em', oculta: true },
    ],
  },
};

// O estado aparece em português no Excel e volta ao código que a página usa.
const ESTADOS = { espera: 'Por começar', curso: 'Em curso', pronto: 'Pronto' };
const ESTADO_CODIGO = Object.fromEntries(Object.entries(ESTADOS).map(([k, v]) => [v.toLowerCase(), k]));

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
const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Lê o ficheiro para { trabalhos: [...], carros: [...], clientes: [...] }.
// Aceita o formato novo (títulos legíveis) e o antigo (nomes técnicos nas colunas).
async function lerDados() {
  const r = { trabalhos: [], carros: [], clientes: [] };
  if (!fs.existsSync(EXCEL)) return r;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL);
  for (const [nome, t] of Object.entries(TABELAS)) {
    const ws = wb.getWorksheet(t.aba);
    if (!ws) continue;
    const porTitulo = {};
    t.colunas.filter((c) => !c.derivada).forEach((c) => { porTitulo[semAcento(c.titulo || c.campo)] = c.campo; porTitulo[c.campo] = c.campo; });
    const cab = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { cab[i] = porTitulo[semAcento(texto(c.value))] || porTitulo[texto(c.value).trim()]; });
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const o = {};
      cab.forEach((campo, i) => { if (campo) o[campo] = texto(row.getCell(i).value).trim(); });
      if (!o.id) return;
      if (nome === 'trabalhos' && o.estado) o.estado = ESTADO_CODIGO[o.estado.toLowerCase()] || o.estado;
      r[nome].push(o);
    });
  }
  return r;
}

const dataDe = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null;
};
function tempoTexto(t) {
  const i = dataDe(t.inicio), f = dataDe(t.pronto);
  if (!i || !f) return '';
  const min = Math.max(0, Math.round((f - i) / 60000 - (Number(t.pausa_min) || 0)));
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

// Escreve o ficheiro inteiro outra vez, já arrumado, com os nomes preenchidos.
async function escreverDados(d) {
  const clientes = new Map(d.clientes.map((c) => [c.id, c]));
  const carros = new Map(d.carros.map((c) => [c.id, c]));
  const derivadas = {
    trabalhos: (t) => {
      const carro = carros.get(t.carro_id) || {};
      const dono = clientes.get(carro.cliente_id) || {};
      return { matricula: carro.matricula, modelo: [carro.marca, carro.modelo].filter(Boolean).join(' '), dono: dono.nome, tempo: tempoTexto(t), estado: ESTADOS[t.estado] || t.estado };
    },
    carros: (c) => ({ dono: (clientes.get(c.cliente_id) || {}).nome }),
    clientes: (c) => ({ carros: d.carros.filter((x) => x.cliente_id === c.id).map((x) => x.matricula).filter(Boolean).join(', ') }),
  };
  const wb = new ExcelJS.Workbook();
  for (const [nome, t] of Object.entries(TABELAS)) {
    const ws = wb.addWorksheet(t.aba, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = t.colunas.map((c) => ({ header: c.titulo || c.campo, key: c.campo, width: c.largura || 14, hidden: !!c.oculta }));
    const cab = ws.getRow(1);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
    for (const o of d[nome]) {
      const extra = derivadas[nome](o);
      ws.addRow(Object.fromEntries(t.colunas.map((c) => [c.campo, String((c.campo in extra ? extra[c.campo] : o[c.campo]) ?? '')])));
    }
    const visiveis = t.colunas.filter((c) => !c.oculta).length;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: visiveis } };
  }
  await wb.xlsx.writeFile(EXCEL);
}

async function listar() {
  return { ok: true, ...(await lerDados()) };
}

// Uma escrita de cada vez, para dois pedidos não se atropelarem no ficheiro.
let fila = Promise.resolve();
const emFila = (fn) => { const p = fila.then(fn, fn); fila = p.catch(() => {}); return p; };

function gravar(operacoes) {
  return emFila(async () => {
    const d = await lerDados();
    for (const o of operacoes) {
      const lista = d[o.tabela];
      if (!lista) continue; // tabelas que só existiam na Google Sheet (regras, prémios...)
      const id = String(o.id || '');
      if (!id) throw new Error('Operação sem id.');
      const i = lista.findIndex((r) => r.id === id);
      if (o.op === 'apagar') { if (i >= 0) lista.splice(i, 1); continue; }
      const dados = {};
      Object.entries(o.dados || {}).forEach(([k, v]) => { if (k !== 'id') dados[k] = v == null ? '' : String(v); });
      if (o.op === 'criar' && i < 0) { lista.push({ ...dados, id }); continue; }
      if (i >= 0) lista[i] = { ...lista[i], ...dados, id };
    }
    try {
      await escreverDados(d);
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
  // Cria o ficheiro na primeira vez e arruma um ficheiro antigo (colunas novas, nomes preenchidos).
  if (fs.existsSync(EXCEL)) { try { fs.copyFileSync(EXCEL, EXCEL.replace(/\.xlsx$/i, '') + '-copia.xlsx'); } catch {} }
  await emFila(async () => escreverDados(await lerDados())).catch((err) => console.error('[erro] Excel:', err.message));
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('\n  INOVACAR Tempos a correr.\n');
  console.log(`  Neste computador:   http://localhost:${PORTA}/gestao/`);
  ips.forEach((ip) => console.log(`  Noutro aparelho:    http://${ip}:${PORTA}/gestao/   (mesma rede Wi-Fi)`));
  console.log(`\n  Excel:              ${EXCEL}`);
  console.log('\n  Para parar: feche esta janela ou carregue Ctrl+C.\n');
});
