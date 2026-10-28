/* Consulta de pontos INOVACAR — chama o Apps Script Web App (ou os dados de teste). */

(() => {
  'use strict';

  const root = document.querySelector('[data-pontos]');
  if (!root) return;

  const $ = (sel) => root.querySelector(sel);
  const api = (root.dataset.api || '').trim();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mockDb = {};
  let premiosBase = [];
  try { mockDb = JSON.parse(root.dataset.mock || '{}'); } catch { mockDb = {}; }
  try { premiosBase = JSON.parse(root.dataset.premios || '[]'); } catch { premiosBase = []; }

  const card = $('[data-pontos-card]');
  const form = $('[data-pontos-form]');
  const field = $('[data-pontos-field]');
  const input = $('[data-pontos-tel]');
  const btn = $('[data-pontos-submit]');
  const erro = $('[data-pontos-erro]');
  const result = $('[data-pontos-result]');
  const catalog = $('[data-pontos-catalog]');

  const tipoLabel = { gasto: 'Serviço na oficina', indicacao: 'Indicação de um amigo', resgate: 'Troca', ajuste: 'Ajuste' };
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

  const normalizar = (raw) => {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('351') && d.length >= 12) d = d.slice(3);
    return d;
  };

  // Formata enquanto escreve: 912 345 678
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

  const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const formatData = (iso) => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
  };

  // Contador: sobe até ao saldo com desaceleração (sem ressalto).
  function contar(el, alvo) {
    if (reduce || alvo <= 0) { el.textContent = String(alvo); return; }
    const dur = Math.min(1200, 500 + alvo * 1.2);
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = String(Math.round(alvo * e));
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  // Mantém a altura do cartão estável enquanto troca de estado, e anima a nova altura.
  function trocarEstado(fn) {
    const h0 = card.offsetHeight;
    card.style.height = `${h0}px`;
    fn();
    requestAnimationFrame(() => {
      card.style.height = 'auto';
      const h1 = card.offsetHeight;
      card.style.height = `${h0}px`;
      void card.offsetHeight;
      card.style.height = `${h1}px`;
      const fim = () => { card.style.height = ''; card.removeEventListener('transitionend', fim); };
      card.addEventListener('transitionend', fim);
      if (reduce) card.style.height = '';
    });
  }

  function mostrarResultado(data) {
    const saldo = Math.max(0, Number(data.saldo) || 0);
    const premios = [...(data.premios && data.premios.length ? data.premios : premiosBase)]
      .map((p) => ({ ...p, pontos: Number(p.pontos) || 0 }))
      .sort((a, b) => a.pontos - b.pontos);

    $('[data-pontos-hello]').textContent = `Olá, ${data.nome || 'cliente'}`;

    // Próximo prémio
    const proximo = premios.find((p) => p.pontos > saldo);
    const anterior = [...premios].reverse().find((p) => p.pontos <= saldo);
    const label = $('[data-pontos-next-label]');
    const gap = $('[data-pontos-next-gap]');
    const meter = $('[data-pontos-meter]');
    const fill = $('[data-pontos-meter-fill]');
    let pct = 100;
    if (proximo) {
      const base = anterior ? anterior.pontos : 0;
      pct = Math.round(((saldo - base) / (proximo.pontos - base)) * 100);
      label.textContent = `Próximo: ${proximo.nome}`;
      gap.textContent = `faltam ${proximo.pontos - saldo} pts`;
    } else {
      label.textContent = 'Já pode trocar por qualquer prémio';
      gap.textContent = '';
    }
    meter.setAttribute('aria-valuenow', String(pct));
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(0)';

    // Lista de prémios: disponíveis primeiro (com visto), depois os que faltam
    const lista = $('[data-pontos-rewards]');
    lista.innerHTML = premios
      .map((p, i) => {
        const ok = saldo >= p.pontos;
        const custo = ok ? `${p.pontos} pts · disponível` : `${p.pontos} pts`;
        return `<li class="pts-reward${ok ? ' is-ok' : ''}" style="--i:${i}">
          <span class="pts-badge">${ok ? check : ''}</span>
          <span class="pts-reward-name">${escapeHtml(p.nome)}</span>
          <span class="pts-reward-cost t-num">${custo}</span>
        </li>`;
      })
      .join('');

    // Movimentos
    const movs = data.movimentos || [];
    const hist = $('[data-pontos-history]');
    hist.hidden = movs.length === 0;
    hist.open = false;
    $('[data-pontos-movimentos]').innerHTML = movs
      .map((m) => {
        const pts = Number(m.pontos) || 0;
        const o = tipoLabel[m.tipo] || m.tipo || '';
        const nota = m.nota ? ` · ${escapeHtml(m.nota)}` : '';
        return `<li class="pts-move">
          <span class="pts-move-what">${escapeHtml(o)}</span>
          <span class="pts-move-when t-num">${formatData(m.data)}${nota}</span>
          <span class="pts-move-pts t-num ${pts < 0 ? 'is-neg' : 'is-pos'}">${pts > 0 ? '+' : ''}${pts}</span>
        </li>`;
      })
      .join('');

    const saldoEl = $('[data-pontos-saldo]');
    saldoEl.textContent = '0';

    const entrar = () =>
      trocarEstado(() => {
        form.hidden = true;
        form.classList.remove('is-leaving');
        result.hidden = false;
        result.classList.add('is-entering');
        card.dataset.state = 'result';
        if (catalog) catalog.hidden = true;
        contar(saldoEl, saldo);
        requestAnimationFrame(() => {
          fill.style.transition = '';
          fill.style.transform = `scaleX(${Math.max(0, Math.min(100, pct)) / 100})`;
        });
        $('[data-pontos-hello]').setAttribute('tabindex', '-1');
        $('[data-pontos-hello]').focus({ preventScroll: true });
      });

    if (reduce) { entrar(); return; }
    form.classList.add('is-leaving');
    setTimeout(entrar, 180);
  }

  function voltar() {
    trocarEstado(() => {
      result.hidden = true;
      result.classList.remove('is-entering');
      form.hidden = false;
      card.dataset.state = 'ask';
      if (catalog) catalog.hidden = false;
      input.value = '';
      input.focus();
    });
  }

  async function consultar(tel) {
    if (!api) { mostrarErro('A consulta ainda não está disponível. Ligue para a oficina.'); return; }
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      let data;
      if (api === 'mock') {
        await new Promise((r) => setTimeout(r, 450));
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
