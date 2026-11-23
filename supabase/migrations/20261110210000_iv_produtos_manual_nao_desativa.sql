-- Produto incluído à mão pelo "Buscar no Omie" (manual = true) não é desativado pelo sync diário do catálogo.
-- Para tirar um produto manual da lista, é preciso marcar manual = false e ativo = false na mesma atualização.
-- (Já aplicada no vpprd em 10/11/2026 pelo MCP; este arquivo registra a mesma mudança no repositório. Idempotente.)
create or replace function public.iv_produtos_manual_nao_desativa() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.manual and new.ativo = false then
    new.ativo := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_iv_produtos_manual_nao_desativa on public.importacao_varejo_produtos;
create trigger trg_iv_produtos_manual_nao_desativa
  before update of ativo on public.importacao_varejo_produtos
  for each row execute function public.iv_produtos_manual_nao_desativa();
