-- Recibos de pagamento ao montador (15/10/2026).
-- Fluxo: o Omie paga -> o sistema registra -> envia o recibo por link -> o montador assina e atesta o recebimento ->
-- o valor é abatido das parcelas do contrato (adiantamento) e o recibo aparece em Pagamentos a Instaladores.
-- Tabela nasce FECHADA (só usuário logado e ativo). A página pública do montador usa só as RPCs por token (SECURITY DEFINER).

create table if not exists public.instalador_recibos (
  id text primary key,
  tipo text not null default 'adiantamento' check (tipo in ('adiantamento','parcela')),
  acordo_id text,
  contrato_id uuid,
  parcela_id text,
  dossier_id text,
  parceiro_instalador_id text not null,
  instalador_nome text,
  instalador_cnpj text,
  valor numeric(14,2) not null check (valor > 0),
  data_pagamento date not null,
  forma text,                                   -- PIX, TED...
  descricao text,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'pendente' check (status in ('pendente','assinado','recusado','cancelado')),
  enviado_em timestamptz,
  visualizado_em timestamptz,
  assinado_em timestamptz,
  audit jsonb not null default '{}'::jsonb,
  log jsonb not null default '[]'::jsonb,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists instalador_recibos_contrato_idx on public.instalador_recibos (contrato_id);
create index if not exists instalador_recibos_parceiro_idx on public.instalador_recibos (parceiro_instalador_id);
create index if not exists instalador_recibos_dossier_idx on public.instalador_recibos (dossier_id);

alter table public.instalador_recibos enable row level security;
revoke all on public.instalador_recibos from anon;
drop policy if exists ir_select on public.instalador_recibos;
drop policy if exists ir_insert on public.instalador_recibos;
drop policy if exists ir_update on public.instalador_recibos;
create policy ir_select on public.instalador_recibos for select to authenticated using (public.vp_usuario_ativo());
create policy ir_insert on public.instalador_recibos for insert to authenticated with check (public.vp_usuario_ativo());
create policy ir_update on public.instalador_recibos for update to authenticated using (public.vp_usuario_ativo()) with check (public.vp_usuario_ativo());
grant select, insert, update on public.instalador_recibos to authenticated;

-- ---------- RPCs públicas (token) ----------
-- Só devolve o necessário para mostrar o recibo ao montador. Nunca lista, nunca expõe outro registro.
create or replace function public.public_recibo_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r instalador_recibos%rowtype;
begin
  if coalesce(length(p_token), 0) < 16 then return null; end if;
  select * into r from instalador_recibos where token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', r.id, 'tipo', r.tipo, 'status', r.status, 'valor', r.valor, 'data_pagamento', r.data_pagamento, 'forma', r.forma,
    'descricao', r.descricao, 'dossier_id', r.dossier_id, 'instalador_nome', r.instalador_nome, 'instalador_cnpj', r.instalador_cnpj,
    'assinado_em', r.assinado_em, 'assinante', r.audit->>'signerName');
end $$;

create or replace function public.public_recibo_visualizado(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(length(p_token), 0) < 16 then return; end if;
  update instalador_recibos set visualizado_em = coalesce(visualizado_em, now()), atualizado_em = now()
   where token = p_token and status = 'pendente';
end $$;

create or replace function public.public_recibo_assinar(p_token text, p_audit jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r instalador_recibos%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 16 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into r from instalador_recibos where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status = 'assinado' then return jsonb_build_object('ok', true, 'jaAssinado', true); end if;   -- idempotente
  if r.status <> 'pendente' then return jsonb_build_object('ok', false, 'erro', 'status_' || r.status); end if;
  if coalesce(trim(p_audit->>'signerName'), '') = '' then return jsonb_build_object('ok', false, 'erro', 'nome_obrigatorio'); end if;
  ip := public._pp_ip(p_audit->>'signIp');
  update instalador_recibos set status = 'assinado', assinado_em = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('signedAt', now(), 'signIp', ip, 'consent', true),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'assinado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'hash', p_audit->>'hash')))
   where id = r.id;
  -- Aviso na Central de Notificações (global; falha nunca impede a assinatura).
  begin
    insert into alertas (id, title, sub, level, module, rota)
    values ('recibo-' || r.id, 'Recibo ' || r.id || ' ASSINADO', coalesce(r.instalador_nome, 'Montador') || ' atestou o recebimento de R$ ' || to_char(r.valor, 'FM999G999G990D00'),
            'info', 'Financeiro', '/adm-financeiro/pagamentos-instalador/recibos')
    on conflict (id) do nothing;
  exception when others then null;
  end;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.public_recibo_recusar(p_token text, p_nome text, p_motivo text, p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r instalador_recibos%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 16 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into r from instalador_recibos where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status <> 'pendente' then return jsonb_build_object('ok', false, 'erro', 'status_' || r.status); end if;
  ip := public._pp_ip(p_audit->>'refuseIp');
  update instalador_recibos set status = 'recusado', atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || jsonb_build_object('refusedAt', now(), 'refusedBy', nullif(left(trim(coalesce(p_nome, '')), 200), ''),
                 'refusedReason', nullif(left(trim(coalesce(p_motivo, '')), 2000), ''), 'refuseIp', ip),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'recusado', 'at', now(), 'meta', jsonb_build_object('ip', ip)))
   where id = r.id;
  begin
    insert into alertas (id, title, sub, level, module, rota)
    values ('recibo-rec-' || r.id, 'Recibo ' || r.id || ' RECUSADO', coalesce(r.instalador_nome, 'Montador') || ' não reconheceu o pagamento — confira com o Financeiro.',
            'danger', 'Financeiro', '/adm-financeiro/pagamentos-instalador/recibos')
    on conflict (id) do nothing;
  exception when others then null;
  end;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.public_recibo_obter(text), public.public_recibo_visualizado(text), public.public_recibo_assinar(text, jsonb),
  public.public_recibo_recusar(text, text, text, jsonb) from public;
grant execute on function public.public_recibo_obter(text), public.public_recibo_visualizado(text), public.public_recibo_assinar(text, jsonb),
  public.public_recibo_recusar(text, text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
