-- Solicitações de Produto — chat interno e devolução com pendência (8.3, spec de 04/11/2026).
-- Aditiva: nada existente muda de significado. Tabela nova nasce FECHADA e imutável (Arts. 26 e 27).

-- 1) Pendência por cima do status (a Ficha já foi criada; o status do ciclo não volta).
alter table public.solicitacoes_produto
  add column if not exists pendente_com text check (pendente_com in ('solicitante','engenharia','importacao')),
  add column if not exists pendente_desde timestamptz,
  add column if not exists pendente_prazo timestamptz,
  add column if not exists pendente_motivo text;

-- 2) Linha do tempo: dois tipos novos de evento.
alter table public.solicitacao_produto_eventos drop constraint if exists solicitacao_produto_eventos_tipo_check;
alter table public.solicitacao_produto_eventos add constraint solicitacao_produto_eventos_tipo_check
  check (tipo in ('aberta','aviso_engenharia','analise_iniciada','ficha_criada','aviso_importacao','ficha_publicada',
                  'devolvida','devolucao_respondida'));

-- 3) Chat.
create table if not exists public.solicitacao_produto_mensagens (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id bigint not null references public.solicitacoes_produto(id),
  autor_email text not null,
  autor_nome text,
  setor text not null check (setor in ('solicitante','engenharia','importacao')),
  tipo text not null default 'mensagem' check (tipo in ('mensagem','devolucao','resposta')),
  texto text not null check (length(btrim(texto)) between 1 and 4000),
  anexos jsonb not null default '[]'::jsonb,
  cita_email text,
  cita_nome text,
  criado_em timestamptz not null default now()
);
create index if not exists solicitacao_produto_mensagens_sol_idx on public.solicitacao_produto_mensagens (solicitacao_id, criado_em);

alter table public.solicitacao_produto_mensagens enable row level security;
revoke all on public.solicitacao_produto_mensagens from anon, authenticated;
grant select, insert on public.solicitacao_produto_mensagens to authenticated;
grant all on public.solicitacao_produto_mensagens to service_role;

drop policy if exists spm_sel on public.solicitacao_produto_mensagens;
create policy spm_sel on public.solicitacao_produto_mensagens for select to authenticated
  using ((select public.vp_usuario_ativo()));
-- Insert direto só de mensagem comum, em nome de si mesmo. Devolução e resposta só pelas funções abaixo.
drop policy if exists spm_ins on public.solicitacao_produto_mensagens;
create policy spm_ins on public.solicitacao_produto_mensagens for insert to authenticated
  with check ((select public.vp_usuario_ativo()) and tipo = 'mensagem' and lower(autor_email) = lower((select public.vp_email())));

-- 4) Devolver: abre a pendência, grava a mensagem e o evento na mesma transação.
create or replace function public.solicitacao_devolver(
  p_id bigint, p_para text, p_motivo text, p_setor_autor text, p_autor_nome text,
  p_cita_email text, p_cita_nome text, p_prazo timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare s public.solicitacoes_produto%rowtype; v_email text := lower(public.vp_email());
begin
  if not public.vp_usuario_ativo() then raise exception 'Usuário sem acesso.'; end if;
  if p_para not in ('solicitante','engenharia','importacao') then raise exception 'Destino inválido.'; end if;
  if p_setor_autor not in ('solicitante','engenharia','importacao') then raise exception 'Setor inválido.'; end if;
  if length(btrim(coalesce(p_motivo,''))) < 10 then raise exception 'Explique o motivo (mínimo 10 letras).'; end if;
  select * into s from public.solicitacoes_produto where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if s.pendente_com is not null then raise exception 'Já existe uma devolução aguardando resposta.'; end if;
  if p_para = 'solicitante' and s.status not in ('novo','em_analise') then raise exception 'Só se devolve ao solicitante antes de criar a Ficha.'; end if;
  if p_para <> 'solicitante' and s.status <> 'convertido_em_ficha' then raise exception 'Só se devolve entre Engenharia e Importação depois de criar a Ficha.'; end if;
  if p_para <> 'solicitante' and exists (select 1 from public.fichas_tecnicas f where f.id::text = s.ficha_tecnica_id::text and f.omie_publicado_em is not null)
    then raise exception 'A Ficha já foi publicada no Omie.'; end if;
  update public.solicitacoes_produto
     set pendente_com = p_para, pendente_desde = now(), pendente_prazo = p_prazo, pendente_motivo = btrim(p_motivo)
   where id = p_id;
  insert into public.solicitacao_produto_mensagens (solicitacao_id, autor_email, autor_nome, setor, tipo, texto, cita_email, cita_nome)
    values (p_id, v_email, p_autor_nome, p_setor_autor, 'devolucao', btrim(p_motivo), p_cita_email, p_cita_nome);
  insert into public.solicitacao_produto_eventos (solicitacao_id, tipo, ator_nome, ator_email, alvo_nome, alvo_email, detalhe)
    values (p_id, 'devolvida', p_autor_nome, v_email, p_cita_nome, p_cita_email, jsonb_build_object('para', p_para));
end $$;

-- 5) Responder: só o solicitante (1ª volta) ou Administrador na devolução ao solicitante; encerra a pendência.
-- A conferência "é da Engenharia/Importação" fica na tela (as listas moram no código) — limite honesto (#571).
create or replace function public.solicitacao_responder(
  p_id bigint, p_texto text, p_setor_autor text, p_autor_nome text, p_anexos jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s public.solicitacoes_produto%rowtype; v_email text := lower(public.vp_email());
begin
  if not public.vp_usuario_ativo() then raise exception 'Usuário sem acesso.'; end if;
  if length(btrim(coalesce(p_texto,''))) < 1 then raise exception 'Escreva a resposta.'; end if;
  select * into s from public.solicitacoes_produto where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if s.pendente_com is null then raise exception 'Não há devolução aguardando resposta.'; end if;
  if s.pendente_com = 'solicitante' and lower(coalesce(s.solicitante_email,'')) <> v_email and not public.vp_eh_admin()
    then raise exception 'Só o solicitante responde a esta devolução.'; end if;
  insert into public.solicitacao_produto_mensagens (solicitacao_id, autor_email, autor_nome, setor, tipo, texto, anexos)
    values (p_id, v_email, p_autor_nome, p_setor_autor, 'resposta', btrim(p_texto), coalesce(p_anexos,'[]'::jsonb));
  update public.solicitacoes_produto
     set pendente_com = null, pendente_desde = null, pendente_prazo = null, pendente_motivo = null
   where id = p_id;
  insert into public.solicitacao_produto_eventos (solicitacao_id, tipo, ator_nome, ator_email, detalhe)
    values (p_id, 'devolucao_respondida', p_autor_nome, v_email, jsonb_build_object('de', s.pendente_com));
end $$;

revoke all on function public.solicitacao_devolver(bigint,text,text,text,text,text,text,timestamptz) from public, anon;
revoke all on function public.solicitacao_responder(bigint,text,text,text,jsonb) from public, anon;
grant execute on function public.solicitacao_devolver(bigint,text,text,text,text,text,text,timestamptz) to authenticated;
grant execute on function public.solicitacao_responder(bigint,text,text,text,jsonb) to authenticated;

-- 6) Atualização do chat em tempo real.
alter publication supabase_realtime add table public.solicitacao_produto_mensagens;
