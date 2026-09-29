-- Avais Financeiro e Jurídico abrem juntos quando o cliente aprova a Proposta
-- (29/09/2026, pedido do usuário).
--
-- 1) Aval Jurídico deixa de nascer só do Contrato de Venda assinado: passa a
--    ter proposta_id (chave principal nova) e contrato_venda_id vira opcional
--    (é preenchido depois, quando o contrato existir — usado pelo gate do
--    Desenho de Instalação).
-- 2) Trigger em propostas: status -> 'aprovada' cria os dois registros de aval
--    (se ainda não existirem) e grava uma notificação em `alertas`
--    ("avais iniciados"). Roda no banco porque a assinatura acontece na
--    página pública /assinar, que não carrega os stores de aval.
-- 3) Trigger nos dois avais: quando Aval de Pagamento (Financeiro) E Aval
--    Jurídico estão aprovados, grava a notificação "avais OK" (uma vez só,
--    id determinístico). Se a margem da precificação ficou abaixo de 15%
--    (ou é desconhecida), o texto avisa que ainda falta a aprovação do CEO —
--    mesma regra de LIMITE_MARGEM_SEM_CEO em decisoes-store.js.

alter table public.avais_juridicos alter column contrato_venda_id drop not null;
alter table public.avais_juridicos add column if not exists proposta_id uuid;
create unique index if not exists avais_juridicos_proposta_id_uniq
  on public.avais_juridicos (proposta_id) where proposta_id is not null;
create index if not exists avais_juridicos_numero_cotacao_idx
  on public.avais_juridicos (numero_cotacao);

create or replace function public.fn_avais_abrir_na_proposta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente text;
  v_ref text;
begin
  if new.status is distinct from 'aprovada' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'aprovada' then return new; end if;

  v_cliente := coalesce(new.data_json->'cliente'->>'nome', new.titulo);
  v_ref := coalesce('Cotação Nº ' || new.numero_cotacao::text, 'Proposta ' || new.numero_documento, 'Proposta');

  insert into avais_financeiros (numero_cotacao, proposta_id, numero_documento, cliente_nome, valor_total, status)
  values (new.numero_cotacao, new.id, new.numero_documento, v_cliente, new.valor_total, 'pendente_consulta')
  on conflict (proposta_id) where proposta_id is not null do nothing;

  insert into avais_juridicos (proposta_id, numero_cotacao, numero_documento, cliente_nome, status)
  values (new.id, new.numero_cotacao, new.numero_documento, v_cliente, 'pendente')
  on conflict (proposta_id) where proposta_id is not null do nothing;

  insert into alertas (id, level, title, sub, module, resolved)
  values (
    'avais-abertos-' || new.id::text, 'info',
    v_ref || ' — Avais Financeiro e Jurídico iniciados',
    coalesce(v_cliente, '—') || ' aprovou a proposta. Jurídico: dar o aval em "Aval Jurídico". Financeiro: Aval de Pagamento depois do sinal pago.',
    'Financeiro', false)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_avais_abrir_na_proposta on public.propostas;
create trigger trg_avais_abrir_na_proposta
  after insert or update of status on public.propostas
  for each row execute function public.fn_avais_abrir_na_proposta();

create or replace function public.fn_avais_notificar_ok(p_proposta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  af record;
  aj record;
  v_margem numeric;
  v_ref text;
  v_sub text;
begin
  if p_proposta_id is null then return; end if;
  select * into af from avais_financeiros where proposta_id = p_proposta_id;
  select * into aj from avais_juridicos where proposta_id = p_proposta_id;
  if af.id is null or aj.id is null then return; end if;
  if not coalesce(af.aval_pagamento_confirmado, false) or aj.status <> 'aprovado' then return; end if;

  if af.numero_cotacao is not null then
    select coalesce((pz.resultado_v2->'precificacao'->>'margemEfetivaPct')::numeric,
                    (pz.resultado->>'margemFinalPct')::numeric)
      into v_margem
      from precificacoes_elevador pz
     where pz.numero_cotacao = af.numero_cotacao
     order by (pz.status = 'finalizado') desc, pz.updated_at desc
     limit 1;
  end if;

  v_ref := coalesce('Cotação Nº ' || af.numero_cotacao::text, 'Proposta ' || af.numero_documento, 'Proposta');
  if v_margem is not null and v_margem >= 0.15 then
    v_sub := coalesce(af.cliente_nome, '—') || ' · Aval de Pagamento e Aval Jurídico aprovados — a compra na China está liberada.';
  elsif af.aprovacao_ceo_em is not null then
    v_sub := coalesce(af.cliente_nome, '—') || ' · Aval de Pagamento, Aval Jurídico e CEO aprovados — a compra na China está liberada.';
  else
    v_sub := coalesce(af.cliente_nome, '—') || ' · Aval de Pagamento e Aval Jurídico aprovados. Margem '
      || coalesce(round(v_margem * 100, 1)::text || '%', 'desconhecida')
      || ' — falta a aprovação do CEO (Diego) em "Aval Financeiro" para liberar a compra.';
  end if;

  insert into alertas (id, level, title, sub, module, resolved)
  values ('avais-ok-' || p_proposta_id::text, 'info', v_ref || ' — Avais Financeiro e Jurídico OK', v_sub, 'Financeiro', false)
  on conflict (id) do nothing;
end;
$$;

create or replace function public.fn_avais_notificar_ok_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_avais_notificar_ok(new.proposta_id);
  return new;
end;
$$;

drop trigger if exists trg_avais_financeiros_ok on public.avais_financeiros;
create trigger trg_avais_financeiros_ok
  after update of aval_pagamento_confirmado on public.avais_financeiros
  for each row when (new.aval_pagamento_confirmado is true)
  execute function public.fn_avais_notificar_ok_trg();

drop trigger if exists trg_avais_juridicos_ok on public.avais_juridicos;
create trigger trg_avais_juridicos_ok
  after update of status on public.avais_juridicos
  for each row when (new.status = 'aprovado')
  execute function public.fn_avais_notificar_ok_trg();

-- Carga inicial: propostas já aprovadas ganham o registro de Aval Jurídico
-- (e de Aval Financeiro, se ainda não tiverem). Sem notificação — são
-- anteriores a esta regra.
insert into public.avais_financeiros (numero_cotacao, proposta_id, numero_documento, cliente_nome, valor_total, status)
select p.numero_cotacao, p.id, p.numero_documento, coalesce(p.data_json->'cliente'->>'nome', p.titulo), p.valor_total, 'pendente_consulta'
  from public.propostas p where p.status = 'aprovada'
on conflict (proposta_id) where proposta_id is not null do nothing;

insert into public.avais_juridicos (proposta_id, numero_cotacao, numero_documento, cliente_nome, status)
select p.id, p.numero_cotacao, p.numero_documento, coalesce(p.data_json->'cliente'->>'nome', p.titulo), 'pendente'
  from public.propostas p where p.status = 'aprovada'
on conflict (proposta_id) where proposta_id is not null do nothing;

-- Vincula o contrato de venda já existente (se houver) ao aval jurídico da proposta.
update public.avais_juridicos aj
   set contrato_venda_id = cv.id, atualizado_em = now()
  from public.contratos_venda_equipamentos cv
 where aj.proposta_id = cv.proposta_id and aj.contrato_venda_id is null;
