-- Estoque — fase 3: contagem e endereço numa tabela só (importacao_varejo_contagem, a que o app 013_Estoque já grava).
-- O Almoxarifado passa a ler/gravar aqui (antes: pcp_estoque_fisico/pcp_estoque_contagens, 0 linhas, e pcp_produtos.endereco).
-- Nada é apagado: as tabelas antigas ficam paradas até a fase 6.

-- 1) Carga única: endereços do PCP que a tabela de contagem ainda não tem (linha só de endereço, quantidade nula = não é contagem).
--    Itens que já têm endereço na contagem ficam como estão (ex.: VPB-112 "I 02" × "I02").
insert into public.importacao_varejo_contagem (codigo, endereco, atualizado_por)
select upper(p.codigo), left(trim(p.endereco), 60), 'carga fase 3 (pcp_produtos.endereco)'
  from public.pcp_produtos p
 where coalesce(trim(p.endereco), '') <> ''
on conflict (codigo) do update
  set endereco = excluded.endereco, atualizado_em = now(), atualizado_por = excluded.atualizado_por
  where coalesce(importacao_varejo_contagem.endereco, '') = '';

-- 2) Espelho: endereço gravado na contagem vira também pcp_produtos.endereco (quem ainda lê de lá — relatórios, etiquetas — segue certo).
create or replace function public.iv_contagem_espelha_endereco() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.endereco is distinct from (case when tg_op = 'UPDATE' then old.endereco end) then
    update public.pcp_produtos set endereco = new.endereco where upper(codigo) = upper(new.codigo);
  end if;
  return new;
exception when others then
  return new;   -- o espelho nunca pode impedir a contagem de ser gravada
end $$;

drop trigger if exists trg_iv_contagem_espelha_endereco on public.importacao_varejo_contagem;
create trigger trg_iv_contagem_espelha_endereco
  after insert or update of endereco on public.importacao_varejo_contagem
  for each row execute function public.iv_contagem_espelha_endereco();

revoke all on function public.iv_contagem_espelha_endereco() from public, anon, authenticated;
