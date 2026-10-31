-- Segurança #571 · F1 — valores em R$ respeitados pelo BANCO, não só pela tela (Gelson, 10/10/2026).
-- Fonte das liberações: vpsistema.com/administracao → valores_acesso (modo todos/nenhum + liberar/esconder por
-- etiqueta 'modulo.etiqueta'), lida por vp_ve_valor(perfil, etiqueta).
--
-- Por que não "desfocar" coluna por coluna: boa parte dos valores mora dentro de blocos jsonb (data_json da proposta,
-- doc do contrato, resultado_v2 da precificação). Esconder pedaço de bloco faria quem não pode ver gravar o bloco
-- desfocado por cima do verdadeiro. Por isso, por tabela:
--   • fechada: quem não tem a etiqueta não LÊ nem GRAVA (tabelas só de dinheiro);
--   • mista:   lê normalmente, mas só GRAVA quem tem a etiqueta (ninguém sobrescreve preço por engano).
-- Vale só para quem fala com o banco com a SESSÃO individual (papel authenticated, fase F0). Funções internas do banco
-- (SECURITY DEFINER: cascatas, RPCs das páginas públicas) e as Edge Functions não são afetadas.
-- Limite honesto: a chave pública (anon) ainda lê/grava estas tabelas — fechar o anon é a fase F4.
--
-- NASCE DESLIGADA: só vale para quem está em vp_valores_piloto ('*' = todos).
--   Ligar p/ alguém:  insert into vp_valores_piloto(email, motivo) values ('fulano@…', '…');
--   Desligar tudo:    remover as linhas de vp_valores_piloto.
-- A recusa de gravação volta com hint 'vp_valores' — o site (vp-auth.js v3) NÃO refaz o pedido com a chave pública.

create table if not exists public.vp_valores_piloto (
  email      text primary key check (email = lower(email)),
  incluido_em timestamptz not null default now(),
  motivo     text
);
alter table public.vp_valores_piloto enable row level security;
revoke all on public.vp_valores_piloto from public, anon, authenticated;

create table if not exists public.vp_valores_regra (
  tabela    text primary key,
  modo      text not null check (modo in ('fechada', 'mista')),
  etiquetas text[] not null check (cardinality(etiquetas) > 0)  -- basta UMA delas
);
alter table public.vp_valores_regra enable row level security;
revoke all on public.vp_valores_regra from public, anon, authenticated;

insert into public.vp_valores_regra (tabela, modo, etiquetas) values
  ('precificacoes_elevador',            'fechada', array['precificacao.custos_precificacao', 'precificacao.margem']),
  ('avais_financeiros',                 'fechada', array['aval-financeiro.valores_aval']),
  ('custos_containers',                 'fechada', array['cadastro-custos.custos', 'precificacao.custos_precificacao']),
  ('custos_instalacao_elevador',        'fechada', array['cadastro-custos.custos', 'precificacao.custos_precificacao']),
  ('custos_instalacao_escada_esteira',  'fechada', array['cadastro-custos.custos', 'precificacao.custos_precificacao']),
  ('comissoes',                         'fechada', array['precificacao.comissao']),
  ('regras_comissionamento',            'fechada', array['precificacao.comissao']),
  ('contrato_instalador_parcelas',      'fechada', array['contrato-instalador.pagamento_instaladores']),
  ('pi_omie_pagamentos',                'fechada', array['pi-importacao.valores_pi']),
  ('propostas',                         'mista',   array['propostas.preco_proposta']),
  ('proposta_itens',                    'mista',   array['propostas.preco_proposta']),
  ('contratos_venda_equipamentos',      'mista',   array['contrato-venda-equipamentos.valor_contrato']),
  ('contratos_instalador',              'mista',   array['contrato-instalador.pagamento_instaladores']),
  ('cotacoes_elevador_fornecedor',      'mista',   array['cotacoes-fornecedor.preco_fornecedor']),
  ('pi_importacao',                     'mista',   array['pi-importacao.valores_pi']),
  ('embarques_importacao',              'mista',   array['embarques-importacao.valores_embarque']),
  ('ims_importacao',                    'mista',   array['ims-importacao.valor_previsto_ims'])
on conflict (tabela) do update set modo = excluded.modo, etiquetas = excluded.etiquetas;

-- A trava vale para quem está fazendo o pedido agora?
create or replace function public.vp_valores_ligado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vp_valores_piloto where email in ('*', public.vp_email()))
$$;

-- Quem pede pode mexer nos valores desta tabela? (desligado ou tabela sem regra = sim)
create or replace function public.vp_pode_valores(p_tabela text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not public.vp_valores_ligado() then true
    when not exists (select 1 from public.vp_valores_regra where tabela = p_tabela) then true
    else exists (
      select 1 from public.vp_valores_regra r, public.perfis p
       where r.tabela = p_tabela and lower(p.email) = public.vp_email() and p.ativo
         and exists (select 1 from unnest(r.etiquetas) e where public.vp_ve_valor(p.id, e)))
  end
$$;

revoke execute on function public.vp_valores_ligado(), public.vp_pode_valores(text) from public, anon;
grant execute on function public.vp_valores_ligado(), public.vp_pode_valores(text) to authenticated;

-- Gravação: só a gravação DIRETA de quem tem sessão (current_user = authenticated) é conferida.
create or replace function public.vp_valores_guarda() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.vp_pode_valores(tg_table_name) then
    raise exception 'Você não tem liberação para os valores em R$ desta tela.'
      using errcode = '42501', hint = 'vp_valores',
            detail = 'Peça a liberação em vpsistema.com/administracao (Valores).';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare r record;
begin
  for r in select tabela, modo from public.vp_valores_regra loop
    execute format('create or replace trigger vp_valores_guarda before insert or update or delete on public.%I
                    for each row execute function public.vp_valores_guarda()', r.tabela);
    if r.modo = 'fechada' and not exists (select 1 from pg_policies where schemaname = 'public'
                                           and tablename = r.tabela and policyname = 'vp_valores_leitura') then
      execute format('create policy vp_valores_leitura on public.%I as restrictive for select to authenticated
                      using ((select public.vp_pode_valores(%L)))', r.tabela, r.tabela);
    end if;
  end loop;
end $$;
