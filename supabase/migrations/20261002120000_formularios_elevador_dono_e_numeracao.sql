-- Formulário/Cotação: Nº sequencial único e imutável, dono permanente, sem exclusão (02/10/2026)
--
-- Pedido do usuário: o vendedor que cria um formulário (mesmo rascunho) é dono dele pra
-- sempre — nunca sobrescrito nem apagado — e o Nº da cotação (VPCT-xxxx) é sequencial e
-- travado.
--
-- O que garante isto NO BANCO (vale pra qualquer cliente, mesmo fora do front):
--   1. UNIQUE em numero_cotacao (antes só a sequência garantia, sem constraint).
--   2. numero_cotacao SEMPRE vem da sequência no INSERT (valor enviado pelo cliente é ignorado)
--      e a sequência perde o privilégio pro anon/authenticated (ninguém dá setval/nextval direto).
--   3. UPDATE não consegue mudar id, numero_cotacao, created_at, nem created_by/vendedor
--      depois de preenchidos (o valor novo é descartado em silêncio, o resto do UPDATE passa).
--   4. DELETE é recusado (o Nº nunca é reaproveitado).
--
-- NÃO garante: isolamento de VISÃO/EDIÇÃO entre vendedores. As políticas RLS do app são
-- abertas ao anon (sem identidade verificável) — isso só fecha com a issue #571. A parte
-- por vendedor fica no front (ver formulario-elevador-store.js) até lá.
--
-- Pode haver "buracos" no Nº se um INSERT falhar depois de consumir a sequência (comportamento
-- normal do Postgres); o que NUNCA acontece é reaproveitar ou alterar um Nº já emitido.
--
-- ROLLBACK:
--   drop trigger if exists trg_formularios_elevador_protege on public.formularios_elevador;
--   drop function if exists public.fn_formularios_elevador_protege();
--   drop index if exists public.formularios_elevador_numero_cotacao_uniq;
--   alter table public.formularios_elevador alter column numero_cotacao
--     set default nextval('public.formulario_elevador_numero_cotacao_seq'::regclass);
--   grant usage, select on sequence public.formulario_elevador_numero_cotacao_seq to anon, authenticated;

create unique index if not exists formularios_elevador_numero_cotacao_uniq
  on public.formularios_elevador (numero_cotacao);

create or replace function public.fn_formularios_elevador_protege()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    -- sempre da sequência: o cliente não escolhe o Nº
    new.numero_cotacao := nextval(tg_argv[0]::regclass);
    return new;

  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    new.numero_cotacao := old.numero_cotacao;
    new.created_at := old.created_at;
    if old.created_by is not null and btrim(old.created_by) <> '' then
      new.created_by := old.created_by;
    end if;
    if old.vendedor is not null and btrim(old.vendedor) <> '' then
      new.vendedor := old.vendedor;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    raise exception 'Formulário/Cotação Nº % não pode ser apagado: numeração e dono são permanentes.', old.numero_cotacao
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;

revoke all on function public.fn_formularios_elevador_protege() from public, anon, authenticated;

-- a sequência passa a ser consumida só pela função acima (security definer)
alter table public.formularios_elevador alter column numero_cotacao drop default;
revoke all on sequence public.formulario_elevador_numero_cotacao_seq from public, anon, authenticated;

drop trigger if exists trg_formularios_elevador_protege on public.formularios_elevador;
create trigger trg_formularios_elevador_protege
  before insert or update or delete on public.formularios_elevador
  for each row execute function public.fn_formularios_elevador_protege('public.formulario_elevador_numero_cotacao_seq');
