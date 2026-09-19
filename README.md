# Barbearia Capitão — Site + Painel de Reservas

Site institucional com agendamento online e painel de agenda para a Barbearia Capitão (Francisco Morato — SP).

**Versão atual:** v1.1 — reservas online com Supabase

## Estrutura

```
index.html        Site (hero, a casa, serviços, galeria Instagram, reserva, localização)
admin.html        Painel da barbearia (agenda por barbeiro, status, encaixe, bloqueios, CSV)
css/style.css     Estilos do site (e base do painel)
css/admin.css     Estilos do painel
js/config.js      URL + chave pública (publishable/anon) do Supabase
js/data.js        Configuração central (serviços, preços, barbeiros, horários) + cálculo de horários
js/store.js       Camada de dados: Supabase (online) ou localStorage (modo local)
supabase/schema.sql  Tabelas, regras de segurança (RLS), funções e realtime
js/main.js        Interações e animações do site
js/booking.js     Fluxo de reserva em 4 passos
js/admin.js       Lógica do painel
assets/img/       Logo e posts do Instagram
```

## Supabase

1. No SQL Editor do projeto, rode `supabase/schema.sql` (pode rodar de novo sem problema).
2. Em **Authentication → Users → Add user**, crie o login de quem usa o painel.
3. Autorize o e-mail no banco: `insert into public.admins (email) values ('email@exemplo.com');`
4. Em `js/config.js`, a `anonKey` é a chave **publishable/anon** (pública). Nunca use a `service_role`/`secret`.

Como funciona a segurança:
- O site não lê a tabela de reservas; só consulta horários ocupados (sem nome/telefone) e cria reservas pela função `criar_reserva`, que valida dia, horário e conflito no servidor.
- Uma constraint de exclusão no banco impede duas reservas no mesmo barbeiro/horário, mesmo com cliques simultâneos.
- O painel exige login e só e-mails em `public.admins` leem/editam dados. Reservas novas aparecem em tempo real.

Com `anonKey` vazio, tudo roda em modo local (localStorage, PIN `1234`) para desenvolvimento.

## Rodar localmente

```bash
python -m http.server 5510
```

Abrir `http://localhost:5510` (site) e `http://localhost:5510/admin.html` (painel).

## Pendências

- Dados marcados com `[PLACEHOLDER]` em `js/data.js`: WhatsApp, preços, nomes/fotos dos barbeiros.
- O expediente e os IDs dos barbeiros estão repetidos em `supabase/schema.sql` (função `criar_reserva`) — se mudar em `js/data.js`, mude lá também.
- Preço total é enviado pelo navegador (não recalculado no servidor) e não há limite de reservas por telefone.
- Logo em alta resolução (a atual vem do Instagram, 150px).
