-- 10/09 — bug real: o índice único parcial (where imap_uid is not null)
-- criado em 20260910210000_emails_projeto.sql não serve de arbiter pro
-- upsert(onConflict:'imap_uid') do Supabase, que gera "ON CONFLICT
-- (imap_uid) DO UPDATE" sem repetir a cláusula WHERE — Postgres não
-- infere predicado de índice parcial nesse caso (42P10: "there is no
-- unique or exclusion constraint matching the ON CONFLICT
-- specification"). Toda mensagem de entrada lida por read-inbox falhava
-- ao persistir, silenciosamente (só logado via console.warn, nunca
-- quebrava a leitura em si — por isso passou despercebido até conferir
-- a tabela direto). Índice único comum resolve: múltiplos NULLs
-- continuam coexistindo sem violar a constraint (comportamento padrão
-- do Postgres — só valores reais de imap_uid precisam ser únicos).
drop index if exists public.emails_projeto_imap_uid_uk;
create unique index emails_projeto_imap_uid_uk on public.emails_projeto (imap_uid);
