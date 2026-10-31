-- ============================================================
-- T3 #1223 (31/10/2026) — código VPFOR vem do banco, igual ao VPCLI.
-- Antes o navegador lia todos os códigos e somava 1 (não atômico; sem banco
-- caía num 'VPFOR-0001' fixo). Sequência própria, começando depois do maior
-- código já usado; a função é a única forma de pegar o próximo número.
-- ============================================================
create sequence if not exists public.seq_fornecedores_codigo;

select setval('public.seq_fornecedores_codigo',
  greatest(1, coalesce((select max((regexp_replace(codigo, '\D', '', 'g'))::int)
                         from public.fornecedores where codigo ~ '\d'), 0)),
  (select count(*) > 0 from public.fornecedores where codigo ~ '\d'));

create or replace function public.gerar_codigo_fornecedor()
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  return 'VPFOR-' || lpad(nextval('public.seq_fornecedores_codigo')::text, 4, '0');
end;
$$;

revoke all on sequence public.seq_fornecedores_codigo from public, anon, authenticated;
revoke all on function public.gerar_codigo_fornecedor() from public;
grant execute on function public.gerar_codigo_fornecedor() to anon, authenticated;
