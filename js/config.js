/* =========================================================
   Conexão Supabase
   A chave "anon / publishable" é pública por design (vai pro navegador);
   quem protege os dados são as regras RLS em supabase/schema.sql.
   NUNCA coloque aqui a chave "service_role" / "secret".
   Deixe anonKey vazio para rodar em modo local (localStorage).
   ========================================================= */
window.CAPITAO_SUPABASE = {
  url: 'https://gascdkkswhsmprmcqcfo.supabase.co',
  anonKey: 'sb_publishable_G0koOt_P4TgF330hfqF3Fg_t4QvBm0u',
};
