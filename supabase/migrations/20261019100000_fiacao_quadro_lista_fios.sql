-- Fabricação · Lista de fios do quadro de comando (Montagem do Produto › Lista de fios).
-- 4 cadastros: lista de fios (origem/destino/cor/bitola/comprimento), bitola grossa por variante,
-- de-para (fio cor+bitola e terminal tipo+bitola -> código) e conectores Mini-Fit (vias/código).
-- Nascem FECHADAS (plano #571): lê usuário ativo; grava só quem tem lista-fios.editar (Administrador passa).
-- O cálculo (metros/pontas/conectores) é puro, em src/fiacao-quadro-engine.js; nada daqui vai ao Omie.

create table if not exists public.fiacao_fios (
  id uuid primary key default gen_random_uuid(),
  ordem int not null default 0,
  tag text,
  origem_comp text, origem_borne text, origem_tipo text,
  destino_comp text, destino_borne text, destino_tipo text,
  cor text not null,
  bitola numeric(6,2) not null check (bitola > 0),
  comprimento_cm numeric(8,1) not null check (comprimento_cm > 0),
  criado_por text not null default public.vp_email(),
  created_at timestamptz not null default now()
);
create table if not exists public.fiacao_bitola_variante (
  variante text primary key,
  bitola_grossa numeric(6,2) not null check (bitola_grossa > 0),
  observacao text
);
create table if not exists public.fiacao_depara (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('fio', 'terminal')),
  tipo text,                                   -- terminal: Tubular, Tubular duplo, Mini fit, Forquilha, Olhal, Faston
  cor text,                                    -- fio: PT, VD+AM, AZ
  bitola numeric(6,2),                         -- nulo = qualquer bitola (ex.: terminal Mini-Fit)
  codigo text not null check (length(btrim(codigo)) > 0)
);
create unique index if not exists fiacao_depara_chave on public.fiacao_depara (categoria, coalesce(lower(tipo), ''), coalesce(upper(cor), ''), coalesce(bitola, 0));
create table if not exists public.fiacao_conectores (
  nome text primary key,                       -- ex.: KY9
  vias int check (vias is null or vias > 0),
  codigo text
);

do $$
declare t text;
begin
  foreach t in array array['fiacao_fios', 'fiacao_bitola_variante', 'fiacao_depara', 'fiacao_conectores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.vp_usuario_ativo()))', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade(''lista-fios'', ''editar'')))', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade(''lista-fios'', ''editar''))) with check ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade(''lista-fios'', ''editar'')))', t || '_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_del', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade(''lista-fios'', ''editar'')))', t || '_del', t);
  end loop;
end $$;

-- Carga inicial: só o que já é certo (códigos conhecidos do Omie e 30 kW/380 V = 10 mm²). O resto a Engenharia preenche.
insert into public.fiacao_bitola_variante (variante, bitola_grossa, observacao) values
  ('30_380', 10, 'Confirmado pela BOM do VPEL-709b')
on conflict (variante) do nothing;
insert into public.fiacao_depara (categoria, cor, bitola, tipo, codigo) values
  ('fio', 'PT', 0.75, null, 'VPMP-057'), ('fio', 'VD+AM', 0.75, null, 'VPMP-883'),
  ('fio', 'PT', 2.5, null, 'VPMP-265'), ('fio', 'PT', 6, null, 'VPMP-263'), ('fio', 'VD+AM', 6, null, 'VPMP-884'),
  ('fio', 'PT', 10, null, 'VPMP-702'), ('fio', 'VD+AM', 10, null, 'VPMP-886'),
  ('terminal', null, 0.75, 'Tubular', 'VPMP-084'), ('terminal', null, 2.5, 'Tubular', 'VPMP-385'),
  ('terminal', null, 6, 'Tubular', 'VPMP-393'), ('terminal', null, 10, 'Tubular', 'VPMP-663'),
  ('terminal', null, 0.75, 'Tubular duplo', 'VPMP-390'), ('terminal', null, 6, 'Tubular duplo', 'VPMP-392'),
  ('terminal', null, 6, 'Forquilha', 'VPMP-888'), ('terminal', null, 10, 'Forquilha', 'VPMP-887'),
  ('terminal', null, null, 'Mini fit', 'VPMP-795')
on conflict do nothing;

notify pgrst, 'reload schema';
