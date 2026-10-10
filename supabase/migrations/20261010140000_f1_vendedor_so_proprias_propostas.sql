-- Segurança #571 · F1 — vendedor vê só as PRÓPRIAS propostas (Gelson, 10/10/2026: "vendedores só veem o que for
-- propostas e se essas forem deles").
-- Quem é "vendedor" aqui: quem tem o valor de proposta por LIBERAÇÃO individual no vpsistema (valores_acesso.modo
-- diferente de 'todos' e 'propostas.preco_proposta' em liberar). Para essa pessoa, propostas e itens só aparecem
-- quando propostas.vendedor_id é ela. Propostas sem vendedor gravado ficam só para quem vê todos os valores.
-- Quem vê todos os valores (modo 'todos') vê todas. Quem NÃO tem valor de proposta continua abrindo como hoje
-- (decisão do Gelson, 10/10/2026 — esconder o valor dentro da proposta para essas pessoas é etapa futura).
-- Mesmo interruptor da trava de valores: só vale para quem está em vp_valores_piloto ('*' = todos).

alter table public.vp_valores_regra add column if not exists dono_coluna text;
comment on column public.vp_valores_regra.dono_coluna is
  'Se preenchida: quem tem a etiqueta só por liberação individual (não "todos") vê apenas as linhas em que é o dono.';
update public.vp_valores_regra set dono_coluna = 'vendedor_id' where tabela = 'propostas';

-- Quem pede está restrito às próprias linhas desta tabela?
create or replace function public.vp_so_proprias(p_tabela text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.vp_valores_ligado() and exists (
    select 1 from public.vp_valores_regra r, public.perfis p, public.valores_acesso va
     where r.tabela = p_tabela and r.dono_coluna is not null
       and lower(p.email) = public.vp_email() and p.ativo
       and va.perfil_id = p.id and va.modo <> 'todos' and va.liberar && r.etiquetas)
$$;

create or replace function public.vp_meu_perfil_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.perfis p where lower(p.email) = public.vp_email() and p.ativo limit 1
$$;

revoke execute on function public.vp_so_proprias(text), public.vp_meu_perfil_id() from public, anon;
grant execute on function public.vp_so_proprias(text), public.vp_meu_perfil_id() to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'propostas' and policyname = 'vp_valores_dono') then
    create policy vp_valores_dono on public.propostas as restrictive for select to authenticated
      using (not (select public.vp_so_proprias('propostas')) or vendedor_id = (select public.vp_meu_perfil_id()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'proposta_itens' and policyname = 'vp_valores_dono') then
    create policy vp_valores_dono on public.proposta_itens as restrictive for select to authenticated
      using (not (select public.vp_so_proprias('propostas'))
             or exists (select 1 from public.propostas pr
                         where pr.id = proposta_itens.proposta_id and pr.vendedor_id = (select public.vp_meu_perfil_id())));
  end if;
end $$;
