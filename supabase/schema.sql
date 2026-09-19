-- =========================================================
-- BARBEARIA CAPITÃO — schema Supabase (v1.1)
-- Rodar inteiro no SQL Editor do projeto. É idempotente.
--
-- Segurança:
--  • O site (chave anon) NÃO lê a tabela de reservas. Ele só:
--      - consulta horários ocupados via RPC `horarios_ocupados` (sem nome/telefone)
--      - cria reserva via RPC `criar_reserva` (valida conflito no servidor)
--  • O painel usa login (Supabase Auth). Só e-mails cadastrados em
--    `public.admins` conseguem ler/editar reservas e bloqueios.
--  • Constraint de exclusão impede dois clientes no mesmo barbeiro/horário,
--    mesmo com cliques simultâneos.
-- =========================================================

create extension if not exists btree_gist with schema extensions;

-- ---------- Admins ----------
create table if not exists public.admins (
  email text primary key,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "admins leem admins" on public.admins;
create policy "admins leem admins" on public.admins
  for select to authenticated using (public.is_admin());

-- ---------- Reservas ----------
create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null default upper(substr(md5(random()::text), 1, 6)),
  servicos jsonb not null default '[]'::jsonb,
  barbeiro_id text not null,
  data date not null,
  hora time not null,
  duracao int not null check (duracao between 15 and 240),
  total numeric(10,2) not null default 0,
  cliente_nome text not null check (char_length(cliente_nome) between 2 and 80),
  cliente_telefone text check (cliente_telefone is null or char_length(cliente_telefone) <= 20),
  obs text check (obs is null or char_length(obs) <= 300),
  status text not null default 'confirmado'
    check (status in ('confirmado', 'concluido', 'falta', 'cancelado')),
  origem text not null default 'site' check (origem in ('site', 'balcao', 'demo')),
  criado_em timestamptz not null default now(),
  periodo tsrange generated always as (
    tsrange(data + hora, data + hora + make_interval(mins => duracao), '[)')
  ) stored
);

do $$ begin
  alter table public.reservas
    add constraint reservas_sem_conflito
    exclude using gist (barbeiro_id with =, periodo with &&)
    where (status <> 'cancelado');
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists reservas_data_idx on public.reservas (data);

alter table public.reservas enable row level security;

drop policy if exists "admin gerencia reservas" on public.reservas;
create policy "admin gerencia reservas" on public.reservas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Bloqueios ----------
create table if not exists public.bloqueios (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id text not null,
  data date not null,
  hora time not null,
  criado_em timestamptz not null default now(),
  unique (barbeiro_id, data, hora)
);
alter table public.bloqueios enable row level security;

drop policy if exists "admin gerencia bloqueios" on public.bloqueios;
create policy "admin gerencia bloqueios" on public.bloqueios
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- RPC pública: horários ocupados (sem dados pessoais) ----------
create or replace function public.horarios_ocupados(p_inicio date, p_fim date)
returns table (barbeiro_id text, data date, hora time, duracao int)
language sql stable security definer
set search_path = public
as $$
  select r.barbeiro_id, r.data, r.hora, r.duracao
    from public.reservas r
   where r.data between p_inicio and least(p_fim, p_inicio + 62)
     and r.status <> 'cancelado'
  union all
  select b.barbeiro_id, b.data, b.hora, 30
    from public.bloqueios b
   where b.data between p_inicio and least(p_fim, p_inicio + 62);
$$;

-- ---------- RPC pública: criar reserva ----------
-- Expediente espelhado de js/data.js (seg–sáb 09:00–20:00). Se mudar lá, mude aqui.
create or replace function public.criar_reserva(
  p_servicos jsonb,
  p_barbeiro_id text,
  p_data date,
  p_hora time,
  p_duracao int,
  p_total numeric,
  p_nome text,
  p_telefone text,
  p_obs text default null
)
returns table (id uuid, codigo text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_agora timestamp := (now() at time zone 'America/Sao_Paulo');
  v_ini timestamp := p_data + p_hora;
  v_fim timestamp := p_data + p_hora + make_interval(mins => p_duracao);
begin
  if p_barbeiro_id not in ('b1', 'b2', 'b3') then
    raise exception 'Barbeiro inválido.' using errcode = 'P0001';
  end if;
  if extract(dow from p_data) = 0 then
    raise exception 'A barbearia não abre aos domingos.' using errcode = 'P0001';
  end if;
  if p_hora < time '09:00' or (p_hora + make_interval(mins => p_duracao)) > time '20:00'
     or p_hora + make_interval(mins => p_duracao) < p_hora then
    raise exception 'Fora do horário de funcionamento.' using errcode = 'P0001';
  end if;
  if v_ini < v_agora + interval '15 minutes' then
    raise exception 'Esse horário já passou.' using errcode = 'P0001';
  end if;
  if p_data > (v_agora::date + 60) then
    raise exception 'Data muito distante.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.bloqueios b
     where b.barbeiro_id = p_barbeiro_id and b.data = p_data
       and tsrange(b.data + b.hora, b.data + b.hora + interval '30 minutes', '[)') && tsrange(v_ini, v_fim, '[)')
  ) then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.' using errcode = 'P0001';
  end if;

  return query
  insert into public.reservas as r
    (servicos, barbeiro_id, data, hora, duracao, total, cliente_nome, cliente_telefone, obs, origem)
  values
    (coalesce(p_servicos, '[]'::jsonb), p_barbeiro_id, p_data, p_hora, p_duracao, coalesce(p_total, 0),
     trim(p_nome), nullif(trim(p_telefone), ''), nullif(trim(p_obs), ''), 'site')
  returning r.id, r.codigo;
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.' using errcode = 'P0001';
end;
$$;

revoke all on function public.horarios_ocupados(date, date) from public;
revoke all on function public.criar_reserva(jsonb, text, date, time, int, numeric, text, text, text) from public;
grant execute on function public.horarios_ocupados(date, date) to anon, authenticated;
grant execute on function public.criar_reserva(jsonb, text, date, time, int, numeric, text, text, text) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------- Realtime (painel atualiza sozinho) ----------
do $$ begin
  alter publication supabase_realtime add table public.reservas;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.bloqueios;
exception when duplicate_object then null; end $$;

-- ---------- Cadastre aqui o(s) e-mail(s) com acesso ao painel ----------
insert into public.admins (email) values ('victoralexandre608@gmail.com') on conflict do nothing;
-- insert into public.admins (email) values ('dono@exemplo.com') on conflict do nothing;
