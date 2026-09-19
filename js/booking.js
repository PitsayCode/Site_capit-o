/* =========================================================
   BARBEARIA CAPITÃO — Reserva online (v1.1)
   Grava via CapitaoStore (Supabase, ou localStorage em modo local).
   ========================================================= */
(() => {
  const C = window.CAPITAO, DB = window.CapitaoDB, S = window.CapitaoStore;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DIAS_C = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MESES_C = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const st = { step: 1, servicos: new Set(), barbeiro: null, data: null, hora: null, ultima: null };

  const servSel = () => C.servicos.filter(s => st.servicos.has(s.id));
  const duracao = () => {
    const raw = servSel().reduce((a, s) => a + s.duracao, 0);
    return Math.max(C.slotMin, Math.ceil(raw / C.slotMin) * C.slotMin);
  };
  const total = () => servSel().reduce((a, s) => a + s.preco, 0);
  const nomeBarbeiro = (id) => id === 'any' ? 'Sem preferência' : (C.barbeiros.find(b => b.id === id)?.nome || '—');
  const fmtData = (ymd) => { const d = DB.parseYmd(ymd); return `${DIAS_C[d.getDay()]}, ${d.getDate()} ${MESES_C[d.getMonth()]}`; };
  const fmtDur = (m) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`;

  /* Ocupação (sem dados pessoais) dos próximos dias, buscada do servidor */
  let ocupacao = [];
  async function carregarOcupacao() {
    const hoje = DB.ymd(new Date());
    ocupacao = await S.ocupacao(hoje, DB.addDias(hoje, C.diasAFrente));
  }

  /** Horários livres considerando "sem preferência" (união de todos) */
  function slotsDoDia(data) {
    const dur = duracao();
    if (st.barbeiro && st.barbeiro !== 'any') return DB.livres(ocupacao, st.barbeiro, data, dur);
    const set = new Set();
    C.barbeiros.forEach(b => DB.livres(ocupacao, b.id, data, dur).forEach(h => set.add(h)));
    return [...set].sort();
  }

  /* ---------- Passo 1: serviços ---------- */
  const pickServ = $('#pickServ');
  pickServ.innerHTML = C.servicos.map(s => `
    <button type="button" class="pick" data-id="${s.id}" aria-pressed="false">
      <span class="pick__box"><svg><use href="#i-check"/></svg></span>
      <span class="pick__txt"><strong>${s.nome}</strong><small>${s.duracao} min · ${s.desc}</small></span>
      <span class="pick__price">${brl(s.preco)}</span>
    </button>`).join('');
  pickServ.addEventListener('click', (e) => {
    const b = e.target.closest('.pick'); if (!b) return;
    const id = b.dataset.id;
    st.servicos.has(id) ? st.servicos.delete(id) : st.servicos.add(id);
    b.setAttribute('aria-pressed', st.servicos.has(id));
    st.hora = null; // duração mudou
    update();
  });

  /* ---------- Passo 2: barbeiro ---------- */
  const pickBarber = $('#pickBarber');
  pickBarber.innerHTML = [{ id: 'any', nome: 'Sem preferência', papel: 'O primeiro livre' }, ...C.barbeiros].map(b => `
    <button type="button" class="barber" data-id="${b.id}" aria-pressed="false">
      <span class="barber__avatar ${b.id === 'any' ? 'barber__avatar--any' : ''}"><svg><use href="#capitao"/></svg></span>
      <strong>${b.nome}</strong><small>${b.papel}</small>
    </button>`).join('');
  pickBarber.addEventListener('click', (e) => {
    const b = e.target.closest('.barber'); if (!b) return;
    st.barbeiro = b.dataset.id; st.hora = null;
    $$('.barber', pickBarber).forEach(x => x.setAttribute('aria-pressed', x === b));
    update();
    setTimeout(() => go(3), 250);
  });

  /* ---------- Passo 3: dia + horário ---------- */
  const pickDay = $('#pickDay'), pickSlot = $('#pickSlot');
  function renderDays() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let html = '';
    for (let i = 0; i < C.diasAFrente; i++) {
      const d = new Date(hoje); d.setDate(hoje.getDate() + i);
      const ymd = DB.ymd(d);
      const aberto = !!C.horarios[d.getDay()];
      const livres = aberto ? slotsDoDia(ymd).length : 0;
      const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DIAS_C[d.getDay()];
      html += `<button type="button" class="day" data-d="${ymd}" aria-pressed="${st.data === ymd}" ${livres ? '' : 'disabled'}>
        <small>${label}</small><strong>${d.getDate()}</strong><em>${aberto ? (livres ? MESES_C[d.getMonth()] : 'lotado') : 'fechado'}</em></button>`;
    }
    pickDay.innerHTML = html;
    if (!st.data || pickDay.querySelector(`[data-d="${st.data}"]:disabled`)) {
      const first = pickDay.querySelector('.day:not(:disabled)');
      st.data = first ? first.dataset.d : null;
      if (first) first.setAttribute('aria-pressed', 'true');
    }
    renderSlots();
  }
  function renderSlots() {
    if (!st.data) { pickSlot.innerHTML = '<p class="slots__empty">Nenhum dia disponível.</p>'; return; }
    const slots = slotsDoDia(st.data);
    if (!slots.length) { pickSlot.innerHTML = '<p class="slots__empty">Agenda cheia nesse dia. Tenta outro?</p>'; return; }
    const grupos = [['Manhã', h => h < '12:00'], ['Tarde', h => h >= '12:00' && h < '18:00'], ['Noite', h => h >= '18:00']];
    pickSlot.innerHTML = grupos.map(([nome, fn]) => {
      const hs = slots.filter(fn);
      if (!hs.length) return '';
      return `<span class="slots__label">${nome}</span>` +
        hs.map(h => `<button type="button" class="slot" data-h="${h}" aria-pressed="${st.hora === h}">${h}</button>`).join('');
    }).join('');
  }
  async function atualizarAgenda() {
    pickDay.innerHTML = '';
    pickSlot.innerHTML = '<p class="slots__empty">Consultando a agenda…</p>';
    try {
      await carregarOcupacao();
      renderDays();
    } catch (ex) {
      pickSlot.innerHTML = `<p class="slots__empty">Não consegui carregar a agenda. <button type="button" class="btn btn--link" data-retry>Tentar de novo</button></p>`;
    }
  }
  pickSlot.addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) atualizarAgenda(); });

  pickDay.addEventListener('click', (e) => {
    const b = e.target.closest('.day'); if (!b || b.disabled) return;
    st.data = b.dataset.d; st.hora = null;
    $$('.day', pickDay).forEach(x => x.setAttribute('aria-pressed', x === b));
    renderSlots(); update();
  });
  pickSlot.addEventListener('click', (e) => {
    const b = e.target.closest('.slot'); if (!b) return;
    st.hora = b.dataset.h;
    $$('.slot', pickSlot).forEach(x => x.setAttribute('aria-pressed', x === b));
    update();
  });

  /* ---------- Passo 4: dados ---------- */
  const form = $('#bookForm');
  const tel = form.telefone;
  tel.addEventListener('input', () => {
    let v = tel.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, v.length - 4)}-${v.slice(-4)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    tel.value = v;
  });
  try { const saved = JSON.parse(localStorage.getItem('capitao_cliente') || 'null'); if (saved) { form.nome.value = saved.nome || ''; form.telefone.value = saved.telefone || ''; } } catch {}

  function validar() {
    const nome = form.nome.value.trim(), fone = form.telefone.value.replace(/\D/g, '');
    form.nome.classList.toggle('is-invalid', nome.length < 2);
    form.telefone.classList.toggle('is-invalid', fone.length < 10);
    if (nome.length < 2) return 'Diz seu nome pra gente.';
    if (fone.length < 10) return 'WhatsApp inválido — coloca com DDD.';
    return '';
  }

  /* ---------- Navegação ---------- */
  const steps = $$('#wizSteps li'), panels = $$('.wizard__panel'), next = $('#wizNext'), back = $('#wizBack');
  function canNext() {
    return (st.step === 1 && st.servicos.size > 0) || (st.step === 2 && !!st.barbeiro) ||
           (st.step === 3 && !!st.hora) || st.step === 4;
  }
  function go(n) {
    st.step = n;
    panels.forEach(p => p.classList.toggle('is-active', +p.dataset.step === n));
    steps.forEach((li, i) => { li.classList.toggle('is-active', i + 1 === n); li.classList.toggle('is-done', i + 1 < n || n === 5); });
    $('#wizNav').classList.toggle('is-hidden', n === 5);
    if (n === 3) atualizarAgenda();
    if (n === 4) setTimeout(() => form.nome.focus({ preventScroll: true }), 300);
    update();
    const w = $('#wizard').getBoundingClientRect();
    if (w.top < 0) $('#wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  next.addEventListener('click', () => {
    if (st.step < 4) return go(st.step + 1);
    confirmar();
  });
  back.addEventListener('click', () => st.step > 1 && go(st.step - 1));
  form.addEventListener('submit', (e) => { e.preventDefault(); confirmar(); });

  function update() {
    back.disabled = st.step === 1;
    next.disabled = !canNext();
    next.textContent = st.step === 4 ? 'Confirmar reserva' : 'Continuar';
    // comanda
    const sel = servSel();
    $('#sumList').innerHTML = sel.length
      ? sel.map(s => `<li><span>${s.nome}</span><span>${brl(s.preco)}</span></li>`).join('')
      : '<li class="muted">Nenhum serviço ainda</li>';
    $('#sumBarber').textContent = st.barbeiro ? nomeBarbeiro(st.barbeiro) : '—';
    $('#sumWhen').textContent = st.data && st.hora ? `${fmtData(st.data)} · ${st.hora}` : (st.data && st.step >= 3 ? fmtData(st.data) : '—');
    $('#sumDur').textContent = sel.length ? fmtDur(duracao()) : '—';
    $('#sumTotal').textContent = brl(total());
  }

  let enviando = false;
  async function confirmar() {
    if (enviando) return;
    const err = validar();
    $('#formErr').textContent = err;
    if (err) return;
    const dur = duracao();
    const cliente = { nome: form.nome.value.trim(), telefone: form.telefone.value.trim() };
    enviando = true;
    next.disabled = true; next.textContent = 'Reservando…';
    try {
      await carregarOcupacao(); // dados frescos pra escolher o barbeiro livre
      let barbeiroId = st.barbeiro;
      if (barbeiroId === 'any') {
        const livre = C.barbeiros.find(b => DB.livres(ocupacao, b.id, st.data, dur).includes(st.hora));
        if (!livre) throw new S.StoreError('Esse horário acabou de ser ocupado. Escolha outro.');
        barbeiroId = livre.id;
      }
      const r = await S.criarReserva({
        servicos: servSel().map(s => ({ id: s.id, nome: s.nome, preco: s.preco })),
        barbeiroId, data: st.data, hora: st.hora, duracao: dur, total: total(),
        cliente, obs: form.obs.value.trim(),
      });
      try { localStorage.setItem('capitao_cliente', JSON.stringify(cliente)); } catch {}
      st.ultima = r;
      renderTicket(r);
      go(5);
      window.Sound?.ding();
      confete();
    } catch (ex) {
      $('#formErr').textContent = ex instanceof S.StoreError ? ex.message : 'Falha de conexão. Tente de novo.';
      if (/ocupado/.test(ex.message)) { st.hora = null; setTimeout(() => go(3), 1400); }
    } finally {
      enviando = false;
      update();
    }
  }

  function renderTicket(r) {
    $('#ticket').innerHTML = `
      <div class="ticket__head">
        <img src="assets/img/logo.jpg" alt="" />
        <div><strong>Reservado!</strong><small>Comprovante · Capitão</small></div>
        <span class="ticket__ok"><svg><use href="#i-check"/></svg></span>
      </div>
      <dl>
        <div><dt>Cliente</dt><dd>${esc(r.cliente.nome)}</dd></div>
        <div><dt>Serviço</dt><dd>${r.servicos.map(s => s.nome).join(' + ')}</dd></div>
        <div><dt>Barbeiro</dt><dd>${nomeBarbeiro(r.barbeiroId)}</dd></div>
        <div><dt>Quando</dt><dd>${fmtData(r.data)} · ${r.hora}</dd></div>
        <div><dt>Duração</dt><dd>${fmtDur(r.duracao)}</dd></div>
        <div><dt>Total</dt><dd>${brl(r.total)}</dd></div>
      </dl>
      <div class="ticket__code"><span>Código</span><b>${esc(r.codigo)}</b></div>`;
    const msg = `Olá, Capitão! Acabei de reservar pelo site:\n\n` +
      `• ${r.servicos.map(s => s.nome).join(' + ')}\n• ${fmtData(r.data)} às ${r.hora}\n• Barbeiro: ${nomeBarbeiro(r.barbeiroId)}\n` +
      `• Nome: ${r.cliente.nome}\n• Código: ${r.codigo}`;
    $('#waConfirm').href = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`;
  }

  $('#icsBtn').addEventListener('click', () => {
    const r = st.ultima; if (!r) return;
    const [y, m, d] = r.data.split('-'), [hh, mm] = r.hora.split(':');
    const ini = new Date(+y, m - 1, +d, +hh, +mm), fim = new Date(ini.getTime() + r.duracao * 60000);
    const f = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Barbearia Capitao//PT-BR', 'BEGIN:VEVENT',
      `UID:${r.id}@capitao`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(ini)}`, `DTEND:${f(fim)}`,
      `SUMMARY:Barbearia Capitão — ${r.servicos.map(s => s.nome).join(' + ')}`,
      `LOCATION:${C.endereco}\\, ${C.cidade}`, `DESCRIPTION:Código ${r.codigo}`,
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Corte na Capitão em 1h', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'reserva-capitao.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#newBooking').addEventListener('click', () => {
    st.servicos.clear(); st.barbeiro = null; st.data = null; st.hora = null;
    $$('.pick', pickServ).forEach(b => b.setAttribute('aria-pressed', 'false'));
    $$('.barber', pickBarber).forEach(b => b.setAttribute('aria-pressed', 'false'));
    form.obs.value = '';
    go(1);
  });

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* Confete de "cabelo" + listras do poste */
  function confete() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cores = ['#2ea3dc', '#f3efe6', '#16244a', '#c9a27a'];
    const box = $('#wizard').getBoundingClientRect();
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('i');
      p.className = 'hair';
      Object.assign(p.style, {
        left: box.left + box.width / 2 + (Math.random() * 200 - 100) + 'px',
        top: box.top + 120 + 'px', width: '4px', height: 8 + Math.random() * 10 + 'px',
        background: cores[i % cores.length], animationDuration: 1.2 + Math.random() + 's',
      });
      p.style.setProperty('--dx', (Math.random() * 500 - 250) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720) + 'deg');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 2400);
    }
  }

  // API pública — o cardápio de serviços usa pra pré-selecionar
  window.Booking = {
    preselect(id) {
      if (st.step === 5) $('#newBooking').click();
      st.servicos.add(id);
      st.hora = null; // duração mudou
      const b = pickServ.querySelector(`[data-id="${id}"]`);
      if (b) b.setAttribute('aria-pressed', 'true');
      go(1);
      toast('Adicionado à sua comanda ✂');
    },
  };

  // cliente voltou pra aba: busca a agenda de novo (pode ter mudado no painel)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && st.step === 3) atualizarAgenda(); });

  // modo local: atualiza horários se o painel mexer na agenda em outra aba
  if (S.mode === 'local') S.aoMudar(() => { if (st.step === 3) atualizarAgenda(); });

  if (S.demo && S.onlineDisponivel) $('#demoNote').hidden = false;

  update();
})();
