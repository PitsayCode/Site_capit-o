/* =========================================================
   BARBEARIA CAPITÃO — camada de dados (v1.1)
   Mesma interface para dois backends:
     • Supabase (quando js/config.js tem anonKey)
     • Local (localStorage) — fallback para desenvolvimento
   Formato no app:
     reserva = { id, codigo, servicos:[{id,nome,preco}], barbeiroId, data, hora:'HH:MM',
                 duracao, total, cliente:{nome,telefone}, obs, status, origem, criadoEm }
     bloqueio = { id, barbeiroId, data, hora }
   ========================================================= */
window.CapitaoStore = (() => {
  const cfg = window.CAPITAO_SUPABASE || {};
  const useSupabase = !!(cfg.url && cfg.anonKey && window.supabase?.createClient);

  class StoreError extends Error {}

  /* ---------------- Supabase ---------------- */
  function supabaseBackend() {
    const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, storageKey: 'capitao_auth' },
    });
    const hhmm = (t) => (t || '').slice(0, 5);
    const fromRow = (r) => ({
      id: r.id, codigo: r.codigo, servicos: r.servicos || [], barbeiroId: r.barbeiro_id, data: r.data,
      hora: hhmm(r.hora), duracao: r.duracao, total: Number(r.total), obs: r.obs || '',
      cliente: { nome: r.cliente_nome, telefone: r.cliente_telefone || '' },
      status: r.status, origem: r.origem, criadoEm: r.criado_em,
    });
    const toRow = (r) => ({
      servicos: r.servicos, barbeiro_id: r.barbeiroId, data: r.data, hora: r.hora, duracao: r.duracao,
      total: r.total, cliente_nome: r.cliente.nome, cliente_telefone: r.cliente.telefone || null,
      obs: r.obs || null, status: r.status || 'confirmado', origem: r.origem || 'balcao',
    });
    const fail = (error) => {
      const msg = error?.code === '23P01'
        ? 'Esse barbeiro já tem cliente nesse horário.'
        : (error?.message || 'Falha de conexão. Tente de novo.');
      throw new StoreError(msg);
    };

    return {
      mode: 'supabase',

      async ocupacao(inicio, fim) {
        const { data, error } = await sb.rpc('horarios_ocupados', { p_inicio: inicio, p_fim: fim });
        if (error) fail(error);
        return data.map(o => ({ barbeiroId: o.barbeiro_id, data: o.data, hora: hhmm(o.hora), duracao: o.duracao }));
      },

      async criarReserva(d) {
        const { data, error } = await sb.rpc('criar_reserva', {
          p_servicos: d.servicos, p_barbeiro_id: d.barbeiroId, p_data: d.data, p_hora: d.hora,
          p_duracao: d.duracao, p_total: d.total, p_nome: d.cliente.nome, p_telefone: d.cliente.telefone, p_obs: d.obs || null,
        });
        if (error) fail(error);
        const row = Array.isArray(data) ? data[0] : data;
        return { ...d, id: row.id, codigo: row.codigo, status: 'confirmado', origem: 'site' };
      },

      /* ---- painel (exige login de admin) ---- */
      auth: {
        async sessao() { const { data } = await sb.auth.getSession(); return data.session; },
        async entrar(email, senha) {
          const { error } = await sb.auth.signInWithPassword({ email, password: senha });
          if (error) throw new StoreError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
          const { data: ok } = await sb.rpc('is_admin');
          if (!ok) { await sb.auth.signOut(); throw new StoreError('Esse e-mail não tem acesso ao painel.'); }
        },
        async ehAdmin() { const { data } = await sb.rpc('is_admin'); return !!data; },
        async sair() { await sb.auth.signOut(); },
      },

      async listar(inicio, fim) {
        const [r, b] = await Promise.all([
          sb.from('reservas').select('*').gte('data', inicio).lte('data', fim).order('data').order('hora'),
          sb.from('bloqueios').select('*').gte('data', inicio).lte('data', fim),
        ]);
        if (r.error) fail(r.error);
        if (b.error) fail(b.error);
        return {
          reservas: r.data.map(fromRow),
          bloqueios: b.data.map(x => ({ id: x.id, barbeiroId: x.barbeiro_id, data: x.data, hora: hhmm(x.hora) })),
        };
      },

      async criarBalcao(d) {
        const { data, error } = await sb.from('reservas').insert(toRow(d)).select().single();
        if (error) fail(error);
        return fromRow(data);
      },

      async criarVarias(lista) {
        if (!lista.length) return 0;
        const { error } = await sb.from('reservas').insert(lista.map(toRow));
        if (error) fail(error);
        return lista.length;
      },

      async atualizar(id, patch) {
        const row = {};
        if (patch.status) row.status = patch.status;
        const { error } = await sb.from('reservas').update(row).eq('id', id);
        if (error) fail(error);
      },

      async remover(id) {
        const { error } = await sb.from('reservas').delete().eq('id', id);
        if (error) fail(error);
      },

      async limparDemo() {
        const { data, error } = await sb.from('reservas').delete().eq('origem', 'demo').select('id');
        if (error) fail(error);
        return data.length;
      },

      async alternarBloqueio(barbeiroId, data, hora, bloqueioId) {
        const q = bloqueioId
          ? sb.from('bloqueios').delete().eq('id', bloqueioId)
          : sb.from('bloqueios').insert({ barbeiro_id: barbeiroId, data, hora });
        const { error } = await q;
        if (error) fail(error);
      },

      async bloquearVarios(lista) {
        if (!lista.length) return;
        const { error } = await sb.from('bloqueios').insert(lista.map(x => ({ barbeiro_id: x.barbeiroId, data: x.data, hora: x.hora })));
        if (error) fail(error);
      },

      async liberarVarios(ids) {
        if (!ids.length) return;
        const { error } = await sb.from('bloqueios').delete().in('id', ids);
        if (error) fail(error);
      },

      /** Avisa quando qualquer reserva/bloqueio muda (Realtime). Retorna função pra cancelar. */
      aoMudar(cb) {
        const ch = sb.channel('agenda')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, (p) => cb(p.eventType, p.new && p.new.id ? fromRow(p.new) : null))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bloqueios' }, () => cb('bloqueio', null))
          .subscribe();
        return () => sb.removeChannel(ch);
      },
    };
  }

  /* ---------------- Local (localStorage) ---------------- */
  function localBackend() {
    const KEY = 'capitao_db_v1';
    const empty = () => ({ reservas: [], bloqueios: [] });
    const load = () => { try { const raw = localStorage.getItem(KEY); return raw ? Object.assign(empty(), JSON.parse(raw)) : empty(); } catch { return empty(); } };
    const save = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2));
    const codigo = () => Math.random().toString(36).slice(2, 8).toUpperCase();
    const U = window.CapitaoDB;
    const ocupacaoDe = (db) => [
      ...db.reservas.filter(r => r.status !== 'cancelado').map(r => ({ id: r.id, barbeiroId: r.barbeiroId, data: r.data, hora: r.hora, duracao: r.duracao })),
      ...db.bloqueios.map(b => ({ barbeiroId: b.barbeiroId, data: b.data, hora: b.hora, duracao: CAPITAO.slotMin })),
    ];
    const conflita = (db, d) => {
      const occ = U.ocupados(ocupacaoDe(db), d.barbeiroId, d.data);
      const ini = U.toMin(d.hora);
      for (let m = ini; m < ini + d.duracao; m += CAPITAO.slotMin) if (occ.has(m)) return true;
      return false;
    };
    const inserir = (d, origem) => {
      const db = load();
      if (conflita(db, d)) throw new StoreError(origem === 'site' ? 'Esse horário acabou de ser ocupado. Escolha outro.' : 'Esse barbeiro já tem cliente nesse horário.');
      const r = { ...d, id: uid(), codigo: codigo(), status: d.status || 'confirmado', origem, criadoEm: new Date().toISOString() };
      db.reservas.push(r); save(db);
      return r;
    };

    return {
      mode: 'local',
      async ocupacao(inicio, fim) { return ocupacaoDe(load()).filter(o => o.data >= inicio && o.data <= fim); },
      async criarReserva(d) {
        if (!U.livres(ocupacaoDe(load()), d.barbeiroId, d.data, d.duracao).includes(d.hora)) throw new StoreError('Esse horário acabou de ser ocupado. Escolha outro.');
        return inserir(d, 'site');
      },
      auth: {
        async sessao() { try { return sessionStorage.getItem('capitao_admin') === '1' ? {} : null; } catch { return null; } },
        async entrar(_email, pin) {
          if (pin !== '1234') throw new StoreError('PIN incorreto.');
          try { sessionStorage.setItem('capitao_admin', '1'); } catch {}
        },
        async ehAdmin() { return true; },
        async sair() { try { sessionStorage.removeItem('capitao_admin'); } catch {} },
      },
      async listar(inicio, fim) {
        const db = load();
        return {
          reservas: db.reservas.filter(r => r.data >= inicio && r.data <= fim).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)),
          bloqueios: db.bloqueios.filter(b => b.data >= inicio && b.data <= fim),
        };
      },
      async criarBalcao(d) { return inserir(d, d.origem || 'balcao'); },
      async criarVarias(lista) {
        const db = load();
        lista.forEach(d => db.reservas.push({ ...d, id: uid(), codigo: codigo(), criadoEm: new Date().toISOString() }));
        save(db); return lista.length;
      },
      async atualizar(id, patch) { const db = load(); const r = db.reservas.find(x => x.id === id); if (r) Object.assign(r, patch); save(db); },
      async remover(id) { const db = load(); db.reservas = db.reservas.filter(x => x.id !== id); save(db); },
      async limparDemo() { const db = load(); const n = db.reservas.length; db.reservas = db.reservas.filter(r => r.origem !== 'demo'); save(db); return n - db.reservas.length; },
      async alternarBloqueio(barbeiroId, data, hora, bloqueioId) {
        const db = load();
        if (bloqueioId) db.bloqueios = db.bloqueios.filter(b => b.id !== bloqueioId);
        else db.bloqueios.push({ id: uid(), barbeiroId, data, hora });
        save(db);
      },
      async bloquearVarios(lista) { const db = load(); lista.forEach(x => db.bloqueios.push({ id: uid(), ...x })); save(db); },
      async liberarVarios(ids) { const db = load(); db.bloqueios = db.bloqueios.filter(b => !ids.includes(b.id)); save(db); },
      aoMudar(cb) {
        const h = (e) => { if (e.key === KEY) cb('sync', null); };
        addEventListener('storage', h);
        return () => removeEventListener('storage', h);
      },
    };
  }

  const api = useSupabase ? supabaseBackend() : localBackend();
  api.StoreError = StoreError;
  if (!useSupabase) console.info('[Capitão] Modo local (sem Supabase). Configure js/config.js para usar o banco online.');
  return api;
})();
