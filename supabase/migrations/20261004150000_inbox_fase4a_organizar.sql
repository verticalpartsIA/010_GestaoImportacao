-- Inbox · fase 4A (04/10/2026): organização estilo Gmail — Arquivar, Adiar (Suspender), Spam e Marcadores. Aditivo.
-- Modelo (decisões padrão — o usuário ainda não escolheu entre pessoal/equipe, então: o que é "limpar a MINHA caixa" é pessoal;
-- o que descreve o e-mail para todos é compartilhado):
--   · estrela, arquivar, adiar  → POR PESSOA (inbox_estado_pessoa). Arquivar não some o e-mail de ninguém; continua em "Todos os e-mails".
--   · spam                      → COMPARTILHADO (emails_projeto.spam_em/por), mas a tela nunca deixa marcar e-mail ligado a cotação/documento.
--   · marcadores                → "pessoal" (só o dono do marcador) ou "equipe" (todos que veem o e-mail; criar exige triagem/ver_todos).
-- Limite honesto: organização na tela (issue #571). Não altera send-email, read-inbox nem o vínculo/matching.

-- 1) Por pessoa: arquivado + adiado
alter table public.inbox_estado_pessoa
  add column if not exists arquivado boolean not null default false,
  add column if not exists adiado_ate timestamptz,
  add column if not exists acordado_avisado_em timestamptz;
create index if not exists inbox_estado_pessoa_adiado_idx on public.inbox_estado_pessoa (adiado_ate) where adiado_ate is not null;

-- 2) Spam compartilhado
alter table public.emails_projeto
  add column if not exists spam_em timestamptz,
  add column if not exists spam_por text;

-- 3) Marcadores (aninháveis) e vínculo e-mail–marcador
create table if not exists public.inbox_marcadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 60),
  cor text not null default '#64748b',
  escopo text not null check (escopo in ('pessoal', 'equipe')),
  dono_email text not null,
  pai_id uuid references public.inbox_marcadores(id) on delete set null,
  criado_em timestamptz not null default now()
);
create unique index if not exists inbox_marcadores_unico_idx on public.inbox_marcadores
  (escopo, (case when escopo = 'pessoal' then dono_email else '' end), lower(trim(nome)), coalesce(pai_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.inbox_marcadores enable row level security;
drop policy if exists inbox_marcadores_all on public.inbox_marcadores;
create policy inbox_marcadores_all on public.inbox_marcadores for all to anon, authenticated using (true) with check (true);

create table if not exists public.inbox_email_marcador (
  email_id uuid not null references public.emails_projeto(id) on delete cascade,
  marcador_id uuid not null references public.inbox_marcadores(id) on delete cascade,
  aplicado_por text,
  aplicado_em timestamptz not null default now(),
  primary key (email_id, marcador_id)
);
create index if not exists inbox_email_marcador_marcador_idx on public.inbox_email_marcador (marcador_id);
alter table public.inbox_email_marcador enable row level security;
drop policy if exists inbox_email_marcador_all on public.inbox_email_marcador;
create policy inbox_email_marcador_all on public.inbox_email_marcador for all to anon, authenticated using (true) with check (true);

-- 4) Adiado que voltou → avisa a pessoa (Central de Notificações), uma vez. O e-mail já volta "não lido" (a tela grava lido=false ao adiar).
create or replace function public.inbox_acordar_adiados() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; v_assunto text;
begin
  for r in select s.email_id, s.pessoa from public.inbox_estado_pessoa s
            where s.adiado_ate is not null and s.adiado_ate <= now() and s.acordado_avisado_em is null limit 200 loop
    begin
      select coalesce(assunto, '(sem assunto)') into v_assunto from public.emails_projeto where id = r.email_id;
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values ('inbox-acordou-' || r.email_id::text || '-' || md5(r.pessoa), 'info', 'E-mail adiado voltou', left(coalesce(v_assunto, ''), 480), 'Inbox', false, r.pessoa, '/geral/inbox')
      on conflict (id) do nothing;
      update public.inbox_estado_pessoa set acordado_avisado_em = now() where email_id = r.email_id and pessoa = r.pessoa;
      n := n + 1;
    exception when others then null;     -- um aviso com problema não trava os demais
    end;
  end loop;
  return n;
end $$;
revoke all on function public.inbox_acordar_adiados() from public, anon, authenticated;

do $$ begin perform cron.unschedule(jobid) from cron.job where jobname = 'inbox-acordar-adiados'; end $$;
select cron.schedule('inbox-acordar-adiados', '*/10 * * * *', $$ select public.inbox_acordar_adiados() $$);
