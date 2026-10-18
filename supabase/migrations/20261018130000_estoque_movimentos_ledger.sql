-- Estoque — fase 4 (etapas 1 e 2): livro-razão de movimentos em MODO SIMULAR. NADA é enviado ao Omie por aqui.
-- Regra de ouro: saída por VENDA/remessa não vai ao Omie (a NF já baixa lá); só consumo de produção, perda e ajuste de contagem.
-- Hoje o livro-razão só REGISTRA: (a) cada contagem com diferença vira um ajuste "pendente de confirmação manual";
-- (b) cada ajuste que o PCP já enviou ao Omie (pcp_omie_fila) é espelhado como "enviado". O envio real (etapa 3) fica para depois.

create table if not exists public.estoque_movimentos (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null,
  quantidade     numeric not null,                       -- com sinal: + entra, − sai
  origem         text not null check (origem in ('ajuste_contagem', 'pcp_ajuste')),
  enviar_omie    boolean not null,                       -- fixado na criação pela regra de ouro
  status_omie    text not null check (status_omie in ('pendente_confirmacao', 'confirmado', 'descartado', 'enviado')),
  referencia     text,
  chave          text not null unique,                   -- idempotência: um fato = um movimento
  observacao     text,
  criado_em      timestamptz not null default now(),
  decidido_por   text,
  decidido_em    timestamptz
);
create index if not exists estoque_movimentos_codigo_idx on public.estoque_movimentos (codigo, criado_em desc);
create index if not exists estoque_movimentos_pendentes_idx on public.estoque_movimentos (status_omie) where status_omie = 'pendente_confirmacao';

-- Nasce FECHADA (#571): só usuário logado ativo lê; ninguém grava direto — só as funções abaixo.
alter table public.estoque_movimentos enable row level security;
create policy estoque_movimentos_select on public.estoque_movimentos for select to authenticated using (public.vp_usuario_ativo());

-- Imutável: só as colunas de decisão podem mudar, e nunca apaga.
create or replace function public.estoque_movimentos_guarda() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Movimento de estoque não pode ser apagado.'; end if;
  if (new.id, new.codigo, new.quantidade, new.origem, new.enviar_omie, new.referencia, new.chave, new.criado_em)
     is distinct from (old.id, old.codigo, old.quantidade, old.origem, old.enviar_omie, old.referencia, old.chave, old.criado_em) then
    raise exception 'Movimento de estoque é imutável; só a decisão pode ser registrada.';
  end if;
  return new;
end $$;
drop trigger if exists trg_estoque_movimentos_guarda on public.estoque_movimentos;
create trigger trg_estoque_movimentos_guarda before update or delete on public.estoque_movimentos
  for each row execute function public.estoque_movimentos_guarda();

-- (a) Contagem com diferença -> ajuste pendente de confirmação manual (só contagens NOVAS; o histórico antigo não gera nada).
create or replace function public.estoque_mov_de_contagem() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.diferenca, 0) <> 0 then
    insert into public.estoque_movimentos (codigo, quantidade, origem, enviar_omie, status_omie, referencia, chave, observacao)
    values (upper(new.codigo), new.diferenca, 'ajuste_contagem', true, 'pendente_confirmacao', new.id::text, 'contagem:' || new.id,
            'Contagem ' || coalesce(new.origem, 'tela') || ': contado ' || new.quantidade || ' × sistema ' || coalesce(new.saldo_sistemico::text, '?'))
    on conflict (chave) do nothing;
  end if;
  return new;
exception when others then
  return new;      -- o registro no livro-razão nunca pode impedir a contagem de ser gravada
end $$;
drop trigger if exists trg_estoque_mov_de_contagem on public.importacao_varejo_contagem_hist;
create trigger trg_estoque_mov_de_contagem after insert on public.importacao_varejo_contagem_hist
  for each row execute function public.estoque_mov_de_contagem();

-- (b) Ajuste que o PCP já mandou ao Omie -> espelhado como "enviado" (só leitura do que já aconteceu).
create or replace function public.estoque_mov_de_fila() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tipo text; v_qtd numeric; v_cod text;
begin
  if new.tipo = 'ajuste_estoque' and new.status = 'enviado' then
    v_cod  := upper(new.payload #>> '{meta,codigo}');
    v_tipo := new.payload #>> '{meta,tipo}';
    v_qtd  := (new.payload #>> '{meta,quantidade}')::numeric;
    if v_cod is not null and v_qtd is not null and v_tipo in ('ENT', 'SAI') then
      insert into public.estoque_movimentos (codigo, quantidade, origem, enviar_omie, status_omie, referencia, chave, observacao)
      values (v_cod, case when v_tipo = 'SAI' then -v_qtd else v_qtd end, 'pcp_ajuste', true, 'enviado', new.id::text, 'fila:' || new.id,
              left(coalesce(new.payload #>> '{param,obs}', ''), 200))
      on conflict (chave) do nothing;
    end if;
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists trg_estoque_mov_de_fila on public.pcp_omie_fila;
create trigger trg_estoque_mov_de_fila after insert or update of status on public.pcp_omie_fila
  for each row execute function public.estoque_mov_de_fila();

-- Decisão manual (etapa 2): confirmar ou descartar um ajuste pendente. CONFIRMAR NÃO ENVIA nada ao Omie — só registra a decisão
-- (o envio real, com chave idempotente, é a etapa 3).
create or replace function public.estoque_decidir_movimento(p_id uuid, p_confirmar boolean) returns public.estoque_movimentos
language plpgsql security definer set search_path = public as $$
declare r public.estoque_movimentos;
begin
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('almoxarifado', 'escrever_omie')) then
    raise exception 'Sem permissão para decidir movimentos de estoque.';
  end if;
  update public.estoque_movimentos
     set status_omie = case when p_confirmar then 'confirmado' else 'descartado' end,
         decidido_por = public.vp_email(), decidido_em = now()
   where id = p_id and status_omie = 'pendente_confirmacao'
   returning * into r;
  if r.id is null then raise exception 'Movimento não encontrado ou já decidido.'; end if;
  return r;
end $$;
revoke all on function public.estoque_decidir_movimento(uuid, boolean) from public, anon;
grant execute on function public.estoque_decidir_movimento(uuid, boolean) to authenticated;

-- Conferência: por item, o que está parado esperando decisão e o que já foi ao Omie.
create or replace view public.estoque_reconciliacao_v with (security_invoker = true) as
select m.codigo,
       count(*) filter (where m.status_omie = 'pendente_confirmacao')                      as aguardando,
       coalesce(sum(m.quantidade) filter (where m.status_omie = 'pendente_confirmacao'), 0) as qtd_aguardando,
       count(*) filter (where m.status_omie = 'confirmado')                                as confirmados,
       coalesce(sum(m.quantidade) filter (where m.status_omie = 'enviado'), 0)             as qtd_enviada,
       e.fisico                                                                            as fisico_omie,
       max(m.criado_em)                                                                    as ultimo_movimento
  from public.estoque_movimentos m
  left join public.importacao_varejo_estoque e on upper(e.codigo) = m.codigo
 group by m.codigo, e.fisico;
grant select on public.estoque_reconciliacao_v to authenticated;
