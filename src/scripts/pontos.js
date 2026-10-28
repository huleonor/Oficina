/* Consulta de pontos INOVACAR — chama o Apps Script Web App. */

(() => {
  'use strict';

  const root = document.querySelector('[data-pontos]');
  if (!root) return;

  const api = (root.getAttribute('data-api') || '').trim();
  let mockDb = {};
  try {
    const raw = root.getAttribute('data-mock') || '';
    if (raw) mockDb = JSON.parse(raw);
  } catch {
    mockDb = {};
  }
  const form = root.querySelector('[data-pontos-form]');
  const input = root.querySelector('[data-pontos-tel]');
  const status = root.querySelector('[data-pontos-status]');
  const resultado = root.querySelector('[data-pontos-resultado]');
  const saudacao = root.querySelector('[data-pontos-saudacao]');
  const saldoEl = root.querySelector('[data-pontos-saldo]');
  const movList = root.querySelector('[data-pontos-movimentos]');
  const marksRoot = root.querySelector('[data-pontos-premios]');
  const fill = root.querySelector('[data-pontos-fill]');
  const bar = root.querySelector('[data-pontos-bar]');
  const btn = root.querySelector('[data-pontos-submit]');

  let maxPts = Number(root.getAttribute('data-max-pts')) || 500;

  const tipoLabel = {
    gasto: 'Gasto',
    indicacao: 'Indicação',
    resgate: 'Resgate',
    ajuste: 'Ajuste',
  };

  function normalizar(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('351') && d.length >= 12) d = d.slice(3);
    if (d.length > 9 && d.startsWith('0')) d = d.replace(/^0+/, '');
    return d;
  }

  function setStatus(msg, kind) {
    if (!status) return;
    status.hidden = !msg;
    status.textContent = msg || '';
    status.dataset.kind = kind || '';
  }

  function formatData(iso) {
    if (!iso) return '';
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMovimentos(list) {
    if (!movList) return;
    movList.innerHTML = '';
    if (!list || !list.length) {
      const li = document.createElement('li');
      li.className = 'pontos-empty';
      li.textContent = 'Ainda sem movimentos.';
      movList.appendChild(li);
      return;
    }
    list.forEach((m) => {
      const li = document.createElement('li');
      li.className = 'pontos-mov';
      const pts = Number(m.pontos) || 0;
      const sinal = pts > 0 ? '+' : '';
      li.innerHTML = `
        <div class="pontos-mov-main">
          <span class="pontos-mov-tipo">${tipoLabel[m.tipo] || m.tipo}</span>
          <span class="pontos-mov-data t-num">${formatData(m.data)}</span>
        </div>
        <div class="pontos-mov-meta">
          <span class="pontos-mov-nota">${escapeHtml(m.nota || '')}</span>
          <span class="pontos-mov-pts t-num ${pts < 0 ? 'is-neg' : 'is-pos'}">${sinal}${pts} pts</span>
        </div>`;
      movList.appendChild(li);
    });
  }

  function syncMarksFromApi(list) {
    if (!marksRoot || !list || !list.length) return;
    const sorted = [...list].sort((a, b) => a.pontos - b.pontos);
    maxPts = Math.max(...sorted.map((p) => Number(p.pontos) || 0), 1);
    root.setAttribute('data-max-pts', String(maxPts));
    if (bar) bar.setAttribute('aria-valuemax', String(maxPts));

    marksRoot.innerHTML = '';
    sorted.forEach((p) => {
      const pct = Math.min(100, (Number(p.pontos) / maxPts) * 100);
      const li = document.createElement('li');
      li.className = 'pontos-mark';
      li.style.left = `${pct}%`;
      li.setAttribute('data-premio-id', p.id);
      li.setAttribute('data-premio-pts', String(p.pontos));
      if (p.descricao) li.title = p.descricao;
      li.innerHTML = `
        <span class="pontos-mark-pts t-num" data-premio-pts-label>${p.pontos}</span>
        <span class="pontos-mark-dot" aria-hidden="true"></span>
        <span class="pontos-mark-nome" data-premio-nome>${escapeHtml(p.nome)}</span>`;
      marksRoot.appendChild(li);
    });
  }

  function actualizarBarra(saldo) {
    const s = Math.max(0, Number(saldo) || 0);
    if (saldoEl) saldoEl.textContent = String(s);
    const pct = Math.min(100, (s / maxPts) * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (bar) bar.setAttribute('aria-valuenow', String(s));

    marksRoot?.querySelectorAll('[data-premio-pts]').forEach((mark) => {
      const custo = Number(mark.getAttribute('data-premio-pts')) || 0;
      mark.classList.toggle('is-reached', s >= custo);
    });
  }

  function aplicarResultado(data) {
    const saldo = Number(data.saldo) || 0;
    if (saudacao) {
      saudacao.textContent = `Olá, ${data.nome || 'Cliente'}. Resgate na oficina.`;
    }
    if (data.premios && data.premios.length) syncMarksFromApi(data.premios);
    actualizarBarra(saldo);
    renderMovimentos(data.movimentos || []);
    setStatus('', '');
    if (resultado) {
      resultado.hidden = false;
      resultado.focus?.();
    }
  }

  function consultarMock(telemovel) {
    const hit = mockDb[telemovel];
    if (!hit || hit.ok === false) {
      setStatus(
        'Não encontrámos este telemóvel. Confirme o número ou fale connosco na oficina.',
        'error',
      );
      if (resultado) resultado.hidden = true;
      return;
    }
    aplicarResultado(hit);
  }

  async function consultar(telemovel) {
    if (!api) {
      setStatus(
        'A consulta ainda não está ligada. A oficina está a preparar o programa de pontos.',
        'warn',
      );
      if (resultado) resultado.hidden = true;
      return;
    }

    setStatus('A consultar…', 'loading');
    if (btn) btn.disabled = true;
    if (resultado) resultado.hidden = true;

    try {
      if (api === 'mock') {
        consultarMock(telemovel);
        return;
      }

      const res = await fetch(api, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ telemovel }),
      });
      const data = await res.json();

      if (!data || data.ok === false) {
        if (data && data.erro === 'nao_encontrado') {
          setStatus(
            'Não encontrámos este telemóvel. Confirme o número ou fale connosco na oficina.',
            'error',
          );
        } else if (data && data.erro === 'telemovel_invalido') {
          setStatus('Introduza um telemóvel válido (9 dígitos).', 'error');
        } else {
          setStatus(
            'Não foi possível consultar agora. Tente mais tarde ou ligue para a oficina.',
            'error',
          );
        }
        return;
      }

      aplicarResultado(data);
    } catch {
      setStatus(
        'Falha de rede ou o serviço de pontos está indisponível. Tente mais tarde.',
        'error',
      );
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // Estado inicial da barra (0 pts)
  actualizarBarra(0);

  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const tel = normalizar(input?.value);
    if (tel.length < 9) {
      setStatus('Introduza um telemóvel válido (9 dígitos).', 'error');
      input?.focus();
      return;
    }
    consultar(tel);
  });
})();
