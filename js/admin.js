/* =========================================================
   BARBEARIA CAPITÃO — Painel de reservas (beta 1.0)
   ⚠ PIN apenas local/demonstrativo. Segurança real exige backend.
   ========================================================= */
(() => {
  const C = window.CAPITAO, DB = window.CapitaoDB;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const PIN = '1234';
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const STATUS = { confirmado: 'Confirmado', concluido: 'Concluído', falta: 'Faltou', cancelado: 'Cancelado' };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nomeB = (id) => C.barbeiros.find(b => b.id === id)?.nome || id;
  const fmtDia = (ymd) => { const d = DB.parseYmd(ymd); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 2600); };

  let dia = DB.ymd(new Date());
  let blockMode = false;
  let knownIds = new Set(DB.load().reservas.map(r => r.id));

  /* ---------- Login ---------- */
  const boxes = $$('#pinBoxes input');
  boxes.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '');
      if (inp.value && i < boxes.length - 1) boxes[i + 1].focus();
      if (boxes.every(b => b.value)) $('#loginForm').requestSubmit();
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && i > 0) boxes[i - 1].focus(); });
    inp.addEventListener('paste', (e) => {
      const v = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      if (!v) return; e.preventDefault();
      v.split('').forEach((c, k) => boxes[k] && (boxes[k].value = c));
      if (v.length === 4) $('#loginForm').requestSubmit();
    });
  });
  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (boxes.map(b => b.value).join('') === PIN) {
      try { sessionStorage.setItem('capitao_admin', '1'); } catch {}
      entrar();
    } else {
      $('#loginErr').textContent = 'PIN incorreto.';
      $('#pinBoxes').classList.remove('is-shake'); void $('#pinBoxes').offsetWidth; $('#pinBoxes').classList.add('is-shake');
      boxes.forEach(b => b.value = ''); boxes[0].focus();
    }
  });
  function entrar() { $('#login').hidden = true; $('#app').hidden = false; render(); }
  let logged = false;
  try { logged = sessionStorage.getItem('capitao_admin') === '1'; } catch {}
  if (logged) entrar(); else boxes[0].focus();
  $('#logoutBtn').onclick = () => { try { sessionStorage.removeItem('capitao_admin'); } catch {} location.reload(); };

  /* ---------- Navegação ---------- */
  $$('.side__nav button').forEach(b => b.addEventListener('click', () => {
    $$('.side__nav button').forEach(x => x.classList.toggle('is-active', x === b));
    $$('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === b.dataset.view));
    render();
  }));
  const shift = (n) => { const d = DB.parseYmd(dia); d.setDate(d.getDate() + n); dia = DB.ymd(d); render(); };
  $('#prevDay').onclick = () => shift(-1);
  $('#nextDay').onclick = () => shift(1);
  $('#todayBtn').onclick = () => { dia = DB.ymd(new Date()); render(); };
  $('#datePick').onchange = (e) => { if (e.target.value) { dia = e.target.value; render(); } };
  $('#blockMode').onclick = () => {
    blockMode = !blockMode;
    $('#blockMode').setAttribute('aria-pressed', blockMode);
    $('#agenda').classList.toggle('block-mode', blockMode);
    toast(blockMode ? 'Modo bloqueio: clique nos horários pra bloquear/liberar' : 'Modo bloqueio desligado');
  };
  addEventListener('keydown', (e) => {
    if ($('#app').hidden || e.target.closest('input, select, textarea, dialog')) return;
    if (e.key === 'ArrowLeft') shift(-1);
    if (e.key === 'ArrowRight') shift(1);
    if (e.key === 'Escape') closeDrawer();
  });

  /* ---------- Render ---------- */
  function render() {
    if ($('#app').hidden) return;
    const d = DB.parseYmd(dia);
    const hoje = DB.ymd(new Date());
    $('#dateTitle').textContent = dia === hoje ? `Hoje · ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}` : fmtDia(dia);
    $('#datePick').value = dia;
    renderKpis();
    if ($('[data-view="agenda"].view').classList.contains('is-active')) renderAgenda();
    else renderLista();
  }

  function renderKpis() {
    const db = DB.load();
    const doDia = db.reservas.filter(r => r.data === dia && r.status !== 'cancelado');
    const fat = doDia.filter(r => r.status !== 'falta').reduce((a, r) => a + r.total, 0);
    const conc = doDia.filter(r => r.status === 'concluido');
    const faltas = doDia.filter(r => r.status === 'falta').length;
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const isHoje = dia === DB.ymd(now);
    const prox = doDia.filter(r => r.status === 'confirmado' && (!isHoje || DB.toMin(r.hora) + r.duracao > nowMin))
      .sort((a, b) => a.hora.localeCompare(b.hora))[0];
    let proxTxt = 'Agenda livre';
    if (prox) {
      const diff = DB.toMin(prox.hora) - nowMin;
      proxTxt = isHoje ? (diff <= 0 ? 'na cadeira agora' : diff < 60 ? `em ${diff} min` : `às ${prox.hora}`) : `às ${prox.hora}`;
    }
    const hrs = C.horarios[DB.parseYmd(dia).getDay()];
    const cap = hrs ? ((DB.toMin(hrs[1]) - DB.toMin(hrs[0])) / C.slotMin) * C.barbeiros.length : 0;
    const usados = doDia.reduce((a, r) => a + r.duracao / C.slotMin, 0);
    const ocup = cap ? Math.round((usados / cap) * 100) : 0;
    $('#kpis').innerHTML = `
      <div class="kpi"><small>Reservas</small><strong>${doDia.length}</strong><span>${conc.length} concluídas · ${faltas} faltas</span></div>
      <div class="kpi"><small>Faturamento previsto</small><strong>${brl(fat)}</strong><span>${brl(conc.reduce((a, r) => a + r.total, 0))} já realizado</span></div>
      <div class="kpi"><small>Ocupação</small><strong>${ocup}%</strong><span>${hrs ? `${Math.max(0, cap - usados)} horários livres` : 'Fechado'}</span></div>
      <div class="kpi kpi--hot"><small>Próximo cliente</small><strong>${prox ? esc(prox.cliente.nome) : '—'}</strong><span>${proxTxt}${prox ? ' · ' + esc(nomeB(prox.barbeiroId)) : ''}</span></div>`;
  }

  function renderAgenda() {
    const ag = $('#agenda');
    const d = DB.parseYmd(dia);
    const hrs = C.horarios[d.getDay()];
    if (!hrs) {
      ag.style.gridTemplateColumns = '1fr';
      ag.innerHTML = `<div class="closed"><svg><use href="#capitao"/></svg><strong>Fechado</strong>${DIAS[d.getDay()]} a barbearia não abre.</div>`;
      return;
    }
    const db = DB.load();
    const [abre, fecha] = hrs.map(DB.toMin);
    const step = C.slotMin, rows = (fecha - abre) / step;
    const rowH = 44;
    const now = new Date(), isHoje = dia === DB.ymd(now), nowMin = now.getHours() * 60 + now.getMinutes();
    const isPastDay = dia < DB.ymd(now);

    ag.style.gridTemplateColumns = `64px repeat(${C.barbeiros.length}, minmax(180px, 1fr))`;
    let html = `<div class="agenda__head" style="justify-content:center">⏱</div>`;
    C.barbeiros.forEach(b => {
      const n = db.reservas.filter(r => r.data === dia && r.barbeiroId === b.id && r.status !== 'cancelado').length;
      html += `<div class="agenda__head"><span class="av"><svg><use href="#capitao"/></svg></span><div>${esc(b.nome)}<small>${n} ${n === 1 ? 'cliente' : 'clientes'}</small></div></div>`;
    });
    html += `<div class="agenda__times">`;
    for (let i = 0; i < rows; i++) html += `<div class="agenda__time">${i === 0 ? '' : DB.toHHMM(abre + i * step)}</div>`;
    html += `</div>`;

    C.barbeiros.forEach(b => {
      html += `<div class="agenda__col" data-b="${b.id}">`;
      const bloq = new Set(db.bloqueios.filter(x => x.barbeiroId === b.id && x.data === dia).map(x => x.hora));
      for (let i = 0; i < rows; i++) {
        const m = abre + i * step, h = DB.toHHMM(m);
        const past = isPastDay || (isHoje && m + step <= nowMin);
        html += `<button class="cell ${bloq.has(h) ? 'is-blocked' : ''} ${past ? 'is-past' : ''}" data-h="${h}" aria-label="${esc(b.nome)} ${h}${bloq.has(h) ? ' bloqueado' : ' livre'}"></button>`;
      }
      db.reservas.filter(r => r.data === dia && r.barbeiroId === b.id && r.status !== 'cancelado').forEach(r => {
        const top = ((DB.toMin(r.hora) - abre) / step) * rowH + 2;
        const hgt = (r.duracao / step) * rowH - 4;
        const fim = DB.toHHMM(DB.toMin(r.hora) + r.duracao);
        html += `<button class="appt appt--${r.status} ${hgt < 60 ? 'appt--compact' : ''} ${knownIds.has(r.id) ? '' : 'is-new'}" data-id="${r.id}" style="top:${top}px;height:${hgt}px">
          <span class="appt__t">${r.hora} – ${fim}${r.origem === 'site' ? ' · site' : ''}</span>
          <strong>${esc(r.cliente.nome)}</strong>
          ${hgt > 50 ? `<small>${esc(r.servicos.map(s => s.nome).join(' + '))}</small>` : ''}
        </button>`;
      });
      html += `</div>`;
    });
    ag.innerHTML = html;
    ag.style.setProperty('--row', rowH + 'px');
    if (isHoje && nowMin >= abre && nowMin <= fecha) {
      const line = document.createElement('div');
      line.className = 'nowline';
      line.style.top = (ag.querySelector('.agenda__head').offsetHeight + ((nowMin - abre) / step) * rowH) + 'px';
      line.style.left = '64px';
      ag.appendChild(line);
    }
    DB.load().reservas.forEach(r => knownIds.add(r.id));
  }

  $('#agenda').addEventListener('click', (e) => {
    const ap = e.target.closest('.appt');
    if (ap) return openDrawer(ap.dataset.id);
    const cell = e.target.closest('.cell'); if (!cell) return;
    const b = cell.closest('.agenda__col').dataset.b, h = cell.dataset.h;
    if (blockMode || cell.classList.contains('is-blocked')) {
      DB.alternarBloqueio(b, dia, h);
      renderAgenda(); renderKpis();
      return;
    }
    openNew({ barbeiro: b, data: dia, hora: h });
  });

  /* ---------- Lista ---------- */
  function renderLista() {
    const db = DB.load(), q = $('#q').value.trim().toLowerCase(), fs = $('#fStatus').value;
    const hoje = DB.ymd(new Date());
    const itens = db.reservas
      .filter(r => r.data >= hoje || q)
      .filter(r => !fs || r.status === fs)
      .filter(r => !q || [r.cliente.nome, r.cliente.telefone, r.id].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    if (!itens.length) { $('#list').innerHTML = `<div class="empty">Nenhuma reserva encontrada.<br/>Use "Gerar dados demo" pra testar o painel.</div>`; return; }
    const grupos = {};
    itens.forEach(r => (grupos[r.data] ||= []).push(r));
    $('#list').innerHTML = Object.entries(grupos).map(([d, rs]) => `
      <div class="day-group">
        <h3>${d === hoje ? 'Hoje · ' : ''}${fmtDia(d)}<span>${rs.length} · ${brl(rs.filter(r => r.status !== 'cancelado').reduce((a, r) => a + r.total, 0))}</span></h3>
        ${rs.map(r => `
          <button class="row" data-id="${r.id}">
            <b>${r.hora}</b>
            <span class="nm">${esc(r.cliente.nome)}<small>${esc(r.cliente.telefone || 'sem telefone')}</small></span>
            <span class="sv">${esc(r.servicos.map(s => s.nome).join(' + '))}<small>${r.duracao} min</small></span>
            <span class="bb">${esc(nomeB(r.barbeiroId))}</span>
            <span class="val">${brl(r.total)}</span>
            <span class="pill pill--${r.status}">${STATUS[r.status]}</span>
          </button>`).join('')}
      </div>`).join('');
  }
  $('#q').addEventListener('input', renderLista);
  $('#fStatus').addEventListener('change', renderLista);
  $('#list').addEventListener('click', (e) => { const r = e.target.closest('.row'); if (r) openDrawer(r.dataset.id); });

  /* ---------- Drawer ---------- */
  const drawer = $('#drawer'), scrim = $('#scrim');
  function openDrawer(id) {
    const r = DB.load().reservas.find(x => x.id === id); if (!r) return;
    const fone = (r.cliente.telefone || '').replace(/\D/g, '');
    const msg = `Olá, ${r.cliente.nome.split(' ')[0]}! Aqui é da Barbearia Capitão. Confirmando seu horário: ${fmtDia(r.data)} às ${r.hora} (${r.servicos.map(s => s.nome).join(' + ')}). Te esperamos!`;
    drawer.innerHTML = `
      <button class="drawer__close" aria-label="Fechar">×</button>
      <div><span class="drawer__code">Reserva #${r.id.slice(-6)} · via ${r.origem === 'site' ? 'site' : r.origem === 'demo' ? 'demo' : 'balcão'}</span>
      <h2>${esc(r.cliente.nome)}</h2></div>
      <dl>
        <div><dt>Quando</dt><dd>${fmtDia(r.data)} · ${r.hora}</dd></div>
        <div><dt>Barbeiro</dt><dd>${esc(nomeB(r.barbeiroId))}</dd></div>
        <div><dt>Serviços</dt><dd>${esc(r.servicos.map(s => s.nome).join(' + '))}</dd></div>
        <div><dt>Duração</dt><dd>${r.duracao} min</dd></div>
        <div><dt>Total</dt><dd>${brl(r.total)}</dd></div>
        <div><dt>WhatsApp</dt><dd>${esc(r.cliente.telefone || '—')}</dd></div>
      </dl>
      ${r.obs ? `<div class="drawer__obs">“${esc(r.obs)}”</div>` : ''}
      <h4>Status</h4>
      <div class="status-btns">${Object.entries(STATUS).map(([k, v]) => `<button data-s="${k}" aria-pressed="${r.status === k}">${v}</button>`).join('')}</div>
      <div class="drawer__actions">
        ${fone ? `<a class="btn btn--sky" target="_blank" rel="noopener" href="https://wa.me/55${fone}?text=${encodeURIComponent(msg)}"><svg><use href="#i-wa"/></svg> Confirmar no WhatsApp</a>` : ''}
        <button class="btn btn--link" data-del>Excluir reserva</button>
      </div>`;
    drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); scrim.hidden = false;
    drawer.querySelector('.drawer__close').focus();
    drawer.querySelector('.drawer__close').onclick = closeDrawer;
    $$('.status-btns button', drawer).forEach(b => b.onclick = () => {
      DB.atualizar(id, { status: b.dataset.s });
      $$('.status-btns button', drawer).forEach(x => x.setAttribute('aria-pressed', x === b));
      toast(`Marcado como ${STATUS[b.dataset.s].toLowerCase()}`);
      render();
    });
    drawer.querySelector('[data-del]').onclick = () => {
      if (!confirm('Excluir essa reserva? Não dá pra desfazer.')) return;
      DB.remover(id); closeDrawer(); render(); toast('Reserva excluída');
    };
  }
  function closeDrawer() { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); scrim.hidden = true; }
  scrim.onclick = closeDrawer;

  /* ---------- Encaixe ---------- */
  const modal = $('#modal'), nf = $('#newForm');
  const selServ = new Set();
  $('#newServ').innerHTML = C.servicos.map(s => `<button type="button" class="chip" data-id="${s.id}" aria-pressed="false">${s.nome}</button>`).join('');
  $('#newBarber').innerHTML = C.barbeiros.map(b => `<option value="${b.id}">${esc(b.nome)}</option>`).join('');
  const durNew = () => {
    const raw = C.servicos.filter(s => selServ.has(s.id)).reduce((a, s) => a + s.duracao, 0) || C.slotMin;
    return Math.ceil(raw / C.slotMin) * C.slotMin;
  };
  /** No balcão pode encaixar mesmo em horário que já passou hoje — só respeita ocupação */
  function livresBalcao(b, data, dur) {
    const hrs = C.horarios[DB.parseYmd(data).getDay()]; if (!hrs) return [];
    const [abre, fecha] = hrs.map(DB.toMin), occ = DB.ocupados(DB.load(), b, data), out = [];
    for (let m = abre; m + dur <= fecha; m += C.slotMin) {
      let ok = true; for (let k = m; k < m + dur; k += C.slotMin) if (occ.has(k)) { ok = false; break; }
      if (ok) out.push(DB.toHHMM(m));
    }
    return out;
  }
  function fillHoras(pref) {
    const hs = livresBalcao($('#newBarber').value, $('#newDate').value, durNew());
    const cur = pref || $('#newHora').value;
    $('#newHora').innerHTML = hs.length ? hs.map(h => `<option ${h === cur ? 'selected' : ''}>${h}</option>`).join('') : '<option value="">Sem horário livre</option>';
  }
  $('#newServ').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    selServ.has(c.dataset.id) ? selServ.delete(c.dataset.id) : selServ.add(c.dataset.id);
    c.setAttribute('aria-pressed', selServ.has(c.dataset.id));
    fillHoras();
  });
  $('#newBarber').onchange = () => fillHoras();
  $('#newDate').onchange = () => fillHoras();
  function openNew({ barbeiro, data, hora } = {}) {
    nf.reset(); selServ.clear(); $$('.chip', nf).forEach(c => c.setAttribute('aria-pressed', 'false'));
    const first = $('.chip', nf); selServ.add(first.dataset.id); first.setAttribute('aria-pressed', 'true');
    $('#newBarber').value = barbeiro || C.barbeiros[0].id;
    $('#newDate').value = data || dia;
    $('#newErr').textContent = '';
    fillHoras(hora);
    modal.showModal();
    nf.nome.focus();
  }
  $('#newBtn').onclick = () => openNew();
  nf.addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'save') return;
    e.preventDefault();
    const nome = nf.nome.value.trim();
    if (!nome) { $('#newErr').textContent = 'Coloca o nome do cliente.'; return; }
    if (!selServ.size) { $('#newErr').textContent = 'Escolha pelo menos um serviço.'; return; }
    if (!nf.hora.value) { $('#newErr').textContent = 'Sem horário livre pra essa duração.'; return; }
    const sv = C.servicos.filter(s => selServ.has(s.id));
    DB.criar({
      servicos: sv.map(s => ({ id: s.id, nome: s.nome, preco: s.preco })),
      barbeiroId: nf.barbeiro.value, data: nf.data.value, hora: nf.hora.value, duracao: durNew(),
      total: sv.reduce((a, s) => a + s.preco, 0), cliente: { nome, telefone: nf.telefone.value.trim() },
      obs: nf.obs.value.trim(), origem: 'balcao', forcar: true,
    });
    modal.close();
    dia = nf.data.value;
    render();
    toast('Encaixe salvo ✂');
  });

  /* ---------- Demo / CSV ---------- */
  $('#seedBtn').onclick = () => {
    const nomes = ['Rafael S.', 'Bruno M.', 'Diego A.', 'Lucas P.', 'Thiago R.', 'Matheus C.', 'Gabriel L.', 'João V.', 'Pedro H.', 'Caio F.', 'Enzo (kids)', 'Vinícius T.', 'André O.', 'Felipe N.'];
    const db = DB.load();
    const base = new Date(); base.setHours(0, 0, 0, 0);
    let n = 0;
    for (let off = 0; off < 3; off++) {
      const d = new Date(base); d.setDate(base.getDate() + off);
      const data = DB.ymd(d), hrs = C.horarios[d.getDay()];
      if (!hrs) continue;
      C.barbeiros.forEach(b => {
        let m = DB.toMin(hrs[0]) + C.slotMin * Math.floor(Math.random() * 3);
        while (m < DB.toMin(hrs[1]) - 60) {
          if (Math.random() < .62) {
            const s = C.servicos[Math.floor(Math.random() * 8)];
            const dur = Math.ceil(s.duracao / C.slotMin) * C.slotMin;
            const occ = DB.ocupados(db, b.id, data);
            let free = true; for (let k = m; k < m + dur; k += C.slotMin) if (occ.has(k)) free = false;
            if (free) {
              const passou = off === 0 && m + dur < new Date().getHours() * 60 + new Date().getMinutes();
              db.reservas.push({
                id: DB.uid(), status: passou ? (Math.random() < .88 ? 'concluido' : 'falta') : 'confirmado',
                criadoEm: new Date().toISOString(), origem: 'demo',
                servicos: [{ id: s.id, nome: s.nome, preco: s.preco }], barbeiroId: b.id, data, hora: DB.toHHMM(m),
                duracao: dur, total: s.preco, cliente: { nome: nomes[Math.floor(Math.random() * nomes.length)], telefone: '(11) 9' + String(Math.floor(1e7 + Math.random() * 9e7)).slice(0, 4) + '-' + String(Math.floor(1000 + Math.random() * 8999)) }, obs: '',
              });
              n++;
            }
            m += dur;
          }
          m += C.slotMin;
        }
      });
    }
    DB.save(db); knownIds = new Set(db.reservas.map(r => r.id));
    render(); toast(`${n} reservas demo criadas`);
  };
  $('#clearDemoBtn').onclick = () => {
    const db = DB.load(); const antes = db.reservas.length;
    db.reservas = db.reservas.filter(r => r.origem !== 'demo'); DB.save(db);
    render(); toast(`${antes - db.reservas.length} reservas demo removidas`);
  };
  $('#csvBtn').onclick = () => {
    const rs = DB.load().reservas.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    const cols = ['codigo', 'data', 'hora', 'barbeiro', 'cliente', 'telefone', 'servicos', 'duracao_min', 'total', 'status', 'origem'];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(';'), ...rs.map(r => [r.id.slice(-6), r.data, r.hora, nomeB(r.barbeiroId), r.cliente.nome, r.cliente.telefone,
      r.servicos.map(s => s.nome).join(' + '), r.duracao, String(r.total).replace('.', ','), STATUS[r.status], r.origem].map(q).join(';'))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `reservas-capitao-${DB.ymd(new Date())}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  /* ---------- Tempo real (outra aba / site) ---------- */
  addEventListener('storage', (e) => {
    if (e.key !== DB.KEY) return;
    const novas = DB.load().reservas.filter(r => !knownIds.has(r.id));
    if (novas.length) toast(`🔔 Nova reserva: ${novas[0].cliente.nome} · ${novas[0].hora}`);
    render();
  });
  setInterval(() => { if (!$('#app').hidden) { renderKpis(); if ($('[data-view="agenda"].view').classList.contains('is-active') && !drawer.classList.contains('is-open')) renderAgenda(); } }, 60000);
})();
