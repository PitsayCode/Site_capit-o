# Barbearia Capitão — Site + Painel de Reservas

Site institucional com agendamento online e painel de agenda para a Barbearia Capitão (Francisco Morato — SP).

**Versão atual:** beta 1.0

## Estrutura

```
index.html        Site (hero, a casa, serviços, galeria Instagram, reserva, localização)
admin.html        Painel da barbearia (agenda por barbeiro, status, encaixe, bloqueios, CSV)
css/style.css     Estilos do site (e base do painel)
css/admin.css     Estilos do painel
js/data.js        Configuração central (serviços, preços, barbeiros, horários) + banco local
js/main.js        Interações e animações do site
js/booking.js     Fluxo de reserva em 4 passos
js/admin.js       Lógica do painel
assets/img/       Logo e posts do Instagram
```

## Rodar localmente

```bash
python -m http.server 5510
```

Abrir `http://localhost:5510` (site) e `http://localhost:5510/admin.html` (painel — PIN de teste `1234`).

## Pendências (beta)

- Dados marcados com `[PLACEHOLDER]` em `js/data.js`: WhatsApp, preços, nomes/fotos dos barbeiros.
- Reservas ficam no `localStorage` do navegador — a próxima versão precisa de backend para compartilhar a agenda entre dispositivos e ter login real no painel.
- Logo em alta resolução (a atual vem do Instagram, 150px).
