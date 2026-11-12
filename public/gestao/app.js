/* INOVACAR Gestão: contar o tempo de cada arranjo, por modelo de carro. A Google Sheet guarda os registos. */
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
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço */ } };
  const ler = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

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
  // Usa as abas Gestão Carros (um por modelo) e Gestão Trabalhos (um por tempo) da sheet.
  const TABELAS = ['carros', 'trabalhos'];
  const st = { carros: [], trabalhos: [], carregado: false, erro: null, codigoErro: null, pendentes: ler('tp.pendentes', []), enviando: false, lendo: false, busca: '' };

  const ligacao = () => { const l = ler('ig.ligacao', {}); return { apiUrl: (l.apiUrl || CFG.apiUrl || '').trim(), pin: l.pin || '' }; };
  const emDemo = () => !ligacao().apiUrl || ler('ig.forcarDemo', false);

  const carroDe = (t) => st.carros.find((c) => c.id === t.carro_id);
  const nomeModelo = (c) => (c ? [c.marca, c.modelo].filter(Boolean).join(' ') : '') || 'Sem modelo';
  const modeloDe = (t) => nomeModelo(carroDe(t));
  const aContar = (t) => t.estado === 'curso' && t.inicio && !t.pronto;
  const terminado = (t) => !!(t.inicio && t.pronto);

  function tempo(t, agora = new Date()) {
    const i = data(t.inicio);
    if (!i) return 0;
    const fim = data(t.pronto) || agora;
    const pausaAgora = t.pausado_em && !t.pronto ? fim - data(t.pausado_em) : 0;
    return Math.max(0, fim - i - num(t.pausa_min) * MIN - pausaAgora);
  }

  // Média dos tempos terminados com o mesmo modelo e arranjo (e só do arranjo, se não houver).
  function media(modelo, arranjo) {
    const feitos = st.trabalhos.filter(terminado);
    const de = (l) => (l.length ? { ms: l.reduce((s, t) => s + tempo(t), 0) / l.length, n: l.length } : null);
    return {
      igual: de(feitos.filter((t) => sem(modeloDe(t)) === sem(modelo) && sem(t.servico) === sem(arranjo))),
      arranjo: de(feitos.filter((t) => sem(t.servico) === sem(arranjo))),
    };
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
    dados: () => ler('tp.demo', null) || semente(),
    async chamar(corpo) {
      await new Promise((r) => setTimeout(r, 150));
      const d = this.dados();
      if (corpo.action === 'gravar') aplicar(d, corpo.operacoes || []);
      guardar('tp.demo', d);
      return { ok: true, ...JSON.parse(JSON.stringify(d)) };
    },
  };
  function semente() {
    const S = CFG.servicos || ['Travões'];
    const modelos = ['Peugeot 208', 'Renault Clio', 'Volkswagen Golf', 'Toyota Yaris'];
    const carros = modelos.map((m, k) => ({ id: 'm' + k, cliente_id: '', matricula: '', marca: '', modelo: m, criado_em: '' }));
    const trabalhos = [];
    const agora = new Date();
    for (let k = 0; k < 14; k++) {
      const ini = new Date(agora); ini.setDate(ini.getDate() - 1 - Math.floor(k / 3)); ini.setHours(9 + (k % 3) * 3, 10 * (k % 5), 0, 0);
      const fim = new Date(ini.getTime() + (35 + ((k * 37) % 150)) * MIN);
      trabalhos.push({ id: 't' + k, carro_id: 'm' + (k % 4), servico: S[k % 4], estado: 'pronto', entrada: paraTexto(ini), inicio: paraTexto(ini), pronto: paraTexto(fim), pausado_em: '', pausa_min: '', criado_em: paraTexto(ini) });
    }
    const ini = new Date(agora.getTime() - 47 * MIN);
    trabalhos.push({ id: 'tx', carro_id: 'm0', servico: S[0], estado: 'curso', entrada: paraTexto(ini), inicio: paraTexto(ini), pronto: '', pausado_em: '', pausa_min: '', criado_em: paraTexto(ini) });
    return { carros, trabalhos };
  }

  async function carregar() {
    if (st.lendo) return;
    st.lendo = true;
    desenharSync();
    try {
      if (st.pendentes.length) await enviar();
      const j = await chamar({ action: 'listar' });
      const base = { carros: j.carros || [], trabalhos: j.trabalhos || [] };
      aplicar(base, st.pendentes);
      Object.assign(st, base, { carregado: true, erro: null, codigoErro: null });
      if (!emDemo()) guardar('tp.cache', { url: ligacao().apiUrl, ...base });
    } catch (err) {
      st.erro = err.message || String(err);
      st.codigoErro = err.codigo || 'rede';
    } finally {
      st.lendo = false;
      desenhar();
    }
  }

  function gravar(ops, msg) {
    aplicar(st, ops);
    st.pendentes.push(...ops);
    guardar('tp.pendentes', st.pendentes);
    if (!emDemo()) guardar('tp.cache', { url: ligacao().apiUrl, carros: st.carros, trabalhos: st.trabalhos });
    desenhar();
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
  function modeloOps(nome) {
    const existente = st.carros.find((c) => sem(nomeModelo(c)) === sem(nome));
    if (existente) return { id: existente.id, ops: [] };
    const id = novoId();
    return { id, ops: [{ op: 'criar', tabela: 'carros', id, dados: { cliente_id: '', matricula: '', marca: '', modelo: nome, criado_em: paraTexto(new Date()) } }] };
  }

  function comecar(modelo, arranjo) {
    const m = modeloOps(modelo);
    const agora = paraTexto(new Date());
    gravar([...m.ops, { op: 'criar', tabela: 'trabalhos', id: novoId(), dados: { carro_id: m.id, servico: arranjo, estado: 'curso', entrada: agora, inicio: agora, pronto: '', pausado_em: '', pausa_min: '', criado_em: agora } }], 'A contar.');
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
    gravar([{ op: 'atualizar', tabela: 'trabalhos', id, dados }], `Registado: ${duracao(tempo({ ...t, ...dados }))}.`);
  }
  function apagar(id) {
    const t = trab(id);
    if (!t || !confirm(`Apagar o tempo de ${modeloDe(t)} (${t.servico || 'sem arranjo'})?`)) return;
    gravar([{ op: 'apagar', tabela: 'trabalhos', id }], 'Apagado.');
  }

  // ---------------------------------------------------------------- desenho
  const conteudo = $('[data-conteudo]');
  // Os arranjos do site e os que já se escreveram em "Outro" (vêm da sheet e ficam também no aparelho).
  function arranjos() {
    const base = (CFG.servicos || []).filter((s) => sem(s) !== 'outro');
    const usos = new Map();
    [...ler('tp.arranjos', []), ...st.trabalhos.map((t) => t.servico)].forEach((s) => {
      s = String(s || '').trim();
      if (!s || base.some((b) => sem(b) === sem(s))) return;
      const k = sem(s);
      const u = usos.get(k) || { nome: s, n: 0 };
      u.n++; usos.set(k, u);
    });
    return [...base, ...[...usos.values()].sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, 'pt')).map((u) => u.nome)];
  }
  // O nome como já existe (para "troca de pneus" e "Troca de pneus" contarem juntos).
  const nomeArranjo = (s) => arranjos().find((a) => sem(a) === sem(s)) || s.charAt(0).toUpperCase() + s.slice(1);

  function desenhar() {
    desenharSync();
    desenharAviso();
    const foco = document.activeElement && document.activeElement.name;
    const form = $('[data-form="novo"]');
    const antes = form ? { modelo: form.modelo.value, arranjo: (form.querySelector('input[name="arranjo"]:checked') || {}).value, outro: form.outro.value } : ler('tp.ultimo', {});
    conteudo.innerHTML = `${vistaNovo(antes)}${vistaAContar()}${vistaRegistos()}`;
    if (foco && $(`[name="${foco}"]`)) {
      const el = $(`[name="${foco}"]`);
      if (el.type !== 'radio') { el.focus(); if (el.setSelectionRange && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); }
    }
    ligarNovo();
    tique();
  }

  function vistaNovo(v = {}) {
    const lista = arranjos();
    const ehOutro = v.arranjo === '__outro';
    const modelos = [...new Set(st.carros.map(nomeModelo).filter((n) => n !== 'Sem modelo'))].sort((a, b) => a.localeCompare(b, 'pt'));
    return `<section class="bloco novo" aria-labelledby="t-novo">
      <h1 id="t-novo" class="titulo">Contar um tempo</h1>
      <form data-form="novo" novalidate autocomplete="off">
        <label class="campo"><span class="rotulo">Modelo do carro</span>
          <input name="modelo" type="text" list="modelos" placeholder="Ex.: Peugeot 208" value="${esc(v.modelo || '')}" enterkeyhint="next">
          <datalist id="modelos">${modelos.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
        </label>
        <fieldset class="campo"><legend class="rotulo">Arranjo</legend>
          <div class="chips">
            ${lista.map((s) => `<label class="chip"><input type="radio" name="arranjo" value="${esc(s)}"${v.arranjo === s ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}
            <label class="chip"><input type="radio" name="arranjo" value="__outro"${ehOutro ? ' checked' : ''}><span>Outro</span></label>
          </div>
          <input name="outro" type="text" class="outro" placeholder="Que arranjo?" value="${esc(v.outro || '')}"${ehOutro ? '' : ' hidden'} aria-label="Outro arranjo">
        </fieldset>
        <p class="erro-form" data-erro hidden></p>
        <button class="btn primario grande" type="submit">${icone('play')}<span>Começar a contar</span></button>
      </form>
    </section>`;
  }

  function ligarNovo() {
    const f = $('[data-form="novo"]');
    const outro = f.outro;
    f.addEventListener('change', (e) => {
      if (e.target.name === 'arranjo') { outro.hidden = e.target.value !== '__outro'; if (!outro.hidden) outro.focus(); }
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const modelo = f.modelo.value.trim().replace(/\s+/g, ' ');
      const r = f.querySelector('input[name="arranjo"]:checked');
      const arranjo = r ? (r.value === '__outro' ? outro.value.trim() : r.value) : '';
      const erro = $('[data-erro]', f);
      const falta = !modelo ? 'Escreva o modelo do carro.' : !arranjo ? (r ? 'Escreva o arranjo.' : 'Escolha o arranjo.') : '';
      if (falta) { erro.textContent = falta; erro.hidden = false; (!modelo ? f.modelo : r ? outro : f.querySelector('input[name="arranjo"]')).focus(); return; }
      const nome = nomeArranjo(arranjo);
      const guardados = ler('tp.arranjos', []);
      if (!guardados.some((g) => sem(g) === sem(nome))) guardar('tp.arranjos', [...guardados, nome]);
      guardar('tp.ultimo', {});
      f.reset();
      comecar(modelo, nome);
    });
  }

  function vistaAContar() {
    const lista = st.trabalhos.filter(aContar).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
    if (!lista.length) return '';
    return `<section class="bloco" aria-labelledby="t-contar">
      <h2 id="t-contar" class="titulo">A contar <span class="conta">${lista.length}</span></h2>
      <ul class="cronos">${lista.map(crono).join('')}</ul>
    </section>`;
  }

  function crono(t) {
    const modelo = modeloDe(t);
    const m = media(modelo, t.servico);
    const ref = m.igual || m.arranjo;
    const refTxt = ref ? `Média ${m.igual ? 'deste modelo' : 'deste arranjo'}: <b>${duracao(ref.ms)}</b> (${ref.n} ${ref.n === 1 ? 'vez' : 'vezes'})` : 'Primeira vez que se conta.';
    const pausa = !!t.pausado_em;
    const ini = data(t.inicio);
    return `<li class="crono${pausa ? ' em-pausa' : ''}" data-id="${esc(t.id)}">
      <div class="crono-cima">
        <div>
          <p class="crono-modelo">${esc(modelo)}</p>
          <p class="crono-arranjo">${esc(t.servico || 'Sem arranjo')}</p>
        </div>
        <button class="btn-icone" type="button" data-apagar="${esc(t.id)}" aria-label="Apagar este tempo" title="Apagar">${icone('trash')}</button>
      </div>
      <p class="relogio" data-relogio="${esc(t.id)}" aria-live="off">${relogio(tempo(t))}</p>
      <p class="crono-info">${pausa ? '<span class="selo-pausa">Em pausa</span> ' : ''}Começou ${diaTexto(ini).toLowerCase()} às ${hora(ini)}. ${refTxt}</p>
      ${ref ? `<div class="barra" aria-hidden="true"><span data-barra="${esc(t.id)}" data-ref="${ref.ms}"></span></div>` : ''}
      <div class="crono-acoes">
        ${pausa
          ? `<button class="btn" type="button" data-retomar="${esc(t.id)}">${icone('play')}<span>Retomar</span></button>`
          : `<button class="btn" type="button" data-pausar="${esc(t.id)}">${icone('pause')}<span>Pausar</span></button>`}
        <button class="btn primario" type="button" data-terminar="${esc(t.id)}">${icone('flag-checkered')}<span>Terminar</span></button>
      </div>
    </li>`;
  }

  function vistaRegistos() {
    const q = sem(st.busca);
    const todos = st.trabalhos.filter(terminado).sort((a, b) => String(b.pronto).localeCompare(String(a.pronto)));
    const lista = q ? todos.filter((t) => sem(`${modeloDe(t)} ${t.servico}`).includes(q)) : todos;
    // Um grupo por modelo e arranjo: os tempos e a média. O mais recente primeiro.
    const grupos = new Map();
    lista.forEach((t) => {
      const k = `${sem(modeloDe(t))}|${sem(t.servico)}`;
      if (!grupos.has(k)) grupos.set(k, { modelo: modeloDe(t), arranjo: t.servico, itens: [] });
      grupos.get(k).itens.push(t);
    });
    const vazio = !todos.length
      ? '<p class="vazio">Ainda não há tempos registados. Escolha o modelo e o arranjo e carregue em Começar a contar.</p>'
      : !lista.length ? '<p class="vazio">Nada encontrado.</p>' : '';
    return `<section class="bloco" aria-labelledby="t-registos">
      <div class="cabeca-bloco">
        <h2 id="t-registos" class="titulo">Tempos registados <span class="conta">${todos.length}</span></h2>
        ${todos.length ? `<label class="busca">${icone('magnifying-glass')}<input name="busca" type="search" placeholder="Procurar modelo ou arranjo" value="${esc(st.busca)}" aria-label="Procurar"></label>` : ''}
      </div>
      ${vazio}
      <div class="grupos">${[...grupos.values()].map((g) => {
        const ms = g.itens.reduce((s, t) => s + tempo(t), 0) / g.itens.length;
        return `<article class="grupo">
          <header class="grupo-cabeca">
            <div><h3>${esc(g.modelo)}</h3><p>${esc(g.arranjo || 'Sem arranjo')}</p></div>
            <div class="media"><small>Média</small><b>${duracao(ms)}</b><small>${g.itens.length} ${g.itens.length === 1 ? 'vez' : 'vezes'}</small></div>
          </header>
          <ul class="registos">${g.itens.map((t) => {
            const i = data(t.inicio), p = data(t.pronto);
            return `<li class="registo">
              <span class="registo-texto">${diaTexto(p)}, ${hora(i)} – ${hora(p)}${num(t.pausa_min) >= 1 ? ` <small>(${duracao(num(t.pausa_min) * MIN)} em pausa)</small>` : ''}</span>
              <span class="registo-tempo">${duracao(tempo(t))}</span>
              <button class="btn-icone" type="button" data-apagar="${esc(t.id)}" aria-label="Apagar" title="Apagar">${icone('trash')}</button>
            </li>`;
          }).join('')}</ul>
        </article>`;
      }).join('')}</div>
    </section>`;
  }

  // O relógio e a barra avançam sem redesenhar a página.
  function tique() {
    const agora = new Date();
    $$('[data-relogio]').forEach((el) => { const t = trab(el.dataset.relogio); if (t) el.textContent = relogio(tempo(t, agora)); });
    $$('[data-barra]').forEach((el) => {
      const t = trab(el.dataset.barra);
      if (!t) return;
      const r = tempo(t, agora) / num(el.dataset.ref);
      el.style.width = `${Math.min(100, r * 100)}%`;
      el.classList.toggle('passou', r > 1);
    });
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
    const l = ler('ig.ligacao', {});
    const url = l.apiUrl || CFG.apiUrl || '';
    painel.innerHTML = `<form class="painel-forma" data-form="ligacao" novalidate>
      <header class="painel-cabeca"><h2 id="painel-titulo">Ligação à Google Sheet</h2>
        <button class="btn-icone" type="button" data-fechar aria-label="Fechar">${icone('x')}</button></header>
      <div class="painel-corpo">
        <p>Os tempos ficam na aba <b>Gestão Trabalhos</b> da sheet INOVACAR (e os modelos em <b>Gestão Carros</b>). Cada aparelho escreve o PIN uma vez.</p>
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
  });
  document.addEventListener('input', (e) => {
    if (e.target.name === 'busca') { st.busca = e.target.value; desenhar(); }
    if (e.target.closest('[data-form="novo"]')) {
      const f = e.target.form;
      const r = f.querySelector('input[name="arranjo"]:checked');
      guardar('tp.ultimo', { modelo: f.modelo.value, arranjo: r && r.value, outro: f.outro.value });
      $('[data-erro]', f).hidden = true;
    }
  });

  // ---------------------------------------------------------------- arranque
  conteudo.innerHTML = '';
  $$('[data-icone]').forEach((el) => { el.outerHTML = icone(el.dataset.icone); });
  const cache = ler('tp.cache', null);
  if (!emDemo() && cache && cache.url === ligacao().apiUrl) {
    st.carros = cache.carros || []; st.trabalhos = cache.trabalhos || [];
    aplicar(st, st.pendentes);
  }
  desenhar();
  carregar();
  const cada = Math.max(20, num(CFG.atualizarCada) || 60) * 1000;
  setInterval(() => { if (document.visibilityState === 'visible' && !painel.open && !st.pendentes.length) carregar(); }, cada);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') carregar(); });
  window.addEventListener('online', enviar);
})();
