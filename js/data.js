/* =========================================================
   BARBEARIA CAPITÃO — Configuração central (v1.1)
   Tudo que o cliente pode querer trocar fica aqui.
   ⚠ Valores marcados com [PLACEHOLDER] precisam ser confirmados.
   ========================================================= */
window.CAPITAO = {
  nome: 'Barbearia Capitão',
  slogan: 'O corte de cabelo que você sempre sonhou!',
  endereco: 'R. João Mendes Júnior, 520',
  cidade: 'Francisco Morato — SP',
  whatsapp: '5511900000000', // [PLACEHOLDER] número real com DDI+DDD
  instagram: 'https://www.instagram.com/capitao_bcb/',
  instagramUser: '@capitao_bcb',
  appbarber: 'https://appbarber.com.br/download',
  mapsQuery: 'R. João Mendes Júnior, 520, Francisco Morato - SP',

  // 0 = domingo ... 6 = sábado. null = fechado
  horarios: {
    0: null,
    1: ['09:00', '20:00'],
    2: ['09:00', '20:00'],
    3: ['09:00', '20:00'],
    4: ['09:00', '20:00'],
    5: ['09:00', '20:00'],
    6: ['09:00', '20:00'],
  },
  slotMin: 30,       // granularidade da agenda (minutos)
  diasAFrente: 21,   // quantos dias o cliente pode agendar à frente

  // [PLACEHOLDER] preços e durações de exemplo
  servicos: [
    { id: 'corte',      cat: 'cabelo', nome: 'Corte Masculino',     desc: 'Tesoura ou máquina, lavagem e finalização.',       preco: 40,  duracao: 30, destaque: true },
    { id: 'degrade',    cat: 'cabelo', nome: 'Degradê Navalhado',   desc: 'Fade no detalhe com acabamento na navalha.',       preco: 45,  duracao: 30 },
    { id: 'barba',      cat: 'barba',  nome: 'Barba Completa',      desc: 'Toalha quente, óleo, navalha e balm.',             preco: 30,  duracao: 30, destaque: true },
    { id: 'bigode',     cat: 'barba',  nome: 'Bigode Alinhado',     desc: 'Desenho e acabamento do bigode.',                  preco: 15,  duracao: 15 },
    { id: 'combo',      cat: 'combo',  nome: 'Combo Capitão',       desc: 'Corte + barba completa. O clássico da casa.',      preco: 65,  duracao: 60, destaque: true },
    { id: 'combo-full', cat: 'combo',  nome: 'Combo Almirante',     desc: 'Corte + barba + sobrancelha + hidratação.',        preco: 90,  duracao: 90 },
    { id: 'kids',       cat: 'kids',   nome: 'Corte Kids',          desc: 'Até 12 anos — na cadeira-carrinho, sem choro.',    preco: 35,  duracao: 30 },
    { id: 'pezinho',    cat: 'cabelo', nome: 'Pezinho / Acabamento',desc: 'Contorno entre um corte e outro.',                  preco: 15,  duracao: 15 },
    { id: 'sobrancelha',cat: 'extra',  nome: 'Sobrancelha',         desc: 'Na navalha ou pinça.',                              preco: 15,  duracao: 15 },
    { id: 'pigmenta',   cat: 'extra',  nome: 'Pigmentação',         desc: 'Preenche falhas de barba ou cabelo.',               preco: 25,  duracao: 15 },
    { id: 'platinado',  cat: 'extra',  nome: 'Platinado / Nevou',   desc: 'Descoloração completa com matização.',              preco: 120, duracao: 120 },
    { id: 'hidrata',    cat: 'extra',  nome: 'Hidratação',          desc: 'Tratamento para cabelo ou barba.',                  preco: 25,  duracao: 15 },
  ],

  categorias: [
    { id: 'todos',  nome: 'Todos' },
    { id: 'cabelo', nome: 'Cabelo' },
    { id: 'barba',  nome: 'Barba & Bigode' },
    { id: 'combo',  nome: 'Combos' },
    { id: 'kids',   nome: 'Kids' },
    { id: 'extra',  nome: 'Extras' },
  ],

  // [PLACEHOLDER] nomes e fotos da equipe
  barbeiros: [
    { id: 'b1', nome: 'Barbeiro 1', papel: 'Fade & navalha' },
    { id: 'b2', nome: 'Barbeiro 2', papel: 'Barba & visagismo' },
    { id: 'b3', nome: 'Barbeiro 3', papel: 'Kids & clássicos' },
  ],


  // Posts baixados do Instagram (assets/img)
  posts: [
    { img: 'assets/img/post-01.jpg', url: 'https://www.instagram.com/capitao_bcb/p/DZiEjQlO5Ha/',   tipo: 'foto',  legenda: 'Jogo da Copa — horário especial' },
    { img: 'assets/img/post-04.jpg', url: 'https://www.instagram.com/capitao_bcb/reel/DOzDSiPATR0/', tipo: 'video', legenda: 'Na cadeira, no detalhe' },
    { img: 'assets/img/post-02.jpg', url: 'https://www.instagram.com/capitao_bcb/p/DP14bz3AVbN/',   tipo: 'foto',  legenda: 'Kids na cadeira-carrinho' },
    { img: 'assets/img/post-03.jpg', url: 'https://www.instagram.com/capitao_bcb/reel/DPmuVLpjc3i/', tipo: 'video', legenda: 'Pacote Capitão' },
    { img: 'assets/img/post-06.jpg', url: 'https://www.instagram.com/capitao_bcb/reel/DOjxikPjRHD/', tipo: 'video', legenda: 'Pai e filhos na régua' },
    { img: 'assets/img/post-05.jpg', url: 'https://www.instagram.com/capitao_bcb/p/DOj2z6vjYes/',   tipo: 'foto',  legenda: 'Primeiro corte' },
    { img: 'assets/img/post-09.jpg', url: 'https://www.instagram.com/capitao_bcb/reel/DNl7ZcINqD-/', tipo: 'video', legenda: 'Social kids' },
    { img: 'assets/img/post-08.jpg', url: 'https://www.instagram.com/capitao_bcb/p/DNtWkduwoQo/',   tipo: 'foto',  legenda: 'Recepção' },
    { img: 'assets/img/post-07.jpg', url: 'https://www.instagram.com/capitao_bcb/reel/DN6Xw6YARVs/', tipo: 'video', legenda: 'Cafezinho pós-corte' },
    { img: 'assets/img/post-10.jpg', url: 'https://www.instagram.com/capitao_bcb/reel/DNTD9j5twi1/', tipo: 'video', legenda: 'Cacheado no capricho' },
    { img: 'assets/img/post-12.jpg', url: 'https://www.instagram.com/capitao_bcb/reel/DNI-0AXt-uc/', tipo: 'video', legenda: 'Ambiente família' },
    { img: 'assets/img/post-11.jpg', url: 'https://www.instagram.com/capitao_bcb/p/DNK1g5ntmSR/',   tipo: 'foto',  legenda: 'Dia dos Pais' },
  ],
};

/* ---------- Utilitários de agenda (puros, sem banco) ----------
   "ocupacao" = lista de { barbeiroId, data:'YYYY-MM-DD', hora:'HH:MM', duracao }
   vinda do CapitaoStore (Supabase ou local). */
window.CapitaoDB = (() => {
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const toHHMM = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDias = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };

  /** Set com o início (em minutos) de cada slot ocupado de um barbeiro num dia */
  function ocupados(ocupacao, barbeiroId, data) {
    const step = CAPITAO.slotMin, set = new Set();
    ocupacao.filter(o => o.barbeiroId === barbeiroId && o.data === data).forEach(o => {
      const ini = toMin(o.hora);
      for (let m = ini - (ini % step); m < ini + o.duracao; m += step) set.add(m);
    });
    return set;
  }

  /** Horários livres para uma duração. `respeitarAgora` esconde horários que já passaram (site). */
  function livres(ocupacao, barbeiroId, data, duracao, respeitarAgora = true) {
    const exp = CAPITAO.horarios[parseYmd(data).getDay()];
    if (!exp) return [];
    const step = CAPITAO.slotMin, [abre, fecha] = exp.map(toMin);
    const occ = ocupados(ocupacao, barbeiroId, data);
    const now = new Date(), isToday = ymd(now) === data, nowMin = now.getHours() * 60 + now.getMinutes();
    const out = [];
    for (let m = abre; m + duracao <= fecha; m += step) {
      if (respeitarAgora && isToday && m <= nowMin + 15) continue;
      let ok = true;
      for (let k = m; k < m + duracao; k += step) if (occ.has(k)) { ok = false; break; }
      if (ok) out.push(toHHMM(m));
    }
    return out;
  }

  return { toMin, toHHMM, ymd, parseYmd, addDias, ocupados, livres };
})();

window.brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
