-- Engenharia & Produto › Solicitações de Produto — linha do tempo REAL (8.3).
-- Cada fato do ciclo vira uma linha imutável: quem abriu, quem foi avisado (e quem escolheu),
-- quem iniciou a análise, quem criou a Ficha Técnica, quem foi avisado na Importação e quem publicou no Omie.
-- "Avisado" e "executou" são pessoas diferentes de propósito: o solicitante escolhe quem avisar,
-- mas quem de fato faz pode ser outra pessoa.
-- Nasce FECHADA (Art. 26 / plano #571): só usuário ativo lê e grava; ninguém atualiza nem apaga (histórico imutável, Art. 27).
-- O autor gravado tem de ser o próprio usuário logado (vp_email()), então ninguém registra em nome de outro.

create table if not exists public.solicitacao_produto_eventos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id bigint not null references public.solicitacoes_produto(id),
  tipo text not null check (tipo in (
    'aberta', 'aviso_engenharia', 'analise_iniciada', 'ficha_criada', 'aviso_importacao', 'ficha_publicada'
  )),
  ator_nome text,
  ator_email text not null,
  alvo_nome text,
  alvo_email text,
  detalhe jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists solicitacao_produto_eventos_sol_idx
  on public.solicitacao_produto_eventos (solicitacao_id, criado_em);

alter table public.solicitacao_produto_eventos enable row level security;
revoke all on public.solicitacao_produto_eventos from anon, authenticated;
grant select, insert on public.solicitacao_produto_eventos to authenticated;
grant all on public.solicitacao_produto_eventos to service_role;

drop policy if exists spev_sel on public.solicitacao_produto_eventos;
create policy spev_sel on public.solicitacao_produto_eventos for select to authenticated
  using ((select public.vp_usuario_ativo()));

drop policy if exists spev_ins on public.solicitacao_produto_eventos;
create policy spev_ins on public.solicitacao_produto_eventos for insert to authenticated
  with check ((select public.vp_usuario_ativo()) and lower(ator_email) = lower((select public.vp_email())));

-- ---------------------------------------------------------------------------
-- Carga inicial: reconstrói o que já aconteceu nas solicitações ativas, SÓ com dado que existe
-- (solicitacoes_produto, alertas já enviados e vp_logs da ficha). Marcado origem=reconstruido.
-- Não inventa ator: sem registro de quem criou a ficha, o evento não é criado.
-- ---------------------------------------------------------------------------
insert into public.solicitacao_produto_eventos (solicitacao_id, tipo, ator_nome, ator_email, detalhe, criado_em)
select s.id, 'aberta', s.solicitante_nome, coalesce(s.solicitante_email, ''), '{"origem":"reconstruido"}'::jsonb, s.data_criacao
from public.solicitacoes_produto s
where s.excluido_em is null;

insert into public.solicitacao_produto_eventos (solicitacao_id, tipo, ator_nome, ator_email, alvo_nome, alvo_email, detalhe, criado_em)
select s.id,
       case when a.id like 'sol-pronto-%' or a.id like 'sol-ficha-%' then 'aviso_importacao' else 'aviso_engenharia' end,
       s.solicitante_nome, coalesce(s.solicitante_email, ''),
       p.nome, a.destinatario_email,
       '{"origem":"reconstruido"}'::jsonb, a.created_at
from public.solicitacoes_produto s
join public.alertas a on a.id like 'sol-%' || s.numero_solicitacao || '%' and a.destinatario_email is not null
left join public.perfis p on lower(p.email) = lower(a.destinatario_email)
where s.excluido_em is null;

insert into public.solicitacao_produto_eventos (solicitacao_id, tipo, ator_nome, ator_email, detalhe, criado_em)
select s.id, 'analise_iniciada', p.nome, s.engenheiro_responsavel, '{"origem":"reconstruido"}'::jsonb, s.data_inicio_analise
from public.solicitacoes_produto s
left join public.perfis p on lower(p.email) = lower(s.engenheiro_responsavel)
where s.excluido_em is null and s.data_inicio_analise is not null and s.engenheiro_responsavel is not null;

insert into public.solicitacao_produto_eventos (solicitacao_id, tipo, ator_nome, ator_email, detalhe, criado_em)
select s.id, 'ficha_criada', l.ator_nome, coalesce(p.email, ''),
       jsonb_build_object('origem', 'reconstruido', 'ficha_tecnica_id', s.ficha_tecnica_id),
       l.criado_em
from public.solicitacoes_produto s
join public.vp_logs l on l.alvo_id = s.ficha_tecnica_id::text and l.modulo = 'Ficha Técnica' and l.acao ilike 'Criou ficha%'
left join public.perfis p on lower(p.nome) = lower(l.ator_nome)
where s.excluido_em is null and s.ficha_tecnica_id is not null;

insert into public.solicitacao_produto_eventos (solicitacao_id, tipo, ator_nome, ator_email, detalhe, criado_em)
select s.id, 'ficha_publicada', l.ator_nome, coalesce(p.email, ''),
       jsonb_build_object('origem', 'reconstruido', 'acao', l.acao, 'codigo_produto', l.detalhe->>'codigo_produto'),
       l.criado_em
from public.solicitacoes_produto s
join public.vp_logs l on l.alvo_id = s.ficha_tecnica_id::text and l.modulo = 'Ficha Técnica' and l.acao ilike '%publicou ficha no Omie%'
left join public.perfis p on lower(p.nome) = lower(l.ator_nome)
where s.excluido_em is null and s.ficha_tecnica_id is not null;

notify pgrst, 'reload schema';
