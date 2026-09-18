/* =========================================================
   BARBEARIA CAPITÃO — interações do site (beta 1.0)
   ========================================================= */
(() => {
  const C = window.CAPITAO;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Toast ---------- */
  let toastT;
  window.toast = (msg) => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('is-on'), 2800);
  };

  /* ---------- Som (WebAudio, sem arquivos) ---------- */
  const Sound = (() => {
    let ctx, on = false;
    try { on = localStorage.getItem('capitao_sound') === '1'; } catch {}
    const ensure = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
    function noise(dur, freq, gain) {
      const c = ensure();
      const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
      const g = c.createGain(); g.gain.value = gain;
      src.connect(f).connect(g).connect(c.destination);
      return src;
    }
    function snip() {
      if (!on) return;
      const c = ensure(); const t = c.currentTime;
      noise(.05, 3500, .25).start(t);
      noise(.04, 5000, .18).start(t + .07);
    }
    function clipper(dur = .7) {
      const c = ensure(); const t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 118;
      const lfo = c.createOscillator(); lfo.frequency.value = 60;
      const lg = c.createGain(); lg.gain.value = .02;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = .8;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .05);
      g.gain.setValueAtTime(.06, t + dur - .12); g.gain.linearRampToValueAtTime(0, t + dur);
      lfo.connect(lg).connect(g.gain);
      o.connect(f).connect(g).connect(c.destination);
      o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
    }
    function ding() {
      if (!on) return;
      const c = ensure(); const t = c.currentTime;
      [880, 1320].forEach((fr, i) => {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
        const g = c.createGain(); g.gain.setValueAtTime(.12, t + i * .12); g.gain.exponentialRampToValueAtTime(.001, t + i * .12 + .9);
        o.connect(g).connect(c.destination); o.start(t + i * .12); o.stop(t + i * .12 + 1);
      });
    }
    function toggle() {
      on = !on;
      try { localStorage.setItem('capitao_sound', on ? '1' : '0'); } catch {}
      if (on) clipper();
      return on;
    }
    return { snip, clipper, ding, toggle, get on() { return on; } };
  })();
  window.Sound = Sound;

  const soundBtn = $('#soundBtn');
  const paintSound = () => {
    soundBtn.classList.toggle('is-on', Sound.on);
    soundBtn.querySelector('use').setAttribute('href', Sound.on ? '#i-sound' : '#i-mute');
    soundBtn.setAttribute('aria-label', Sound.on ? 'Desligar sons' : 'Ligar sons da barbearia');
  };
  paintSound();
  soundBtn.addEventListener('click', () => {
    Sound.toggle(); paintSound();
    toast(Sound.on ? 'Máquina ligada — sons ativados' : 'Sons desligados');
  });

  /* ---------- Preloader ---------- */
  const pre = $('#preloader'), bar = $('#preloaderBar');
  let prog = 0;
  const tick = setInterval(() => { prog = Math.min(prog + Math.random() * 18, 92); bar.style.width = prog + '%'; }, 120);
  const finish = () => {
    clearInterval(tick); bar.style.width = '100%';
    setTimeout(() => { pre.classList.add('is-done'); document.body.classList.add('is-loaded'); }, reduce ? 0 : 350);
  };
  if (document.readyState === 'complete') finish(); else window.addEventListener('load', finish);
  setTimeout(finish, 3500); // segurança

  /* ---------- Cursor tesoura + cabelinho caindo ---------- */
  if (finePointer && !reduce) {
    document.body.classList.add('has-cursor');
    const cur = $('#cursor');
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
    (function loop() {
      cx += (x - cx) * .22; cy += (y - cy) * .22;
      cur.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(loop);
    })();
    const hoverSel = 'a, button, .ig-item, .pick, .slot, .day, .barber, [role="tab"]';
    document.addEventListener('mouseover', (e) => cur.classList.toggle('is-hover', !!e.target.closest(hoverSel)));
    document.addEventListener('mousedown', (e) => {
      cur.classList.add('is-click');
      if (e.target.closest(hoverSel)) {
        Sound.snip();
        for (let i = 0; i < 7; i++) {
          const h = document.createElement('i');
          h.className = 'hair';
          h.style.left = e.clientX + (Math.random() * 20 - 10) + 'px';
          h.style.top = e.clientY + (Math.random() * 10 - 5) + 'px';
          h.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
          h.style.setProperty('--rot', (Math.random() * 360) + 'deg');
          h.style.height = 6 + Math.random() * 8 + 'px';
          h.style.animationDelay = Math.random() * .1 + 's';
          document.body.appendChild(h);
          setTimeout(() => h.remove(), 1600);
        }
      }
    });
    document.addEventListener('mouseup', () => cur.classList.remove('is-click'));
  } else {
    document.addEventListener('click', (e) => { if (e.target.closest('a, button')) Sound.snip(); });
  }

  /* ---------- Nav ---------- */
  const nav = $('#nav'), fab = $('#fab');
  let lastY = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > 500 && y > lastY && !$('#navLinks').classList.contains('is-open'));
    lastY = y;
    const ag = $('#agendar').getBoundingClientRect();
    fab.classList.toggle('is-visible', y > innerHeight * .8 && (ag.top > innerHeight || ag.bottom < 0));
  }, { passive: true });

  const burger = $('#burger'), links = $('#navLinks');
  burger.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('a', links).forEach(a => a.addEventListener('click', () => {
    links.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
  }));

  // link ativo
  const secObs = new IntersectionObserver((ents) => ents.forEach(en => {
    if (en.isIntersecting) $$('.nav__links a').forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => secObs.observe(s));

  /* ---------- Reveal + contadores ---------- */
  const revObs = new IntersectionObserver((ents) => ents.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    revObs.unobserve(en.target);
  }), { threshold: .15 });
  const observeReveals = () => $$('.reveal:not(.is-in):not(.cut), .ig-item:not(.is-in)').forEach(el => revObs.observe(el));
  observeReveals();
  // .cut começa 100% recortado por clip-path, e o Chrome desconta o clip-path do alvo
  // no IntersectionObserver — então observamos o pai.
  const cutObs = new IntersectionObserver((ents) => ents.forEach(en => {
    if (!en.isIntersecting) return;
    $$(':scope > .cut', en.target).forEach(c => c.classList.add('is-in'));
    cutObs.unobserve(en.target);
  }), { threshold: .1 });
  new Set($$('.cut').map(c => c.parentElement)).forEach(p => cutObs.observe(p));

  const countObs = new IntersectionObserver((ents) => ents.forEach(en => {
    if (!en.isIntersecting) return;
    const el = en.target, end = +el.dataset.count, suf = el.dataset.suffix || '';
    const t0 = performance.now(), dur = reduce ? 1 : 1600;
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
      el.textContent = v.toLocaleString('pt-BR') + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    countObs.unobserve(el);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => countObs.observe(el));

  /* ---------- Espelho: parallax ---------- */
  const mirror = $('#mirror'), wrap = $('#mirrorWrap');
  if (finePointer && !reduce) {
    $('.hero').addEventListener('mousemove', (e) => {
      const r = wrap.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      mirror.style.transform = `rotateY(${dx * 14}deg) rotateX(${-dy * 10}deg)`;
    });
    $('.hero').addEventListener('mouseleave', () => { mirror.style.transform = ''; });
  }

  /* ---------- Tilt (polaroids) + botões magnéticos ---------- */
  function bindTilt(el, max = 8) {
    if (!finePointer || reduce) return;
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(800px) rotateY(${dx * max}deg) rotateX(${-dy * max}deg) translateY(-4px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  }
  $$('.tilt').forEach(el => bindTilt(el, 12));
  if (finePointer && !reduce) $$('.magnetic').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });

  /* ---------- Serviços ---------- */
  const tabs = $('#servTabs'), list = $('#servList');
  tabs.innerHTML = C.categorias.map((c, i) =>
    `<button class="tab" role="tab" aria-selected="${i === 0}" data-cat="${c.id}">${c.nome}</button>`).join('');
  function renderServ(cat) {
    const items = C.servicos.filter(s => cat === 'todos' || s.cat === cat);
    list.innerHTML = items.map(s => `
      <article class="menu-item is-out">
        <h3>${s.nome}${s.destaque ? '<span class="tag">Top</span>' : ''}</h3>
        <span class="price">${brl(s.preco)}</span>
        <p>${s.desc}</p>
        <span class="dur">${s.duracao} min</span>
        <button class="add" data-add="${s.id}" type="button">Reservar este <span aria-hidden="true">→</span></button>
      </article>`).join('');
    requestAnimationFrame(() => $$('.menu-item', list).forEach((el, i) => setTimeout(() => el.classList.remove('is-out'), i * 50)));
  }
  renderServ('todos');
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    $$('.tab', tabs).forEach(t => t.setAttribute('aria-selected', t === b));
    renderServ(b.dataset.cat);
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    window.Booking?.preselect(b.dataset.add);
    $('#agendar').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });


  /* ---------- Galeria Instagram + lightbox ---------- */
  const grid = $('#igGrid');
  grid.innerHTML = C.posts.map((p, i) => `
    <button class="ig-item" data-i="${i}" type="button" aria-label="Abrir post: ${p.legenda}" style="transition-delay:${(i % 4) * 80}ms">
      <img src="${p.img}" alt="${p.legenda}" loading="lazy" />
      <span class="ig-item__type"><svg><use href="#${p.tipo === 'video' ? 'i-play' : 'i-ig'}"/></svg></span>
      <span class="ig-item__cap"><svg><use href="#i-ig"/></svg>${p.legenda}</span>
    </button>`).join('');
  observeReveals();

  const lb = $('#lightbox'); let lbI = 0, lastFocus;
  function showLb(i) {
    lbI = (i + C.posts.length) % C.posts.length;
    const p = C.posts[lbI];
    $('#lbImg').src = p.img; $('#lbImg').alt = p.legenda;
    $('#lbCap').textContent = p.legenda;
    $('#lbLink').href = p.url;
  }
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.ig-item'); if (!b) return;
    lastFocus = b; showLb(+b.dataset.i); lb.hidden = false; document.body.style.overflow = 'hidden'; $('#lbClose').focus();
  });
  const closeLb = () => { lb.hidden = true; document.body.style.overflow = ''; lastFocus?.focus(); };
  $('#lbClose').onclick = closeLb;
  $('#lbPrev').onclick = () => showLb(lbI - 1);
  $('#lbNext').onclick = () => showLb(lbI + 1);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') showLb(lbI - 1);
    if (e.key === 'ArrowRight') showLb(lbI + 1);
  });
  let tx = 0;
  lb.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => { const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) showLb(lbI + (d < 0 ? 1 : -1)); });

  /* ---------- Aberto agora + tabela de horários ---------- */
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  function paintOpen() {
    const now = new Date(), d = now.getDay(), h = C.horarios[d];
    const min = now.getHours() * 60 + now.getMinutes();
    const open = h && min >= CapitaoDB.toMin(h[0]) && min < CapitaoDB.toMin(h[1]);
    let msg;
    if (open) {
      const left = CapitaoDB.toMin(h[1]) - min;
      msg = left <= 60 ? `Aberto — fecha em ${left} min` : `Aberto agora · até ${h[1].replace(':00', 'h')}`;
    } else {
      let nd = d, add = 0;
      if (h && min < CapitaoDB.toMin(h[0])) { msg = `Fechado · abre hoje às ${h[0].replace(':00', 'h')}`; }
      else {
        do { nd = (nd + 1) % 7; add++; } while (!C.horarios[nd] && add < 7);
        msg = `Fechado · abre ${add === 1 ? 'amanhã' : DIAS[nd].toLowerCase()} às ${C.horarios[nd][0].replace(':00', 'h')}`;
      }
    }
    $('#openNow').innerHTML = `<span class="live-dot ${open ? 'is-open' : ''}"></span>${msg}`;
    $('#heroLiveDot').classList.toggle('is-open', !!open);
    $('#heroStatus').textContent = (open ? 'Aberto agora' : 'Francisco Morato · SP') + (open ? ' · Francisco Morato' : '');
    $('#hoursTable').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(i => {
      const hh = C.horarios[i];
      return `<div class="${i === d ? 'is-today' : ''}"><span>${DIAS[i]}${i === d ? ' · hoje' : ''}</span><span>${hh ? hh.join(' – ') : 'Fechado'}</span></div>`;
    }).join('');
  }
  paintOpen(); setInterval(paintOpen, 60000);

  $('#year').textContent = new Date().getFullYear();
})();
