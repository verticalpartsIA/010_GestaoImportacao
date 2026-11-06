/* ============================================================================
   Containers (Atualização de Custos): ID-TAG do container, Porto e Taxa de porto
   (06/11/2026, pedido do Gelson; spec em docs/modulos/05_financeiro_precos.md 5.1.10 item 10)

   🔒 NÃO APLICAR sem o "Confirmo" do Gelson para esta mudança (trava da
   Atualização de Custos, 13/10/2026; Art. 14 da Constituição). Esta migration
   só foi ESCRITA; testada num Postgres descartável, nunca no banco de produção.

   O que faz:
   1. Colunas novas em custos_containers:
        id_tag         'CONT-001', 'CONT-002'… (nasce do banco; nunca se digita, nunca muda)
        porto          texto livre (só identifica o porto)
        taxa_porto_usd / taxa_porto_rs   (USD; R$ = USD x câmbio, editável, como capatazia/GRI)
   2. O mesmo tamanho pode repetir em portos diferentes: sai a unicidade de `tipo`;
      a identidade passa a ser o ID-TAG (único).
   3. As linhas atuais (20HC e 40HC, usadas para Santos) ganham CONT-001 e CONT-002
      (ordem alfabética do tipo) e Porto = 'Santos'.
   4. ID-TAG nunca é reaproveitado (sequência; buraco na numeração é normal) e não
      pode ser alterado (a tela grava a linha inteira com upsert; o gatilho mantém o
      valor do banco, em silêncio).
   5. Container cujo ID-TAG já consta numa Precificação não pode ser EXCLUÍDO
      (só os valores mudam, para valerem em propostas novas).

   O que NÃO faz: nenhum código de tela/motor (outras mudanças, outros "Confirmo");
   não altera precificações existentes; não leva o porto à P.I./Embarque.
   ============================================================================ */

-- 1. Colunas e sequência -----------------------------------------------------
create sequence if not exists public.custos_containers_id_tag_seq;

alter table public.custos_containers
  add column if not exists id_tag text,
  add column if not exists porto text,
  add column if not exists taxa_porto_usd numeric,
  add column if not exists taxa_porto_rs numeric;

comment on column public.custos_containers.id_tag is 'ID-TAG do container (CONT-001…). Gerado pelo banco (gatilho), imutável, nunca reaproveitado. A Precificação cita o ID-TAG + quantidade.';
comment on column public.custos_containers.porto is 'Porto de chegada do container (texto livre).';
comment on column public.custos_containers.taxa_porto_usd is 'Taxa de porto por container (USD). Mesmo tratamento da capatazia: Despesa Operacional, base do AFRMM.';
comment on column public.custos_containers.taxa_porto_rs is 'Taxa de porto por container (R$ = USD x câmbio do dia, editável).';

-- 2. Linhas atuais: ID-TAG em ordem alfabética do tipo, Porto = Santos ---------
do $$
declare r record; n int;
begin
  -- continua depois do maior número já existente (re-execução não renumera nada)
  select coalesce(max(substring(id_tag from 6)::int), 0) into n
    from public.custos_containers where id_tag ~ '^CONT-[0-9]+$';
  for r in select id from public.custos_containers where id_tag is null order by tipo, id loop
    n := n + 1;
    update public.custos_containers
       set id_tag = 'CONT-' || lpad(n::text, 3, '0'),
           porto  = coalesce(porto, 'Santos')
     where id = r.id;
  end loop;
  if n > 0 then
    perform setval('public.custos_containers_id_tag_seq', n, true);
  end if;
end $$;

-- Sem DEFAULT de propósito: o DEFAULT roda com os privilégios de quem insere (que não
-- tem acesso à sequência). Quem gera o ID-TAG é o gatilho da seção 4 (SECURITY DEFINER);
-- o NOT NULL é conferido depois do gatilho.
alter table public.custos_containers
  alter column id_tag set not null;

alter table public.custos_containers drop constraint if exists custos_containers_id_tag_formato;
alter table public.custos_containers add constraint custos_containers_id_tag_formato check (id_tag ~ '^CONT-[0-9]{3,}$');

create unique index if not exists custos_containers_id_tag_uidx on public.custos_containers (id_tag);

-- 3. Sai a unicidade de `tipo` (mesmo tamanho em portos diferentes) -----------
do $$
declare r record;
begin
  for r in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.custos_containers'::regclass
       and c.contype = 'u'
       and c.conkey = array[(select attnum from pg_attribute where attrelid = 'public.custos_containers'::regclass and attname = 'tipo')]
  loop
    execute format('alter table public.custos_containers drop constraint %I', r.conname);
  end loop;
end $$;

-- 4. ID-TAG imutável e gerado só pelo banco -------------------------------------
create or replace function public.custos_containers_id_tag_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_atual text;
begin
  if tg_op = 'INSERT' then
    -- upsert (ON CONFLICT) de uma linha que já existe: mantém o ID-TAG gravado.
    select id_tag into v_atual from public.custos_containers where id = new.id;
    if found then
      new.id_tag := v_atual;
    else
      -- linha nova: o ID-TAG sempre vem da sequência (o que o cliente mandar é ignorado).
      new.id_tag := 'CONT-' || lpad(nextval('public.custos_containers_id_tag_seq')::text, 3, '0');
    end if;
  else
    new.id_tag := old.id_tag;   -- nunca muda
  end if;
  return new;
end $$;

revoke all on function public.custos_containers_id_tag_guarda() from public, anon, authenticated;

drop trigger if exists trg_custos_containers_id_tag_guarda on public.custos_containers;
create trigger trg_custos_containers_id_tag_guarda
  before insert or update on public.custos_containers
  for each row execute function public.custos_containers_id_tag_guarda();

-- 5. ID-TAG usado numa Precificação não pode ser excluído -------------------------
-- Conta as precificações de elevador cuja lista `containers` cita o ID-TAG.
create or replace function public.container_id_tag_em_uso(p_id_tag text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.precificacoes_elevador p
   where exists (
     select 1
       from jsonb_array_elements(case when jsonb_typeof(p.containers) = 'array' then p.containers else '[]'::jsonb end) c
      where c->>'id_tag' = p_id_tag
   );
$$;

revoke all on function public.container_id_tag_em_uso(text) from public;
grant execute on function public.container_id_tag_em_uso(text) to anon, authenticated;

create or replace function public.custos_containers_bloquear_exclusao()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  n := public.container_id_tag_em_uso(old.id_tag);
  if n > 0 then
    raise exception 'O container % já foi usado em % precificação(ões) e não pode ser excluído. Altere os valores (valem só para propostas novas) ou desative a linha.', old.id_tag, n
      using errcode = 'P0001';
  end if;
  return old;
end $$;

revoke all on function public.custos_containers_bloquear_exclusao() from public, anon, authenticated;

drop trigger if exists trg_custos_containers_bloquear_exclusao on public.custos_containers;
create trigger trg_custos_containers_bloquear_exclusao
  before delete on public.custos_containers
  for each row execute function public.custos_containers_bloquear_exclusao();

notify pgrst, 'reload schema';
