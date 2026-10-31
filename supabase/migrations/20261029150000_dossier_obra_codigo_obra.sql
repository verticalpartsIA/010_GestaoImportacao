-- dossier_obra.codigo_obra — identificador PERSISTENTE da obra (29/10/2026)
--
-- Pedido do usuário: um código estável por obra, pra poder ser referenciado
-- em documentos externos (ex.: "ART-VPNI-OB0017") — uma ART é emitida por
-- OBRA (pode citar vários equipamentos dela), não por equipamento.
--
-- Regra:
--   - Obra NATIVA (nasceu de cotação do site, dossier_obra.numero_cotacao
--     preenchido) -> 'VPNI-<cotação, 4 dígitos>', o MESMO código que o
--     Contrato do Instalador já usa (etapaId('contrato_instalador', ...)
--     em src/master-id-engine.js). Nunca um código separado pra ART.
--   - Obra LEGADA (sem cotação) -> 'VPNI-OB<NNNN>', só nova se não achar
--     outra obra já existente do MESMO cliente + MESMA cidade/UF (e MESMO
--     endereço, quando as duas tiverem endereço preenchido) — reaproveita
--     o código dela quando achar. Numeração própria (obra_legada_numero_seq),
--     nunca reaproveitada.
--
-- Nasce uma vez, NUNCA muda depois de gravado (mesma trava de outras
-- colunas do projeto, ex. formularios_elevador.numero_cotacao) — uma ART já
-- emitida não pode ter a obra "trocando de número" por baixo.

alter table public.dossier_obra add column if not exists codigo_obra text;

create sequence if not exists public.obra_legada_numero_seq;

create or replace function public.dossier_obra_calcular_codigo(
  p_id text, p_client_name text, p_city text, p_state text,
  p_endereco text, p_numero text, p_numero_cotacao integer
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_codigo text;
begin
  if p_numero_cotacao is not null then
    return 'VPNI-' || lpad(p_numero_cotacao::text, 4, '0');
  end if;

  select d.codigo_obra into v_codigo
  from public.dossier_obra d
  where d.id <> coalesce(p_id, '')
    and d.codigo_obra is not null
    and d.codigo_obra like 'VPNI-OB%'
    and lower(trim(unaccent(coalesce(d.client_name, '')))) = lower(trim(unaccent(coalesce(p_client_name, ''))))
    and lower(trim(unaccent(coalesce(d.city, '')))) = lower(trim(unaccent(coalesce(p_city, ''))))
    and lower(trim(coalesce(d.state, ''))) = lower(trim(coalesce(p_state, '')))
    and (
      -- os dois SEM endereço preenchido: casa só por cliente+cidade/UF
      (coalesce(trim(d.endereco_logradouro), '') = '' and coalesce(trim(p_endereco), '') = '')
      or (
        -- os dois COM endereço preenchido: só casa se o endereço bater também
        coalesce(trim(d.endereco_logradouro), '') <> '' and coalesce(trim(p_endereco), '') <> ''
        and lower(trim(unaccent(d.endereco_logradouro))) = lower(trim(unaccent(p_endereco)))
        and coalesce(trim(d.endereco_numero), '') = coalesce(trim(p_numero), '')
      )
    )
  order by d.created_at
  limit 1;

  if v_codigo is not null then
    return v_codigo;
  end if;

  return 'VPNI-OB' || lpad(nextval('public.obra_legada_numero_seq')::text, 4, '0');
end;
$$;

create or replace function public.dossier_obra_fixa_codigo() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.codigo_obra is null then
    new.codigo_obra := public.dossier_obra_calcular_codigo(
      new.id, new.client_name, new.city, new.state,
      new.endereco_logradouro, new.endereco_numero, new.numero_cotacao);
  elsif old.codigo_obra is not null and new.codigo_obra is distinct from old.codigo_obra then
    -- trava: uma vez gravado, não muda (nem por engano, nem por um UPDATE que
    -- recalcule — só existe UMA forma de setar de verdade, que é esta função,
    -- rodando quando codigo_obra ainda está nulo).
    new.codigo_obra := old.codigo_obra;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dossier_obra_fixa_codigo on public.dossier_obra;
create trigger trg_dossier_obra_fixa_codigo
before insert or update on public.dossier_obra
for each row execute function public.dossier_obra_fixa_codigo();

-- Carga única das obras já existentes, uma de cada vez, em ordem de criação
-- (quem existe há mais tempo "puxa" o código pros demais do mesmo cliente).
do $$
declare r record;
begin
  for r in
    select id, client_name, city, state, endereco_logradouro, endereco_numero, numero_cotacao
    from public.dossier_obra
    where codigo_obra is null
    order by created_at
  loop
    update public.dossier_obra
    set codigo_obra = public.dossier_obra_calcular_codigo(
      r.id, r.client_name, r.city, r.state, r.endereco_logradouro, r.endereco_numero, r.numero_cotacao)
    where id = r.id;
  end loop;
end $$;

-- Ajuste manual confirmado pelo usuário (29/10/2026): DOS-M046 ("AZEKA
-- PARTICIPAÇÕES (BANDEIRA PAULISTA)", equipamento novo) e DOS-M047 ("AZEKA -
-- CONDOMINIO BANDEIRA PAULISTA - MOD", modernização + troca de portas) são a
-- MESMA obra física (endereço ainda não cadastrado nos dois na hora desta
-- migration, por isso a regra automática acima não uniu sozinha). DOS-M046
-- vence (nº menor; os dois foram criados no mesmíssimo instante na carga da
-- planilha legada, sem outro critério de ordem).
update public.dossier_obra
set codigo_obra = (select codigo_obra from public.dossier_obra where id = 'DOS-M046')
where id = 'DOS-M047';
