-- Estoque — fase 5 (itens que faltavam): (1) reserva mais fresca quando entra venda nova; (2) movimento físico origem -> EXP.
--
-- (1) Reserva: o `reservado` do Omie só chegava nas 4 janelas do sincronizador (7/11/15/19h). Agora, quando um pedido NASCE (ou muda)
--     para a etapa 20, o hub pede UMA rodada extra do `sync-estoque-omie` (a mesma função, a mesma leitura única do Omie — nada novo no
--     Omie). Trava de segurança contra bloqueio da API do Omie: no máximo 1 rodada extra a cada 30 min (tabela singleton atômica) e a
--     própria função ainda limita 20 chamadas/10 min. Falha engolida: o pedido sempre é gravado. Volume real: 1–6 pedidos/dia.
-- (2) Transferência: concluir a separação de um pedido registra, no livro-razão `estoque_movimentos`, cada item que saiu do endereço de
--     origem para a expedição (EXP). É só rastro físico: NUNCA vai ao Omie (enviar_omie = false, status 'interno'; a NF é que baixa).
--     Fica no livro-razão (e não em `estoque_eventos`) porque `estoque_eventos` é o contrato com o app de contagem. Falha engolida.

-- ---------------------------------------------------------------- (2) livro-razão aceita transferência interna
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.estoque_movimentos'::regclass and contype = 'c'
              and (pg_get_constraintdef(oid) ilike '%ajuste_contagem%' or pg_get_constraintdef(oid) ilike '%pendente_confirmacao%') loop
    execute format('alter table public.estoque_movimentos drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.estoque_movimentos
  add constraint estoque_movimentos_origem_check
    check (origem in ('ajuste_contagem', 'pcp_ajuste', 'transferencia_expedicao')),
  add constraint estoque_movimentos_status_omie_check
    check (status_omie in ('pendente_confirmacao', 'confirmado', 'descartado', 'enviado', 'interno'));
alter table public.estoque_movimentos add column if not exists endereco_origem text;
alter table public.estoque_movimentos add column if not exists endereco_destino text;

-- transferência nunca pode ir ao Omie
alter table public.estoque_movimentos
  add constraint estoque_movimentos_transferencia_interna
    check (origem <> 'transferencia_expedicao' or (enviar_omie = false and status_omie = 'interno'));

-- continua imutável (agora também os endereços)
create or replace function public.estoque_movimentos_guarda() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Movimento de estoque não pode ser apagado.'; end if;
  if (new.id, new.codigo, new.quantidade, new.origem, new.enviar_omie, new.referencia, new.chave, new.criado_em,
      new.endereco_origem, new.endereco_destino)
     is distinct from (old.id, old.codigo, old.quantidade, old.origem, old.enviar_omie, old.referencia, old.chave, old.criado_em,
      old.endereco_origem, old.endereco_destino) then
    raise exception 'Movimento de estoque é imutável; só a decisão pode ser registrada.';
  end if;
  return new;
end $$;

create or replace function public.estoque_mov_de_separacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'separado' and old.status is distinct from 'separado' then
    insert into public.estoque_movimentos
      (codigo, quantidade, origem, enviar_omie, status_omie, referencia, chave, observacao, endereco_origem, endereco_destino)
    select si.codigo, si.qtd_separada, 'transferencia_expedicao', false, 'interno',
           'pedido:' || new.codigo_pedido,
           'transf:' || new.codigo_pedido || ':' || si.codigo || ':' || si.endereco,
           'Separação do pedido ' || new.numero_pedido || ' por ' || coalesce(new.separado_por, '?') || ': ' || si.endereco || ' → EXP',
           si.endereco, 'EXP'
      from public.estoque_separacao_itens si
     where si.codigo_pedido = new.codigo_pedido and si.qtd_separada > 0
    on conflict (chave) do nothing;
  end if;
  return new;
exception when others then
  return new;      -- o rastro nunca pode impedir a conclusão da separação
end $$;
revoke all on function public.estoque_mov_de_separacao() from public, anon, authenticated;
drop trigger if exists trg_estoque_mov_de_separacao on public.estoque_separacoes;
create trigger trg_estoque_mov_de_separacao after update of status on public.estoque_separacoes
  for each row execute function public.estoque_mov_de_separacao();

-- ---------------------------------------------------------------- (1) rodada extra do sincronizador para venda nova
create table if not exists public.estoque_sync_demanda (
  id boolean primary key default true check (id),
  ultima timestamptz not null default 'epoch'
);
insert into public.estoque_sync_demanda (id) values (true) on conflict do nothing;
alter table public.estoque_sync_demanda enable row level security;
revoke all on public.estoque_sync_demanda from anon, authenticated;

create or replace function public.estoque_pedir_sync_por_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  if new.etapa = '20' and coalesce(new.cancelado, false) = false
     and (tg_op = 'INSERT' or old.etapa is distinct from new.etapa) then
    update public.estoque_sync_demanda set ultima = now()
     where id and ultima < now() - interval '30 minutes' returning true into v_ok;
    if v_ok then
      perform net.http_post(
        url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-estoque-omie',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
          'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'),
        body := '{}'::jsonb,
        timeout_milliseconds := 150000);
    end if;
  end if;
  return new;
exception when others then
  return new;      -- nunca impede o sync de pedidos de gravar o pedido
end $$;
revoke all on function public.estoque_pedir_sync_por_pedido() from public, anon, authenticated;
drop trigger if exists trg_estoque_pedir_sync_por_pedido on public.pcp_pedidos;
create trigger trg_estoque_pedir_sync_por_pedido after insert or update of etapa on public.pcp_pedidos
  for each row execute function public.estoque_pedir_sync_por_pedido();
