/* Consulta de pontos INOVACAR — chama o Apps Script Web App (ou os dados de teste). */

(() => {
  'use strict';

  const root = document.querySelector('[data-pontos]');
  if (!root) return;

  const $ = (sel) => root.querySelector(sel);
  const api = (root.dataset.api || '').trim();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mockDb = {};
  let premios = [];
  try { mockDb = JSON.parse(root.dataset.mock || '{}'); } catch { mockDb = {}; }
  try { premios = JSON.parse(root.dataset.premios || '[]'); } catch { premios = []; }

  const card = $('[data-pontos-card]');
  const form = $('[data-pontos-form]');
  const field = $('[data-pontos-field]');
  const input = $('[data-pontos-tel]');
  const btn = $('[data-pontos-submit]');
  const erro = $('[data-pontos-erro]');
  const result = $('[data-pontos-result]');
  const extra = $('[data-pontos-extra]');
  const fill = $('[data-pontos-fill]');
  const detail = $('[data-pontos-detail]');
  const stops = [...root.querySelectorAll('[data-pontos-stop]')];

  let saldo = null; // null = ainda não consultou
  const tipoLabel = { gasto: 'Serviço na oficina', indicacao: 'Indicação de um amigo', resgate: 'Troca', ajuste: 'Ajuste' };

  const normalizar = (raw) => {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('351') && d.length >= 12) d = d.slice(3);
    return d;
  };
  const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const formatData = (iso) => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
  };

  /* ---------- Barra de recompensas ---------- */

  // Paragens à mesma distância: o prémio i fica em (i+1)/n. O enchimento interpola dentro do troço.
  function fracaoBarra(s) {
    const n = premios.length;
    let antes = 0;
    for (let i = 0; i < n; i++) {
      const custo = premios[i].pontos;
      if (s < custo) return (i + (s - antes) / (custo - antes)) / n;
      antes = custo;
    }
    return 1;
  }

  function mostrarDetalhe(i, animar = true) {
    const p = premios[i];
    if (!p) return;
    stops.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    const ok = saldo !== null && saldo >= p.pontos;
    $('[data-pontos-detail-name]').textContent = p.nome;
    let estado = `${p.pontos} pts`;
    if (saldo !== null) estado = ok ? 'Já pode trocar' : `Faltam ${p.pontos - saldo} pts`;
    $('[data-pontos-detail-state]').textContent = estado;
    detail.classList.toggle('is-ok', ok);
    if (animar && !reduce) {
      detail.classList.remove('swap');
      void detail.offsetWidth;
      detail.classList.add('swap');
    }
  }

  function pintarBarra(s) {
    const f = fracaoBarra(s);
    // As paragens acendem à medida que o enchimento lá chega (1 s no total).
    stops.forEach((b, i) => {
      const pos = (i + 1) / premios.length;
      b.style.setProperty('--delay', reduce ? '0ms' : `${Math.round(Math.min(pos / Math.max(f, 0.01), 1) * 900)}ms`);
      b.classList.toggle('is-ok', s >= premios[i].pontos);
    });
    fill.style.setProperty('--fill', String(f));
    $('[data-pontos-track]').setAttribute('aria-label', `${s} pontos`);
  }

  stops.forEach((b, i) => b.addEventListener('click', () => mostrarDetalhe(i)));

  /* ---------- Pedir número ---------- */

  input?.addEventListener('input', () => {
    const d = normalizar(input.value).slice(0, 9);
    input.value = d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
    if (!erro.hidden) mostrarErro('');
  });

  function mostrarErro(msg) {
    erro.textContent = msg;
    erro.hidden = !msg;
    field.classList.toggle('is-invalid', Boolean(msg));
    input.toggleAttribute('aria-invalid', Boolean(msg));
    if (msg && !reduce) {
      field.classList.remove('shake');
      void field.offsetWidth;
      field.classList.add('shake');
    }
  }

  // Contador: sobe até ao saldo e desacelera no fim.
  function contar(el, alvo) {
    if (reduce || alvo <= 0) { el.textContent = String(alvo); return; }
    const dur = Math.min(1000, 450 + alvo);
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(alvo * (1 - Math.pow(1 - p, 4))));
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  /* ---------- Resultado ---------- */

  function mostrarResultado(data) {
    saldo = Math.max(0, Number(data.saldo) || 0);
    if (data.premios && data.premios.length) {
      // A folha manda prémios: se a lista mudou, recarrega a página com os novos não é preciso;
      // só actualizamos nomes/custos das paragens existentes quando o número coincide.
      const novos = [...data.premios].map((p) => ({ ...p, pontos: Number(p.pontos) || 0 })).sort((a, b) => a.pontos - b.pontos);
      if (novos.length === premios.length) {
        premios = novos;
        stops.forEach((b, i) => {
          b.querySelector('.pts-dot-pts').textContent = String(premios[i].pontos);
          b.setAttribute('aria-label', `${premios[i].nome}, ${premios[i].pontos} pontos`);
        });
      }
    }

    $('[data-pontos-hello]').textContent = `Olá, ${data.nome || 'cliente'}`;

    const movs = data.movimentos || [];
    $('[data-pontos-history]').hidden = movs.length === 0;
    $('[data-pontos-history]').open = false;
    $('[data-pontos-movimentos]').innerHTML = movs
      .map((m) => {
        const pts = Number(m.pontos) || 0;
        const nota = m.nota ? ` · ${escapeHtml(m.nota)}` : '';
        return `<li class="pts-move">
          <span class="pts-move-what">${escapeHtml(tipoLabel[m.tipo] || m.tipo || '')}</span>
          <span class="pts-move-when t-num">${formatData(m.data)}${nota}</span>
          <span class="pts-move-pts t-num ${pts < 0 ? 'is-neg' : 'is-pos'}">${pts > 0 ? '+' : ''}${pts}</span>
        </li>`;
      })
      .join('');

    const entrar = () => {
      form.hidden = true;
      form.classList.remove('is-leaving');
      result.hidden = false;
      extra.hidden = false;
      result.classList.add('is-entering');
      extra.classList.add('is-entering');
      card.dataset.state = 'result';
      contar($('[data-pontos-saldo]'), saldo);
      requestAnimationFrame(() => pintarBarra(saldo));
      const proximo = premios.findIndex((p) => p.pontos > saldo);
      mostrarDetalhe(proximo === -1 ? premios.length - 1 : proximo, false);
      $('[data-pontos-hello]').focus({ preventScroll: true });
    };
    if (reduce) { entrar(); return; }
    form.classList.add('is-leaving');
    setTimeout(entrar, 160);
  }

  function voltar() {
    saldo = null;
    result.hidden = true;
    extra.hidden = true;
    result.classList.remove('is-entering');
    extra.classList.remove('is-entering');
    form.hidden = false;
    card.dataset.state = 'ask';
    pintarBarra(0);
    stops.forEach((b) => b.classList.remove('is-ok'));
    mostrarDetalhe(0, false);
    input.value = '';
    input.focus();
  }

  async function consultar(tel) {
    if (!api) { mostrarErro('A consulta ainda não está disponível. Ligue para a oficina.'); return; }
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      let data;
      if (api === 'mock') {
        await new Promise((r) => setTimeout(r, 400));
        data = mockDb[tel] || { ok: false, erro: 'nao_encontrado' };
      } else {
        const res = await fetch(api, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ telemovel: tel }),
        });
        data = await res.json();
      }
      if (!data || data.ok === false) {
        if (data && data.erro === 'nao_encontrado') mostrarErro('Não encontrámos este número. Confirme-o ou fale connosco na oficina.');
        else if (data && data.erro === 'telemovel_invalido') mostrarErro('O número deve ter 9 algarismos.');
        else mostrarErro('Não foi possível consultar agora. Tente daqui a pouco.');
        return;
      }
      mostrarResultado(data);
    } catch {
      mostrarErro('Sem ligação ao serviço de pontos. Verifique a internet e tente de novo.');
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }

  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const tel = normalizar(input.value);
    if (tel.length !== 9) {
      mostrarErro('O número deve ter 9 algarismos.');
      input.focus();
      return;
    }
    mostrarErro('');
    consultar(tel);
  });

  $('[data-pontos-reset]')?.addEventListener('click', voltar);
})();
