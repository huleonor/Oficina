/* INOVACAR Gestão: carros, tempos, clientes, pontos e prémios, com a Google Sheet como base de dados. */
(() => {
  'use strict';

  const CFG = window.GESTAO || {};
  const ICONES = window.ICONES || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduzir = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- utilidades
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icone = (nome, extra = '') =>
    `<svg class="ico ${extra}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${ICONES[nome] || ''}</svg>`;
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const soDigitos = (s) => String(s || '').replace(/\D/g, '');
  const num = (v) => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const temNum = (v) => String(v ?? '').trim() !== '' && !isNaN(Number(String(v).replace(',', '.')));
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço ou privado */ } };
  const ler = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

  const EUR = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
  const EUR0 = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eur = (n, inteiro = false) => (inteiro && Math.abs(n) >= 100 ? EUR0 : EUR).format(n || 0);
  const NUM = new Intl.NumberFormat('pt-PT');
  const pts = (n) => NUM.format(Math.round(n || 0));
  const pct = (n, casas = 1) => `${(n || 0).toLocaleString('pt-PT', { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;

  // Matrículas: guardadas como AA-00-AA; procuradas sem hífenes.
  const matChave = (m) => String(m || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const matFormatar = (m) => {
    const k = matChave(m);
    return k.length === 6 ? `${k.slice(0, 2)}-${k.slice(2, 4)}-${k.slice(4)}` : k;
  };
  const placa = (m, tam = '') => m
    ? `<span class="placa ${tam}" aria-label="Matrícula ${esc(m)}"><span>${esc(m)}</span></span>`
    : `<span class="placa vazia ${tam}"><span>Sem matrícula</span></span>`;
  const telFormatar = (t) => {
    const d = soDigitos(t);
    return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : String(t || '');
  };

  // ---------------------------------------------------------------- datas e tempos
  // Na sheet as datas ficam legíveis, na hora local: "2026-11-08 09:12".
  const pad = (n) => String(n).padStart(2, '0');
  const paraTexto = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const agoraTexto = () => paraTexto(new Date());
  const data = (s) => {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (m && !/Z|[+-]\d{2}:?\d{2}$/.test(String(s))) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };
  const paraInput = (s) => { const d = data(s); return d ? paraTexto(d).replace(' ', 'T') : ''; };
  const deInput = (v) => (v ? v.replace('T', ' ').slice(0, 16) : '');
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const inicioSemana = (d) => { const x = inicioDia(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  function quando(s, comHora = true) {
    const d = data(s);
    if (!d) return '';
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
    let dia;
    if (mesmoDia(d, hoje)) dia = 'hoje';
    else if (mesmoDia(d, ontem)) dia = 'ontem';
    else if (mesmoDia(d, amanha)) dia = 'amanhã';
    else dia = `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== hoje.getFullYear() ? ' ' + d.getFullYear() : ''}`;
    return comHora ? `${dia}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : dia;
  }
  const MIN = 60000, HORA = 60 * MIN, DIA = 24 * HORA;
  function duracao(ms) {
    if (ms == null || isNaN(ms)) return '';
    ms = Math.max(0, ms);
    if (ms < HORA) return `${Math.max(1, Math.round(ms / MIN))} min`;
    if (ms < DIA) { const h = Math.floor(ms / HORA), m = Math.round((ms % HORA) / MIN); return m ? `${h} h ${m} min` : `${h} h`; }
    const d = Math.floor(ms / DIA), h = Math.round((ms % DIA) / HORA);
    return h ? `${d} d ${h} h` : `${d} d`;
  }

  // Horas de abertura entre dois instantes (seg a sex, 09:00 às 18:30 por defeito).
  const HOR = CFG.horario || { dias: [1, 2, 3, 4, 5], abre: '09:00', fecha: '18:30' };
  const minutosDe = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const ABRE = minutosDe(HOR.abre), FECHA = minutosDe(HOR.fecha);
  const DIA_UTIL = (FECHA - ABRE) * MIN;
  function horasUteis(a, b) {
    if (!a || !b || b <= a) return 0;
    let total = 0;
    const d = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    for (let i = 0; d <= b && i < 3660; i++) {
      if (HOR.dias.includes(d.getDay())) {
        const ini = new Date(d.getTime() + ABRE * MIN), fim = new Date(d.getTime() + FECHA * MIN);
        const s = Math.max(ini, a), e = Math.min(fim, b);
        if (e > s) total += e - s;
      }
      d.setDate(d.getDate() + 1);
    }
    return total;
  }
  // Uma duração em horas de abertura: "3 h 20 min", ou "2 dias e 3 h" a partir de um dia inteiro.
  function duracaoUtil(ms) {
    if (ms == null || isNaN(ms)) return '';
    if (ms < DIA_UTIL) return ms < MIN ? '0 min' : duracao(ms);
    const dias = Math.floor(ms / DIA_UTIL), resto = Math.round((ms % DIA_UTIL) / HORA);
    const d = `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
    return resto ? `${d} e ${resto} h` : d;
  }
  // O relógio grande dos cartões: "2:14" (horas de abertura).
  const relogio = (ms) => {
    const m = Math.floor(Math.max(0, ms) / MIN), h = Math.floor(m / 60);
    if (ms >= DIA_UTIL) { const d = Math.floor(ms / DIA_UTIL), r = Math.round((ms % DIA_UTIL) / HORA); return `${d}<small>${d === 1 ? 'dia' : 'dias'}</small>${r ? `${r}<small>h</small>` : ''}`; }
    return h ? `${h}<small>h</small>${pad(m % 60)}` : `${m}<small>min</small>`;
  };

  // ---------------------------------------------------------------- estados
  const ESTADOS = {
    espera: { nome: 'À espera', curto: 'À espera', acao: 'Começar' },
    curso: { nome: 'Em trabalho', curto: 'Em curso', acao: 'Pronto' },
    pronto: { nome: 'Pronto a levantar', curto: 'Prontos', acao: 'Entregar' },
    entregue: { nome: 'Entregue', curto: 'Entregue', acao: '' },
  };
  const ORDEM = ['espera', 'curso', 'pronto', 'entregue'];
  const seguinte = (e) => ORDEM[ORDEM.indexOf(e) + 1];
  const CARIMBO_DE = { curso: 'inicio', pronto: 'pronto', entregue: 'entregue' };
  const MOTIVOS = ['À espera de peças', 'À espera do cliente', 'Outro trabalho primeiro'];
  const TIPOS = {
    gasto: { nome: 'Serviço na oficina', ic: 'receipt' },
    resgate: { nome: 'Troca de pontos', ic: 'gift' },
    indicacao: { nome: 'Indicação de um amigo', ic: 'user-plus' },
    ajuste: { nome: 'Ajuste', ic: 'sliders-horizontal' },
  };

  // ---------------------------------------------------------------- estado da página
  const TABELAS = ['clientes', 'carros', 'trabalhos', 'movimentos', 'premios', 'regras'];
  const st = {
    clientes: [], carros: [], trabalhos: [], movimentos: [], premios: [], regras: [],
    carregado: false, erro: null, codigoErro: null,
    pendentes: ler('ig.pendentes', []),
    enviando: false, lendo: false, animando: 0,
    faixa: 'curso', periodo: 'mes', busca: { oficina: '', clientes: '', carros: '' },
  };

  const ligacao = () => {
    const l = ler('ig.ligacao', {});
    return { apiUrl: (l.apiUrl || CFG.apiUrl || '').trim(), pin: l.pin || '' };
  };
  const emDemo = () => !ligacao().apiUrl || ler('ig.forcarDemo', false);

  // Regras do programa de pontos e da oficina (aba Gestão Regras).
  const REGRAS_BASE = { pontos_por_euro: '1', retorno_percent: '3', objetivo_semana: '12', pontos_por_indicacao: '300' };
  const regra = (k) => { const r = st.regras.find((x) => x.id === k); return num(r && temNum(r.valor) ? r.valor : REGRAS_BASE[k]); };
  // O que um ponto custa à oficina: retorno ÷ pontos por euro (3% e 1 ponto por euro: 0,03 €).
  const valorPonto = () => (regra('retorno_percent') / 100) / Math.max(0.0001, regra('pontos_por_euro'));
  const pontosSugeridos = (custo) => { const v = num(custo) / valorPonto(); return v >= 100 ? Math.round(v / 10) * 10 : Math.max(5, Math.round(v / 5) * 5); };

  // ---------------------------------------------------------------- índices
  let idx = {};
  function indexar() {
    const i = { cliente: new Map(), carro: new Map(), trabalho: new Map(), premio: new Map(), carroPorMat: new Map(), trabalhosDoCarro: new Map(), carrosDoCliente: new Map(), movsDoCliente: new Map(), saldo: new Map(), mediaTrabalho: new Map() };
    st.clientes.forEach((c) => i.cliente.set(c.id, c));
    st.premios.forEach((p) => i.premio.set(p.id, p));
    st.carros.forEach((c) => {
      i.carro.set(c.id, c);
      if (c.matricula) i.carroPorMat.set(matChave(c.matricula), c);
      if (!i.carrosDoCliente.has(c.cliente_id)) i.carrosDoCliente.set(c.cliente_id, []);
      i.carrosDoCliente.get(c.cliente_id).push(c);
    });
    st.trabalhos.forEach((t) => {
      i.trabalho.set(t.id, t);
      if (!i.trabalhosDoCarro.has(t.carro_id)) i.trabalhosDoCarro.set(t.carro_id, []);
      i.trabalhosDoCarro.get(t.carro_id).push(t);
    });
    i.trabalhosDoCarro.forEach((l) => l.sort((a, b) => (data(b.entrada) || 0) - (data(a.entrada) || 0)));
    st.movimentos.forEach((m) => {
      if (!i.movsDoCliente.has(m.cliente_id)) i.movsDoCliente.set(m.cliente_id, []);
      i.movsDoCliente.get(m.cliente_id).push(m);
      i.saldo.set(m.cliente_id, (i.saldo.get(m.cliente_id) || 0) + num(m.pontos));
    });
    i.movsDoCliente.forEach((l) => l.sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criado_em).localeCompare(String(a.criado_em))));
    // Tempo médio de trabalho por serviço, para a barra dos cartões em curso.
    const soma = new Map();
    st.trabalhos.forEach((t) => {
      if (!t.pronto || !t.inicio) return;
      const k = t.servico || '';
      const v = tempos(t).trabalho;
      const s = soma.get(k) || [0, 0]; s[0] += v; s[1]++; soma.set(k, s);
      const g = soma.get('*') || [0, 0]; g[0] += v; g[1]++; soma.set('*', g);
    });
    soma.forEach(([s, n], k) => i.mediaTrabalho.set(k, s / n));
    idx = i;
  }
  const carroDe = (t) => idx.carro.get(t.carro_id);
  const clienteDe = (carro) => (carro ? idx.cliente.get(carro.cliente_id) : null);
  const nomeCarro = (c) => (c ? [c.marca, c.modelo].filter(Boolean).join(' ') || 'Carro sem marca' : 'Carro apagado');
  const saldoDe = (cid) => Math.max(0, idx.saldo.get(cid) || 0);
  const trabalhosDoCliente = (cid) => (idx.carrosDoCliente.get(cid) || []).flatMap((c) => idx.trabalhosDoCarro.get(c.id) || [])
    .sort((a, b) => (data(b.entrada) || 0) - (data(a.entrada) || 0));
  const mediaDe = (servico) => idx.mediaTrabalho.get(servico || '') ?? idx.mediaTrabalho.get('*') ?? null;
  const emPausa = (t) => t.estado === 'curso' && !!t.pausado_em;

  function tempos(t, ate = new Date()) {
    const e = data(t.entrada), i = data(t.inicio), p = data(t.pronto);
    const fimOficina = p || (t.estado === 'entregue' ? data(t.entregue) : null) || ate;
    const pausaAgora = t.pausado_em && !p ? horasUteis(data(t.pausado_em), ate) : 0;
    const pausa = num(t.pausa_min) * MIN + pausaAgora;
    return {
      espera: e ? horasUteis(e, i || (t.estado === 'espera' ? ate : fimOficina)) : null,
      trabalho: i ? Math.max(0, horasUteis(i, p || ate) - pausa) : null,
      pausa,
      oficina: e ? horasUteis(e, fimOficina) : null,
      calendario: e ? fimOficina - e : null,
      concluido: !!p,
    };
  }
  const fimDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
  function prazo(t) {
    if (!t.previsto || t.estado === 'pronto' || t.estado === 'entregue') return null;
    const d = data(t.previsto);
    if (!d) return null;
    const hoje = new Date();
    if (fimDoDia(d) < hoje) { const dias = Math.round((inicioDia(hoje) - inicioDia(d)) / DIA); return { tipo: 'atraso', txt: dias <= 1 ? 'Atrasado desde ontem' : `Atrasado ${dias} dias` }; }
    if (mesmoDia(d, hoje)) return { tipo: 'hoje', txt: 'Prometido para hoje' };
    return { tipo: 'ok', txt: `Para ${quando(t.previsto, false)}` };
  }
  const cumpriuPrazo = (t) => {
    if (!t.previsto || !t.pronto) return null;
    return data(t.pronto) <= fimDoDia(data(t.previsto));
  };

  // ---------------------------------------------------------------- servidor (Apps Script) ou demonstração
  async function chamar(corpo) {
    const { apiUrl, pin } = ligacao();
    if (emDemo()) return demo.chamar(corpo);
    const r = await fetch(apiUrl, {
      method: 'POST',
      // text/plain evita o pedido prévio de CORS, que o Apps Script não atende.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...corpo, pin }),
      redirect: 'follow',
    });
    if (!r.ok) throw Object.assign(new Error(`A sheet respondeu ${r.status}.`), { codigo: 'rede' });
    let j;
    try { j = await r.json(); } catch { throw Object.assign(new Error('A resposta não veio do script da INOVACAR. Confirme o URL /exec.'), { codigo: 'url' }); }
    if (corpo.action && ((j.ok && j.servico === 'inovacar-pontos') || j.erro === 'telemovel_invalido')) {
      throw Object.assign(new Error('O script da sheet ainda é o antigo. Cole o Codigo.gs novo e faça Nova versão da implementação.'), { codigo: 'versao' });
    }
    if (!j.ok) throw Object.assign(new Error(j.erro || 'Erro na sheet.'), { codigo: j.codigo || 'sheet' });
    return j;
  }

  function aplicar(base, ops) {
    ops.forEach((o) => {
      const lista = base[o.tabela];
      if (!lista) return;
      const i = lista.findIndex((r) => r.id === o.id);
      if (o.op === 'apagar') { if (i >= 0) lista.splice(i, 1); return; }
      if (o.op === 'criar' && i < 0) { lista.push({ ...o.dados, id: o.id }); return; }
      if (i >= 0) lista[i] = { ...lista[i], ...o.dados, id: o.id };
    });
  }
  const baseAtual = () => Object.fromEntries(TABELAS.map((t) => [t, st[t]]));

  function guardarCache() {
    if (emDemo()) return;
    guardar('ig.cache', { url: ligacao().apiUrl, ...baseAtual() });
  }

  async function carregar({ silencioso = false } = {}) {
    if (st.lendo) return;
    st.lendo = true;
    if (!silencioso) atualizarSync();
    try {
      if (st.pendentes.length) await enviar();
      const j = await chamar({ action: 'listar' });
      const base = Object.fromEntries(TABELAS.map((t) => [t, j[t] || []]));
      aplicar(base, st.pendentes);
      Object.assign(st, base, { carregado: true, erro: null, codigoErro: null });
      indexar();
      guardarCache();
    } catch (err) {
      st.erro = err.message || String(err);
      st.codigoErro = err.codigo || 'rede';
      if (['pin', 'sem-pin', 'versao'].includes(err.codigo) && !painel.open) abrirPainel('ligacao');
    } finally {
      st.lendo = false;
      desenhar();
    }
  }

  function gravar(ops, msg) {
    const base = baseAtual();
    aplicar(base, ops);
    indexar();
    st.pendentes.push(...ops);
    guardar('ig.pendentes', st.pendentes);
    guardarCache();
    desenhar();
    if (msg) toast(msg);
    enviar();
  }

  let tentarDeNovo = null;
  async function enviar() {
    if (st.enviando || !st.pendentes.length) return;
    st.enviando = true;
    atualizarSync();
    const lote = st.pendentes.slice();
    try {
      await chamar({ action: 'gravar', operacoes: lote });
      st.pendentes = st.pendentes.slice(lote.length);
      guardar('ig.pendentes', st.pendentes);
      if (st.erro && st.carregado) { st.erro = null; st.codigoErro = null; desenharAviso(); }
    } catch (err) {
      st.erro = err.message || String(err);
      st.codigoErro = err.codigo || 'rede';
      desenharAviso();
      clearTimeout(tentarDeNovo);
      tentarDeNovo = setTimeout(enviar, 15000);
    } finally {
      st.enviando = false;
      atualizarSync();
    }
    if (st.pendentes.length && !st.erro) enviar();
  }

  // ---------------------------------------------------------------- demonstração (dados só neste navegador)
  const demo = {
    dados() {
      let d = ler('ig.demo2', null);
      if (!d) { d = semente(); guardar('ig.demo2', d); }
      return d;
    },
    async chamar(corpo) {
      await new Promise((r) => setTimeout(r, 200));
      const d = this.dados();
      if (corpo.action === 'listar') return { ok: true, ...JSON.parse(JSON.stringify(d)) };
      if (corpo.action === 'gravar') { aplicar(d, corpo.operacoes || []); guardar('ig.demo2', d); return { ok: true }; }
      return { ok: true };
    },
  };

  function semente() {
    const agora = new Date();
    const util = (n) => {
      const d = new Date(agora); d.setHours(12, 0, 0, 0);
      while (!HOR.dias.includes(d.getDay())) d.setDate(d.getDate() - 1);
      for (let k = 0; k < -n; k++) { d.setDate(d.getDate() - 1); while (!HOR.dias.includes(d.getDay())) d.setDate(d.getDate() - 1); }
      const hoje = new Date(agora); hoje.setHours(12, 0, 0, 0);
      return Math.round((d - hoje) / DIA);
    };
    const em = (dias, h = 9, m = 0) => { const d = new Date(agora); d.setDate(d.getDate() + dias); d.setHours(h, m, 0, 0); return paraTexto(d > agora ? new Date(agora - 20 * MIN) : d); };
    const clientes = [
      ['Ana Sousa', '934000001'], ['Bruno Martins', '934000002'], ['Jorge Abrantes', '928021473'],
      ['Marta Pinho', '912345118'], ['Rui Teixeira', '965220871'], ['Sofia Ramos', '936418002'],
      ['Carlos Neves', '917003455'], ['Inês Matos', '932118740'],
    ].map(([nome, telemovel], k) => ({ id: 'cli' + k, nome, telemovel, email: '', nif: '', notas: '', criado_em: em(-120) }));
    const carros = [
      ['cli0', '45-QX-12', 'Peugeot', '208', '2019', '84200'], ['cli1', 'AB-12-CD', 'Renault', 'Clio', '2017', '132500'],
      ['cli2', '27-LM-88', 'Volkswagen', 'Golf', '2015', '188900'], ['cli3', 'BE-04-RT', 'Toyota', 'Yaris', '2021', '41300'],
      ['cli4', '91-TT-30', 'BMW', 'Série 1', '2016', '159000'], ['cli5', 'AK-77-PX', 'Seat', 'Ibiza', '2020', '67800'],
      ['cli6', '12-HG-09', 'Opel', 'Corsa', '2012', '214000'], ['cli7', 'BJ-31-SM', 'Fiat', '500', '2022', '22100'],
      ['cli2', '66-PO-41', 'Citroën', 'Berlingo', '2014', '241700'],
    ].map(([cliente_id, matricula, marca, modelo, ano, km], k) => ({ id: 'car' + k, cliente_id, matricula, marca, modelo, ano, km, notas: '', criado_em: em(-120) }));
    const S = CFG.servicos || [];
    const premios = [
      ['aromatizante', 'Aromatizante', 1.5, '18', 'Aromatizante para o habitáculo', 'https://www.continente.pt'],
      ['kit-limpeza', 'Kit de limpeza', 3, '2', 'Panos de microfibra e limpa-vidros', ''],
      ['aspiracao', 'Aspiração do habitáculo', 4, '', 'Aspiração completa do interior', ''],
      ['lavagem', 'Lavagem exterior', 5, '', 'Lavagem exterior do veículo', ''],
      ['lavagem-completa', 'Lavagem completa', 9, '', 'Lavagem exterior e limpeza do habitáculo', ''],
      ['desconto10', 'Desconto 10 €', 10, '', 'Desconto de 10 euros na próxima fatura', ''],
      ['check-up', 'Check-up rápido', 12.5, '', 'Níveis, luzes, pneus e bateria', ''],
      ['desconto25', 'Desconto 25 €', 25, '', 'Desconto de 25 euros na próxima fatura', ''],
    ].map(([id, nome, custo, stock, descricao, comprar]) => ({ id, nome, pontos: String(Math.round(custo / 0.03 / 10) * 10), custo_eur: String(custo), stock, descricao, comprar, nota: '', ativo: 'sim', criado_em: em(-120) }));
    const regras = Object.entries(REGRAS_BASE).map(([id, valor]) => ({ id, valor, nota: '' }));
    const t = [], movs = [];
    const add = (carro, servico, descricao, estado, entrada, inicio, pronto, entregue, previsto, extra = {}) =>
      t.push({ id: 'tr' + t.length, carro_id: carro, servico, descricao, estado, entrada, inicio: inicio || '', pronto: pronto || '', entregue: entregue || '', previsto: previsto || '', pausado_em: '', pausa_min: '', pausa_motivo: '', valor: '', notas: '', criado_em: entrada, ...extra });
    const d0 = util(0);
    add('car0', S[1], 'Pastilhas da frente a chiar.', 'espera', em(d0, 9, 5), '', '', '', em(d0, 18, 0).slice(0, 10));
    add('car3', S[0], 'Revisão dos 40 mil.', 'espera', em(d0, 10, 40));
    add('car4', S[2], 'Luz do motor acesa, perde força a subir.', 'curso', em(util(-1), 15, 20), em(d0, 9, 30), '', '', em(util(-1), 18, 0).slice(0, 10));
    add('car6', S[5], 'Embraiagem a patinar.', 'curso', em(util(-2), 9, 15), em(util(-2), 11, 0), '', '', em(d0, 18, 0).slice(0, 10), { pausado_em: em(d0, 9, 40), pausa_motivo: MOTIVOS[0] });
    add('car5', S[3], 'Não pega de manhã.', 'pronto', em(d0, 8, 55), em(d0, 9, 10), em(d0, 10, 25), '', em(d0, 18, 0).slice(0, 10));
    // Histórico: cerca de 5 meses de carros entregues, com o que pagaram.
    const carrosIds = carros.map((c) => c.id);
    let semilla = 7;
    const rnd = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
    const precos = [95, 160, 70, 120, 210, 380, 520, 60];
    const horasServ = [1.4, 3, 2.5, 1.2, 5, 9, 14, 1.8];
    for (let k = 0; k < 62; k++) {
      const dias = -Math.round(2 + rnd() * 150);
      const entrada = new Date(agora); entrada.setDate(entrada.getDate() + dias);
      while (!HOR.dias.includes(entrada.getDay())) entrada.setDate(entrada.getDate() - 1);
      entrada.setHours(9 + Math.floor(rnd() * 5), Math.floor(rnd() * 60), 0, 0);
      const s = Math.floor(rnd() * 8);
      const inicio = new Date(entrada.getTime() + (15 + rnd() * 120) * MIN);
      let pronto = new Date(inicio), resto = horasServ[s] * (0.7 + rnd() * 0.7) * HORA;
      while (resto > 0) {
        const fecho = new Date(pronto); fecho.setHours(Math.floor(FECHA / 60), FECHA % 60, 0, 0);
        const cabe = fecho - pronto;
        if (HOR.dias.includes(pronto.getDay()) && cabe > 0) {
          const usa = Math.min(cabe, resto); pronto = new Date(pronto.getTime() + usa); resto -= usa;
          if (resto <= 0) break;
        }
        pronto.setDate(pronto.getDate() + 1); pronto.setHours(Math.floor(ABRE / 60), ABRE % 60, 0, 0);
      }
      if (pronto > agora) continue;
      const entregue = new Date(Math.min(agora.getTime(), pronto.getTime() + (1 + rnd() * 20) * HORA));
      const prev = new Date(entrada); prev.setDate(prev.getDate() + (horasServ[s] > 8 ? 2 : 0));
      const carro = carrosIds[Math.floor(rnd() * carrosIds.length)];
      const valor = Math.round(precos[s] * (0.75 + rnd() * 0.6));
      const id = 'tr' + t.length;
      add(carro, S[s], '', 'entregue', paraTexto(entrada), paraTexto(inicio), paraTexto(pronto), paraTexto(entregue), k % 3 === 0 ? '' : paraTexto(prev).slice(0, 10), { valor: String(valor) });
      const cli = carros.find((c) => c.id === carro).cliente_id;
      movs.push({ id: 'mv' + movs.length, data: paraTexto(entregue), cliente_id: cli, tipo: 'gasto', valor_eur: String(valor), pontos: String(valor), premio_id: '', premio_nome: '', custo_eur: '', trabalho_id: id, nota: '', criado_em: paraTexto(entregue) });
    }
    // Trocas e uma indicação.
    [['cli2', 'lavagem', -40], ['cli0', 'aromatizante', -25], ['cli4', 'desconto10', -18], ['cli2', 'aromatizante', -9], ['cli6', 'kit-limpeza', -60], ['cli1', 'lavagem-completa', -70], ['cli0', 'aspiracao', -3]].forEach(([cli, pid, dias]) => {
      const p = premios.find((x) => x.id === pid);
      const dd = new Date(agora); dd.setDate(dd.getDate() + dias); dd.setHours(16, 10, 0, 0);
      movs.push({ id: 'mv' + movs.length, data: paraTexto(dd), cliente_id: cli, tipo: 'resgate', valor_eur: '', pontos: String(-num(p.pontos)), premio_id: pid, premio_nome: p.nome, custo_eur: p.custo_eur, trabalho_id: '', nota: '', criado_em: paraTexto(dd) });
    });
    movs.push({ id: 'mv' + movs.length, data: em(-50, 11), cliente_id: 'cli0', tipo: 'indicacao', valor_eur: '', pontos: '300', premio_id: '', premio_nome: '', custo_eur: '', trabalho_id: '', nota: 'Trouxe o Bruno Martins', criado_em: em(-50, 11) });
    return { clientes, carros, trabalhos: t, movimentos: movs, premios, regras };
  }

  // ---------------------------------------------------------------- motion
  // Uma assinatura: entradas a desacelerar (emph), saídas a acelerar, pops só no que se ganha.
  const E = { std: 'cubic-bezier(.2,0,0,1)', emph: 'cubic-bezier(.05,.7,.1,1)', sai: 'cubic-bezier(.3,0,1,1)', pop: 'cubic-bezier(.175,.885,.32,1.275)' };
  const vistos = {};        // ids já mostrados por vista, para animar só o que é novo
  const valoresAntes = {};  // números que contam quando mudam
  let vistaAnterior = null;

  function animarEntradas(vista) {
    if (reduzir()) return;
    const novaVista = vistaAnterior !== vista;
    if (novaVista) {
      $$('[data-entra]', $('[data-conteudo]')).forEach((el, i) => {
        el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: Math.min(i, 6) * 45, easing: E.emph, fill: 'backwards' });
      });
    }
    const antes = vistos[vista] || new Set();
    const agora = new Set();
    let n = 0;
    $$('[data-anim-id]', $('[data-conteudo]')).forEach((el) => {
      const id = el.dataset.animId;
      agora.add(id);
      if (novaVista ? n < 12 : !antes.has(id)) {
        el.animate([{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }],
          { duration: 300, delay: (novaVista ? 120 : 0) + Math.min(n, 10) * 35, easing: E.emph, fill: 'backwards' });
        n++;
      }
    });
    vistos[vista] = agora;
    vistaAnterior = vista;
  }

  function contarNumeros(raiz = document) {
    $$('[data-contar-id]', raiz).forEach((el) => {
      const id = el.dataset.contarId, alvo = num(el.dataset.contar);
      const de = valoresAntes[id];
      valoresAntes[id] = alvo;
      if (de == null || de === alvo || reduzir()) return;
      const fmt = el.dataset.fmt === 'eur' ? (v) => eur(v, true) : (v) => pts(v);
      const t0 = performance.now(), dur = Math.min(900, 400 + Math.abs(alvo - de) * 2);
      const passo = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = fmt(de + (alvo - de) * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
      el.animate([{ transform: 'scale(1)' }, { transform: `scale(${alvo > de ? 1.12 : 0.92})` }, { transform: 'scale(1)' }], { duration: 420, easing: E.pop });
    });
  }

  // A meta da semana: o segmento novo acende; ao cumprir, uma onda por todos.
  let metaAntes = null;
  function animarMeta() {
    const lista = $('[data-metas]');
    if (!lista) return;
    const feitos = num(lista.dataset.feitos), meta = num(lista.dataset.meta);
    const antes = metaAntes;
    metaAntes = feitos;
    if (antes == null || feitos <= antes || reduzir()) return;
    const segs = $$('li', lista);
    segs.slice(antes, feitos).forEach((s, i) => s.animate([{ transform: 'scaleY(.4)', opacity: 0.4 }, { transform: 'scaleY(1.35)' }, { transform: 'none', opacity: 1 }], { duration: 480, delay: i * 60, easing: E.pop }));
    if (antes < meta && feitos >= meta) {
      segs.forEach((s, i) => s.animate([{ transform: 'none' }, { transform: 'translateY(-6px)' }, { transform: 'none' }], { duration: 420, delay: 300 + i * 30, easing: E.std }));
      setTimeout(() => toast(`Objetivo da semana cumprido: ${feitos} carros entregues.`, 'trophy'), 700);
    }
  }

  function abanar(el) {
    if (!el || reduzir()) return;
    el.animate([{ transform: 'none' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(2px)' }, { transform: 'none' }], { duration: 360, easing: 'ease-in-out' });
  }

  // O momento da entrega: o carro sai do cartão, deixa pó, e o cartão fecha.
  async function carroVaiEmbora(card) {
    if (!card || reduzir()) return;
    st.animando++;
    try {
      const li = card.closest('li') || card;
      const r = card.getBoundingClientRect();
      card.classList.add('a-entregar');
      const palco = document.createElement('div');
      palco.className = 'palco';
      palco.innerHTML = `<span class="palco-ok">${icone('check-circle')}Entregue</span><span class="carro-ani"><span class="rastos"><i></i><i></i><i></i></span><span class="carro-corpo">${icone('car-profile-fill')}</span></span><span class="po"></span><span class="po p2"></span>`;
      card.appendChild(palco);
      const carro = $('.carro-ani', palco), corpo = $('.carro-corpo', palco), rastos = $('.rastos', palco), ok = $('.palco-ok', palco);
      const dist = r.width + 60;
      // Entra o carro (encolhido), recua um pouco (antecipação) e arranca a acelerar.
      const viagem = carro.animate([
        { transform: 'translateX(-30px) scale(.8)', opacity: 0, offset: 0, easing: E.emph },
        { transform: 'translateX(0) scale(1)', opacity: 1, offset: 0.28, easing: 'ease-out' },
        { transform: 'translateX(-12px) scaleX(1.08) scaleY(.92)', offset: 0.44, easing: 'cubic-bezier(.55,0,.85,.2)' },
        { transform: `translateX(${dist}px) scaleX(1.12) scaleY(.94)`, opacity: 1, offset: 1 },
      ], { duration: 1150, fill: 'forwards' });
      corpo.animate([{ transform: 'none' }, { transform: 'translateY(-2px) rotate(-2deg)' }, { transform: 'none' }], { duration: 140, delay: 520, iterations: 4 });
      rastos.animate([{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1.6)' }], { duration: 640, delay: 510, easing: 'ease-in', fill: 'both' });
      $$('.po', palco).forEach((p, i) => p.animate([{ opacity: 0.55, transform: 'scale(.3)' }, { opacity: 0, transform: `scale(${1.6 + i * 0.5}) translate(${-10 - i * 8}px, -${4 + i * 3}px)` }], { duration: 560, delay: 500 + i * 70, easing: 'ease-out', fill: 'both' }));
      ok.animate([{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 1080, easing: E.pop, fill: 'both' });
      await viagem.finished;
      await new Promise((res) => setTimeout(res, 420));
      const h = li.getBoundingClientRect().height;
      await li.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0, marginBottom: '-10px' }], { duration: 280, easing: E.std, fill: 'forwards' }).finished;
    } finally {
      st.animando--;
    }
  }

  // ---------------------------------------------------------------- navegação
  const VISTAS = [
    { id: 'oficina', nome: 'Oficina', icone: 'wrench' },
    { id: 'clientes', nome: 'Clientes', icone: 'users-three' },
    { id: 'carros', nome: 'Carros', icone: 'car' },
    { id: 'premios', nome: 'Prémios', icone: 'gift' },
    { id: 'relatorios', nome: 'Relatórios', icone: 'chart-bar' },
  ];
  const vistaAtual = () => { const h = location.hash.slice(1); return VISTAS.some((v) => v.id === h) ? h : 'oficina'; };

  function desenharNav() {
    const v = vistaAtual();
    const naOficina = st.trabalhos.filter((t) => t.estado !== 'entregue').length;
    $('[data-nav]').innerHTML = VISTAS.map((x) => `<a href="#${x.id}"${x.id === v ? ' aria-current="page"' : ''}>${x.nome}${x.id === 'oficina' && st.carregado ? ` <span class="conta-aba" aria-label="${naOficina} carros na oficina">${naOficina}</span>` : ''}</a>`).join('');
    $('[data-nav-baixo]').innerHTML = VISTAS.map((x) => `<a href="#${x.id}"${x.id === v ? ' aria-current="page"' : ''}>${icone(x.icone)}<span>${x.nome}</span></a>`).join('');
  }

  function atualizarSync() {
    const el = $('[data-sync]');
    let estado = 'ok', txt = 'Sheet em dia';
    if (emDemo()) { estado = 'demo'; txt = 'Demonstração'; }
    else if (st.enviando || st.lendo) { estado = 'a-gravar'; txt = st.enviando ? 'A gravar...' : 'A ler a sheet...'; }
    else if (st.pendentes.length) { estado = 'offline'; txt = `${st.pendentes.length} por gravar`; }
    else if (st.erro) { estado = 'offline'; txt = 'Sem ligação'; }
    el.dataset.estado = estado;
    el.textContent = txt;
    el.title = txt;
  }

  function desenharAviso() {
    const el = $('[data-aviso]');
    let html = '';
    if (emDemo()) {
      html = `<div class="aviso-dentro">${icone('cloud-slash')}<p><strong>Modo de demonstração.</strong> Estes dados de exemplo ficam só neste navegador.</p><button class="btn pequeno escuro" type="button" data-abrir="ligacao">Ligar à sheet</button></div>`;
    } else if (st.erro) {
      const n = st.pendentes.length;
      const pend = n ? ` ${n === 1 ? 'Uma alteração fica guardada' : n + ' alterações ficam guardadas'} aqui e ${n === 1 ? 'segue' : 'seguem'} quando a ligação voltar.` : '';
      html = `<div class="aviso-dentro erro">${icone('warning')}<p><strong>Não foi possível falar com a sheet.</strong> ${esc(st.erro)}${pend}</p><button class="btn pequeno" type="button" data-acao="recarregar">${icone('arrows-clockwise')}Tentar de novo</button></div>`;
    }
    el.innerHTML = html;
    el.hidden = !html;
  }

  function desenhar() {
    if (st.animando) { desenharPedido = true; return; }
    desenharNav();
    atualizarSync();
    desenharAviso();
    const main = $('[data-conteudo]');
    const ativo = document.activeElement;
    const focoBusca = ativo && ativo.matches && ativo.matches('[data-busca]') ? { v: ativo.dataset.busca, s: ativo.selectionStart } : null;
    const v = vistaAtual();
    main.innerHTML = ({ oficina: vistaOficina, clientes: vistaClientes, carros: vistaCarros, premios: vistaPremios, relatorios: vistaRelatorios }[v])();
    document.title = `${VISTAS.find((x) => x.id === v).nome}: INOVACAR Gestão`;
    if (focoBusca) {
      const i = $(`[data-busca="${focoBusca.v}"]`);
      if (i) { i.focus(); try { i.setSelectionRange(focoBusca.s, focoBusca.s); } catch { /* */ } }
    }
    if (st.carregado) { animarEntradas(v); contarNumeros(main); animarMeta(); }
  }
  let desenharPedido = false;
  setInterval(() => { if (desenharPedido && !st.animando) { desenharPedido = false; desenhar(); } }, 120);

  const esqueletos = (n) => Array.from({ length: n }, () => '<div class="esqueleto" aria-hidden="true"><i></i><i></i><i></i></div>').join('');
  const caixaPesquisa = (vista, ph) => `<label class="pesquisa">${icone('magnifying-glass')}<span class="so-leitor">${ph}</span><input type="search" data-busca="${vista}" placeholder="${ph}" value="${esc(st.busca[vista])}" autocomplete="off"></label>`;

  // ---------------------------------------------------------------- vista: oficina
  function bateBusca(t, q) {
    if (!q) return true;
    const c = carroDe(t), cl = clienteDe(c);
    const alvo = sem([c && c.matricula, c && matChave(c.matricula), nomeCarro(c), cl && cl.nome, cl && cl.telemovel, t.servico, t.descricao].join(' '));
    return sem(q).split(/\s+/).every((p) => alvo.includes(p.replace(/-/g, '')) || alvo.includes(p));
  }

  function entreguesNaSemana() {
    const ini = inicioSemana(new Date());
    return st.trabalhos.filter((t) => t.entregue && data(t.entregue) >= ini).length;
  }

  function faixaSemana() {
    const meta = Math.max(1, Math.round(regra('objetivo_semana')));
    const feitos = entreguesNaSemana();
    const segs = Math.max(meta, feitos);
    const falta = meta - feitos;
    const ativos = st.trabalhos.filter((t) => t.estado !== 'entregue');
    const atrasados = ativos.filter((t) => prazo(t)?.tipo === 'atraso').length;
    const hoje = ativos.filter((t) => prazo(t)?.tipo === 'hoje').length;
    const pausa = ativos.filter(emPausa).length;
    const agora = new Date(), hojeI = (agora.getDay() + 6) % 7;
    const aberto = agora.getHours() * 60 + agora.getMinutes() < FECHA;
    const restam = HOR.dias.filter((d) => { const i = (d + 6) % 7; return i > hojeI || (i === hojeI && aberto); }).length;
    return `<section class="semana" data-entra aria-label="Objetivo da semana">
      <div class="semana-topo">
        <div>
          <p class="rotulo">Esta semana ${icone('flag-checkered')}</p>
          <p class="semana-num"><strong data-contar-id="semana" data-contar="${feitos}">${feitos}</strong><span> de ${meta} carros entregues</span></p>
        </div>
        <p class="semana-falta">${feitos >= meta ? `${icone('trophy')}Objetivo cumprido${feitos > meta ? `, mais ${feitos - meta}` : ''}` : `Faltam <strong>${falta}</strong>${restam ? ` em ${plural(restam, 'dia', 'dias')}` : ''}`}</p>
      </div>
      <ol class="metas${feitos >= meta ? ' cumprida' : ''}" data-metas data-feitos="${feitos}" data-meta="${meta}" aria-hidden="true">
        ${Array.from({ length: segs }, (_, i) => `<li class="${i < feitos ? (i >= meta ? 'cheio extra' : 'cheio') : ''}"></li>`).join('')}
      </ol>
      ${atrasados || hoje || pausa ? `<div class="semana-chips">
        ${atrasados ? `<span class="chip-estado atraso">${icone('warning')}${plural(atrasados, 'atrasado', 'atrasados')}</span>` : ''}
        ${hoje ? `<span class="chip-estado hoje">${icone('clock-countdown')}${plural(hoje, 'prometido', 'prometidos')} para hoje</span>` : ''}
        ${pausa ? `<span class="chip-estado pausa">${icone('pause')}${plural(pausa, 'em pausa', 'em pausa')}</span>` : ''}
      </div>` : ''}
    </section>`;
  }

  function vistaOficina() {
    const q = st.busca.oficina.trim();
    const ativos = st.trabalhos.filter((t) => t.estado !== 'entregue');
    const por = { espera: [], curso: [], pronto: [] };
    ativos.filter((t) => bateBusca(t, q)).forEach((t) => (por[t.estado] || por.espera).push(t));
    const urg = (t) => (prazo(t)?.tipo === 'atraso' ? 0 : prazo(t)?.tipo === 'hoje' ? 1 : 2);
    por.espera.sort((a, b) => urg(a) - urg(b) || (data(a.entrada) || 0) - (data(b.entrada) || 0));
    por.curso.sort((a, b) => emPausa(a) - emPausa(b) || urg(a) - urg(b) || (data(a.inicio) || 0) - (data(b.inicio) || 0));
    por.pronto.sort((a, b) => (data(a.pronto) || 0) - (data(b.pronto) || 0));
    const VAZIO = {
      espera: ['Ninguém à espera.', 'Quando chegar um carro, carregue em Dar entrada.'],
      curso: ['Nada em trabalho.', 'Pegue num carro À espera e carregue em Começar: o relógio começa a contar.'],
      pronto: ['Nada por levantar.', 'Os carros prontos ficam aqui até serem entregues.'],
    };
    const faixa = (e) => `
      <section class="faixa${st.faixa === e ? ' ativa' : ''}" data-estado="${e}" id="faixa-${e}" role="tabpanel" aria-labelledby="seg-${e}">
        <header class="faixa-cabeca"><span class="ponto${e === 'curso' && por.curso.some((t) => !emPausa(t)) ? ' vivo' : ''}" aria-hidden="true"></span><h2>${ESTADOS[e].nome}</h2><span class="conta">${st.carregado ? por[e].length : ''}</span></header>
        ${!st.carregado ? `<div class="cartoes">${esqueletos(e === 'curso' ? 2 : 1)}</div>`
          : por[e].length ? `<ol class="cartoes">${por[e].map(cartao).join('')}</ol>`
          : `<div class="faixa-vazia">${q ? '<strong>Nada encontrado.</strong>Experimente outra matrícula ou nome.' : `<strong>${VAZIO[e][0]}</strong>${VAZIO[e][1]}`}</div>`}
      </section>`;
    return `
      ${st.carregado ? faixaSemana() : ''}
      <div class="vista-cabeca" data-entra>
        <div><h1>Na oficina</h1><p class="resumo">${!st.carregado ? 'A ler a sheet...' : ativos.length ? `${plural(ativos.length, 'carro', 'carros')} lá dentro agora.` : 'A oficina está vazia.'}</p></div>
        <div class="acoes">${caixaPesquisa('oficina', 'Matrícula, cliente ou serviço')}</div>
      </div>
      <div class="segmentos" role="tablist" aria-label="Estado">
        ${['espera', 'curso', 'pronto'].map((e) => `<button type="button" role="tab" id="seg-${e}" aria-controls="faixa-${e}" aria-selected="${st.faixa === e}" data-faixa="${e}"><span class="ponto" data-estado="${e}" aria-hidden="true"></span>${ESTADOS[e].curto}${st.carregado ? ` <span class="fraco">${por[e].length}</span>` : ''}</button>`).join('')}
      </div>
      <div class="faixas">${faixa('espera')}${faixa('curso')}${faixa('pronto')}</div>`;
  }

  function cartao(t) {
    const c = carroDe(t), cl = clienteDe(c);
    const tp = tempos(t);
    const pz = prazo(t);
    const pausa = emPausa(t);
    let corpo;
    if (t.estado === 'curso') {
      const media = mediaDe(t.servico);
      const fr = media ? tp.trabalho / media : 0;
      const acima = media && tp.trabalho > media;
      corpo = `<div class="relogio${pausa ? ' em-pausa' : ''}">
          <span class="relogio-num">${relogio(tp.trabalho)}</span>
          <span class="relogio-rot">${pausa ? `${icone('pause')}${esc(t.pausa_motivo || 'Em pausa')}` : '<span class="ponto vivo" aria-hidden="true"></span>em trabalho'}</span>
        </div>
        ${media ? `<div class="medidor${acima ? ' acima' : ''}" aria-label="Média deste serviço: ${esc(duracaoUtil(media))}"><span class="medidor-barra"><i style="width:${Math.min(100, Math.max(3, fr * 100))}%"></i></span><span class="medidor-txt">${acima ? `${esc(duracao(tp.trabalho - media))} acima da média` : `média ${esc(duracaoUtil(media))}`}</span></div>` : ''}`;
    } else if (t.estado === 'espera') {
      corpo = `<div class="relogio espera"><span class="relogio-num">${relogio(tp.espera)}</span><span class="relogio-rot">à espera, chegou ${esc(quando(t.entrada).replace(/^hoje, /, 'às '))}</span></div>`;
    } else {
      corpo = `<div class="relogio pronto"><span class="relogio-num">${icone('check-circle')}</span><span class="relogio-rot">pronto ${esc(quando(t.pronto).replace(/^hoje, /, 'às '))}, feito em ${esc(duracaoUtil(tp.trabalho ?? tp.oficina))}</span></div>`;
    }
    const prazoHtml = pz ? `<span class="prazo ${pz.tipo}">${icone(pz.tipo === 'ok' ? 'calendar-blank' : pz.tipo === 'hoje' ? 'clock-countdown' : 'warning')}${esc(pz.txt)}</span>` : '<span></span>';
    let botoes = '';
    if (t.estado === 'espera') botoes = `<button class="btn pequeno primario" type="button" data-avancar="${t.id}">${icone('play')}Começar</button>`;
    if (t.estado === 'curso') botoes = pausa
      ? `<button class="btn pequeno" type="button" data-retomar="${t.id}">${icone('play')}Retomar</button>`
      : `<button class="btn-icone contorno" type="button" data-pausar="${t.id}" aria-label="Pausar" title="Pausar">${icone('pause')}</button><button class="btn pequeno pronto" type="button" data-avancar="${t.id}">${icone('check')}Pronto</button>`;
    if (t.estado === 'pronto') botoes = `${cl && cl.telemovel ? `<a class="btn-icone contorno" href="tel:${esc(soDigitos(cl.telemovel))}" aria-label="Ligar a ${esc(cl.nome)}" title="Ligar a ${esc(cl.nome)}">${icone('phone')}</a>` : ''}<button class="btn pequeno escuro" type="button" data-abrir="entregar" data-id="${t.id}">${icone('flag-checkered')}Entregar</button>`;
    return `<li data-anim-id="${t.id}-${t.estado}"><article class="cartao${pz?.tipo === 'atraso' ? ' atrasado' : ''}${pausa ? ' pausado' : ''}" data-card="${t.id}" data-estado="${t.estado}">
      <button class="cartao-abrir" type="button" data-abrir="trabalho" data-id="${t.id}" aria-label="Abrir ${esc(c ? c.matricula : '')} ${esc(nomeCarro(c))}">
        <span class="cartao-linha">${placa(c && c.matricula)}<span class="cartao-carro">${esc(nomeCarro(c))}</span></span>
        ${corpo}
        <p class="cartao-servico"><strong>${esc(t.servico || 'Serviço por definir')}</strong>${t.descricao ? ` ${esc(t.descricao)}` : ''}</p>
        <p class="cartao-cliente">${icone('user')}${esc(cl ? cl.nome : 'Sem cliente')}</p>
      </button>
      <div class="cartao-rodape">${prazoHtml}<span class="botoes">${botoes}</span></div>
    </article></li>`;
  }

  // ---------------------------------------------------------------- vista: clientes
  function vistaClientes() {
    const q = sem(st.busca.clientes.trim());
    const linhas = st.clientes
      .map((c) => {
        const carros = idx.carrosDoCliente.get(c.id) || [];
        const tr = trabalhosDoCliente(c.id);
        return { c, carros, visitas: tr.length, ultima: tr[0] ? tr[0].entrada : '', saldo: saldoDe(c.id) };
      })
      .filter(({ c, carros }) => !q || sem([c.nome, c.telemovel, soDigitos(c.telemovel), c.email, c.nif, ...carros.map((k) => k.matricula + ' ' + matChave(k.matricula))].join(' ')).includes(q.replace(/\s+/g, ' ')))
      .sort((a, b) => (data(b.ultima) || 0) - (data(a.ultima) || 0) || a.c.nome.localeCompare(b.c.nome, 'pt'));

    const corpo = !st.carregado ? `<div class="carregar">${esqueletos(4)}</div>`
      : !st.clientes.length ? `<div class="lista-vazia"><strong>Ainda não há clientes.</strong>Os clientes entram quando dá entrada a um carro, ou aqui.<br><button class="btn primario" type="button" data-abrir="cliente">${icone('plus')}Novo cliente</button></div>`
      : !linhas.length ? '<div class="lista-vazia"><strong>Nenhum cliente encontrado.</strong>Procure pelo nome, telemóvel ou matrícula.</div>'
      : `<table><thead><tr><th>Nome</th><th>Telemóvel</th><th>Carros</th><th class="num">Pontos</th><th class="num">Visitas</th><th class="num">Última visita</th></tr></thead><tbody>
        ${linhas.map(({ c, carros, visitas, ultima, saldo }) => `<tr data-abrir-linha="cliente" data-id="${c.id}" tabindex="0" data-anim-id="${c.id}">
          <td class="nome-linha">${esc(c.nome)}</td>
          <td data-rotulo="Telemóvel">${esc(telFormatar(c.telemovel)) || '<span class="fraco">sem número</span>'}</td>
          <td><div class="placas">${carros.map((k) => placa(k.matricula)).join('') || '<span class="fraco">sem carros</span>'}</div></td>
          <td class="num" data-rotulo="Pontos"><span class="pontos-pill">${icone('coins')}${pts(saldo)}</span></td>
          <td class="num esconder-telemovel">${visitas}</td>
          <td class="num" data-rotulo="Última visita">${ultima ? esc(quando(ultima, false)) : '<span class="fraco">nunca</span>'}</td>
        </tr>`).join('')}</tbody></table>`;

    return `
      <div class="vista-cabeca" data-entra>
        <div><h1>Clientes</h1><p class="resumo">${st.carregado ? plural(st.clientes.length, 'cliente', 'clientes') : 'A ler a sheet...'}</p></div>
        <div class="acoes">${caixaPesquisa('clientes', 'Nome, telemóvel ou matrícula')}<button class="btn" type="button" data-abrir="cliente">${icone('plus')}Novo cliente</button></div>
      </div>
      <div class="tabela-caixa responsiva" data-entra>${corpo}</div>`;
  }

  // ---------------------------------------------------------------- vista: carros
  function vistaCarros() {
    const q = sem(st.busca.carros.trim());
    const linhas = st.carros
      .map((k) => {
        const tr = idx.trabalhosDoCarro.get(k.id) || [];
        const feitos = tr.filter((t) => t.pronto);
        const media = feitos.length ? feitos.reduce((s, t) => s + tempos(t).oficina, 0) / feitos.length : null;
        return { k, cl: clienteDe(k), visitas: tr.length, ultima: tr[0] ? tr[0].entrada : '', media, naOficina: tr.some((t) => t.estado !== 'entregue'), gasto: tr.reduce((s, t) => s + num(t.valor), 0) };
      })
      .filter(({ k, cl }) => !q || sem([k.matricula, matChave(k.matricula), k.marca, k.modelo, k.ano, cl && cl.nome].join(' ')).includes(q))
      .sort((a, b) => (b.naOficina - a.naOficina) || (data(b.ultima) || 0) - (data(a.ultima) || 0));

    const corpo = !st.carregado ? `<div class="carregar">${esqueletos(4)}</div>`
      : !st.carros.length ? `<div class="lista-vazia"><strong>Ainda não há carros.</strong>Cada carro entra com a primeira entrada na oficina.<br><button class="btn primario" type="button" data-abrir="entrada">${icone('plus')}Dar entrada</button></div>`
      : !linhas.length ? '<div class="lista-vazia"><strong>Nenhum carro encontrado.</strong>Procure pela matrícula, marca, modelo ou cliente.</div>'
      : `<table><thead><tr><th>Matrícula</th><th>Carro</th><th>Cliente</th><th class="num">Visitas</th><th class="num">Gasto</th><th class="num">Última visita</th><th class="num">Tempo médio</th></tr></thead><tbody>
        ${linhas.map(({ k, cl, visitas, ultima, media, naOficina, gasto }) => `<tr data-abrir-linha="carro" data-id="${k.id}" tabindex="0" data-anim-id="${k.id}">
          <td>${placa(k.matricula)}</td>
          <td class="nome-linha">${esc(nomeCarro(k))}${k.ano ? ` <span class="fraco">${esc(k.ano)}</span>` : ''}${naOficina ? ' <span class="selo ok">Na oficina</span>' : ''}</td>
          <td data-rotulo="Cliente">${cl ? esc(cl.nome) : '<span class="fraco">sem cliente</span>'}</td>
          <td class="num esconder-telemovel">${visitas}</td>
          <td class="num esconder-telemovel">${gasto ? esc(eur(gasto, true)) : '<span class="fraco">-</span>'}</td>
          <td class="num" data-rotulo="Última visita">${ultima ? esc(quando(ultima, false)) : '<span class="fraco">nunca</span>'}</td>
          <td class="num esconder-telemovel">${media != null ? esc(duracaoUtil(media)) : '<span class="fraco">sem dados</span>'}</td>
        </tr>`).join('')}</tbody></table>`;

    return `
      <div class="vista-cabeca" data-entra>
        <div><h1>Carros</h1><p class="resumo">${st.carregado ? plural(st.carros.length, 'carro', 'carros') : 'A ler a sheet...'}</p></div>
        <div class="acoes">${caixaPesquisa('carros', 'Matrícula, marca ou cliente')}<button class="btn" type="button" data-abrir="carro">${icone('plus')}Novo carro</button></div>
      </div>
      <div class="tabela-caixa responsiva" data-entra>${corpo}</div>`;
  }

  // ---------------------------------------------------------------- vista: prémios
  const trocasDe = (pid) => st.movimentos.filter((m) => m.tipo === 'resgate' && m.premio_id === pid).length;
  function estadoStock(p) {
    if (!temNum(p.stock)) return { cls: 'servico', txt: 'Sem stock a contar', ic: 'storefront' };
    const s = num(p.stock);
    if (s <= 0) return { cls: 'esgotado', txt: 'Esgotado', ic: 'warning-circle' };
    if (s <= 3) return { cls: 'baixo', txt: `Só ${s} em stock`, ic: 'package' };
    return { cls: 'ok', txt: `${s} em stock`, ic: 'package' };
  }
  const retornoDe = (p) => (num(p.pontos) > 0 ? (num(p.custo_eur) / (num(p.pontos) / Math.max(0.0001, regra('pontos_por_euro')))) * 100 : 0);

  function vistaPremios() {
    const alvo = regra('retorno_percent');
    const lista = [...st.premios].sort((a, b) => ativoP(b) - ativoP(a) || num(a.pontos) - num(b.pontos));
    const fora = lista.filter((p) => ativoP(p) && num(p.custo_eur) > 0 && Math.abs(num(p.pontos) - pontosSugeridos(p.custo_eur)) / Math.max(1, pontosSugeridos(p.custo_eur)) > 0.06);
    const regrasHtml = `<section class="regras" data-entra aria-label="Regras do programa">
      <div class="regra-bloco"><span class="rotulo">Ganha</span><strong>${pts(regra('pontos_por_euro'))} ${regra('pontos_por_euro') === 1 ? 'ponto' : 'pontos'}</strong><span>por cada euro gasto</span></div>
      <div class="regra-bloco"><span class="rotulo">Devolve</span><strong>${pct(alvo, alvo % 1 ? 1 : 0)}</strong><span>do que o cliente gasta</span></div>
      <div class="regra-bloco"><span class="rotulo">Cada ponto custa</span><strong>${esc(eur(valorPonto()).replace(/\s/g, ' '))}</strong><span>à oficina</span></div>
      <div class="regra-bloco"><span class="rotulo">Indicação</span><strong>${pts(regra('pontos_por_indicacao'))} pts</strong><span>custa ${esc(eur(regra('pontos_por_indicacao') * valorPonto()))}</span></div>
      <button class="btn" type="button" data-abrir="regras">${icone('sliders-horizontal')}Mudar regras</button>
    </section>`;
    const aviso = fora.length ? `<div class="aviso-dentro ambar" data-entra>${icone('coins')}<p><strong>${plural(fora.length, 'prémio não está', 'prémios não estão')} nos ${pct(alvo, alvo % 1 ? 1 : 0)}.</strong> ${esc(fora.slice(0, 3).map((p) => `${p.nome}: ${pts(p.pontos)} em vez de ${pts(pontosSugeridos(p.custo_eur))}`).join('; '))}${fora.length > 3 ? '...' : ''}</p><button class="btn pequeno escuro" type="button" data-acao="ajustar-premios">Ajustar aos ${pct(alvo, alvo % 1 ? 1 : 0)}</button></div>` : '';
    const cartoes = !st.carregado ? `<div class="grelha-premios">${esqueletos(4)}</div>`
      : !lista.length ? `<div class="tabela-caixa"><div class="lista-vazia"><strong>Ainda não há prémios.</strong>Crie o primeiro: o que custa à oficina e quantos pontos pede.<br><button class="btn primario" type="button" data-abrir="premio">${icone('plus')}Novo prémio</button></div></div>`
      : `<ul class="grelha-premios">${lista.map((p) => {
          const sk = estadoStock(p), ret = retornoDe(p), n = trocasDe(p.id);
          return `<li data-anim-id="${p.id}"><button class="premio${ativoP(p) ? '' : ' inativo'}" type="button" data-abrir="premio" data-id="${p.id}">
            <span class="premio-topo"><span class="premio-ic">${icone('gift')}</span><span class="stock ${sk.cls}">${icone(sk.ic)}${esc(sk.txt)}</span></span>
            <strong class="premio-nome">${esc(p.nome)}</strong>
            <span class="premio-pts"><b>${pts(p.pontos)}</b> pontos</span>
            <span class="premio-linha"><span>Custa ${esc(eur(num(p.custo_eur)))}</span><span class="ret${num(p.custo_eur) && Math.abs(ret - alvo) > alvo * 0.06 ? ' fora' : ''}">devolve ${pct(ret)}</span></span>
            <span class="premio-rodape"><span>${n ? `Trocado ${plural(n, 'vez', 'vezes')}` : 'Ainda não trocado'}</span>${p.comprar ? `<span class="comprar">${icone('link')}Onde comprar</span>` : ''}${ativoP(p) ? '' : '<span class="selo">Escondido</span>'}</span>
          </button></li>`;
        }).join('')}</ul>`;
    return `
      <div class="vista-cabeca" data-entra>
        <div><h1>Pontos e prémios</h1><p class="resumo">O que cada prémio custa à oficina e em pontos. O site mostra os prémios ativos.</p></div>
        <div class="acoes"><button class="btn primario" type="button" data-abrir="premio">${icone('plus')}Novo prémio</button></div>
      </div>
      ${st.carregado ? regrasHtml : ''}
      ${aviso}
      ${cartoes}`;
  }
  const ativoP = (p) => !['nao', 'não', 'false', '0', 'n'].includes(String(p.ativo ?? '').trim().toLowerCase());

  // ---------------------------------------------------------------- vista: relatórios
  const PERIODOS = [['semana', 'Semana'], ['mes', 'Mês'], ['tri', '3 meses'], ['ano', 'Ano']];
  function intervalo(per) {
    const agora = new Date();
    let ini;
    if (per === 'semana') ini = inicioSemana(agora);
    else if (per === 'mes') { ini = inicioDia(agora); ini.setDate(ini.getDate() - 29); }
    else if (per === 'tri') { ini = inicioDia(agora); ini.setDate(ini.getDate() - 89); }
    else { ini = inicioDia(agora); ini.setDate(ini.getDate() - 364); }
    const dur = agora - ini;
    return { ini, fim: agora, antIni: new Date(ini - dur), antFim: ini };
  }
  const dentro = (s, a, b) => { const d = data(s); return d && d >= a && d < b; };

  function resumoPeriodo(a, b) {
    const ent = st.trabalhos.filter((t) => t.entregue && dentro(t.entregue, a, b));
    const prontos = st.trabalhos.filter((t) => t.pronto && dentro(t.pronto, a, b));
    const movs = st.movimentos.filter((m) => dentro(m.data, a, b));
    const media = (l, k) => { const v = l.map((t) => tempos(t)[k]).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
    const comPrazo = prontos.filter((t) => cumpriuPrazo(t) !== null);
    return {
      entregues: ent.length,
      faturado: ent.reduce((s, t) => s + num(t.valor), 0),
      oficina: media(prontos, 'oficina'),
      trabalho: media(prontos, 'trabalho'),
      noPrazo: comPrazo.length ? comPrazo.filter(cumpriuPrazo).length / comPrazo.length : null,
      dados: movs.filter((m) => num(m.pontos) > 0).reduce((s, m) => s + num(m.pontos), 0),
      trocados: -movs.filter((m) => num(m.pontos) < 0).reduce((s, m) => s + num(m.pontos), 0),
      custo: movs.filter((m) => m.tipo === 'resgate').reduce((s, m) => s + num(m.custo_eur), 0),
      prontos,
    };
  }

  function delta(agora, antes, inverso = false) {
    if (agora == null || antes == null || !antes) return '';
    const d = (agora - antes) / antes;
    if (Math.abs(d) < 0.005) return '<span class="delta igual">igual</span>';
    const bom = inverso ? d < 0 : d > 0;
    return `<span class="delta ${bom ? 'bom' : 'mau'}">${icone(d > 0 ? 'arrow-up' : 'arrow-down')}${pct(Math.abs(d) * 100, 0)}</span>`;
  }

  function vistaRelatorios() {
    const per = intervalo(st.periodo);
    const nomePer = { semana: 'esta semana', mes: 'nos últimos 30 dias', tri: 'nos últimos 3 meses', ano: 'no último ano' }[st.periodo];
    const vsPer = { semana: 'semana passada', mes: '30 dias antes', tri: '3 meses antes', ano: 'ano anterior' }[st.periodo];
    const periodo = `<div class="periodo" role="group" aria-label="Período">${PERIODOS.map(([v, n]) => `<button type="button" data-periodo="${v}" aria-pressed="${st.periodo === v}">${n}</button>`).join('')}</div>`;
    const cabeca = `<div class="vista-cabeca" data-entra><div><h1>Relatórios</h1><p class="resumo">Como correu ${nomePer}, comparado com ${vsPer}.</p></div><div class="acoes">${periodo}</div></div>`;
    if (!st.carregado) return cabeca + `<div class="carregar">${esqueletos(3)}</div>`;
    const r = resumoPeriodo(per.ini, per.fim), ant = resumoPeriodo(per.antIni, per.antFim);
    const custoPct = r.faturado ? (r.custo / r.faturado) * 100 : null;

    const kpi = (rot, valor, extra = '', id = '', fmt = '') => `<div class="kpi"><dt>${rot}</dt><dd><span class="kpi-num"${id ? ` data-contar-id="${id}" data-contar="${valor.n}"${fmt ? ` data-fmt="${fmt}"` : ''}` : ''}>${valor.txt}</span>${extra}</dd></div>`;
    const kpis = `<section class="painel-kpi" data-entra aria-label="Resumo">
      <dl class="kpis">
        ${kpi('Carros entregues', { n: r.entregues, txt: pts(r.entregues) }, delta(r.entregues, ant.entregues), 'r-ent')}
        ${kpi('Faturado', { n: r.faturado, txt: eur(r.faturado, true) }, delta(r.faturado, ant.faturado), 'r-fat', 'eur')}
        ${kpi('Tempo médio de trabalho', { txt: r.trabalho != null ? duracaoUtil(r.trabalho) : '-' }, delta(r.trabalho, ant.trabalho, true))}
        ${kpi('Tempo médio na oficina', { txt: r.oficina != null ? duracaoUtil(r.oficina) : '-' }, delta(r.oficina, ant.oficina, true))}
        ${kpi('Prontos no dia prometido', { txt: r.noPrazo != null ? pct(r.noPrazo * 100, 0) : '-' }, '')}
        ${kpi('Pontos dados', { n: r.dados, txt: pts(r.dados) }, delta(r.dados, ant.dados), 'r-dados')}
        ${kpi('Pontos trocados', { n: r.trocados, txt: pts(r.trocados) }, '', 'r-troc')}
        ${kpi('Custo dos prémios', { txt: eur(r.custo) }, custoPct != null ? `<small>${pct(custoPct)} do faturado</small>` : '')}
      </dl>
    </section>`;

    return cabeca + kpis + `
      <div class="grelha-rel">
        <section class="cartao-rel largo" data-entra>${graficoSemanas()}</section>
        <section class="cartao-rel" data-entra>${mapaAtividade()}</section>
        <section class="cartao-rel" data-entra>${graficoPontos()}</section>
        <section class="cartao-rel largo" data-entra>${tabelaServicos(r.prontos)}</section>
        <section class="cartao-rel" data-entra>${listaPremiosTop(per)}</section>
        <section class="cartao-rel" data-entra>${listaClientesTop(per)}</section>
        <section class="cartao-rel largo" data-entra>${tabelaProntos(r.prontos)}</section>
      </div>`;
  }

  // Colunas: carros entregues por semana nas últimas 12, com a linha do objetivo.
  // Os gráficos desenham-se à largura real do cartão, para o texto ficar sempre do mesmo tamanho.
  const larguraCartao = (largo) => {
    const m = $('[data-conteudo]').clientWidth - 40;
    const duas = window.matchMedia('(min-width: 1101px)').matches;
    return Math.max(280, Math.round(largo || !duas ? m - 38 : (m - 18) / 2 - 38));
  };
  function graficoSemanas() {
    const meta = regra('objetivo_semana');
    const ini0 = inicioSemana(new Date());
    const semanas = Array.from({ length: 12 }, (_, i) => { const a = new Date(ini0); a.setDate(a.getDate() - (11 - i) * 7); const b = new Date(a); b.setDate(b.getDate() + 7); return { a, b, n: 0 }; });
    st.trabalhos.forEach((t) => { const d = data(t.entregue); if (!d) return; const s = semanas.find((x) => d >= x.a && d < x.b); if (s) s.n++; });
    const max = Math.max(meta, ...semanas.map((s) => s.n), 1);
    const topo = Math.ceil(max / 5) * 5;
    const W = larguraCartao(true), H = 220, pl = 28, pb = 26, pt0 = 12, larg = (W - pl) / semanas.length;
    const y = (v) => pt0 + (H - pt0 - pb) * (1 - v / topo);
    const bw = Math.min(24, larg * 0.55);
    const ticks = [0, topo / 2, topo];
    const cumpridas = semanas.filter((s) => s.n >= meta).length;
    const svg = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carros entregues por semana, últimas 12 semanas">
      ${ticks.map((v) => `<line class="grelha" x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${semanas.map((s, i) => {
        const x = pl + i * larg + (larg - bw) / 2, h = y(0) - y(s.n), atual = i === semanas.length - 1;
        const dica = `Semana de ${s.a.getDate()} ${MESES[s.a.getMonth()]}: ${plural(s.n, 'carro', 'carros')}`;
        return `<g class="barra-g" data-dica="${esc(dica)}" tabindex="0" aria-label="${esc(dica)}">
          <rect class="alvo-hover" x="${pl + i * larg}" y="${pt0}" width="${larg}" height="${H - pt0 - pb}"/>
          ${s.n ? `<path class="barra${atual ? ' atual' : ''}" style="--i:${i}" d="M${x},${y(0)} V${y(0) - h + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y(0)} Z"/>` : ''}
          ${atual ? `<text class="valor" x="${x + bw / 2}" y="${y(s.n) - 6}" text-anchor="middle">${s.n}</text>` : ''}
          ${W > 560 || i % 2 === 1 || atual ? `<text class="eixo" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${s.a.getDate()} ${MESES[s.a.getMonth()]}</text>` : ''}
        </g>`;
      }).join('')}
      <line class="linha-meta" x1="${pl}" x2="${W}" y1="${y(meta)}" y2="${y(meta)}"/>
      <text class="rotulo-meta" x="${W - 2}" y="${y(meta) - 6}" text-anchor="end">Objetivo ${meta}</text>
    </svg>`;
    return `<header class="rel-cabeca"><h2>Carros entregues por semana</h2><p>${plural(cumpridas, 'semana', 'semanas')} com o objetivo cumprido nas últimas 12.</p></header>${svg}
      <details class="ver-tabela"><summary>Ver em tabela</summary><table><thead><tr><th>Semana</th><th class="num">Carros</th></tr></thead><tbody>${semanas.map((s) => `<tr><td>${s.a.getDate()} ${MESES[s.a.getMonth()]}</td><td class="num">${s.n}</td></tr>`).join('')}</tbody></table></details>`;
  }

  // Mapa de atividade: entregas por dia, 18 semanas.
  function mapaAtividade() {
    const semanas = 18;
    const ini = inicioSemana(new Date()); ini.setDate(ini.getDate() - (semanas - 1) * 7);
    const conta = new Map();
    st.trabalhos.forEach((t) => { const d = data(t.entregue); if (!d || d < ini) return; const k = inicioDia(d).getTime(); conta.set(k, (conta.get(k) || 0) + 1); });
    const max = Math.max(1, ...conta.values());
    const nivel = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
    const hoje = inicioDia(new Date());
    let total = 0, melhor = { n: 0, d: null };
    const cols = [];
    for (let s = 0; s < semanas; s++) {
      const dias = [];
      for (let d = 0; d < 7; d++) {
        const dia = new Date(ini); dia.setDate(dia.getDate() + s * 7 + d);
        const n = conta.get(dia.getTime()) || 0;
        total += n; if (n > melhor.n) melhor = { n, d: dia };
        const futuro = dia > hoje;
        dias.push(`<i class="n${futuro ? 'f' : nivel(n)}" style="--i:${s}" data-dica="${futuro ? '' : esc(`${DIAS[dia.getDay()]} ${dia.getDate()} ${MESES[dia.getMonth()]}: ${plural(n, 'entrega', 'entregas')}`)}"></i>`);
      }
      cols.push(`<span class="mapa-col">${dias.join('')}</span>`);
    }
    return `<header class="rel-cabeca"><h2>Atividade</h2><p>${plural(total, 'carro entregue', 'carros entregues')} em ${semanas} semanas${melhor.d ? `. Melhor dia: ${melhor.d.getDate()} ${MESES[melhor.d.getMonth()]}, com ${melhor.n}` : ''}.</p></header>
      <div class="mapa" role="img" aria-label="Entregas por dia nas últimas ${semanas} semanas"><span class="mapa-dias"><i>seg</i><i></i><i>qua</i><i></i><i>sex</i><i></i><i></i></span>${cols.join('')}</div>
      <p class="legenda-mapa"><span>Menos</span><i class="n0"></i><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i><span>Mais</span></p>`;
  }

  // Pontos dados e trocados por mês, últimos 6 meses (mesma unidade: um só eixo).
  function graficoPontos() {
    const agora = new Date();
    const meses = Array.from({ length: 6 }, (_, i) => { const a = new Date(agora.getFullYear(), agora.getMonth() - 5 + i, 1); const b = new Date(a.getFullYear(), a.getMonth() + 1, 1); return { a, b, dados: 0, troc: 0 }; });
    st.movimentos.forEach((m) => { const d = data(m.data); if (!d) return; const s = meses.find((x) => d >= x.a && d < x.b); if (!s) return; const p = num(m.pontos); if (p > 0) s.dados += p; else s.troc -= p; });
    const topoBruto = Math.max(10, ...meses.map((m) => Math.max(m.dados, m.troc)));
    const passo = Math.pow(10, Math.floor(Math.log10(topoBruto)));
    const topo = Math.ceil(topoBruto / passo) * passo;
    const W = larguraCartao(false), H = 200, pl = 40, pb = 24, pt0 = 14, larg = (W - pl) / meses.length;
    const y = (v) => pt0 + (H - pt0 - pb) * (1 - v / topo);
    const bw = Math.min(18, larg * 0.32);
    const fk = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}K`.replace('.', ',') : String(v));
    const col = (x, v, cls, i) => (v ? `<path class="${cls}" style="--i:${i}" d="M${x},${y(0)} V${y(v) + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y(0)} Z"/>` : '');
    const ult = meses[meses.length - 1];
    const svg = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pontos dados e trocados por mês">
      ${[0, topo / 2, topo].map((v) => `<line class="grelha" x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${fk(v)}</text>`).join('')}
      ${meses.map((m, i) => {
        const x = pl + i * larg + larg / 2 - bw - 1;
        const dica = `${MESES[m.a.getMonth()]}: ${pts(m.dados)} dados, ${pts(m.troc)} trocados`;
        return `<g class="barra-g" data-dica="${esc(dica)}" tabindex="0" aria-label="${esc(dica)}"><rect class="alvo-hover" x="${pl + i * larg}" y="${pt0}" width="${larg}" height="${H - pt0 - pb}"/>${col(x, m.dados, 'barra s1', i)}${col(x + bw + 2, m.troc, 'barra s2', i)}<text class="eixo" x="${pl + i * larg + larg / 2}" y="${H - 6}" text-anchor="middle">${MESES[m.a.getMonth()]}</text></g>`;
      }).join('')}
    </svg>`;
    return `<header class="rel-cabeca"><h2>Pontos por mês</h2><p>Este mês: ${pts(ult.dados)} dados, ${pts(ult.troc)} trocados.</p></header>
      <p class="legenda"><span><i class="s1"></i>Dados</span><span><i class="s2"></i>Trocados</span></p>${svg}
      <details class="ver-tabela"><summary>Ver em tabela</summary><table><thead><tr><th>Mês</th><th class="num">Dados</th><th class="num">Trocados</th></tr></thead><tbody>${meses.map((m) => `<tr><td>${MESES[m.a.getMonth()]}</td><td class="num">${pts(m.dados)}</td><td class="num">${pts(m.troc)}</td></tr>`).join('')}</tbody></table></details>`;
  }

  function tabelaServicos(prontos) {
    if (!prontos.length) return '<header class="rel-cabeca"><h2>Tempos por serviço</h2><p>Ainda sem carros prontos neste período.</p></header>';
    const por = new Map();
    prontos.forEach((t) => { const k = t.servico || 'Sem serviço'; if (!por.has(k)) por.set(k, []); por.get(k).push(tempos(t)); });
    const linhas = [...por.entries()].map(([nome, l]) => {
      const med = (k) => { const v = l.map((x) => x[k]).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
      const ofi = l.map((x) => x.oficina);
      return { nome, n: l.length, trabalho: med('trabalho'), oficina: med('oficina'), min: Math.min(...ofi), max: Math.max(...ofi) };
    }).sort((a, b) => (b.trabalho || 0) - (a.trabalho || 0));
    const maxT = Math.max(1, ...linhas.map((s) => s.trabalho || 0));
    return `<header class="rel-cabeca"><h2>Tempos por serviço</h2><p>Trabalho: de começar a pronto, sem as pausas. Na oficina: da chegada a pronto. Em horas de abertura (${esc(HOR.abre)} às ${esc(HOR.fecha)}).</p></header>
      <div class="tabela-caixa responsiva sem-borda"><table>
        <thead><tr><th>Serviço</th><th class="num">Carros</th><th>Média de trabalho</th><th class="num">Média na oficina</th><th class="num">Mais rápido</th><th class="num">Mais lento</th></tr></thead>
        <tbody>${linhas.map((s, i) => `<tr data-dica="${esc(`${s.nome}: ${plural(s.n, 'carro', 'carros')}`)}">
          <td class="nome-linha">${esc(s.nome)}</td>
          <td class="num" data-rotulo="Carros">${s.n}</td>
          <td data-rotulo="Média de trabalho"><div class="celula-barra"><span>${esc(duracaoUtil(s.trabalho))}</span><span class="barra-h esconder-telemovel" aria-hidden="true"><i style="width:${Math.max(3, ((s.trabalho || 0) / maxT) * 100)}%;--i:${i}"></i></span></div></td>
          <td class="num" data-rotulo="Na oficina">${esc(duracaoUtil(s.oficina))}</td>
          <td class="num esconder-telemovel">${esc(duracaoUtil(s.min))}</td>
          <td class="num esconder-telemovel">${esc(duracaoUtil(s.max))}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }

  function listaPremiosTop(per) {
    const trocas = st.movimentos.filter((m) => m.tipo === 'resgate' && dentro(m.data, per.ini, per.fim));
    const por = new Map();
    trocas.forEach((m) => { const k = m.premio_nome || 'Prémio'; const v = por.get(k) || { n: 0, custo: 0 }; v.n++; v.custo += num(m.custo_eur); por.set(k, v); });
    const l = [...por.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5);
    const max = Math.max(1, ...l.map(([, v]) => v.n));
    const alertas = st.premios.filter((p) => ativoP(p) && temNum(p.stock) && num(p.stock) <= 3);
    return `<header class="rel-cabeca"><h2>Prémios trocados</h2><p>${trocas.length ? `${plural(trocas.length, 'troca', 'trocas')}, custaram ${esc(eur(trocas.reduce((s, m) => s + num(m.custo_eur), 0)))}.` : 'Nenhuma troca neste período.'}</p></header>
      ${l.length ? `<ul class="ranking">${l.map(([nome, v], i) => `<li><span class="rk-nome">${esc(nome)}</span><span class="barra-h"><i style="width:${(v.n / max) * 100}%;--i:${i}"></i></span><span class="rk-val">${v.n}</span></li>`).join('')}</ul>` : ''}
      ${alertas.length ? `<div class="alertas">${alertas.map((p) => `<button class="alerta-stock" type="button" data-abrir="premio" data-id="${p.id}">${icone(num(p.stock) <= 0 ? 'warning-circle' : 'package')}<span><strong>${esc(p.nome)}</strong> ${num(p.stock) <= 0 ? 'esgotado' : `só ${num(p.stock)} em stock`}</span>${p.comprar ? `<span class="comprar">${icone('link')}Comprar</span>` : ''}</button>`).join('')}</div>` : ''}`;
  }

  function listaClientesTop(per) {
    const por = new Map();
    st.trabalhos.forEach((t) => {
      if (!t.entregue || !dentro(t.entregue, per.ini, per.fim)) return;
      const cl = clienteDe(carroDe(t)); if (!cl) return;
      const v = por.get(cl.id) || { gasto: 0, visitas: 0 }; v.gasto += num(t.valor); v.visitas++; por.set(cl.id, v);
    });
    const l = [...por.entries()].sort((a, b) => b[1].gasto - a[1].gasto).slice(0, 5);
    return `<header class="rel-cabeca"><h2>Melhores clientes</h2><p>Pelo que gastaram neste período.</p></header>
      ${l.length ? `<ol class="top-clientes">${l.map(([id, v], i) => { const c = idx.cliente.get(id); return `<li><button type="button" data-abrir="cliente" data-id="${id}"><span class="pos">${i + 1}</span><span class="tc-nome"><strong>${esc(c.nome)}</strong><span>${plural(v.visitas, 'visita', 'visitas')}, ${pts(saldoDe(id))} pontos</span></span><span class="tc-val">${esc(eur(v.gasto, true))}</span></button></li>`; }).join('')}</ol>` : '<p class="historico-vazio">Sem entregas com cliente neste período.</p>'}`;
  }

  function tabelaProntos(prontos) {
    const l = [...prontos].sort((a, b) => data(b.pronto) - data(a.pronto)).slice(0, 60);
    if (!l.length) return '<header class="rel-cabeca"><h2>Carros prontos</h2><p>Nenhum neste período.</p></header>';
    return `<header class="rel-cabeca"><h2>Carros prontos</h2><p>Os mais recentes primeiro. Toque num para ver ou corrigir as horas.</p></header>
      <div class="tabela-caixa responsiva sem-borda"><table>
        <thead><tr><th>Pronto</th><th>Matrícula</th><th>Carro</th><th>Serviço</th><th class="num">Trabalho</th><th class="num">Na oficina</th><th class="num">Pagou</th><th>Prazo</th></tr></thead>
        <tbody>${l.map((t) => {
          const c = carroDe(t), ok = cumpriuPrazo(t), tp = tempos(t);
          return `<tr data-abrir-linha="trabalho" data-id="${t.id}" tabindex="0">
            <td data-rotulo="Pronto">${esc(quando(t.pronto))}</td>
            <td>${placa(c && c.matricula)}</td>
            <td class="nome-linha">${esc(nomeCarro(c))}</td>
            <td class="esconder-telemovel">${esc(t.servico || '')}</td>
            <td class="num" data-rotulo="Trabalho">${tp.trabalho != null ? esc(duracaoUtil(tp.trabalho)) : '<span class="fraco">sem início</span>'}</td>
            <td class="num" data-rotulo="Na oficina">${esc(duracaoUtil(tp.oficina))}</td>
            <td class="num" data-rotulo="Pagou">${t.valor ? esc(eur(num(t.valor))) : '<span class="fraco">-</span>'}</td>
            <td>${ok === null ? '<span class="fraco">sem prazo</span>' : ok ? `<span class="selo ok">${icone('check')}No prazo</span>` : `<span class="selo tarde">${icone('warning')}Atrasado</span>`}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
  }

  // ---------------------------------------------------------------- painéis
  const painel = $('[data-painel]');
  const toastEl = $('[data-toast]');
  const soltarToast = () => { if (toastEl.parentElement !== document.body) document.body.appendChild(toastEl); };
  let painelAtual = null, fecharTimer = null;

  function abrirPainel(tipo, opcoes = {}) {
    clearTimeout(fecharTimer);
    painel.classList.remove('a-fechar');
    const html = ({ trabalho: painelTrabalho, entrada: painelEntrada, cliente: painelCliente, carro: painelCarro, ligacao: painelLigacao, entregar: painelEntregar, trocar: painelTrocar, pontos: painelPontos, premio: painelPremio, regras: painelRegras, pausar: painelPausar }[tipo])(opcoes);
    if (!html) return;
    const trocar = painel.open;
    painelAtual = { tipo, ...opcoes };
    soltarToast();
    painel.innerHTML = html;
    if (!painel.open) painel.showModal();
    else if (trocar && !reduzir()) $('.painel-forma', painel).animate([{ opacity: 0, transform: 'translateX(14px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: E.emph });
    const foco = $('[data-focar]', painel);
    if (foco) foco.focus(); else $('.painel-corpo', painel)?.focus?.();
    ligarPainel(tipo);
    contarNumeros(painel);
  }
  function fecharPainel() {
    if (!painel.open) return;
    if (reduzir()) { painel.close(); return; }
    painel.classList.add('a-fechar');
    clearTimeout(fecharTimer);
    fecharTimer = setTimeout(() => { painel.classList.remove('a-fechar'); painel.close(); }, 200);
  }
  painel.addEventListener('close', () => { painelAtual = null; soltarToast(); painel.innerHTML = ''; });
  painel.addEventListener('cancel', (e) => { e.preventDefault(); fecharPainel(); });
  painel.addEventListener('click', (e) => { if (e.target === painel) fecharPainel(); });

  const cabecaPainel = (titulo, sub = '', antes = '') => `
    <header class="painel-cabeca">
      <div style="min-width:0">${antes}<h2 id="painel-titulo">${titulo}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
      <button class="btn-icone" type="button" data-fechar aria-label="Fechar">${icone('x')}</button>
    </header>`;

  const campo = (nome, rotulo, valor = '', o = {}) => `
    <label class="campo${o.classe ? ' ' + o.classe : ''}"><span>${rotulo}${o.opcional ? ' <em>(opcional)</em>' : ''}</span>
      <input name="${nome}" type="${o.tipo || 'text'}" value="${esc(valor)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.obrig ? ' required' : ''}${o.foco ? ' data-focar' : ''}${o.extra || ''}>
      ${o.ajuda ? `<span class="ajuda">${o.ajuda}</span>` : ''}
    </label>`;
  const area = (nome, rotulo, valor = '', o = {}) => `
    <label class="campo"><span>${rotulo}${o.opcional ? ' <em>(opcional)</em>' : ''}</span><textarea name="${nome}" rows="${o.linhas || 3}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>${esc(valor)}</textarea></label>`;
  const escolhaServico = (atual) => {
    const lista = [...(CFG.servicos || [])];
    if (atual && !lista.includes(atual)) lista.unshift(atual);
    return `<fieldset class="grupo"><legend>Serviço</legend><div class="chips">${lista.map((s) => `<label class="chip"><input type="radio" name="servico" value="${esc(s)}"${s === atual ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div></fieldset>`;
  };
  const erroForm = '<p class="campo"><span class="erro-campo" data-erro-form hidden></span></p>';
  function falhar(f, msg, el) {
    const erro = $('[data-erro-form]', f);
    erro.textContent = msg; erro.hidden = false;
    if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); abanar(el); } else abanar(erro);
  }

  function historicoHtml(lista, mostrarCarro = false) {
    if (!lista.length) return '<p class="historico-vazio">Ainda sem visitas.</p>';
    return `<ul class="historico">${lista.map((t) => {
      const c = carroDe(t), tp = tempos(t);
      const dur = t.pronto ? duracaoUtil(tp.trabalho ?? tp.oficina) : ESTADOS[t.estado]?.nome || '';
      return `<li><button type="button" data-abrir="trabalho" data-id="${t.id}">
        <span class="ponto" data-estado="${t.estado}" aria-hidden="true"></span>
        <span class="h-servico">${esc(t.servico || 'Serviço')}</span>
        <span class="h-data">${esc(quando(t.entrada, false))}${mostrarCarro && c ? ', ' + esc(c.matricula) : ''}${t.valor ? ', ' + esc(eur(num(t.valor))) : ''}</span>
        <span class="h-dur">${esc(dur)}</span>
      </button></li>`;
    }).join('')}</ul>`;
  }

  // --- Dar entrada a um carro
  function painelEntrada(o = {}) {
    const carro = o.carroId ? idx.carro.get(o.carroId) : null;
    return `<form class="painel-forma" data-form="entrada" novalidate>
      ${cabecaPainel('Dar entrada', 'Um carro chegou à oficina.')}
      <div class="painel-corpo">
        <div class="grupo">
          ${campo('matricula', 'Matrícula', carro ? carro.matricula : '', { classe: 'campo-matricula', ph: 'AA-00-AA', obrig: true, foco: !carro, extra: ' autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12"' })}
          <div data-carro-achado></div>
        </div>
        <fieldset class="grupo" data-carro-novo>
          <legend>Carro</legend>
          <div class="linha-campos tres">
            ${campo('marca', 'Marca', '', { ph: 'Peugeot' })}
            ${campo('modelo', 'Modelo', '', { ph: '208' })}
            ${campo('ano', 'Ano', '', { ph: '2019', extra: ' inputmode="numeric" maxlength="4"' })}
          </div>
        </fieldset>
        <fieldset class="grupo" data-cliente-grupo>
          <legend>Cliente</legend>
          <div data-cliente-achado></div>
          <div class="linha-campos" data-cliente-campos>
            ${campo('cliente_nome', 'Nome', '', { ph: 'Nome do cliente', extra: ' autocomplete="off"' })}
            ${campo('cliente_tel', 'Telemóvel', '', { tipo: 'tel', ph: '912 345 678', extra: ' autocomplete="off" inputmode="tel"', ajuda: 'Com o telemóvel, o cliente vê os pontos no site.' })}
          </div>
          <div class="sugestoes" data-cliente-sugestoes></div>
        </fieldset>
        ${escolhaServico('')}
        ${area('descricao', 'O que se passa', '', { ph: 'O que o cliente disse, luzes acesas, ruídos.', opcional: true, linhas: 3 })}
        <div class="linha-campos">
          ${campo('entrada', 'Chegou', paraInput(agoraTexto()), { tipo: 'datetime-local' })}
          ${campo('previsto', 'Prometido para', '', { tipo: 'date', opcional: true })}
        </div>
        ${campo('km', 'Quilómetros', carro ? carro.km : '', { ph: '84 200', opcional: true, extra: ' inputmode="numeric"' })}
        <label class="interruptor"><input type="checkbox" name="comecar"><span class="int-trilho" aria-hidden="true"></span><span>Começar já o trabalho</span></label>
        ${erroForm}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">${icone('plus')}Dar entrada</button></div></footer>
    </form>`;
  }

  function ligarEntrada() {
    const f = $('[data-form="entrada"]', painel);
    const ctx = { carro: null, cliente: null, clienteDoCarro: false };
    const mat = f.matricula;

    const mostrarCliente = () => {
      const achado = $('[data-cliente-achado]', f), campos = $('[data-cliente-campos]', f);
      if (ctx.cliente) {
        const cs = idx.carrosDoCliente.get(ctx.cliente.id) || [];
        achado.innerHTML = `<div class="achado">${icone('user')}<p><strong>${esc(ctx.cliente.nome)}</strong><span>${esc(telFormatar(ctx.cliente.telemovel)) || 'sem telemóvel'}${cs.length ? `, ${plural(cs.length, 'carro', 'carros')}` : ''}, ${pts(saldoDe(ctx.cliente.id))} pontos</span></p>${ctx.carro ? '' : '<button class="btn texto pequeno" type="button" data-trocar-cliente>Trocar</button>'}</div>`;
        campos.hidden = true;
        $('[data-cliente-sugestoes]', f).innerHTML = '';
      } else {
        achado.innerHTML = '';
        campos.hidden = false;
      }
    };
    const procurar = () => {
      const k = matChave(mat.value);
      const antes = ctx.carro;
      ctx.carro = k.length >= 4 ? idx.carroPorMat.get(k) || null : null;
      const zona = $('[data-carro-achado]', f);
      const naOficina = ctx.carro && (idx.trabalhosDoCarro.get(ctx.carro.id) || []).find((t) => t.estado !== 'entregue');
      if (ctx.carro) {
        const v = (idx.trabalhosDoCarro.get(ctx.carro.id) || []).length;
        zona.innerHTML = `<div class="achado">${icone('car')}<p><strong>${esc(nomeCarro(ctx.carro))}${ctx.carro.ano ? ', ' + esc(ctx.carro.ano) : ''}</strong><span>Já é cliente. ${v ? plural(v, 'visita', 'visitas') : 'Sem visitas'}${naOficina ? `, e está na oficina agora (${esc(ESTADOS[naOficina.estado].nome.toLowerCase())}).` : '.'}</span></p></div>`;
        ctx.cliente = clienteDe(ctx.carro) || null;
        if (!f.km.value) f.km.value = ctx.carro.km || '';
        if (!antes && !reduzir()) zona.firstElementChild.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: E.emph });
      } else {
        zona.innerHTML = k.length >= 6 ? '<p class="ajuda-linha">Carro novo: preencha a marca e o cliente.</p>' : '';
        if (ctx.cliente && ctx.clienteDoCarro) ctx.cliente = null;
      }
      ctx.clienteDoCarro = !!ctx.carro;
      $('[data-carro-novo]', f).hidden = !!ctx.carro;
      mostrarCliente();
    };
    const sugerir = () => {
      if (ctx.cliente) return;
      const nome = sem(f.cliente_nome.value.trim()), tel = soDigitos(f.cliente_tel.value);
      const caixa = $('[data-cliente-sugestoes]', f);
      if (nome.length < 2 && tel.length < 3) { caixa.innerHTML = ''; return; }
      const l = st.clientes.filter((c) => (nome.length >= 2 && sem(c.nome).includes(nome)) || (tel.length >= 3 && soDigitos(c.telemovel).includes(tel))).slice(0, 5);
      caixa.innerHTML = l.length ? `<p>É um destes clientes?</p>${l.map((c) => `<button class="sugestao" type="button" data-escolher-cliente="${c.id}">${icone('user')}<strong>${esc(c.nome)}</strong><span>${esc(telFormatar(c.telemovel))}</span></button>`).join('')}` : '';
    };

    mat.addEventListener('input', procurar);
    mat.addEventListener('blur', () => { mat.value = matFormatar(mat.value); });
    f.cliente_nome.addEventListener('input', sugerir);
    f.cliente_tel.addEventListener('input', sugerir);
    f.addEventListener('click', (e) => {
      const b = e.target.closest('[data-escolher-cliente]');
      if (b) { ctx.cliente = idx.cliente.get(b.dataset.escolherCliente); mostrarCliente(); }
      if (e.target.closest('[data-trocar-cliente]')) { ctx.cliente = null; mostrarCliente(); f.cliente_nome.focus(); }
    });
    if (mat.value) procurar();

    f.addEventListener('submit', (e) => {
      e.preventDefault();
      $$('[aria-invalid]', f).forEach((el) => el.removeAttribute('aria-invalid'));
      $('[data-erro-form]', f).hidden = true;
      const matricula = matFormatar(mat.value);
      if (matChave(matricula).length < 4) return falhar(f, 'Escreva a matrícula do carro.', mat);
      const naOficina = ctx.carro && (idx.trabalhosDoCarro.get(ctx.carro.id) || []).find((t) => t.estado !== 'entregue');
      if (naOficina && !f.dataset.confirmado) {
        f.dataset.confirmado = '1';
        return falhar(f, `Este carro já está na oficina (${ESTADOS[naOficina.estado].nome.toLowerCase()}). Carregue outra vez em Dar entrada para abrir um segundo trabalho.`);
      }
      const ops = [];
      const agora = agoraTexto();
      let cliente = ctx.cliente;
      if (!ctx.carro && !cliente) {
        const nome = f.cliente_nome.value.trim();
        if (!nome) return falhar(f, 'Escreva o nome do cliente, ou escolha um que já exista.', f.cliente_nome);
        cliente = { id: novoId(), nome, telemovel: soDigitos(f.cliente_tel.value) || f.cliente_tel.value.trim(), email: '', nif: '', notas: '', criado_em: agora };
        ops.push({ op: 'criar', tabela: 'clientes', id: cliente.id, dados: cliente });
      }
      let carro = ctx.carro;
      const km = soDigitos(f.km.value);
      if (!carro) {
        carro = { id: novoId(), cliente_id: cliente ? cliente.id : '', matricula, marca: f.marca.value.trim(), modelo: f.modelo.value.trim(), ano: soDigitos(f.ano.value), km, notas: '', criado_em: agora };
        ops.push({ op: 'criar', tabela: 'carros', id: carro.id, dados: carro });
      } else if (km && km !== carro.km) {
        ops.push({ op: 'atualizar', tabela: 'carros', id: carro.id, dados: { km } });
      }
      const servico = (f.querySelector('input[name="servico"]:checked') || {}).value || '';
      const comecar = f.comecar.checked;
      const t = {
        id: novoId(), carro_id: carro.id, servico, descricao: f.descricao.value.trim(), estado: comecar ? 'curso' : 'espera',
        entrada: deInput(f.entrada.value) || agora, inicio: comecar ? agora : '', pronto: '', entregue: '', previsto: f.previsto.value || '',
        pausado_em: '', pausa_min: '', pausa_motivo: '', valor: '', notas: '', criado_em: agora,
      };
      ops.push({ op: 'criar', tabela: 'trabalhos', id: t.id, dados: t });
      fecharPainel();
      st.faixa = t.estado;
      if (vistaAtual() !== 'oficina') location.hash = '#oficina';
      gravar(ops, `${matricula} deu entrada.`);
    });
  }

  // --- Um trabalho
  function painelTrabalho({ id }) {
    const t = idx.trabalho.get(id);
    if (!t) { toast('Este trabalho já não existe.'); return ''; }
    const c = carroDe(t), cl = clienteDe(c), tp = tempos(t);
    const i = ORDEM.indexOf(t.estado);
    const etapa = (k, nome, quandoTxt) => {
      const n = ORDEM.indexOf(k);
      const cls = n < i || (n === i && k === 'entregue') ? 'feita' : n === i ? 'agora' : '';
      return `<li class="etapa ${cls}"><span class="bola" aria-hidden="true"></span><strong>${nome}</strong><span>${quandoTxt ? esc(quandoTxt) : '&nbsp;'}</span></li>`;
    };
    const pausa = emPausa(t);
    let acao = '';
    if (t.estado === 'espera') acao = `<button class="btn primario" type="button" data-avancar="${t.id}">${icone('play')}Começar</button>`;
    if (t.estado === 'curso') acao = pausa ? `<button class="btn" type="button" data-retomar="${t.id}">${icone('play')}Retomar</button>` : `<button class="btn" type="button" data-abrir="pausar" data-id="${t.id}">${icone('pause')}Pausar</button><button class="btn pronto" type="button" data-avancar="${t.id}">${icone('check')}Pronto</button>`;
    if (t.estado === 'pronto') acao = `<button class="btn escuro" type="button" data-abrir="entregar" data-id="${t.id}">${icone('flag-checkered')}Entregar</button>`;
    return `<form class="painel-forma" data-form="trabalho" data-id="${t.id}" novalidate>
      ${cabecaPainel(esc(nomeCarro(c)), esc(t.servico || 'Serviço por definir'), `<div class="placa-topo">${placa(c && c.matricula, 'grande')}</div>`)}
      <div class="painel-corpo" tabindex="-1">
        <ol class="etapas" aria-label="Estado: ${ESTADOS[t.estado].nome}">
          ${etapa('espera', 'Chegou', quando(t.entrada))}
          ${etapa('curso', 'Começou', quando(t.inicio))}
          ${etapa('pronto', 'Pronto', quando(t.pronto))}
          ${etapa('entregue', 'Entregue', quando(t.entregue))}
        </ol>
        <dl class="duracoes">
          <div class="destaque"><dt>Trabalho</dt><dd>${tp.trabalho != null ? esc(duracaoUtil(tp.trabalho)) : '-'}</dd></div>
          <div><dt>À espera</dt><dd>${tp.espera != null ? esc(duracaoUtil(tp.espera)) : '-'}</dd></div>
          <div><dt>Na oficina</dt><dd>${tp.oficina != null ? esc(duracaoUtil(tp.oficina)) : '-'}</dd></div>
        </dl>
        <p class="duracoes-nota">Em horas de abertura${tp.concluido ? '' : ', a contar'}${tp.pausa ? `. Em pausa: ${esc(duracaoUtil(tp.pausa))}, fora do trabalho` : ''}.${tp.calendario != null && tp.calendario >= DIA ? ` No calendário: ${esc(duracao(tp.calendario))}.` : ''}</p>
        ${pausa ? `<p class="chip-estado pausa grande">${icone('pause')}Em pausa desde ${esc(quando(t.pausado_em))}: ${esc(t.pausa_motivo || 'sem motivo')}</p>` : ''}
        ${prazo(t)?.tipo === 'atraso' ? `<p class="prazo atraso">${icone('warning')}Prometido para ${esc(quando(t.previsto, false))}.</p>` : ''}

        <div class="contacto">
          <div class="quem"><strong>${cl ? esc(cl.nome) : 'Sem cliente'}</strong><span>${cl && cl.telemovel ? esc(telFormatar(cl.telemovel)) : 'sem telemóvel'}${cl ? `, ${pts(saldoDe(cl.id))} pontos` : ''}</span></div>
          ${cl && cl.telemovel ? `<a class="btn pequeno" href="tel:${esc(soDigitos(cl.telemovel))}">${icone('phone')}Ligar</a>` : ''}
          ${cl ? `<button class="btn texto pequeno" type="button" data-abrir="cliente" data-id="${cl.id}">Ficha do cliente</button>` : ''}
          ${c ? `<button class="btn texto pequeno" type="button" data-abrir="carro" data-id="${c.id}">Ficha do carro</button>` : ''}
        </div>

        ${escolhaServico(t.servico)}
        ${area('descricao', 'O que se passa', t.descricao, { opcional: true })}
        ${area('notas', 'Notas da oficina', t.notas, { opcional: true, ph: 'Peças, o que foi feito, o que falta.' })}

        <fieldset class="grupo">
          <legend>Horas e valor</legend>
          <label class="campo"><span>Estado</span><select name="estado">${ORDEM.map((e) => `<option value="${e}"${e === t.estado ? ' selected' : ''}>${ESTADOS[e].nome}</option>`).join('')}</select></label>
          <div class="linha-campos">
            ${campo('entrada', 'Chegou', paraInput(t.entrada), { tipo: 'datetime-local' })}
            ${campo('inicio', 'Começou', paraInput(t.inicio), { tipo: 'datetime-local' })}
            ${campo('pronto', 'Pronto', paraInput(t.pronto), { tipo: 'datetime-local' })}
            ${campo('entregue', 'Entregue', paraInput(t.entregue), { tipo: 'datetime-local' })}
          </div>
          <div class="linha-campos">
            ${campo('previsto', 'Prometido para', t.previsto ? String(t.previsto).slice(0, 10) : '', { tipo: 'date', opcional: true })}
            ${campo('pausa_min', 'Minutos em pausa', t.pausa_min ? Math.round(num(t.pausa_min)) : '', { opcional: true, extra: ' inputmode="numeric"' })}
          </div>
          ${campo('valor', 'Valor pago (€)', t.valor, { opcional: true, extra: ' inputmode="decimal"', ajuda: 'Mudar aqui não mexe nos pontos já dados. Para isso use a ficha do cliente.' })}
        </fieldset>
        <p><button class="btn perigo pequeno" type="button" data-apagar-trabalho>${icone('trash')}Apagar este trabalho</button></p>
      </div>
      <footer class="painel-pe">
        <button class="btn" type="submit">Guardar</button>
        <div class="direita">${acao}</div>
      </footer>
    </form>`;
  }

  function dadosTrabalho(f, t) {
    const d = {
      servico: (f.querySelector('input[name="servico"]:checked') || {}).value || t.servico || '',
      descricao: f.descricao.value.trim(), notas: f.notas.value.trim(), estado: f.estado.value,
      entrada: deInput(f.entrada.value), inicio: deInput(f.inicio.value), pronto: deInput(f.pronto.value), entregue: deInput(f.entregue.value),
      previsto: f.previsto.value || '', pausa_min: soDigitos(f.pausa_min.value), valor: f.valor.value.trim().replace(',', '.'),
    };
    const n = ORDEM.indexOf(d.estado);
    ORDEM.slice(1, n + 1).forEach((e) => { const k = CARIMBO_DE[e]; if (!d[k]) d[k] = agoraTexto(); });
    return d;
  }

  function ligarTrabalho() {
    const f = $('[data-form="trabalho"]', painel);
    const t = idx.trabalho.get(f.dataset.id);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = dadosTrabalho(f, t);
      const mudou = Object.keys(d).filter((k) => (t[k] || '') !== d[k]);
      fecharPainel();
      if (mudou.length) gravar([{ op: 'atualizar', tabela: 'trabalhos', id: t.id, dados: d }], 'Guardado.');
    });
    $('[data-apagar-trabalho]', f).addEventListener('click', () => {
      const c = carroDe(t);
      if (!confirm(`Apagar este trabalho${c ? ' do ' + c.matricula : ''}? Sai também da sheet.`)) return;
      fecharPainel();
      gravar([{ op: 'apagar', tabela: 'trabalhos', id: t.id }], 'Trabalho apagado.');
    });
  }

  // Fecha uma pausa: soma as horas de abertura paradas a pausa_min.
  const fecharPausa = (t, quando = new Date()) => (t.pausado_em
    ? { pausado_em: '', pausa_min: String(Math.round(num(t.pausa_min) + horasUteis(data(t.pausado_em), quando) / MIN)) }
    : {});

  async function avancar(id) {
    const t = idx.trabalho.get(id);
    if (!t) return;
    const prox = seguinte(t.estado);
    if (!prox || prox === 'entregue') { if (prox) abrirPainel('entregar', { id }); return; }
    const dados = { estado: prox, [CARIMBO_DE[prox]]: agoraTexto() };
    if (prox === 'pronto') { Object.assign(dados, fecharPausa(t)); if (!t.inicio) dados.inicio = t.entrada || agoraTexto(); }
    if (painelAtual && painelAtual.tipo === 'trabalho' && painelAtual.id === id) {
      const f = $('[data-form="trabalho"]', painel);
      Object.assign(dados, { ...dadosTrabalho(f, t), ...dados });
    }
    if (painel.open) fecharPainel();
    const c = carroDe(t);
    const card = $(`[data-card="${id}"]`);
    if (card && !reduzir()) {
      // Sai a deslizar para a coluna seguinte.
      st.animando++;
      await card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(28px) scale(.97)' }], { duration: 200, easing: E.sai, fill: 'forwards' }).finished;
      st.animando--;
    }
    if (window.matchMedia('(max-width: 900px)').matches) st.faixa = prox;
    const msg = prox === 'curso' ? `${c ? c.matricula : 'O carro'}: relógio a contar.` : `${c ? c.matricula : 'O carro'} está pronto. ${duracaoUtil(tempos({ ...t, ...dados }).trabalho)} de trabalho.`;
    gravar([{ op: 'atualizar', tabela: 'trabalhos', id, dados }], msg);
  }

  // --- Pausar (à espera de peças, etc.)
  function painelPausar({ id }) {
    const t = idx.trabalho.get(id);
    if (!t) return '';
    const c = carroDe(t);
    return `<form class="painel-forma compacto" data-form="pausar" data-id="${id}" novalidate>
      ${cabecaPainel('Pausar o trabalho', `${esc(c ? c.matricula : '')} ${esc(nomeCarro(c))}. O relógio para e a pausa não conta como trabalho.`)}
      <div class="painel-corpo">
        <fieldset class="grupo"><legend>Porquê?</legend><div class="chips">${MOTIVOS.map((m, i) => `<label class="chip"><input type="radio" name="motivo" value="${esc(m)}"${i === 0 ? ' checked' : ''}><span>${esc(m)}</span></label>`).join('')}</div></fieldset>
        ${campo('outro', 'Outro motivo', '', { opcional: true, ph: 'Ex.: à espera de aprovação do orçamento' })}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">${icone('pause')}Pausar</button></div></footer>
    </form>`;
  }
  function ligarPausar() {
    const f = $('[data-form="pausar"]', painel);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = f.dataset.id, t = idx.trabalho.get(id);
      const motivo = f.outro.value.trim() || (f.querySelector('input[name="motivo"]:checked') || {}).value || '';
      fecharPainel();
      gravar([{ op: 'atualizar', tabela: 'trabalhos', id, dados: { pausado_em: agoraTexto(), pausa_motivo: motivo } }], `${carroDe(t)?.matricula || 'Trabalho'} em pausa: ${motivo.toLowerCase()}.`);
    });
  }
  function retomar(id) {
    const t = idx.trabalho.get(id);
    if (!t) return;
    if (painel.open) fecharPainel();
    gravar([{ op: 'atualizar', tabela: 'trabalhos', id, dados: { ...fecharPausa(t), pausa_motivo: '' } }], `${carroDe(t)?.matricula || 'Trabalho'}: relógio a contar outra vez.`);
  }

  // --- Entregar: quanto pagou, os pontos que ganha, e o carro vai-se embora.
  function painelEntregar({ id }) {
    const t = idx.trabalho.get(id);
    if (!t) return '';
    const c = carroDe(t), cl = clienteDe(c), tp = tempos(t);
    const saldo = cl ? saldoDe(cl.id) : 0;
    return `<form class="painel-forma compacto" data-form="entregar" data-id="${id}" novalidate>
      ${cabecaPainel(`Entregar o ${esc(nomeCarro(c))}`, `${esc(t.servico || 'Serviço')}, feito em ${esc(duracaoUtil(tp.trabalho ?? tp.oficina))} de trabalho.`, `<div class="placa-topo">${placa(c && c.matricula, 'grande')}</div>`)}
      <div class="painel-corpo">
        <label class="campo campo-dinheiro"><span>Quanto pagou?</span>
          <span class="dinheiro"><input name="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(t.valor ? String(t.valor).replace('.', ',') : '')}" data-focar><b>€</b></span>
        </label>
        ${cl ? `<div class="ganho" data-ganho>
            <span class="ganho-ic">${icone('coins')}</span>
            <p><strong class="ganho-num">+<span data-ganho-pts>0</span> pontos</strong><span>${esc(cl.nome)} fica com <b data-ganho-saldo>${pts(saldo)}</b> pontos${cl.telemovel ? '' : '. Sem telemóvel, não os vê no site'}.</span></p>
          </div>`
          : '<p class="ajuda-linha">Este carro não tem cliente: a entrega fica registada, sem pontos.</p>'}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn escuro" type="submit">${icone('flag-checkered')}Entregar</button></div></footer>
    </form>`;
  }
  function ligarEntregar() {
    const f = $('[data-form="entregar"]', painel);
    const t = idx.trabalho.get(f.dataset.id);
    const cl = clienteDe(carroDe(t));
    const ppe = regra('pontos_por_euro');
    const ganhos = () => Math.floor(num(f.valor.value) * ppe);
    let ultimo = 0;
    const atualizar = () => {
      if (!cl) return;
      const g = ganhos();
      $('[data-ganho-pts]', f).textContent = pts(g);
      $('[data-ganho-saldo]', f).textContent = pts(saldoDe(cl.id) + g);
      $('[data-ganho]', f).classList.toggle('ativo', g > 0);
      if (g > ultimo && !reduzir()) $('.ganho-num', f).animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 220, easing: E.pop });
      ultimo = g;
    };
    f.valor.addEventListener('input', atualizar);
    atualizar();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const valor = num(f.valor.value);
      if (f.valor.value.trim() && !(valor >= 0)) return falhar(f, 'Escreva o valor em euros, por exemplo 120,50.', f.valor);
      const agora = agoraTexto();
      const dados = { estado: 'entregue', entregue: agora, valor: valor ? String(valor) : '' };
      if (!t.pronto) { dados.pronto = agora; Object.assign(dados, fecharPausa(t)); }
      const ops = [{ op: 'atualizar', tabela: 'trabalhos', id: t.id, dados }];
      const g = ganhos();
      if (cl && g > 0) ops.push({ op: 'criar', tabela: 'movimentos', id: novoId(), dados: { data: agora, cliente_id: cl.id, tipo: 'gasto', valor_eur: String(valor), pontos: String(g), premio_id: '', premio_nome: '', custo_eur: '', trabalho_id: t.id, nota: t.servico || '', criado_em: agora } });
      fecharPainel();
      const c = carroDe(t);
      await carroVaiEmbora($(`[data-card="${t.id}"]`));
      gravar(ops, `${c ? c.matricula : 'Carro'} entregue${cl && g ? `. +${pts(g)} pontos para ${cl.nome.split(' ')[0]}` : ''}.`);
    });
  }

  // --- Cliente
  function painelCliente({ id } = {}) {
    const c = id ? idx.cliente.get(id) : null;
    const carros = c ? idx.carrosDoCliente.get(c.id) || [] : [];
    const hist = c ? trabalhosDoCliente(c.id) : [];
    const movs = c ? idx.movsDoCliente.get(c.id) || [] : [];
    const saldo = c ? saldoDe(c.id) : 0;
    const gasto = hist.reduce((s, t) => s + num(t.valor), 0);
    return `<form class="painel-forma" data-form="cliente" data-id="${c ? c.id : ''}" novalidate>
      ${cabecaPainel(c ? esc(c.nome) : 'Novo cliente', c ? `${plural(hist.length, 'visita', 'visitas')}${gasto ? `, ${esc(eur(gasto, true))} gastos` : ''}${hist[0] ? ', a última ' + esc(quando(hist[0].entrada, false)) : ''}` : '')}
      <div class="painel-corpo" tabindex="-1">
        ${c ? `<section class="saldo-cartao">
            <div><span class="rotulo">Pontos</span><strong class="saldo-num" data-contar-id="saldo-${c.id}" data-contar="${saldo}">${pts(saldo)}</strong><span class="saldo-eur">valem ${esc(eur(saldo * valorPonto()))} em prémios</span></div>
            <div class="saldo-acoes">
              <button class="btn primario" type="button" data-abrir="trocar" data-id="${c.id}">${icone('gift')}Trocar pontos</button>
              <button class="btn" type="button" data-abrir="pontos" data-id="${c.id}">${icone('plus')}Dar pontos</button>
            </div>
            ${proximoPremio(saldo)}
          </section>
          <div class="contacto">${c.telemovel ? `<a class="btn pequeno" href="tel:${esc(soDigitos(c.telemovel))}">${icone('phone')}Ligar ${esc(telFormatar(c.telemovel))}</a>` : '<span class="ajuda-linha">Sem telemóvel: não vê os pontos no site.</span>'}</div>` : ''}
        <div class="grupo">
          ${campo('nome', 'Nome', c ? c.nome : '', { obrig: true, foco: !c })}
          <div class="linha-campos">
            ${campo('telemovel', 'Telemóvel', c ? telFormatar(c.telemovel) : '', { tipo: 'tel', ph: '912 345 678', extra: ' inputmode="tel"' })}
            ${campo('nif', 'NIF', c ? c.nif : '', { opcional: true, extra: ' inputmode="numeric" maxlength="9"' })}
          </div>
          ${campo('email', 'Email', c ? c.email : '', { tipo: 'email', opcional: true })}
          ${area('notas', 'Notas', c ? c.notas : '', { opcional: true, linhas: 2 })}
        </div>
        ${c ? `
        <section class="grupo"><h3 class="titulo-grupo">Movimentos de pontos</h3>${movimentosHtml(movs)}</section>
        <section class="grupo"><h3 class="titulo-grupo">Carros</h3>
          ${carros.length ? `<div class="lista-carros">${carros.map((k) => `<button type="button" data-abrir="carro" data-id="${k.id}">${placa(k.matricula)}<span class="c-info"><strong>${esc(nomeCarro(k))}</strong><span>${[k.ano, k.km ? Number(k.km).toLocaleString('pt-PT') + ' km' : ''].filter(Boolean).join(', ')}</span></span>${icone('caret-right')}</button>`).join('')}</div>` : '<p class="historico-vazio">Sem carros.</p>'}
          <p><button class="btn pequeno" type="button" data-abrir="carro" data-cliente="${c.id}">${icone('plus')}Juntar carro</button></p>
        </section>
        <section class="grupo"><h3 class="titulo-grupo">Visitas</h3>${historicoHtml(hist, true)}</section>
        <p><button class="btn perigo pequeno" type="button" data-apagar-cliente>${icone('trash')}Apagar cliente</button></p>` : ''}
        ${erroForm}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">${c ? 'Guardar' : 'Criar cliente'}</button></div></footer>
    </form>`;
  }
  function proximoPremio(saldo) {
    const l = st.premios.filter((p) => ativoP(p) && num(p.pontos) > 0).sort((a, b) => num(a.pontos) - num(b.pontos));
    const prox = l.find((p) => num(p.pontos) > saldo);
    const ja = l.filter((p) => num(p.pontos) <= saldo).length;
    if (!l.length) return '';
    if (!prox) return `<p class="saldo-prox">${icone('gift')}Já chega para qualquer prémio.</p>`;
    const ant = l.filter((p) => num(p.pontos) <= saldo).pop();
    const base = ant ? num(ant.pontos) : 0;
    const fr = (saldo - base) / (num(prox.pontos) - base);
    return `<div class="saldo-prox"><span>${ja ? `Já dá para ${plural(ja, 'prémio', 'prémios')}. ` : ''}Faltam <b>${pts(num(prox.pontos) - saldo)}</b> para ${esc(prox.nome)}</span><span class="barra-h"><i style="width:${Math.max(3, fr * 100)}%"></i></span></div>`;
  }
  function movimentosHtml(movs) {
    if (!movs.length) return '<p class="historico-vazio">Ainda sem pontos.</p>';
    return `<ul class="movimentos">${movs.slice(0, 30).map((m) => {
      const p = num(m.pontos), tipo = TIPOS[m.tipo] || TIPOS.ajuste;
      const det = m.tipo === 'resgate' ? m.premio_nome : m.tipo === 'gasto' ? [m.valor_eur ? eur(num(m.valor_eur)) : '', m.nota].filter(Boolean).join(', ') : m.nota;
      return `<li><span class="mv-ic ${m.tipo}">${icone(tipo.ic)}</span><span class="mv-txt"><strong>${esc(tipo.nome)}</strong><span>${esc(quando(m.data, false))}${det ? ', ' + esc(det) : ''}</span></span><span class="mv-pts ${p < 0 ? 'neg' : 'pos'}">${p > 0 ? '+' : ''}${pts(p)}</span>${m.tipo !== 'gasto' || !m.trabalho_id ? `<button class="btn-icone mini" type="button" data-apagar-mov="${m.id}" aria-label="Anular este movimento" title="Anular">${icone('x')}</button>` : ''}</li>`;
    }).join('')}</ul>`;
  }

  function ligarCliente() {
    const f = $('[data-form="cliente"]', painel);
    const c = f.dataset.id ? idx.cliente.get(f.dataset.id) : null;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = f.nome.value.trim();
      if (!nome) return falhar(f, 'Escreva o nome do cliente.', f.nome);
      const d = { nome, telemovel: soDigitos(f.telemovel.value) || f.telemovel.value.trim(), nif: soDigitos(f.nif.value), email: f.email.value.trim(), notas: f.notas.value.trim() };
      fecharPainel();
      if (c) gravar([{ op: 'atualizar', tabela: 'clientes', id: c.id, dados: d }], 'Cliente guardado.');
      else gravar([{ op: 'criar', tabela: 'clientes', id: novoId(), dados: { ...d, criado_em: agoraTexto() } }], `${nome} foi criado.`);
    });
    f.addEventListener('click', (e) => {
      const b = e.target.closest('[data-apagar-mov]');
      if (!b) return;
      const m = st.movimentos.find((x) => x.id === b.dataset.apagarMov);
      if (!m || !confirm(`Anular este movimento (${num(m.pontos) > 0 ? '+' : ''}${pts(num(m.pontos))} pontos)?`)) return;
      const ops = [{ op: 'apagar', tabela: 'movimentos', id: m.id }];
      const p = m.premio_id && idx.premio.get(m.premio_id);
      if (m.tipo === 'resgate' && p && temNum(p.stock)) ops.push({ op: 'atualizar', tabela: 'premios', id: p.id, dados: { stock: String(num(p.stock) + 1) } });
      gravar(ops, 'Movimento anulado.');
      abrirPainel('cliente', { id: c.id });
    });
    const apagar = $('[data-apagar-cliente]', f);
    if (apagar) apagar.addEventListener('click', () => {
      const carros = idx.carrosDoCliente.get(c.id) || [];
      if (carros.length) {
        const n = carros.length;
        return falhar(f, `${c.nome} tem ${n === 1 ? 'um carro' : n + ' carros'}. Passe-${n === 1 ? 'o' : 'os'} para outro cliente ou apague-${n === 1 ? 'o' : 'os'} primeiro.`);
      }
      if (!confirm(`Apagar ${c.nome} e os seus movimentos de pontos? Sai também da sheet.`)) return;
      fecharPainel();
      gravar([...(idx.movsDoCliente.get(c.id) || []).map((m) => ({ op: 'apagar', tabela: 'movimentos', id: m.id })), { op: 'apagar', tabela: 'clientes', id: c.id }], 'Cliente apagado.');
    });
  }

  // --- Trocar pontos por um prémio
  function painelTrocar({ id }) {
    const c = idx.cliente.get(id);
    if (!c) return '';
    const saldo = saldoDe(c.id);
    const l = st.premios.filter(ativoP).sort((a, b) => num(a.pontos) - num(b.pontos));
    return `<form class="painel-forma" data-form="trocar" data-id="${c.id}" novalidate>
      ${cabecaPainel('Trocar pontos', `${esc(c.nome)} tem <b>${pts(saldo)}</b> pontos.`)}
      <div class="painel-corpo">
        ${l.length ? `<fieldset class="grupo"><legend class="so-leitor">Prémio</legend><div class="lista-trocar">${l.map((p) => {
          const falta = num(p.pontos) - saldo, sk = estadoStock(p), esg = sk.cls === 'esgotado';
          const pode = falta <= 0 && !esg;
          return `<label class="opcao-premio${pode ? '' : ' indisponivel'}"><input type="radio" name="premio" value="${p.id}"${pode ? '' : ' disabled'}>
            <span class="op-ic">${icone('gift')}</span>
            <span class="op-txt"><strong>${esc(p.nome)}</strong><span>${esg ? 'Esgotado' : falta > 0 ? `Faltam ${pts(falta)} pontos` : sk.cls === 'servico' ? esc(p.descricao || 'Disponível') : esc(sk.txt)}</span></span>
            <span class="op-pts">${pts(p.pontos)}</span>
          </label>`;
        }).join('')}</div></fieldset>` : '<p class="historico-vazio">Ainda não há prémios. Crie-os em Prémios.</p>'}
        ${area('nota', 'Nota', '', { opcional: true, linhas: 2 })}
        <div class="resumo-troca" data-resumo hidden></div>
        ${erroForm}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit" data-trocar-btn disabled>${icone('gift')}Trocar</button></div></footer>
    </form>`;
  }
  function ligarTrocar() {
    const f = $('[data-form="trocar"]', painel);
    const c = idx.cliente.get(f.dataset.id);
    const saldo = saldoDe(c.id);
    const escolhido = () => idx.premio.get((f.querySelector('input[name="premio"]:checked') || {}).value);
    f.addEventListener('change', () => {
      const p = escolhido();
      const r = $('[data-resumo]', f), b = $('[data-trocar-btn]', f);
      if (!p) return;
      r.hidden = false;
      r.innerHTML = `${icone('gift')}<p>Trocar <strong>${esc(p.nome)}</strong> por <strong>${pts(p.pontos)} pontos</strong>. ${esc(c.nome.split(' ')[0])} fica com <strong>${pts(saldo - num(p.pontos))}</strong>.${temNum(p.stock) ? ` Fica ${pts(num(p.stock) - 1)} em stock.` : ''}</p>`;
      b.disabled = false;
      b.innerHTML = `${icone('gift')}Trocar por ${pts(p.pontos)} pontos`;
      if (!reduzir()) r.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: E.emph });
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const p = escolhido();
      if (!p) return falhar(f, 'Escolha o prémio.');
      const agora = agoraTexto();
      const ops = [{ op: 'criar', tabela: 'movimentos', id: novoId(), dados: { data: agora, cliente_id: c.id, tipo: 'resgate', valor_eur: '', pontos: String(-num(p.pontos)), premio_id: p.id, premio_nome: p.nome, custo_eur: String(num(p.custo_eur)), trabalho_id: '', nota: f.nota.value.trim(), criado_em: agora } }];
      if (temNum(p.stock)) ops.push({ op: 'atualizar', tabela: 'premios', id: p.id, dados: { stock: String(Math.max(0, num(p.stock) - 1)) } });
      gravar(ops, `${c.nome.split(' ')[0]} trocou ${pts(p.pontos)} pontos por ${p.nome}.`);
      abrirPainel('cliente', { id: c.id });
    });
  }

  // --- Dar pontos à mão: um gasto sem trabalho, uma indicação, um ajuste.
  function painelPontos({ id }) {
    const c = idx.cliente.get(id);
    if (!c) return '';
    return `<form class="painel-forma compacto" data-form="pontos" data-id="${c.id}" novalidate>
      ${cabecaPainel('Dar pontos', `${esc(c.nome)} tem ${pts(saldoDe(c.id))} pontos.`)}
      <div class="painel-corpo">
        <fieldset class="grupo"><legend>O quê?</legend><div class="chips">
          <label class="chip"><input type="radio" name="tipo" value="gasto" checked><span>Gastou na oficina</span></label>
          <label class="chip"><input type="radio" name="tipo" value="indicacao"><span>Trouxe um amigo</span></label>
          <label class="chip"><input type="radio" name="tipo" value="ajuste"><span>Ajuste</span></label>
        </div></fieldset>
        <div data-se="gasto">${campo('valor', 'Quanto gastou (€)', '', { extra: ' inputmode="decimal" autocomplete="off"', ph: '0,00', foco: true })}</div>
        <div data-se="ajuste" hidden>${campo('ajuste', 'Pontos (use menos para tirar)', '', { extra: ' inputmode="numeric" autocomplete="off"', ph: '50 ou -50' })}</div>
        ${campo('nota', 'Nota', '', { opcional: true, ph: 'Ex.: trouxe o Bruno Martins' })}
        <p class="ganho-linha" data-previa></p>
        ${erroForm}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">${icone('coins')}Dar pontos</button></div></footer>
    </form>`;
  }
  function ligarPontos() {
    const f = $('[data-form="pontos"]', painel);
    const c = idx.cliente.get(f.dataset.id);
    const tipo = () => (f.querySelector('input[name="tipo"]:checked') || {}).value;
    const calc = () => {
      const t = tipo();
      if (t === 'gasto') return Math.floor(num(f.valor.value) * regra('pontos_por_euro'));
      if (t === 'indicacao') return Math.round(regra('pontos_por_indicacao'));
      return Math.round(num(f.ajuste.value));
    };
    const atualizar = () => {
      const t = tipo();
      $$('[data-se]', f).forEach((el) => { el.hidden = el.dataset.se !== t; });
      const p = calc();
      $('[data-previa]', f).innerHTML = p ? `${icone('coins')}<span><b>${p > 0 ? '+' : ''}${pts(p)} pontos</b>, fica com ${pts(saldoDe(c.id) + p)}.</span>` : '';
    };
    f.addEventListener('input', atualizar);
    f.addEventListener('change', atualizar);
    atualizar();
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = tipo(), p = calc();
      if (!p) return falhar(f, t === 'gasto' ? 'Escreva quanto gastou.' : 'Escreva quantos pontos.', t === 'gasto' ? f.valor : f.ajuste);
      if (saldoDe(c.id) + p < 0) return falhar(f, `Só tem ${pts(saldoDe(c.id))} pontos.`, f.ajuste);
      const agora = agoraTexto();
      gravar([{ op: 'criar', tabela: 'movimentos', id: novoId(), dados: { data: agora, cliente_id: c.id, tipo: t, valor_eur: t === 'gasto' ? String(num(f.valor.value)) : '', pontos: String(p), premio_id: '', premio_nome: '', custo_eur: '', trabalho_id: '', nota: f.nota.value.trim(), criado_em: agora } }], `${p > 0 ? '+' : ''}${pts(p)} pontos para ${c.nome.split(' ')[0]}.`);
      abrirPainel('cliente', { id: c.id });
    });
  }

  // --- Carro
  function painelCarro({ id, cliente: clienteId } = {}) {
    const k = id ? idx.carro.get(id) : null;
    const hist = k ? idx.trabalhosDoCarro.get(k.id) || [] : [];
    const dono = k ? k.cliente_id : clienteId || '';
    const clientes = [...st.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    const naOficina = hist.find((t) => t.estado !== 'entregue');
    return `<form class="painel-forma" data-form="carro" data-id="${k ? k.id : ''}" novalidate>
      ${cabecaPainel(k ? esc(nomeCarro(k)) : 'Novo carro', k ? plural(hist.length, 'visita', 'visitas') : '', k ? `<div class="placa-topo">${placa(k.matricula, 'grande')}</div>` : '')}
      <div class="painel-corpo" tabindex="-1">
        ${k ? (naOficina
          ? `<p><button class="btn pequeno" type="button" data-abrir="trabalho" data-id="${naOficina.id}"><span class="ponto" data-estado="${naOficina.estado}" aria-hidden="true"></span>Na oficina: ${esc(ESTADOS[naOficina.estado].nome.toLowerCase())}</button></p>`
          : `<p><button class="btn pequeno primario" type="button" data-abrir="entrada" data-carro="${k.id}">${icone('plus')}Dar entrada a este carro</button></p>`) : ''}
        <div class="grupo">
          ${campo('matricula', 'Matrícula', k ? k.matricula : '', { classe: 'campo-matricula', ph: 'AA-00-AA', obrig: true, foco: !k, extra: ' autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12"' })}
          <div class="linha-campos tres">
            ${campo('marca', 'Marca', k ? k.marca : '')}
            ${campo('modelo', 'Modelo', k ? k.modelo : '')}
            ${campo('ano', 'Ano', k ? k.ano : '', { extra: ' inputmode="numeric" maxlength="4"' })}
          </div>
          ${campo('km', 'Quilómetros', k ? k.km : '', { opcional: true, extra: ' inputmode="numeric"' })}
          <label class="campo"><span>Cliente</span><select name="cliente_id"><option value="">Sem cliente</option>${clientes.map((c) => `<option value="${c.id}"${c.id === dono ? ' selected' : ''}>${esc(c.nome)}${c.telemovel ? ' (' + esc(telFormatar(c.telemovel)) + ')' : ''}</option>`).join('')}</select></label>
          ${area('notas', 'Notas', k ? k.notas : '', { opcional: true, linhas: 2 })}
        </div>
        ${k ? `<section class="grupo"><h3 class="titulo-grupo">Visitas</h3>${historicoHtml(hist)}</section>
        <p><button class="btn perigo pequeno" type="button" data-apagar-carro>${icone('trash')}Apagar carro</button></p>` : ''}
        ${erroForm}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">${k ? 'Guardar' : 'Criar carro'}</button></div></footer>
    </form>`;
  }
  function ligarCarro() {
    const f = $('[data-form="carro"]', painel);
    const k = f.dataset.id ? idx.carro.get(f.dataset.id) : null;
    f.matricula.addEventListener('blur', () => { f.matricula.value = matFormatar(f.matricula.value); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const matricula = matFormatar(f.matricula.value);
      const outro = idx.carroPorMat.get(matChave(matricula));
      if (matChave(matricula).length < 4) return falhar(f, 'Escreva a matrícula.', f.matricula);
      if (outro && (!k || outro.id !== k.id)) return falhar(f, `Já existe um carro com a matrícula ${outro.matricula}.`, f.matricula);
      const d = { matricula, marca: f.marca.value.trim(), modelo: f.modelo.value.trim(), ano: soDigitos(f.ano.value), km: soDigitos(f.km.value), cliente_id: f.cliente_id.value, notas: f.notas.value.trim() };
      fecharPainel();
      if (k) gravar([{ op: 'atualizar', tabela: 'carros', id: k.id, dados: d }], 'Carro guardado.');
      else gravar([{ op: 'criar', tabela: 'carros', id: novoId(), dados: { ...d, criado_em: agoraTexto() } }], `${matricula} foi criado.`);
    });
    const apagar = $('[data-apagar-carro]', f);
    if (apagar) apagar.addEventListener('click', () => {
      const n = (idx.trabalhosDoCarro.get(k.id) || []).length;
      if (!confirm(n ? `Apagar ${k.matricula} e ${n === 1 ? 'a sua visita' : 'as suas ' + n + ' visitas'}? Saem também da sheet.` : `Apagar ${k.matricula}? Sai também da sheet.`)) return;
      fecharPainel();
      gravar([
        ...(idx.trabalhosDoCarro.get(k.id) || []).map((t) => ({ op: 'apagar', tabela: 'trabalhos', id: t.id })),
        { op: 'apagar', tabela: 'carros', id: k.id },
      ], 'Carro apagado.');
    });
  }

  // --- Prémio
  function painelPremio({ id } = {}) {
    const p = id ? idx.premio.get(id) : null;
    const n = p ? trocasDe(p.id) : 0;
    return `<form class="painel-forma" data-form="premio" data-id="${p ? p.id : ''}" novalidate>
      ${cabecaPainel(p ? esc(p.nome) : 'Novo prémio', p ? (n ? `Trocado ${plural(n, 'vez', 'vezes')}` : 'Ainda não trocado') : 'O que custa à oficina e quantos pontos pede.')}
      <div class="painel-corpo">
        <div class="grupo">
          ${campo('nome', 'Nome', p ? p.nome : '', { obrig: true, foco: !p, ph: 'Lavagem exterior' })}
          ${campo('descricao', 'O que o cliente vê no site', p ? p.descricao : '', { opcional: true, ph: 'Lavagem exterior do veículo' })}
          <div class="linha-campos">
            ${campo('custo_eur', 'Custa à oficina (€)', p ? String(p.custo_eur || '').replace('.', ',') : '', { extra: ' inputmode="decimal" autocomplete="off"', ph: '5,00' })}
            ${campo('pontos', 'Pontos', p ? p.pontos : '', { extra: ' inputmode="numeric" autocomplete="off"', ph: '170' })}
          </div>
          <div class="sugestao-pts" data-sugestao></div>
          ${campo('stock', 'Quantos há em stock', p ? p.stock : '', { opcional: true, extra: ' inputmode="numeric"', ajuda: 'Deixe vazio se não se compra (lavagens, descontos, serviços). Cada troca tira um.' })}
          ${campo('comprar', 'Onde comprar (link)', p ? p.comprar : '', { tipo: 'url', opcional: true, ph: 'https://...' })}
          ${area('nota', 'Nota da oficina', p ? p.nota : '', { opcional: true, linhas: 2, ph: 'Fornecedor, referência, preço de caixa.' })}
          <label class="interruptor"><input type="checkbox" name="ativo"${!p || ativoP(p) ? ' checked' : ''}><span class="int-trilho" aria-hidden="true"></span><span>Mostrar no site e aceitar trocas</span></label>
        </div>
        ${p && p.comprar ? `<p><a class="btn pequeno" href="${esc(p.comprar)}" target="_blank" rel="noopener">${icone('link')}Abrir o link de compra</a></p>` : ''}
        ${p ? `<p><button class="btn perigo pequeno" type="button" data-apagar-premio>${icone('trash')}Apagar prémio</button></p>` : ''}
        ${erroForm}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">${p ? 'Guardar' : 'Criar prémio'}</button></div></footer>
    </form>`;
  }
  function ligarPremio() {
    const f = $('[data-form="premio"]', painel);
    const p = f.dataset.id ? idx.premio.get(f.dataset.id) : null;
    const alvo = regra('retorno_percent');
    const mostrar = () => {
      const custo = num(f.custo_eur.value), ptsAtual = num(f.pontos.value);
      const caixa = $('[data-sugestao]', f);
      if (!custo) { caixa.innerHTML = ''; return; }
      const sug = pontosSugeridos(custo);
      const ret = ptsAtual ? (custo / (ptsAtual / regra('pontos_por_euro'))) * 100 : null;
      caixa.innerHTML = `${icone('coins')}<span>Aos ${pct(alvo, alvo % 1 ? 1 : 0)}: <b>${pts(sug)} pontos</b>${ret != null ? `. Com ${pts(ptsAtual)} devolve ${pct(ret)}` : ''}.</span>${ptsAtual !== sug ? `<button class="btn texto pequeno" type="button" data-usar-sug="${sug}">Usar ${pts(sug)}</button>` : ''}`;
    };
    f.addEventListener('input', mostrar);
    f.addEventListener('click', (e) => { const b = e.target.closest('[data-usar-sug]'); if (b) { f.pontos.value = b.dataset.usarSug; mostrar(); } });
    mostrar();
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = f.nome.value.trim();
      if (!nome) return falhar(f, 'Escreva o nome do prémio.', f.nome);
      if (!(num(f.pontos.value) > 0)) return falhar(f, 'Quantos pontos pede este prémio?', f.pontos);
      if (f.stock.value.trim() && !temNum(f.stock.value)) return falhar(f, 'O stock é um número, ou fica vazio.', f.stock);
      const d = { nome, descricao: f.descricao.value.trim(), custo_eur: String(num(f.custo_eur.value)), pontos: String(Math.round(num(f.pontos.value))), stock: f.stock.value.trim() ? String(Math.round(num(f.stock.value))) : '', comprar: f.comprar.value.trim(), nota: f.nota.value.trim(), ativo: f.ativo.checked ? 'sim' : 'nao' };
      fecharPainel();
      if (p) gravar([{ op: 'atualizar', tabela: 'premios', id: p.id, dados: d }], 'Prémio guardado.');
      else gravar([{ op: 'criar', tabela: 'premios', id: sem(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + novoId().slice(-4), dados: { ...d, criado_em: agoraTexto() } }], `${nome} foi criado.`);
    });
    const apagar = $('[data-apagar-premio]', f);
    if (apagar) apagar.addEventListener('click', () => {
      if (!confirm(`Apagar ${p.nome}? As trocas já feitas ficam no histórico. Para só o esconder do site, desligue "Mostrar no site".`)) return;
      fecharPainel();
      gravar([{ op: 'apagar', tabela: 'premios', id: p.id }], 'Prémio apagado.');
    });
  }

  // --- Regras
  function painelRegras() {
    return `<form class="painel-forma compacto" data-form="regras" novalidate>
      ${cabecaPainel('Regras', 'Mudar aqui não mexe nos pontos já dados.')}
      <div class="painel-corpo">
        <div class="linha-campos">
          ${campo('pontos_por_euro', 'Pontos por euro gasto', regra('pontos_por_euro'), { extra: ' inputmode="decimal"' })}
          ${campo('retorno_percent', 'Devolve ao cliente (%)', String(regra('retorno_percent')).replace('.', ','), { extra: ' inputmode="decimal"', ajuda: 'Parte do que gasta que lhe volta em prémios.' })}
        </div>
        <div class="linha-campos">
          ${campo('pontos_por_indicacao', 'Pontos por indicação', regra('pontos_por_indicacao'), { extra: ' inputmode="numeric"' })}
          ${campo('objetivo_semana', 'Objetivo: carros por semana', regra('objetivo_semana'), { extra: ' inputmode="numeric"' })}
        </div>
        <p class="ganho-linha" data-previa></p>
        ${erroForm}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">Guardar</button></div></footer>
    </form>`;
  }
  function ligarRegras() {
    const f = $('[data-form="regras"]', painel);
    const previa = () => {
      const ppe = num(f.pontos_por_euro.value), ret = num(f.retorno_percent.value);
      $('[data-previa]', f).innerHTML = ppe && ret ? `${icone('coins')}<span>Quem gasta 100 € ganha <b>${pts(100 * ppe)} pontos</b>, que valem <b>${esc(eur(ret))}</b> em prémios. Cada ponto custa ${esc(eur(ret / 100 / ppe))}.</span>` : '';
    };
    f.addEventListener('input', previa);
    previa();
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const campos = ['pontos_por_euro', 'retorno_percent', 'pontos_por_indicacao', 'objetivo_semana'];
      for (const k of campos) if (!(num(f[k].value) > 0)) return falhar(f, 'Todos os valores têm de ser maiores que zero.', f[k]);
      const ops = campos.map((k) => {
        const existe = st.regras.find((r) => r.id === k);
        return { op: existe ? 'atualizar' : 'criar', tabela: 'regras', id: k, dados: { valor: String(num(f[k].value)) } };
      });
      fecharPainel();
      gravar(ops, 'Regras guardadas.');
    });
  }

  // --- Ligação à Google Sheet
  function painelLigacao() {
    const l = ler('ig.ligacao', {});
    const url = l.apiUrl || CFG.apiUrl || '';
    const problema = ['pin', 'sem-pin', 'versao'].includes(st.codigoErro);
    return `<form class="painel-forma" data-form="ligacao" novalidate>
      ${cabecaPainel('Ligação à Google Sheet', 'A sheet INOVACAR Pontos guarda tudo. Cada aparelho escreve o PIN uma vez.')}
      <div class="painel-corpo">
        ${problema ? `<p class="estado-ligacao erro">${esc(st.erro)}</p>` : ''}
        <div class="grupo">
          ${campo('pin', 'PIN da gestão', l.pin || '', { tipo: 'password', foco: true, extra: ' autocomplete="current-password"', ajuda: 'O PIN definido na sheet (menu INOVACAR, Definir PIN da gestão). Fica só neste aparelho.' })}
          <details class="avancado"${CFG.apiUrl ? '' : ' open'}><summary>URL do script</summary>
            ${campo('apiUrl', 'URL da aplicação web', url, { tipo: 'url', ph: 'https://script.google.com/macros/s/.../exec', ajuda: CFG.apiUrl ? 'Já vem configurado. Só muda se o script mudar de endereço.' : '' })}
          </details>
        </div>
        <p class="estado-ligacao" data-estado-ligacao hidden></p>
        <section class="grupo">
          <h3 class="titulo-grupo">Primeira vez</h3>
          <ol class="passos">
            <li>Na sheet: Extensões, Apps Script. Substitua o código pelo ficheiro <code>sheets/Codigo.gs</code> do repositório e guarde.</li>
            <li>Volte à sheet e recarregue. No menu <b>INOVACAR</b>, escolha <b>Definir PIN da gestão</b>.</li>
            <li>No Apps Script: Implementar, Gerir implementações, lápis, Versão: Nova versão, Implementar. O URL fica o mesmo.</li>
            <li>Escreva aqui o PIN e carregue em Testar e ligar.</li>
          </ol>
        </section>
        <p>${emDemo() && ligacao().apiUrl ? '' : '<button class="btn texto pequeno" type="button" data-usar-demo>Ver a demonstração</button>'}</p>
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">Testar e ligar</button></div></footer>
    </form>`;
  }

  function ligarLigacao() {
    const f = $('[data-form="ligacao"]', painel);
    const estado = $('[data-estado-ligacao]', f);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const apiUrl = f.apiUrl.value.trim(), pin = f.pin.value;
      const btn = $('button[type="submit"]', f);
      const mostra = (txt, cls) => { estado.textContent = txt; estado.className = 'estado-ligacao ' + (cls || ''); estado.hidden = false; if (cls === 'erro') abanar(estado); };
      if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(apiUrl)) return mostra('O URL deve começar por https://script.google.com/macros/s/ e acabar em /exec.', 'erro');
      if (!pin) return mostra('Escreva o PIN.', 'erro');
      btn.setAttribute('aria-busy', 'true');
      mostra('A testar...');
      const antes = ler('ig.ligacao', {}), demoAntes = ler('ig.forcarDemo', false);
      guardar('ig.ligacao', { apiUrl: apiUrl === CFG.apiUrl ? '' : apiUrl, pin });
      guardar('ig.forcarDemo', false);
      try {
        const j = await chamar({ action: 'listar' });
        mostra(`Ligado. ${plural(j.clientes.length, 'cliente', 'clientes')}, ${plural(j.carros.length, 'carro', 'carros')} e ${plural((j.premios || []).length, 'prémio', 'prémios')} na sheet.`, 'ok');
        if ((antes.apiUrl || CFG.apiUrl) !== apiUrl || demoAntes) { st.pendentes = []; guardar('ig.pendentes', []); }
        st.erro = null; st.codigoErro = null; st.carregado = false;
        setTimeout(() => { fecharPainel(); carregar(); }, 700);
      } catch (err) {
        guardar('ig.ligacao', antes); guardar('ig.forcarDemo', demoAntes);
        mostra(err.codigo === 'pin' ? 'PIN errado. Confirme o PIN definido na sheet.' : err.message || 'Não foi possível ligar.', 'erro');
      } finally {
        btn.removeAttribute('aria-busy');
      }
    });
    const demoBtn = $('[data-usar-demo]', f);
    if (demoBtn) demoBtn.addEventListener('click', () => {
      guardar('ig.forcarDemo', true);
      st.pendentes = []; guardar('ig.pendentes', []);
      st.erro = null; st.codigoErro = null; st.carregado = false;
      fecharPainel();
      carregar();
    });
  }

  function ligarPainel(tipo) {
    ({ entrada: ligarEntrada, trabalho: ligarTrabalho, cliente: ligarCliente, carro: ligarCarro, ligacao: ligarLigacao, entregar: ligarEntregar, trocar: ligarTrocar, pontos: ligarPontos, premio: ligarPremio, regras: ligarRegras, pausar: ligarPausar }[tipo] || (() => {}))();
  }

  function ajustarPremios() {
    const alvo = regra('retorno_percent');
    const ops = st.premios.filter((p) => num(p.custo_eur) > 0 && num(p.pontos) !== pontosSugeridos(p.custo_eur))
      .map((p) => ({ op: 'atualizar', tabela: 'premios', id: p.id, dados: { pontos: String(pontosSugeridos(p.custo_eur)) } }));
    if (!ops.length) return;
    if (!confirm(`Pôr ${plural(ops.length, 'prémio', 'prémios')} nos ${pct(alvo, alvo % 1 ? 1 : 0)}? Os pontos pedidos mudam também no site.`)) return;
    gravar(ops, `${plural(ops.length, 'prémio ajustado', 'prémios ajustados')} aos ${pct(alvo, alvo % 1 ? 1 : 0)}.`);
  }

  // ---------------------------------------------------------------- toast e dicas
  let tToast;
  function toast(msg, ic = 'check') {
    const el = toastEl;
    // Com um painel aberto, o aviso vai para dentro dele, para não ficar por baixo do fundo escuro.
    const casa = painel.open ? painel : document.body;
    if (el.parentElement !== casa) casa.appendChild(el);
    el.innerHTML = `${icone(ic)}<span>${esc(msg)}</span>`;
    el.hidden = false;
    el.classList.remove('sai');
    if (!reduzir()) el.animate([{ opacity: 0, transform: 'translate(-50%, 16px) scale(.96)' }, { opacity: 1, transform: 'translate(-50%, -2px)' }, { transform: 'translate(-50%, 0)' }], { duration: 340, easing: E.emph });
    clearTimeout(tToast);
    tToast = setTimeout(async () => {
      if (!reduzir()) await el.animate([{ opacity: 1, transform: 'translate(-50%, 0)' }, { opacity: 0, transform: 'translate(-50%, 10px)' }], { duration: 180, easing: E.sai }).finished;
      el.hidden = true;
    }, 3400);
  }

  const dica = $('[data-dica-flutuante]');
  function mostrarDica(alvo) {
    const txt = alvo.dataset.dica;
    if (!txt) return;
    dica.textContent = txt;
    dica.hidden = false;
    const r = alvo.getBoundingClientRect(), d = dica.getBoundingClientRect();
    dica.style.left = `${Math.max(8, Math.min(innerWidth - d.width - 8, r.left + r.width / 2 - d.width / 2))}px`;
    dica.style.top = `${Math.max(8, r.top - d.height - 8)}px`;
  }
  document.addEventListener('pointerover', (e) => { const a = e.target.closest('[data-dica]'); if (a) mostrarDica(a); else dica.hidden = true; });
  document.addEventListener('focusin', (e) => { const a = e.target.closest && e.target.closest('[data-dica]'); if (a) mostrarDica(a); else dica.hidden = true; });
  window.addEventListener('scroll', () => { dica.hidden = true; }, { passive: true });

  // ---------------------------------------------------------------- eventos
  document.addEventListener('click', (e) => {
    const abrir = e.target.closest('[data-abrir]');
    if (abrir) {
      e.preventDefault();
      abrirPainel(abrir.dataset.abrir, { id: abrir.dataset.id, carroId: abrir.dataset.carro, cliente: abrir.dataset.cliente });
      return;
    }
    const linha = e.target.closest('[data-abrir-linha]');
    if (linha) { abrirPainel(linha.dataset.abrirLinha, { id: linha.dataset.id }); return; }
    const av = e.target.closest('[data-avancar]');
    if (av) { avancar(av.dataset.avancar); return; }
    const pa = e.target.closest('[data-pausar]');
    if (pa) { abrirPainel('pausar', { id: pa.dataset.pausar }); return; }
    const re = e.target.closest('[data-retomar]');
    if (re) { retomar(re.dataset.retomar); return; }
    if (e.target.closest('[data-fechar]')) { fecharPainel(); return; }
    const fx = e.target.closest('[data-faixa]');
    if (fx) { st.faixa = fx.dataset.faixa; vistaAnterior = null; desenhar(); return; }
    const pr = e.target.closest('[data-periodo]');
    if (pr) { st.periodo = pr.dataset.periodo; vistaAnterior = null; desenhar(); return; }
    if (e.target.closest('[data-acao="ajustar-premios"]')) { ajustarPremios(); return; }
    if (e.target.closest('[data-acao="recarregar"]')) { st.erro = null; carregar(); }
  });
  document.addEventListener('keydown', (e) => {
    const linha = e.target.closest && e.target.closest('[data-abrir-linha]');
    if (linha && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirPainel(linha.dataset.abrirLinha, { id: linha.dataset.id }); }
    if (e.key === '/' && !painel.open && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      const b = $('[data-busca]');
      if (b) { e.preventDefault(); b.focus(); }
    }
  });
  document.addEventListener('input', (e) => {
    const b = e.target.closest('[data-busca]');
    if (b) { st.busca[b.dataset.busca] = b.value; desenhar(); }
  });
  window.addEventListener('hashchange', () => { fecharPainel(); desenhar(); $('[data-conteudo]').focus({ preventScroll: true }); window.scrollTo(0, 0); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') carregar({ silencioso: true }); });
  window.addEventListener('online', () => enviar());
  let tRedim;
  let larguraAntes = innerWidth;
  window.addEventListener('resize', () => { clearTimeout(tRedim); tRedim = setTimeout(() => { if (innerWidth !== larguraAntes && vistaAtual() === 'relatorios') { larguraAntes = innerWidth; desenhar(); } }, 200); });

  // O tempo corre: os relógios dos cartões mudam a cada minuto.
  setInterval(() => { if (!painel.open && !(document.activeElement && document.activeElement.matches('[data-busca]'))) desenhar(); }, 30000);
  setInterval(() => { if (document.visibilityState === 'visible' && !painel.open) carregar({ silencioso: true }); }, Math.max(20, CFG.atualizarCada || 60) * 1000);

  // ---------------------------------------------------------------- arranque
  $('[data-abrir="ligacao"]').innerHTML = icone('gear');
  $$('[data-icone]').forEach((el) => { el.outerHTML = icone(el.dataset.icone); });
  const cache = ler('ig.cache', null);
  if (!emDemo() && cache && cache.url === ligacao().apiUrl) {
    TABELAS.forEach((t) => { st[t] = cache[t] || []; });
    st.carregado = true;
    indexar();
  } else indexar();
  desenhar();
  if (!emDemo() && !ligacao().pin) { st.codigoErro = null; abrirPainel('ligacao'); }
  else carregar();
})();
