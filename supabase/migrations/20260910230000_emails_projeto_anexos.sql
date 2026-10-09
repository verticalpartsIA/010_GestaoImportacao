-- Suporte a anexo real nos e-mails do Inbox (10/09) — pedido do usuário
-- ao ver o botão "Responder" funcionando: "onde está o botão de anexar
-- arquivos? Isso precisa, né?". Escopo: os dois lados —
--   - enviar anexo ao Responder (send-email grava em anexos)
--   - guardar/mostrar anexo que chega em e-mail recebido (read-inbox
--     extrai do MIME e faz upload)
-- Bucket privado, arquivo físico fica no Storage; a coluna só guarda
-- metadados + o path pra gerar link assinado sob demanda.

alter table public.emails_projeto add column if not exists anexos jsonb not null default '[]'::jsonb;
comment on column public.emails_projeto.anexos is
  'Array de {filename, content_type, size, path} — path aponta pro bucket Storage emails-anexos. Preenchido por read-inbox (extraído do MIME) e por send-email (quando o Responder do site anexa arquivo).';

insert into storage.buckets (id, name, public)
values ('emails-anexos', 'emails-anexos', false)
on conflict (id) do nothing;

drop policy if exists "emails_anexos_auth_all" on storage.objects;
create policy "emails_anexos_auth_all" on storage.objects for all to authenticated
  using (bucket_id = 'emails-anexos') with check (bucket_id = 'emails-anexos');
drop policy if exists "emails_anexos_service_all" on storage.objects;
create policy "emails_anexos_service_all" on storage.objects for all to service_role
  using (bucket_id = 'emails-anexos') with check (bucket_id = 'emails-anexos');
