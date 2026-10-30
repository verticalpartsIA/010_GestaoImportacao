-- Inbox/e-mails · destinatários em cópia (PR #1187). A Edge Function `send-email` grava `cc` em emails_projeto
-- a cada envio; sem esta coluna o insert falha e o e-mail sai pelo SMTP mas não aparece em Enviados nem na Linha do Tempo.
-- Já aplicada em produção em 30/10/2026 (mesma versão em supabase_migrations.schema_migrations); idempotente.
alter table public.emails_projeto add column if not exists cc jsonb not null default '[]'::jsonb;
comment on column public.emails_projeto.cc is 'Destinatários em cópia (send-email, campo cc) — 30/10/2026';
notify pgrst, 'reload schema';
