-- Inbox · fase 2 (04/10/2026): troca de dono ("atribuído a"), lido/estrela POR PESSOA e sugestão de vínculo no formato JEV
-- (candidatos com probabilidade e confiança; a tela decide se mostra). Aditivo: não altera send-email, read-inbox nem o vínculo/matching.
-- Limite honesto: organização na tela (issue #571). A sugestão usa só dado já legível pela tela (clientes, fornecedores, cotações, e-mails).

-- 1) Atribuição: o AUTOR/dono original nunca muda; o "responsável atual" = atribuído_a, senão dono. Histórico eterno (sem update/delete).
alter table public.emails_projeto
  add column if not exists atribuido_a text,
  add column if not exists atribuido_por text,
  add column if not exists atribuido_em timestamptz;
create index if not exists emails_projeto_atribuido_idx on public.emails_projeto (atribuido_a);

create table if not exists public.inbox_atribuicoes (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.emails_projeto(id) on delete cascade,
  de_pessoa text,
  para_pessoa text not null,
  por_pessoa text,
  motivo text,
  criado_em timestamptz not null default now()
);
create index if not exists inbox_atribuicoes_email_idx on public.inbox_atribuicoes (email_id, criado_em);
alter table public.inbox_atribuicoes enable row level security;
drop policy if exists inbox_atribuicoes_select on public.inbox_atribuicoes;
drop policy if exists inbox_atribuicoes_insert on public.inbox_atribuicoes;
create policy inbox_atribuicoes_select on public.inbox_atribuicoes for select to anon, authenticated using (true);
create policy inbox_atribuicoes_insert on public.inbox_atribuicoes for insert to anon, authenticated with check (true);   -- sem update/delete: histórico eterno

-- 2) Lido e estrela POR PESSOA (o IMAP \Seen continua sendo o "lido" da caixa, compartilhado; isto é o de cada um).
create table if not exists public.inbox_estado_pessoa (
  email_id uuid not null references public.emails_projeto(id) on delete cascade,
  pessoa text not null,
  lido boolean not null default false,
  estrela boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (email_id, pessoa)
);
create index if not exists inbox_estado_pessoa_pessoa_idx on public.inbox_estado_pessoa (pessoa);
alter table public.inbox_estado_pessoa enable row level security;
drop policy if exists inbox_estado_pessoa_all on public.inbox_estado_pessoa;
create policy inbox_estado_pessoa_all on public.inbox_estado_pessoa for all to anon, authenticated using (true) with check (true);

-- 3) Sugestão de vínculo (JEV): dado o(s) e-mail(s) da outra ponta (e, opcionalmente, o assunto), devolve até 5 cotações candidatas
--    com pontuação, probabilidade e confiança. Pontos: cliente com esse e-mail (0,45) · fornecedor com esse e-mail (0,45) ·
--    já trocamos e-mail com a pessoa sobre a cotação (0,30 + 0,05/e-mail, máx 0,45) · assunto cita o nº (0,60) ·
--    cotação recente (30d +0,20 / 90d +0,10) · tem proposta (0,05). probabilidade = pontos / soma; confiança = prob × min(1, pontos/0,9).
--    NÃO é calibrada como um modelo; a tela só pergunta quando há evidência (ver inbox-triagem-calc.js › politicaSugestao).
create or replace function public.inbox_sugerir_vinculo(p_emails text[], p_assunto text default null)
returns jsonb language sql stable security definer set search_path = public as $$
with alvo as (
  select distinct lower(trim(e)) em from unnest(coalesce(p_emails, '{}'::text[])) e where position('@' in coalesce(e, '')) > 1
), cli as (
  select a.em, c.id cid, coalesce(nullif(c.nome_fantasia, ''), c.razao_social) nome
    from alvo a join public.clientes c on position(a.em in lower(coalesce(c.email, ''))) > 0
), forn as (
  select a.em, coalesce(nullif(fo.nome_fantasia, ''), fo.razao_social) nome
    from alvo a join public.fornecedores fo on position(a.em in lower(coalesce(fo.email, ''))) > 0
), por_cliente as (
  select f.numero_cotacao n, 'cliente'::text origem, cli.nome, f.created_at, lower(f.created_by) created_by, 0 qtd
    from public.formularios_elevador f join cli on f.cliente_id = cli.cid where f.numero_cotacao is not null
), por_fornecedor as (
  select (cf.dados_envio->'header'->>'numero_cotacao')::int n, 'fornecedor'::text origem, forn.nome, cf.created_at, null::text created_by, 0 qtd
    from public.cotacoes_elevador_fornecedor cf join forn on lower(cf.fornecedor) like '%' || lower(forn.nome) || '%'
   where cf.excluido_em is null and (cf.dados_envio->'header'->>'numero_cotacao') ~ '^[0-9]+$'
), historico as (
  select m.numero_cotacao n, 'historico'::text origem, null::text nome, max(m.data_mensagem) created_at, null::text created_by, count(*)::int qtd
    from public.emails_projeto m join alvo a on (lower(coalesce(m.de_email, '')) = a.em or position(a.em in lower(coalesce(m.para::text, ''))) > 0)
   where m.numero_cotacao is not null and m.excluido_em is null group by m.numero_cotacao
), por_assunto as (
  select (regexp_matches(coalesce(p_assunto, ''), '(?:vpct-?|cota[cç][aã]o[^0-9]{0,12}|n[ºo°]\.?\s*)0*([0-9]{3,5})', 'gi'))[1]::int n
), base as (
  select n, origem, nome, created_at, created_by, qtd from por_cliente
  union all select n, origem, nome, created_at, created_by, qtd from por_fornecedor
  union all select n, origem, nome, created_at, created_by, qtd from historico
  union all select n, 'assunto', null, null, null, 0 from por_assunto
), pontos as (
  select b.n,
    max(b.nome) filter (where b.nome is not null) nome,
    array_agg(distinct b.origem) origens,
    max(b.created_by) dono,
    (case when bool_or(b.origem = 'cliente') then 0.45 else 0 end
     + case when bool_or(b.origem = 'fornecedor') then 0.45 else 0 end
     + case when bool_or(b.origem = 'historico') then least(0.45, 0.30 + 0.05 * max(b.qtd)) else 0 end
     + case when bool_or(b.origem = 'assunto') then 0.6 else 0 end
     + case when max(b.created_at) > now() - interval '30 days' then 0.2 when max(b.created_at) > now() - interval '90 days' then 0.1 else 0 end
     + case when exists (select 1 from public.propostas p where p.numero_cotacao = b.n) then 0.05 else 0 end)::numeric score
  from base b
  where b.n is not null and exists (select 1 from public.formularios_elevador f where f.numero_cotacao = b.n)
  group by b.n
), tot as (select coalesce(sum(score), 0) s from pontos),
ranking as (
  select p.*, round(p.score / nullif(t.s, 0), 2) prob from pontos p cross join tot t order by p.score desc limit 5
)
select jsonb_build_object(
  'candidatos', coalesce((select jsonb_agg(jsonb_build_object('numero', n, 'nome', nome, 'origens', origens, 'dono', dono,
                           'score', round(score, 2), 'probabilidade', prob) order by score desc) from ranking), '[]'::jsonb),
  'confianca', coalesce((select round(least(0.99, prob * least(1, score / 0.9)), 2) from ranking order by score desc limit 1), 0),
  'origem', 'regras-v1');
$$;
grant execute on function public.inbox_sugerir_vinculo(text[], text) to anon, authenticated;
