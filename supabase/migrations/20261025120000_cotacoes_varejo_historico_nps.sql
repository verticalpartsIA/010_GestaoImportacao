-- Cotações de Varejo — histórico que nunca morre, dólar duplo, descrição por produto e NPS de fornecedor
-- (25/10/2026; spec em docs/superpowers/specs/2026-10-25-rfq-importacao-vencedor-pi/). Só ADITIVA: nenhuma coluna/tabela
-- existente perde dado. A RPC do portal (public_ivc_responder) NÃO é alterada aqui — o dólar da resposta é gravado por trigger.

-- 1) Convite e item removidos ficam guardados (soft-delete). Antes, remover o convite apagava (cascata) respostas e decisões.
alter table public.iv_cotacao_convites
  add column if not exists removido_em timestamptz,
  add column if not exists removido_por text,
  add column if not exists removido_motivo text,
  add column if not exists substitui_convite_id uuid;

alter table public.iv_cotacao_itens
  add column if not exists removido_em timestamptz,
  add column if not exists removido_por text;

-- O mesmo fornecedor pode ser convidado de novo depois de removido: a unicidade passa a valer só entre os ativos.
alter table public.iv_cotacao_convites drop constraint if exists iv_cotacao_convites_lote_id_fornecedor_id_key;
create unique index if not exists iv_cotacao_convites_lote_fornecedor_ativo_uq
  on public.iv_cotacao_convites (lote_id, fornecedor_id) where removido_em is null;

-- Sem DELETE para o usuário em convite, resposta e item (o histórico não pode ser apagado pela tela).
drop policy if exists vp_int_del on public.iv_cotacao_convites;
drop policy if exists vp_int_del on public.iv_cotacao_respostas;
drop policy if exists vp_int_del on public.iv_cotacao_itens;
revoke delete on public.iv_cotacao_convites, public.iv_cotacao_respostas, public.iv_cotacao_itens from authenticated;

-- O link do fornecedor removido deixa de funcionar: ao marcar a remoção o token é trocado por um valor inutilizável
-- (as RPCs do portal procuram pelo token, então o link antigo vira "inválido" sem reescrevê-las).
create or replace function public.iv_convite_removido_invalida_token() returns trigger
language plpgsql as $$
begin
  if new.removido_em is not null and old.removido_em is null then
    new.token := 'removido-' || gen_random_uuid()::text;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_iv_convite_removido on public.iv_cotacao_convites;
create trigger trg_iv_convite_removido before update of removido_em on public.iv_cotacao_convites
  for each row execute function public.iv_convite_removido_invalida_token();

-- 2) Dólar do dia da cotação x dólar do dia da resposta.
alter table public.iv_cotacao_lotes
  add column if not exists cambio_cotacao_em timestamptz,
  add column if not exists cambio_fonte text;

alter table public.iv_cotacao_respostas
  add column if not exists cambio_resposta numeric,
  add column if not exists cambio_resposta_em timestamptz;

-- Dólar do dia: o sistema interno grava a PTAX (CambioAPI) ao abrir um lote; a resposta do fornecedor herda o último valor
-- conhecido na hora em que é gravada (trigger, sem depender da RPC pública).
create table if not exists public.cambio_diario (
  dia date primary key,
  usd_brl numeric not null check (usd_brl > 0),
  fonte text,
  registrado_por text,
  registrado_em timestamptz not null default now()
);
alter table public.cambio_diario enable row level security;
drop policy if exists vp_int_sel on public.cambio_diario;
drop policy if exists vp_int_ins on public.cambio_diario;
create policy vp_int_sel on public.cambio_diario for select to authenticated using ((select public.vp_usuario_ativo()));
create policy vp_int_ins on public.cambio_diario for insert to authenticated with check ((select public.vp_usuario_ativo()));
revoke all on public.cambio_diario from anon;
grant select, insert on public.cambio_diario to authenticated;
grant all on public.cambio_diario to service_role;

create or replace function public.iv_resposta_grava_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  select usd_brl into v from cambio_diario where dia <= (now() at time zone 'America/Sao_Paulo')::date order by dia desc limit 1;
  if v is not null then
    new.cambio_resposta := v;
    new.cambio_resposta_em := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_iv_resposta_cambio on public.iv_cotacao_respostas;
create trigger trg_iv_resposta_cambio before insert or update of faixas on public.iv_cotacao_respostas
  for each row execute function public.iv_resposta_grava_cambio();

-- 3) Descrição técnica do produto para o fornecedor (reaproveitada em todo lote).
create table if not exists public.produto_descricoes_exportacao (
  codigo text primary key,
  aplicacao text,
  equipamento text,
  tensao text,
  potencia text,
  medidas text,
  material text,
  observacao text,
  texto_pt text,
  texto_en text,
  texto_zh text,
  gerado_por_ia boolean not null default false,
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
alter table public.produto_descricoes_exportacao enable row level security;
drop policy if exists vp_int_sel on public.produto_descricoes_exportacao;
drop policy if exists vp_int_ins on public.produto_descricoes_exportacao;
drop policy if exists vp_int_upd on public.produto_descricoes_exportacao;
create policy vp_int_sel on public.produto_descricoes_exportacao for select to authenticated using ((select public.vp_usuario_ativo()));
create policy vp_int_ins on public.produto_descricoes_exportacao for insert to authenticated with check ((select public.vp_usuario_ativo()));
create policy vp_int_upd on public.produto_descricoes_exportacao for update to authenticated using ((select public.vp_usuario_ativo())) with check ((select public.vp_usuario_ativo()));
revoke all on public.produto_descricoes_exportacao from anon;
grant select, insert, update on public.produto_descricoes_exportacao to authenticated;
grant all on public.produto_descricoes_exportacao to service_role;

-- 4) NPS do fornecedor (0 a 5), histórico imutável: nova avaliação = nova linha.
create table if not exists public.fornecedor_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid,
  fornecedor_nome text not null,
  lote_id uuid,
  lote_numero text,
  convite_id uuid,
  nota_geral smallint not null check (nota_geral between 0 and 5),
  nota_respostas smallint check (nota_respostas between 0 and 5),
  nota_prazos smallint check (nota_prazos between 0 and 5),
  nota_preco smallint check (nota_preco between 0 and 5),
  nota_envio smallint check (nota_envio between 0 and 5),
  nota_sla smallint check (nota_sla between 0 and 5),
  comentario text,
  avaliado_por text default public.vp_email(),
  avaliado_em timestamptz not null default now()
);
create index if not exists fornecedor_avaliacoes_forn_idx on public.fornecedor_avaliacoes (fornecedor_id, avaliado_em);
create index if not exists fornecedor_avaliacoes_nome_idx on public.fornecedor_avaliacoes (lower(fornecedor_nome), avaliado_em);
alter table public.fornecedor_avaliacoes enable row level security;
drop policy if exists vp_int_sel on public.fornecedor_avaliacoes;
drop policy if exists vp_int_ins on public.fornecedor_avaliacoes;
create policy vp_int_sel on public.fornecedor_avaliacoes for select to authenticated using ((select public.vp_usuario_ativo()));
create policy vp_int_ins on public.fornecedor_avaliacoes for insert to authenticated with check ((select public.vp_usuario_ativo()));
revoke all on public.fornecedor_avaliacoes from anon;
grant select, insert on public.fornecedor_avaliacoes to authenticated;
grant all on public.fornecedor_avaliacoes to service_role;

create or replace view public.fornecedor_nps_v with (security_invoker = true) as
  select coalesce(fornecedor_id::text, lower(fornecedor_nome)) as chave, max(fornecedor_nome) as fornecedor_nome,
         count(*) as avaliacoes,
         round(avg(nota_geral)::numeric, 2) as geral, round(avg(nota_respostas)::numeric, 2) as respostas,
         round(avg(nota_prazos)::numeric, 2) as prazos, round(avg(nota_preco)::numeric, 2) as preco,
         round(avg(nota_envio)::numeric, 2) as envio, round(avg(nota_sla)::numeric, 2) as sla,
         max(avaliado_em) as ultima
    from fornecedor_avaliacoes group by 1;
grant select on public.fornecedor_nps_v to authenticated;

notify pgrst, 'reload schema';
