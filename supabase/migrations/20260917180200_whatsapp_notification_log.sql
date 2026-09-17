-- Log de auditoria de tentativas de envio de WhatsApp — sem isso, a única
-- forma de diagnosticar "por que não chegou a mensagem" seria acessar o log
-- do processo da Edge Function diretamente, inviável remotamente.
create table if not exists whatsapp_notification_log (
  id                uuid primary key default gen_random_uuid(),
  stage             text not null check (stage in ('decisao_pendente', 'decisao_resultado')),
  decisao_id        uuid references decisoes_gerenciais(id) on delete set null,
  recipient_email   text,
  recipient_number  text,
  status            text not null check (status in ('sent', 'error', 'skipped_no_apikey', 'skipped_no_number')),
  http_status       int,
  error_detail      text,
  created_at        timestamptz not null default now()
);

create index if not exists whatsapp_notification_log_decisao_id_idx
  on whatsapp_notification_log (decisao_id);
create index if not exists whatsapp_notification_log_created_at_idx
  on whatsapp_notification_log (created_at desc);

alter table whatsapp_notification_log enable row level security;

create policy whatsapp_notification_log_select_authenticated
  on whatsapp_notification_log for select
  to authenticated using (true);

-- Sem policy de insert/update/delete para "authenticated" de propósito — a
-- Edge Function grava usando a service role key, que bypassa RLS.
