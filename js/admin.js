/* =========================================================
   BARBEARIA CAPITÃO — Painel de reservas (v1.3)
   Dados via CapitaoStore:
     • Supabase: login por e-mail/senha (Auth) + permissões RLS + tempo real
     • Demonstração: código 1234 -> dados fictícios só no aparelho (localStorage)
   ========================================================= */
(() => {
  const C = window.CAPITAO, DB = window.CapitaoDB, S = window.CapitaoStore;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const STATUS = { confirmado: 'Confirmado', concluido: 'Concluído', falta: 'Faltou', cancelado: 'Cancelado' };
  const ONLINE = S.mode === 'supabase';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nomeB = (id) => C.barbeiros.find(b => b.id === id)?.nome || id;
  const fmtDia = (ymd) => { const d = DB.parseYmd(ymd); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 2800); };
  const erro = (ex) => toast('⚠ ' + (ex instanceof S.StoreError ? ex.message : 'Falha de conexão. Tente de novo.'));

  let dia = DB.ymd(new Date());
  let blockMode = false;
  let cache = { reservas: [], bloqueios: [], inicio: null, fim: null };
  let knownIds = null; // ids já vistos (pra destacar reservas novas)
  let pararRealtime = null;

  /* ---------- Login ---------- */
  const boxes = $$('#pinBoxes input');
  $('#modeTag').textContent = ONLINE ? 'Painel · online' : 'Painel · demonstração';
  $('#loginForm').hidden = !S.onlineDisponivel;

  boxes.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '');
      if (inp.value && i < boxes.length - 1) boxes[i + 1].focus();
      if (boxes.every(b => b.value)) $('#demoForm').requestSubmit();
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && i > 0) boxes[i - 1].focus(); });
    inp.addEventListener('paste', (e) => {
      const v = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      if (!v) return; e.preventDefault();
      v.split('').forEach((c, k) => boxes[k] && (boxes[k].value = c));
      if (v.length === 4) $('#demoForm').requestSubmit();
    });
  });

  // Demonstração: código 1234 -> dados fictícios locais (site + painel neste aparelho)
  $('#demoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (boxes.map(b => b.value).join('') !== '1234') {
      $('#demoErr').textContent = 'Código incorreto. Use 1234.';
      $('#pinBoxes').classList.remove('is-shake'); void $('#pinBoxes').offsetWidth; $('#pinBoxes').classList.add('is-shake');
      boxes.forEach(b => b.value = ''); boxes[0].focus();
      return;
    }
    S.entrarDemo();
    if (ONLINE) { location.reload(); return; } // recarrega já no modo demonstração
    entrar();
  });

  // Acesso real da barbearia (Supabase Auth)
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn');
    btn.disabled = true; btn.textContent = 'Entrando…'; $('#loginErr').textContent = '';
    try {
      if (!ONLINE) { S.sairDemo(); location.reload(); return; }
      await S.auth.entrar($('#loginEmail').value.trim(), $('#loginPass').value);
      entrar();
    } catch (ex) {
      $('#loginErr').textContent = ex instanceof S.StoreError ? ex.message : 'Falha de conexão.';
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });

  async function entrar() {
    $('#login').hidden = true; $('#app').hidden = false;
    $('#demoBar').hidden = ONLINE;
    $('#logoutBtn').textContent = ONLINE ? 'Sair' : 'Sair da demonstração';
    pararRealtime = S.aoMudar((evento, r) => {
      if (evento === 'INSERT' && r && knownIds && !knownIds.has(r.id)) toast(`🔔 Nova reserva: ${r.cliente.nome} · ${fmtDia(r.data).split(',')[0]} ${r.hora}`);
      refresh();
    });
    await refresh(true);
    // demonstração vazia: já preenche com clientes fictícios pra ficar realista
    if (!ONLINE && !cache.reservas.length) $('#seedBtn').click();
  }
  (async () => {
    try {
      const sessao = await S.auth.sessao();
      if (sessao && await S.auth.ehAdmin()) return entrar();
    } catch {}
    boxes[0].focus();
  })();
  $('#logoutBtn').onclick = async () => {
    pararRealtime?.();
    if (ONLINE) await S.auth.sair(); else S.sairDemo();
    location.reload();
  };

  /* ---------- Carregamento ---------- */
  const hoje = () => DB.ymd(new Date());
  function janela() {
    const h = hoje();
    const ini = [DB.addDias(h, -30), DB.addDias(dia, -1)].sort()[0];
    const fim = [DB.addDias(h, 60), DB.addDias(dia, 1)].sort().pop();
    return [ini, fim];
  }
  let seq = 0;
  async function refresh(forcar = false) {
    const [ini, fim] = janela();
    const my = ++seq;
    $('.main').classList.add('loading');
    try {
      const dados = await S.listar(ini, fim);
      if (my !== seq) return;
      cache = { ...dados, inicio: ini, fim };
      if (!knownIds || forcar) knownIds = new Set(cache.reservas.map(r => r.id));
      render();
      cache.reservas.forEach(r => knownIds.add(r.id));
    } catch (ex) {
      if (my === seq) erro(ex);
    } finally {
      if (my === seq) $('.main').classList.remove('loading');
    }
  }
  /** Muda o dia mostrado; só vai ao servidor se sair da janela em cache */
  function setDia(novo) {
    dia = novo;
    if (dia < cache.inicio || dia > cache.fim) refresh(); else render();
  }

  /* ---------- Navegação ---------- */
  $$('.side__nav button').forEach(b => b.addEventListener('click', () => {
    $$('.side__nav button').forEach(x => x.classList.toggle('is-active', x === b));
    $$('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === b.dataset.view));
    render();
  }));
  $('#prevDay').onclick = () => setDia(DB.addDias(dia, -1));
  $('#nextDay').onclick = () => setDia(DB.addDias(dia, 1));
  $('#todayBtn').onclick = () => setDia(hoje());
  $('#datePick').onchange = (e) => { if (e.target.value) setDia(e.target.value); };
  function setBlockMode(on) {
    blockMode = on;
    $('#blockMode').setAttribute('aria-pressed', on);
    $('#blockMode').lastChild.textContent = on ? ' Concluir bloqueio' : ' Bloquear horários';
    $('#agenda').classList.toggle('block-mode', on);
    $('#blockHint').hidden = !on;
    if (on) $$('.side__nav button').find(b => b.dataset.view === 'agenda' && !b.classList.contains('is-active'))?.click();
  }
  $('#blockMode').onclick = () => setBlockMode(!blockMode);
  $('#blockDone').onclick = () => setBlockMode(false);
  addEventListener('keydown', (e) => {
    if ($('#app').hidden || e.target.closest('input, select, textarea, dialog')) return;
    if (e.key === 'ArrowLeft') setDia(DB.addDias(dia, -1));
    if (e.key === 'ArrowRight') setDia(DB.addDias(dia, 1));
    if (e.key === 'Escape') closeDrawer();
  });

  /* ---------- Render ---------- */
  const ativas = () => cache.reservas.filter(r => r.status !== 'cancelado');
  const ocupacao = () => [
    ...ativas().map(r => ({ id: r.id, barbeiroId: r.barbeiroId, data: r.data, hora: r.hora, duracao: r.duracao })),
    ...cache.bloqueios.map(b => ({ barbeiroId: b.barbeiroId, data: b.data, hora: b.hora, duracao: C.slotMin })),
  ];

  function render() {
    if ($('#app').hidden) return;
    const d = DB.parseYmd(dia);
    $('#dateTitle').textContent = dia === hoje() ? `Hoje · ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}` : fmtDia(dia);
    $('#datePick').value = dia;
    renderKpis();
    if ($('[data-view="agenda"].view').classList.contains('is-active')) renderAgenda();
    else renderLista();
    if (drawer.classList.contains('is-open') && drawer.dataset.id) {
      if (cache.reservas.some(r => r.id === drawer.dataset.id)) openDrawer(drawer.dataset.id, true); else closeDrawer();
    }
  }

  function renderKpis() {
    const doDia = ativas().filter(r => r.data === dia);
    const fat = doDia.filter(r => r.status !== 'falta').reduce((a, r) => a + r.total, 0);
    const conc = doDia.filter(r => r.status === 'concluido');
    const faltas = doDia.filter(r => r.status === 'falta').length;
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const isHoje = dia === hoje();
    const prox = doDia.filter(r => r.status === 'confirmado' && (!isHoje || DB.toMin(r.hora) + r.duracao > nowMin))
      .sort((a, b) => a.hora.localeCompare(b.hora))[0];
    let proxTxt = 'Agenda livre';
    if (prox) {
      const diff = DB.toMin(prox.hora) - nowMin;
      proxTxt = isHoje ? (diff <= 0 ? 'na cadeira agora' : diff < 60 ? `em ${diff} min` : `às ${prox.hora}`) : `às ${prox.hora}`;
    }
    const hrs = C.horarios[DB.parseYmd(dia).getDay()];
    const cap = hrs ? ((DB.toMin(hrs[1]) - DB.toMin(hrs[0])) / C.slotMin) * C.barbeiros.length : 0;
    const usados = doDia.reduce((a, r) => a + Math.ceil(r.duracao / C.slotMin), 0);
    const ocup = cap ? Math.round((usados / cap) * 100) : 0;
    $('#kpis').innerHTML = `
      <div class="kpi"><small>Reservas</small><strong>${doDia.length}</strong><span>${conc.length} concluídas · ${faltas} faltas</span></div>
      <div class="kpi"><small>Faturamento previsto</small><strong>${brl(fat)}</strong><span>${brl(conc.reduce((a, r) => a + r.total, 0))} já realizado</span></div>
      <div class="kpi"><small>Ocupação</small><strong>${ocup}%</strong><span>${hrs ? `${Math.max(0, cap - usados - cache.bloqueios.filter(b => b.data === dia).length)} horários livres` : 'Fechado'}</span></div>
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
    const [abre, fecha] = hrs.map(DB.toMin);
    const step = C.slotMin, rows = (fecha - abre) / step;
    const rowH = 44;
    const now = new Date(), isHoje = dia === hoje(), nowMin = now.getHours() * 60 + now.getMinutes();
    const isPastDay = dia < hoje();

    ag.style.gridTemplateColumns = `64px repeat(${C.barbeiros.length}, minmax(180px, 1fr))`;
    let html = `<div class="agenda__head" style="justify-content:center">⏱</div>`;
    C.barbeiros.forEach(b => {
      const n = ativas().filter(r => r.data === dia && r.barbeiroId === b.id).length;
      html += `<div class="agenda__head" data-b="${b.id}"><span class="av"><svg><use href="#capitao"/></svg></span><div>${esc(b.nome)}<small>${n} ${n === 1 ? 'cliente' : 'clientes'}</small></div></div>`;
    });
    html += `<div class="agenda__times">`;
    for (let i = 0; i < rows; i++) html += `<div class="agenda__time">${i === 0 ? '' : DB.toHHMM(abre + i * step)}</div>`;
    html += `</div>`;

    C.barbeiros.forEach(b => {
      html += `<div class="agenda__col" data-b="${b.id}">`;
      const bloq = new Map(cache.bloqueios.filter(x => x.barbeiroId === b.id && x.data === dia).map(x => [x.hora, x.id]));
      for (let i = 0; i < rows; i++) {
        const m = abre + i * step, h = DB.toHHMM(m);
        const past = isPastDay || (isHoje && m + step <= nowMin);
        html += `<button class="cell ${bloq.has(h) ? 'is-blocked' : ''} ${past ? 'is-past' : ''}" data-h="${h}" ${bloq.has(h) ? `data-bloq="${bloq.get(h)}"` : ''} aria-label="${esc(b.nome)} ${h}${bloq.has(h) ? ' bloqueado' : ' livre'}"></button>`;
      }
      ativas().filter(r => r.data === dia && r.barbeiroId === b.id).forEach(r => {
        const top = ((DB.toMin(r.hora) - abre) / step) * rowH + 2;
        const hgt = (r.duracao / step) * rowH - 4;
        const fim = DB.toHHMM(DB.toMin(r.hora) + r.duracao);
        html += `<button class="appt appt--${r.status} ${hgt < 60 ? 'appt--compact' : ''} ${knownIds && !knownIds.has(r.id) ? 'is-new' : ''}" data-id="${r.id}" style="top:${top}px;height:${hgt}px">
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
  }

  $('#agenda').addEventListener('click', async (e) => {
    const head = e.target.closest('.agenda__head[data-b]');
    if (head && blockMode) return alternarDia(head.dataset.b);
    const ap = e.target.closest('.appt');
    if (ap) return openDrawer(ap.dataset.id);
    const cell = e.target.closest('.cell'); if (!cell) return;
    const b = cell.closest('.agenda__col').dataset.b, h = cell.dataset.h;
    if (blockMode || cell.dataset.bloq) {
      const liberar = !!cell.dataset.bloq;
      if (!blockMode && !confirm(`Liberar ${h} de ${nomeB(b)}? O horário volta a aparecer no site.`)) return;
      cell.disabled = true;
      try {
        await S.alternarBloqueio(b, dia, h, cell.dataset.bloq || null);
        await refresh();
        toast(liberar ? `${h} liberado — volta a aparecer no site` : `🔒 ${h} bloqueado — cliente não consegue reservar`);
      } catch (ex) { erro(ex); cell.disabled = false; }
      return;
    }
    openNew({ barbeiro: b, data: dia, hora: h });
  });

  /** Bloqueia todos os horários livres do barbeiro no dia; se já estiver tudo bloqueado, libera. */
  async function alternarDia(barbeiroId) {
    const hrs = C.horarios[DB.parseYmd(dia).getDay()]; if (!hrs) return;
    const [abre, fecha] = hrs.map(DB.toMin);
    const bloqueados = cache.bloqueios.filter(x => x.barbeiroId === barbeiroId && x.data === dia);
    const comReserva = DB.ocupados(ativas(), barbeiroId, dia);
    const jaBloq = new Set(bloqueados.map(x => x.hora));
    const livres = [];
    for (let m = abre; m < fecha; m += C.slotMin) {
      const h = DB.toHHMM(m);
      if (!jaBloq.has(h) && !comReserva.has(m)) livres.push(h);
    }
    try {
      if (livres.length) {
        const aviso = comReserva.size ? '\nAs reservas já marcadas continuam valendo.' : '';
        if (!confirm(`Bloquear o dia todo de ${nomeB(barbeiroId)} (${livres.length} horários livres)?${aviso}`)) return;
        await S.bloquearVarios(livres.map(hora => ({ barbeiroId, data: dia, hora })));
        await refresh();
        toast(`🔒 Dia de ${nomeB(barbeiroId)} bloqueado`);
      } else if (bloqueados.length) {
        if (!confirm(`Liberar os ${bloqueados.length} horários bloqueados de ${nomeB(barbeiroId)} nesse dia?`)) return;
        await S.liberarVarios(bloqueados.map(x => x.id));
        await refresh();
        toast(`Dia de ${nomeB(barbeiroId)} liberado`);
      }
    } catch (ex) { erro(ex); }
  }

  /* ---------- Lista ---------- */
  function renderLista() {
    const q = $('#q').value.trim().toLowerCase(), fs = $('#fStatus').value;
    const h = hoje();
    const itens = cache.reservas
      .filter(r => r.data >= h || q)
      .filter(r => !fs || r.status === fs)
      .filter(r => !q || [r.cliente.nome, r.cliente.telefone, r.codigo].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    if (!itens.length) { $('#list').innerHTML = `<div class="empty">Nenhuma reserva encontrada.<br/>Use "Gerar dados demo" pra testar o painel.</div>`; return; }
    const grupos = {};
    itens.forEach(r => (grupos[r.data] ||= []).push(r));
    $('#list').innerHTML = Object.entries(grupos).map(([d, rs]) => `
      <div class="day-group">
        <h3>${d === h ? 'Hoje · ' : ''}${fmtDia(d)}<span>${rs.length} · ${brl(rs.filter(r => r.status !== 'cancelado').reduce((a, r) => a + r.total, 0))}</span></h3>
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
  function openDrawer(id, silencioso = false) {
    const r = cache.reservas.find(x => x.id === id); if (!r) return;
    drawer.dataset.id = id;
    const fone = (r.cliente.telefone || '').replace(/\D/g, '');
    const msg = `Olá, ${r.cliente.nome.split(' ')[0]}! Aqui é da Barbearia Capitão. Confirmando seu horário: ${fmtDia(r.data)} às ${r.hora} (${r.servicos.map(s => s.nome).join(' + ')}). Te esperamos!`;
    drawer.innerHTML = `
      <button class="drawer__close" aria-label="Fechar">×</button>
      <div><span class="drawer__code">Reserva #${esc(r.codigo)} · via ${r.origem === 'site' ? 'site' : r.origem === 'demo' ? 'demo' : 'balcão'}</span>
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
    if (!silencioso) drawer.querySelector('.drawer__close').focus();
    drawer.querySelector('.drawer__close').onclick = closeDrawer;
    $$('.status-btns button', drawer).forEach(b => b.onclick = async () => {
      if (b.dataset.s === 'cancelado' && !confirm('Cancelar essa reserva? O horário volta a ficar livre no site.')) return;
      try {
        await S.atualizar(id, { status: b.dataset.s });
        toast(`Marcado como ${STATUS[b.dataset.s].toLowerCase()}`);
        await refresh();
      } catch (ex) { erro(ex); }
    });
    drawer.querySelector('[data-del]').onclick = async () => {
      if (!confirm('Excluir essa reserva? Não dá pra desfazer.')) return;
      try { await S.remover(id); closeDrawer(); await refresh(); toast('Reserva excluída'); } catch (ex) { erro(ex); }
    };
  }
  function closeDrawer() { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); drawer.dataset.id = ''; scrim.hidden = true; }
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
  function fillHoras(pref) {
    const data = $('#newDate').value;
    const hs = (data >= cache.inicio && data <= cache.fim)
      ? DB.livres(ocupacao(), $('#newBarber').value, data, durNew(), false) // balcão pode encaixar horário que já passou
      : [];
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
  $('#newDate').onchange = async () => {
    const d = $('#newDate').value;
    if (d && (d < cache.inicio || d > cache.fim)) { dia = d; await refresh(); }
    fillHoras();
  };
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
  nf.addEventListener('submit', async (e) => {
    if (e.submitter?.value !== 'save') return;
    e.preventDefault();
    const nome = nf.nome.value.trim();
    if (nome.length < 2) { $('#newErr').textContent = 'Coloca o nome do cliente.'; return; }
    if (!selServ.size) { $('#newErr').textContent = 'Escolha pelo menos um serviço.'; return; }
    if (!nf.hora.value) { $('#newErr').textContent = 'Sem horário livre pra essa duração.'; return; }
    const sv = C.servicos.filter(s => selServ.has(s.id));
    const btn = $('#newSave'); btn.disabled = true;
    try {
      await S.criarBalcao({
        servicos: sv.map(s => ({ id: s.id, nome: s.nome, preco: s.preco })),
        barbeiroId: nf.barbeiro.value, data: nf.data.value, hora: nf.hora.value, duracao: durNew(),
        total: sv.reduce((a, s) => a + s.preco, 0), cliente: { nome, telefone: nf.telefone.value.trim() },
        obs: nf.obs.value.trim(), origem: 'balcao',
      });
      modal.close();
      dia = nf.data.value;
      await refresh();
      toast('Encaixe salvo ✂');
    } catch (ex) {
      $('#newErr').textContent = ex instanceof S.StoreError ? ex.message : 'Falha de conexão.';
    } finally { btn.disabled = false; }
  });

  /* ---------- Demo / CSV ---------- */
  $('#seedBtn').onclick = async () => {
    const nomes = ['Rafael S.', 'Bruno M.', 'Diego A.', 'Lucas P.', 'Thiago R.', 'Matheus C.', 'Gabriel L.', 'João V.', 'Pedro H.', 'Caio F.', 'Enzo (kids)', 'Vinícius T.', 'André O.', 'Felipe N.'];
    const occ = ocupacao(), novas = [];
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    for (let off = 0; off < 3; off++) {
      const data = DB.addDias(hoje(), off), hrs = C.horarios[DB.parseYmd(data).getDay()];
      if (!hrs) continue;
      C.barbeiros.forEach(b => {
        let m = DB.toMin(hrs[0]) + C.slotMin * Math.floor(Math.random() * 3);
        while (m < DB.toMin(hrs[1]) - 60) {
          if (Math.random() < .6) {
            const s = C.servicos[Math.floor(Math.random() * 8)];
            const dur = Math.ceil(s.duracao / C.slotMin) * C.slotMin;
            const livre = DB.livres([...occ, ...novas], b.id, data, dur, false).includes(DB.toHHMM(m));
            if (livre) {
              const passou = off === 0 && m + dur < nowMin;
              novas.push({
                status: passou ? (Math.random() < .88 ? 'concluido' : 'falta') : 'confirmado', origem: 'demo',
                servicos: [{ id: s.id, nome: s.nome, preco: s.preco }], barbeiroId: b.id, data, hora: DB.toHHMM(m),
                duracao: dur, total: s.preco, obs: '',
                cliente: { nome: nomes[Math.floor(Math.random() * nomes.length)], telefone: '(11) 9' + String(1000 + Math.floor(Math.random() * 8999)) + '-' + String(1000 + Math.floor(Math.random() * 8999)) },
              });
            }
            m += dur;
          }
          m += C.slotMin;
        }
      });
    }
    try { const n = await S.criarVarias(novas); await refresh(true); toast(`${n} reservas demo criadas`); } catch (ex) { erro(ex); }
  };
  $('#clearDemoBtn').onclick = async () => {
    if (!confirm('Apagar todas as reservas de demonstração?')) return;
    try { const n = await S.limparDemo(); await refresh(); toast(`${n} reservas demo removidas`); } catch (ex) { erro(ex); }
  };
  $('#csvBtn').onclick = () => {
    const rs = [...cache.reservas].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    const cols = ['codigo', 'data', 'hora', 'barbeiro', 'cliente', 'telefone', 'servicos', 'duracao_min', 'total', 'status', 'origem'];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(';'), ...rs.map(r => [r.codigo, r.data, r.hora, nomeB(r.barbeiroId), r.cliente.nome, r.cliente.telefone,
      r.servicos.map(s => s.nome).join(' + '), r.duracao, String(r.total).replace('.', ','), STATUS[r.status], r.origem].map(q).join(';'))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `reservas-capitao-${hoje()}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // relógio: atualiza "próximo cliente" e a linha do agora
  setInterval(() => { if (!$('#app').hidden && !drawer.classList.contains('is-open')) render(); }, 60000);
})();
