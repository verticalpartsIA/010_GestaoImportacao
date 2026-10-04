-- Inbox fase 4B (04/10/2026): pesquisa no HISTÓRICO COMPLETO de emails_projeto, sem diferenciar acento/maiúscula
-- (a tela normaliza o texto digitado: "cotacao" tem que achar "Cotação"). Só leitura: uma função + índices.
create extension if not exists unaccent with schema extensions;

create or replace function public.inbox_sem_acento(t text) returns text
language sql immutable parallel safe set search_path = public, extensions
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $$;

create or replace function public.inbox_texto_busca(a text, b text, c text, d text) returns text
language sql immutable parallel safe set search_path = public, extensions
as $$ select public.inbox_sem_acento(coalesce(a,'') || ' ' || coalesce(b,'') || ' ' || coalesce(c,'') || ' ' || coalesce(d,'')) $$;

drop index if exists public.emails_projeto_assunto_trgm;
drop index if exists public.emails_projeto_de_email_trgm;
drop index if exists public.emails_projeto_de_nome_trgm;
drop index if exists public.emails_projeto_corpo_trgm;
-- (sem índice trigram: a pesquisa varre a tabela inteira de propósito — volume pequeno hoje; criar índice quando passar de dezenas de milhares)
create index if not exists emails_projeto_data_msg_idx on public.emails_projeto (data_mensagem desc);
create index if not exists emails_projeto_numero_cotacao_idx on public.emails_projeto (numero_cotacao);

create or replace function public.inbox_buscar_historico(
  p_termos text[], p_de text[], p_assunto text[], p_cotacao int,
  p_depois timestamptz, p_antes timestamptz, p_limite int default 100
) returns setof public.emails_projeto
language sql stable set search_path = public, extensions
as $$
  select e.* from public.emails_projeto e
  where e.excluido_em is null
    and (p_cotacao is null or e.numero_cotacao = p_cotacao)
    and (p_depois is null or e.data_mensagem >= p_depois)
    and (p_antes is null or e.data_mensagem <= p_antes)
    and not exists (select 1 from unnest(coalesce(p_termos, '{}'::text[])) t
      where public.inbox_texto_busca(e.assunto, e.de_email, e.de_nome, e.corpo_texto)
            not like '%' || replace(replace(public.inbox_sem_acento(t), '%', ''), '_', '\_') || '%')
    and not exists (select 1 from unnest(coalesce(p_de, '{}'::text[])) t
      where public.inbox_sem_acento(coalesce(e.de_email,'') || ' ' || coalesce(e.de_nome,''))
            not like '%' || replace(replace(public.inbox_sem_acento(t), '%', ''), '_', '\_') || '%')
    and not exists (select 1 from unnest(coalesce(p_assunto, '{}'::text[])) t
      where public.inbox_sem_acento(e.assunto)
            not like '%' || replace(replace(public.inbox_sem_acento(t), '%', ''), '_', '\_') || '%')
  order by e.data_mensagem desc nulls last
  limit least(greatest(coalesce(p_limite, 100), 1), 200)
$$;
grant execute on function public.inbox_buscar_historico(text[], text[], text[], int, timestamptz, timestamptz, int) to anon, authenticated;
