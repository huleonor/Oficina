/* INOVACAR Gestão: contar o tempo de cada carro (matrícula, modelo e dono). A Google Sheet guarda os registos. */
(() => {
  'use strict';

  const CFG = window.GESTAO || {};
  const ICONES = window.ICONES || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------------------------------------------------------------- utilidades
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icone = (nome) => `<svg class="ico" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${ICONES[nome] || ''}</svg>`;
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const limpar = (s) => String(s || '').trim().replace(/\s+/g, ' ');
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço */ } };
  const ler = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

  // Matrículas: guardadas como AA-00-AA; comparadas sem hífenes.
  const matChave = (m) => String(m || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const matFormatar = (m) => { const k = matChave(m); return k.length === 6 ? `${k.slice(0, 2)}-${k.slice(2, 4)}-${k.slice(4)}` : k; };
  const placa = (m) => (m
    ? `<span class="placa" aria-label="Matrícula ${esc(m)}"><span class="placa-ue" aria-hidden="true">P</span><span class="placa-txt">${esc(m)}</span></span>`
    : '<span class="placa vazia"><span class="placa-txt">Sem matrícula</span></span>');

  // ---------------------------------------------------------------- datas e tempos
  // Na sheet as datas ficam legíveis, na hora local: "2026-11-12 09:12:30".
  const pad = (n) => String(n).padStart(2, '0');
  const paraTexto = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const data = (s) => {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m && !/Z|[+-]\d{2}:?\d{2}$/.test(String(s))) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  function diaTexto(d) {
    const hoje = new Date(), ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
    if (mesmoDia(d, hoje)) return 'Hoje';
    if (mesmoDia(d, ontem)) return 'Ontem';
    return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== hoje.getFullYear() ? ' ' + d.getFullYear() : ''}`;
  }
  const hora = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const MIN = 60000, HORA = 60 * MIN;
  // "1 h 25 min", "40 min", "45 s".
  function duracao(ms) {
    ms = Math.max(0, ms || 0);
    if (ms < MIN) return `${Math.round(ms / 1000)} s`;
    const h = Math.floor(ms / HORA), m = Math.round((ms % HORA) / MIN);
    if (!h) return `${m} min`;
    return m === 60 ? `${h + 1} h` : m ? `${h} h ${m} min` : `${h} h`;
  }
  // O relógio: "1:05:09".
  const relogio = (ms) => { const s = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

  // ---------------------------------------------------------------- estado
  // Abas da sheet: Gestão Clientes (o dono), Gestão Carros (matrícula e modelo) e Gestão Trabalhos (um por tempo).
  const TABELAS = ['clientes', 'carros', 'trabalhos'];
  const st = { animando: 0, clientes: [], carros: [], trabalhos: [], pagina: 'contar', carregado: false, erro: null, codigoErro: null, pendentes: ler('tp.pendentes', []), enviando: false, lendo: false, busca: '' };

  const ligacao = () => { const l = ler('ig.ligacao', {}); return { apiUrl: (l.apiUrl || CFG.apiUrl || '').trim(), pin: l.pin || '' }; };
  const emDemo = () => !ligacao().apiUrl || ler('ig.forcarDemo', false);

  const carroDe = (t) => st.carros.find((c) => c.id === t.carro_id);
  const donoDe = (c) => (c ? st.clientes.find((x) => x.id === c.cliente_id) : null);
  const nomeModelo = (c) => (c ? [c.marca, c.modelo].filter(Boolean).join(' ') : '') || 'Sem modelo';
  const carroPorMat = (m) => { const k = matChave(m); return k ? st.carros.find((c) => matChave(c.matricula) === k) : null; };
  const info = (t) => { const c = carroDe(t), d = donoDe(c); return { matricula: c ? c.matricula : '', modelo: nomeModelo(c), dono: d ? d.nome : '', servico: limpar(t.servico) }; };
  const aContar = (t) => t.estado === 'curso' && t.inicio && !t.pronto;
  const terminado = (t) => !!(t.inicio && t.pronto);

  function tempo(t, agora = new Date()) {
    const i = data(t.inicio);
    if (!i) return 0;
    const fim = data(t.pronto) || agora;
    const pausaAgora = t.pausado_em && !t.pronto ? fim - data(t.pausado_em) : 0;
    return Math.max(0, fim - i - num(t.pausa_min) * MIN - pausaAgora);
  }

  // ---------------------------------------------------------------- sheet (Apps Script) ou demonstração
  async function chamar(corpo) {
    if (emDemo()) return demo.chamar(corpo);
    const { apiUrl, pin } = ligacao();
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

  const demo = {
    dados: () => ler('tp.demo3', null) || semente(),
    async chamar(corpo) {
      await new Promise((r) => setTimeout(r, 150));
      const d = this.dados();
      if (corpo.action === 'gravar') aplicar(d, corpo.operacoes || []);
      guardar('tp.demo3', d);
      return { ok: true, ...JSON.parse(JSON.stringify(d)) };
    },
  };
  function semente() {
    const donos = ['Ana Sousa', 'Bruno Martins', 'Jorge Abrantes', 'Marta Pinho'];
    const clientes = donos.map((nome, k) => ({ id: 'c' + k, nome, telemovel: '', criado_em: '' }));
    const carros = [['45-QX-12', 'Peugeot 208'], ['AB-12-CD', 'Renault Clio'], ['27-LM-88', 'Volkswagen Golf'], ['BE-04-RT', 'Toyota Yaris']]
      .map(([matricula, modelo], k) => ({ id: 'm' + k, cliente_id: 'c' + k, matricula, marca: '', modelo, criado_em: '' }));
    const trabalhos = [];
    const agora = new Date();
    for (let k = 0; k < 10; k++) {
      const ini = new Date(agora); ini.setDate(ini.getDate() - 1 - Math.floor(k / 3)); ini.setHours(9 + (k % 3) * 3, 10 * (k % 5), 0, 0);
      const fim = new Date(ini.getTime() + (35 + ((k * 37) % 150)) * MIN);
      trabalhos.push({ id: 't' + k, carro_id: 'm' + (k % 4), servico: ['Travões', 'Mudança de óleo', ''][k % 3], estado: 'pronto', entrada: paraTexto(ini), inicio: paraTexto(ini), pronto: paraTexto(fim), pausado_em: '', pausa_min: '', criado_em: paraTexto(ini) });
    }
    const ini = new Date(agora.getTime() - 47 * MIN);
    trabalhos.push({ id: 'tx', carro_id: 'm0', servico: '', estado: 'curso', entrada: paraTexto(ini), inicio: paraTexto(ini), pronto: '', pausado_em: '', pausa_min: '', criado_em: paraTexto(ini) });
    return { clientes, carros, trabalhos };
  }

  const cacheAtual = () => ({ url: ligacao().apiUrl, ...Object.fromEntries(TABELAS.map((t) => [t, st[t]])) });

  async function carregar() {
    if (st.lendo) return;
    st.lendo = true;
    desenharSync();
    try {
      if (st.pendentes.length) await enviar();
      const j = await chamar({ action: 'listar' });
      const base = Object.fromEntries(TABELAS.map((t) => [t, j[t] || []]));
      aplicar(base, st.pendentes);
      Object.assign(st, base, { carregado: true, erro: null, codigoErro: null });
      if (!emDemo()) guardar('tp.cache', cacheAtual());
    } catch (err) {
      st.erro = err.message || String(err);
      st.codigoErro = err.codigo || 'rede';
    } finally {
      st.lendo = false;
      desenhar();
    }
  }

  function gravar(ops, msg, adiar = 0) {
    aplicar(st, ops);
    st.pendentes.push(...ops);
    guardar('tp.pendentes', st.pendentes);
    if (!emDemo()) guardar('tp.cache', cacheAtual());
    if (adiar) { st.animando++; setTimeout(() => { st.animando--; desenhar(); }, adiar); } else desenhar();
    if (msg) toast(msg);
    enviar();
  }

  let tentarDeNovo = null;
  async function enviar() {
    if (st.enviando || !st.pendentes.length) return;
    st.enviando = true;
    desenharSync();
    const lote = st.pendentes.slice();
    try {
      await chamar({ action: 'gravar', operacoes: lote });
      st.pendentes = st.pendentes.slice(lote.length);
      guardar('tp.pendentes', st.pendentes);
      if (st.erro && st.carregado) { st.erro = null; st.codigoErro = null; desenharAviso(); }
    } catch (err) {
      st.erro = err.message || String(err);
      st.codigoErro = err.codigo || 'rede';
      desenharAviso();
      clearTimeout(tentarDeNovo);
      tentarDeNovo = setTimeout(enviar, 15000);
    } finally {
      st.enviando = false;
      desenharSync();
    }
    if (st.pendentes.length && !st.erro) enviar();
  }

  // ---------------------------------------------------------------- ações
  // O carro (pela matrícula) e o dono (pelo nome): usa os que já existem, cria os que faltam.
  function carroOps(matricula, modelo, dono) {
    const ops = [];
    const agora = paraTexto(new Date());
    let clienteId = '';
    if (dono) {
      const c = st.clientes.find((x) => sem(x.nome) === sem(dono));
      if (c) clienteId = c.id;
      else { clienteId = novoId(); ops.push({ op: 'criar', tabela: 'clientes', id: clienteId, dados: { nome: dono, criado_em: agora } }); }
    }
    const carro = carroPorMat(matricula);
    if (!carro) {
      const id = novoId();
      ops.push({ op: 'criar', tabela: 'carros', id, dados: { cliente_id: clienteId, matricula, marca: '', modelo, criado_em: agora } });
      return { id, ops };
    }
    const dados = {};
    if (modelo && sem(modelo) !== sem(nomeModelo(carro))) { dados.marca = ''; dados.modelo = modelo; }
    if (clienteId && clienteId !== carro.cliente_id) dados.cliente_id = clienteId;
    if (Object.keys(dados).length) ops.push({ op: 'atualizar', tabela: 'carros', id: carro.id, dados });
    return { id: carro.id, ops };
  }

  function comecar(matricula, modelo, dono, servico) {
    const c = carroOps(matricula, modelo, dono);
    const agora = paraTexto(new Date());
    gravar([...c.ops, { op: 'criar', tabela: 'trabalhos', id: novoId(), dados: { carro_id: c.id, servico, estado: 'curso', entrada: agora, inicio: agora, pronto: '', pausado_em: '', pausa_min: '', criado_em: agora } }], `${matricula}: a contar.`);
  }
  const trab = (id) => st.trabalhos.find((t) => t.id === id);
  function pausar(id) { gravar([{ op: 'atualizar', tabela: 'trabalhos', id, dados: { pausado_em: paraTexto(new Date()) } }], 'Em pausa.'); }
  function retomar(id) {
    const t = trab(id);
    const somar = (new Date() - data(t.pausado_em)) / MIN;
    gravar([{ op: 'atualizar', tabela: 'trabalhos', id, dados: { pausado_em: '', pausa_min: (num(t.pausa_min) + somar).toFixed(2) } }], 'A contar de novo.');
  }
  function terminar(id) {
    const t = trab(id);
    const agora = new Date();
    const dados = { estado: 'pronto', pronto: paraTexto(agora) };
    if (t.pausado_em) { dados.pausa_min = (num(t.pausa_min) + (agora - data(t.pausado_em)) / MIN).toFixed(2); dados.pausado_em = ''; }
    const fim = duracao(tempo({ ...t, ...dados }));
    const card = $(`.crono[data-id="${CSS.escape(id)}"]`);
    const anima = card && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (anima) animarFim(card, fim);
    gravar([{ op: 'atualizar', tabela: 'trabalhos', id, dados }], `Terminado: ${fim}.`, anima ? 2100 : 0);
  }

  // O cartão fica verde, aparece o visto com o tempo, o carro sai pela direita e o cartão fecha.
  function animarFim(card, fim) {
    card.classList.add('terminando');
    card.style.height = `${card.offsetHeight}px`;
    card.insertAdjacentHTML('beforeend', `<div class="fim" aria-hidden="true">
      <span class="fim-visto">${icone('check')}${Array.from({ length: 10 }, (_, k) => `<i class="fim-ponto" style="--a:${k * 36}deg;--d:${(k % 3) * 40}ms"></i>`).join('')}</span>
      <span class="fim-txt">Terminado</span>
      <span class="fim-tempo">${esc(fim)}</span>
      <span class="fim-estrada"><span class="fim-carro">${icone('car-profile-fill')}</span></span>
    </div>`);
    setTimeout(() => card.classList.add('a-sair'), 1500);
  }
  function apagar(id) {
    const t = trab(id);
    if (!t) return;
    const i = info(t);
    if (!confirm(`Apagar o tempo de ${i.matricula || i.modelo}?`)) return;
    gravar([{ op: 'apagar', tabela: 'trabalhos', id }], 'Apagado.');
  }

  // ---------------------------------------------------------------- desenho
  const conteudo = $('[data-conteudo]');

  function desenhar() {
    desenharSync();
    desenharAviso();
    if (st.animando) return; // uma animação a decorrer; redesenha quando acabar
    const foco = document.activeElement && document.activeElement.name;
    const form = $('[data-form="novo"]');
    conteudo.innerHTML = st.pagina === 'relatorio' ? vistaRelatorio() : vistaAContar();
    $$('[data-pagina]').forEach((el) => el.setAttribute('aria-current', el.dataset.pagina === st.pagina ? 'page' : 'false'));
    if (foco && $(`[name="${foco}"]`)) {
      const el = $(`[name="${foco}"]`);
      el.focus();
      if (el.setSelectionRange && /text|search/.test(el.type)) el.setSelectionRange(el.value.length, el.value.length);
    }
    tique();
  }

  // Os serviços já usados (o mais usado primeiro), para sugerir e para escrever sempre igual.
  function servicosUsados() {
    const n = new Map();
    st.trabalhos.forEach((t) => { const x = limpar(t.servico); if (x) { const k = sem(x); const u = n.get(k) || { nome: x, n: 0 }; u.n++; n.set(k, u); } });
    return [...n.values()].sort((a, b) => b.n - a.n).map((u) => u.nome);
  }
  const nomeServico = (x) => servicosUsados().find((s) => sem(s) === sem(x)) || (x.charAt(0).toUpperCase() + x.slice(1));

  function vistaNovo(v = {}) {
    const modelos = [...new Set(st.carros.map(nomeModelo).filter((n) => n !== 'Sem modelo'))].sort((x, y) => x.localeCompare(y, 'pt'));
    const donos = [...new Set(st.clientes.map((c) => limpar(c.nome)).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pt'));
    const campo = (n, nome, rotulo, ic, valor, extra, depois = '') => `<div class="passo">
          <span class="passo-n" aria-hidden="true">${n}</span>
          <div class="passo-corpo">
            <label class="rotulo" for="f-${nome}">${rotulo}</label>
            <div class="campo-icone">${icone(ic)}<input id="f-${nome}" name="${nome}" type="text" value="${esc(valor || '')}" ${extra}></div>
            ${depois}
          </div>
        </div>`;
    return `<section class="bloco novo" aria-labelledby="t-novo">
      <header class="novo-cabeca">
        <div><h2 id="t-novo" class="titulo">Adicionar carro</h2>
        <p class="ajuda">Matrícula, modelo e dono. O serviço é opcional.</p></div>
        <button class="btn-icone" type="button" data-fechar aria-label="Fechar">${icone('x')}</button>
      </header>
      <form data-form="novo" novalidate autocomplete="off">
        ${campo(1, 'matricula', 'Matrícula', 'tag', v.matricula, 'class="mat" placeholder="AA-00-AA" maxlength="10" autocapitalize="characters" spellcheck="false" enterkeyhint="next"', '<p class="encontrado" data-encontrado hidden></p>')}
        ${campo(2, 'modelo', 'Modelo do carro', 'car-profile', v.modelo, 'list="modelos" placeholder="Ex.: Peugeot 208" autocapitalize="words" enterkeyhint="next"')}
        ${campo(3, 'dono', 'Nome do dono', 'user', v.dono, 'list="donos" placeholder="Ex.: Ana Sousa" autocapitalize="words" enterkeyhint="next"')}
        ${campo(4, 'servico', 'Serviço <span class="opcional">(opcional)</span>', 'wrench', v.servico, 'list="servicos" placeholder="Ex.: Travões" autocapitalize="sentences" enterkeyhint="go"')}
        <datalist id="modelos">${modelos.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
        <datalist id="servicos">${[...new Set([...servicosUsados(), ...(CFG.servicos || []).filter((x) => sem(x) !== 'outro')].map(limpar))].map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
        <datalist id="donos">${donos.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
        <p class="erro-form" data-erro role="alert" hidden></p>
        <div class="novo-pe">
          <button class="btn primario grande" type="submit">${icone('play')}<span>Começar a contar</span></button>
        </div>
      </form>
    </section>`;
  }

  function ligarNovo() {
    const f = $('[data-form="novo"]');
    const encontrado = $('[data-encontrado]', f);
    // Uma matrícula conhecida preenche o modelo e o dono.
    const verMatricula = (preencher) => {
      const c = carroPorMat(f.matricula.value);
      if (!c || matChave(f.matricula.value).length < 6) { encontrado.hidden = true; return; }
      const d = donoDe(c);
      if (preencher) {
        if (!f.modelo.value.trim() && nomeModelo(c) !== 'Sem modelo') f.modelo.value = nomeModelo(c);
        if (!f.dono.value.trim() && d) f.dono.value = d.nome;
      }
      encontrado.innerHTML = `${icone('check-circle')}<span>Carro já conhecido: modelo e dono preenchidos.</span>`;
      encontrado.hidden = false;
    };
    verMatricula(false);
    f.matricula.addEventListener('input', () => {
      const k = matChave(f.matricula.value);
      if (k.length === 6) f.matricula.value = matFormatar(k);
      verMatricula(true);
    });
    f.matricula.addEventListener('blur', () => { f.matricula.value = matFormatar(f.matricula.value); });
    // Enter passa ao campo seguinte; no último, começa.
    [['matricula', 'modelo'], ['modelo', 'dono'], ['dono', 'servico']].forEach(([de, para]) => f[de].addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && f[de].value.trim()) { e.preventDefault(); f[para].focus(); }
    }));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const matricula = matFormatar(f.matricula.value);
      const modelo = limpar(f.modelo.value);
      const dono = limpar(f.dono.value);
      const servico = limpar(f.servico.value) ? nomeServico(limpar(f.servico.value)) : '';
      const erro = $('[data-erro]', f);
      const falta = !matricula ? ['Escreva a matrícula.', f.matricula] : !modelo ? ['Escreva o modelo do carro.', f.modelo] : !dono ? ['Escreva o nome do dono.', f.dono] : null;
      if (falta) { erro.textContent = falta[0]; erro.hidden = false; falta[1].focus(); return; }
      const ja = st.trabalhos.find((t) => aContar(t) && matChave(info(t).matricula) === matChave(matricula));
      if (ja) { erro.textContent = `O ${matricula} já está a contar.`; erro.hidden = false; return; }
      guardar('tp.ultimo2', {});
      f.reset();
      painel.close();
      comecar(matricula, modelo, dono, servico);
    });
  }

  // Os carros a contar, pela ordem em que começaram (o primeiro a entrar primeiro).
  function vistaAContar() {
    const lista = st.trabalhos.filter(aContar).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
    return `<div class="cabeca-pagina">
      <h1 class="titulo-pagina">A contar <span class="conta">${lista.length}</span></h1>
      <button class="btn primario" type="button" data-adicionar>${icone('plus')}<span>Adicionar carro</span></button>
    </div>
    ${lista.length
      ? `<ol class="cronos centro">${lista.map((t, i) => crono(t, i + 1)).join('')}</ol>`
      : `<div class="vazio-contar grande">${icone('timer')}<p>Nenhum carro a contar.</p><small>Carregue em Adicionar carro para começar.</small>
          <button class="btn primario grande" type="button" data-adicionar>${icone('plus')}<span>Adicionar carro</span></button></div>`}`;
  }

  function abrirNovo() {
    painel.classList.add('painel-novo');
    painel.innerHTML = vistaNovo(ler('tp.ultimo2', {}));
    painel.showModal();
    ligarNovo();
    painel.querySelector('[name="matricula"]').focus();
  }

  function crono(t, ordem = 0) {
    const i = info(t);
    const pausa = !!t.pausado_em;
    const ini = data(t.inicio);
    return `<li class="crono${pausa ? ' em-pausa' : ''}" data-id="${esc(t.id)}">
      <div class="crono-cima">
        <div class="crono-carro">
          <div class="crono-topo">${ordem ? `<span class="ordem" title="Ordem de entrada">${ordem}º</span>` : ''}${placa(i.matricula)}</div>
          <p class="crono-modelo">${esc(i.modelo)}</p>
          ${i.dono ? `<p class="crono-dono">${icone('user')}${esc(i.dono)}</p>` : ''}
          ${i.servico ? `<p class="crono-dono">${icone('wrench')}${esc(i.servico)}</p>` : ''}
        </div>
        <button class="btn-icone" type="button" data-apagar="${esc(t.id)}" aria-label="Apagar este tempo" title="Apagar">${icone('trash')}</button>
      </div>
      <p class="relogio" data-relogio="${esc(t.id)}" aria-live="off">${relogio(tempo(t))}</p>
      <p class="crono-info">${pausa ? '<span class="selo-pausa">Em pausa</span> ' : ''}Começou ${diaTexto(ini).toLowerCase()} às ${hora(ini)}.</p>
      <div class="crono-acoes">
        ${pausa
          ? `<button class="btn" type="button" data-retomar="${esc(t.id)}">${icone('play')}<span>Retomar</span></button>`
          : `<button class="btn" type="button" data-pausar="${esc(t.id)}">${icone('pause')}<span>Pausar</span></button>`}
        <button class="btn primario" type="button" data-terminar="${esc(t.id)}">${icone('flag-checkered')}<span>Terminar</span></button>
      </div>
    </li>`;
  }

  function vistaRelatorio() {
    const q = sem(st.busca), qm = matChave(st.busca);
    const todos = st.trabalhos.filter(terminado).sort((a, b) => String(b.pronto).localeCompare(String(a.pronto)));
    const lista = q ? todos.filter((t) => { const i = info(t); return sem(`${i.modelo} ${i.dono} ${i.servico}`).includes(q) || (qm && matChave(i.matricula).includes(qm)); }) : todos;
    const total = lista.reduce((x, t) => x + tempo(t), 0);
    const dias = [];
    lista.slice(0, 300).forEach((t) => {
      const d = diaTexto(data(t.pronto));
      if (!dias.length || dias[dias.length - 1].dia !== d) dias.push({ dia: d, itens: [] });
      dias[dias.length - 1].itens.push(t);
    });
    return `<div class="cabeca-pagina">
      <h1 class="titulo-pagina">Relatório</h1>
      ${todos.length ? `<label class="busca">${icone('magnifying-glass')}<input name="busca" type="search" placeholder="Procurar matrícula, dono, serviço…" value="${esc(st.busca)}" aria-label="Procurar"></label>` : ''}
    </div>
    ${lista.length ? `<div class="resumo">
      <div class="numero"><small>Carros terminados</small><b>${lista.length}</b></div>
      <div class="numero"><small>Tempo total</small><b>${duracao(total)}</b></div>
      <div class="numero"><small>Média por carro</small><b>${duracao(total / lista.length)}</b></div>
    </div>` : ''}
    ${(() => {
      const g = new Map();
      lista.forEach((t) => { const x = limpar(t.servico); if (!x) return; const k = sem(x); const u = g.get(k) || { nome: x, soma: 0, n: 0 }; u.soma += tempo(t); u.n++; g.set(k, u); });
      const m = [...g.values()].sort((a, b) => b.n - a.n);
      return m.length ? `<section class="bloco" aria-labelledby="t-media">
        <h2 id="t-media" class="titulo">Média por serviço</h2>
        <table class="tabela"><thead><tr><th scope="col">Serviço</th><th scope="col" class="n">Vezes</th><th scope="col" class="n">Média</th></tr></thead>
        <tbody>${m.map((u) => `<tr><td>${esc(u.nome)}</td><td class="n">${u.n}</td><td class="n forte">${duracao(u.soma / u.n)}</td></tr>`).join('')}</tbody></table>
      </section>` : '';
    })()}
    <section class="bloco" aria-labelledby="t-tempos">
      <h2 id="t-tempos" class="titulo">Tempos <span class="conta">${lista.length}</span></h2>
      ${!todos.length ? '<p class="vazio">Ainda não há carros terminados.</p>' : !lista.length ? '<p class="vazio">Nada encontrado.</p>' : ''}
      ${dias.map((d) => `<h3 class="dia">${esc(d.dia)}</h3>
        <ul class="registos">${d.itens.map((t) => {
          const i = info(t), a = data(t.inicio), p = data(t.pronto);
          return `<li class="registo">
            ${placa(i.matricula)}
            <div class="registo-texto"><b>${esc(i.modelo)}</b>${i.dono ? ` <span>· ${esc(i.dono)}</span>` : ''}${i.servico ? ` <span class="registo-servico">${esc(i.servico)}</span>` : ''}<small>${hora(a)} – ${hora(p)}${num(t.pausa_min) >= 1 ? ` · ${duracao(num(t.pausa_min) * MIN)} em pausa` : ''}</small></div>
            <span class="registo-tempo">${duracao(tempo(t))}</span>
            <button class="btn-icone" type="button" data-apagar="${esc(t.id)}" aria-label="Apagar" title="Apagar">${icone('trash')}</button>
          </li>`;
        }).join('')}</ul>`).join('')}
    </section>`;
  }

  // O relógio avança sem redesenhar a página.
  function tique() {
    const agora = new Date();
    $$('[data-relogio]').forEach((el) => { const t = trab(el.dataset.relogio); if (t) el.textContent = relogio(tempo(t, agora)); });
  }
  setInterval(tique, 1000);

  const elSync = $('[data-sync]');
  function desenharSync() {
    let txt = '', cls = '';
    if (emDemo()) { txt = 'Demonstração'; cls = 'demo'; }
    else if (st.enviando || st.lendo) txt = 'A guardar…';
    else if (st.pendentes.length) { txt = `${st.pendentes.length} por enviar`; cls = 'aviso'; }
    else if (st.carregado) { txt = 'Guardado na sheet'; cls = 'ok'; }
    elSync.textContent = txt;
    elSync.className = 'sync ' + cls;
  }

  const elAviso = $('[data-aviso]');
  function desenharAviso() {
    if (!st.erro) { elAviso.hidden = true; return; }
    const pin = ['pin', 'sem-pin'].includes(st.codigoErro);
    elAviso.innerHTML = `${icone('warning')}<span>${pin ? (ligacao().pin ? 'PIN errado.' : 'Falta o PIN para ligar à Google Sheet.') : `Sem ligação à sheet. Os tempos ficam neste aparelho e seguem depois. <small>(${esc(st.erro)})</small>`}</span>
      <button class="btn pequeno" type="button" data-abrir-ligacao>${pin ? 'Escrever o PIN' : 'Ligação'}</button>`;
    elAviso.hidden = false;
  }

  let toastTempo;
  function toast(msg) {
    const el = $('[data-toast]');
    el.innerHTML = `${icone('check')}<span>${esc(msg)}</span>`;
    el.hidden = false;
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => { el.hidden = true; }, 3000);
  }

  // ---------------------------------------------------------------- ligação (PIN)
  const painel = $('[data-painel]');
  function abrirLigacao() {
    painel.classList.remove('painel-novo');
    const l = ler('ig.ligacao', {});
    const url = l.apiUrl || CFG.apiUrl || '';
    painel.innerHTML = `<form class="painel-forma" data-form="ligacao" novalidate>
      <header class="painel-cabeca"><h2 id="painel-titulo">Ligação à Google Sheet</h2>
        <button class="btn-icone" type="button" data-fechar aria-label="Fechar">${icone('x')}</button></header>
      <div class="painel-corpo">
        <p>Os tempos ficam na sheet INOVACAR: abas <b>Gestão Trabalhos</b>, <b>Gestão Carros</b> e <b>Gestão Clientes</b>. Cada aparelho escreve o PIN uma vez.</p>
        <label class="campo"><span class="rotulo">PIN da gestão</span><input name="pin" type="password" value="${esc(l.pin || '')}" autocomplete="current-password"></label>
        <details><summary>URL do script</summary>
          <label class="campo"><span class="rotulo">URL da aplicação web</span><input name="apiUrl" type="url" value="${esc(url)}" placeholder="https://script.google.com/macros/s/.../exec"></label>
        </details>
        <p class="estado-ligacao" data-estado hidden></p>
        <p><button class="btn texto" type="button" data-demo>${emDemo() ? 'Continuar na demonstração' : 'Ver a demonstração (dados só neste aparelho)'}</button></p>
      </div>
      <footer class="painel-pe"><button class="btn primario" type="submit">Testar e ligar</button></footer>
    </form>`;
    painel.showModal();
    const f = $('form', painel);
    f.pin.focus();
    const estado = $('[data-estado]', f);
    const mostra = (txt, cls = '') => { estado.textContent = txt; estado.className = 'estado-ligacao ' + cls; estado.hidden = false; };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const apiUrl = f.apiUrl.value.trim(), pin = f.pin.value;
      if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(apiUrl)) return mostra('O URL deve começar por https://script.google.com/macros/s/ e acabar em /exec.', 'erro');
      if (!pin) return mostra('Escreva o PIN.', 'erro');
      const antes = ler('ig.ligacao', {}), demoAntes = ler('ig.forcarDemo', false);
      guardar('ig.ligacao', { apiUrl: apiUrl === CFG.apiUrl ? '' : apiUrl, pin });
      guardar('ig.forcarDemo', false);
      mostra('A testar…');
      try {
        const j = await chamar({ action: 'listar' });
        mostra(`Ligado. ${(j.trabalhos || []).length} tempos na sheet.`, 'ok');
        if (demoAntes) { st.pendentes = []; guardar('tp.pendentes', []); }
        setTimeout(() => { painel.close(); carregar(); }, 600);
      } catch (err) {
        guardar('ig.ligacao', antes); guardar('ig.forcarDemo', demoAntes);
        mostra(err.codigo === 'pin' ? 'PIN errado. Confirme o PIN definido na sheet (menu INOVACAR).' : err.message || 'Não foi possível ligar.', 'erro');
      }
    });
    $('[data-demo]', f).addEventListener('click', () => {
      if (!emDemo()) { st.pendentes = []; guardar('tp.pendentes', []); }
      guardar('ig.forcarDemo', true);
      st.erro = null; st.codigoErro = null;
      painel.close();
      carregar();
    });
  }

  // ---------------------------------------------------------------- eventos
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.pausar) pausar(d.pausar);
    else if (d.retomar) retomar(d.retomar);
    else if (d.terminar) terminar(d.terminar);
    else if (d.apagar) apagar(d.apagar);
    else if ('abrirLigacao' in d) abrirLigacao();
    else if ('fechar' in d) painel.close();
    else if ('adicionar' in d) abrirNovo();
  });
  document.addEventListener('input', (e) => {
    if (e.target.name === 'busca') { st.busca = e.target.value; desenhar(); }
    const f = e.target.closest('[data-form="novo"]');
    if (f) {
      guardar('tp.ultimo2', { matricula: f.matricula.value, modelo: f.modelo.value, dono: f.dono.value, servico: f.servico.value });
      $('[data-erro]', f).hidden = true;
    }
  });

  const lerPagina = () => { st.pagina = location.hash === '#relatorio' ? 'relatorio' : 'contar'; };
  window.addEventListener('hashchange', () => { lerPagina(); desenhar(); window.scrollTo(0, 0); });

  // ---------------------------------------------------------------- arranque
  lerPagina();
  conteudo.innerHTML = '';
  $$('[data-icone]').forEach((el) => { el.outerHTML = icone(el.dataset.icone); });
  const cache = ler('tp.cache', null);
  if (!emDemo() && cache && cache.url === ligacao().apiUrl) {
    TABELAS.forEach((t) => { st[t] = cache[t] || []; });
    aplicar(st, st.pendentes);
  }
  desenhar();
  carregar();
  const cada = Math.max(20, num(CFG.atualizarCada) || 60) * 1000;
  setInterval(() => { if (document.visibilityState === 'visible' && !painel.open && !st.pendentes.length) carregar(); }, cada);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') carregar(); });
  window.addEventListener('online', enviar);
})();
