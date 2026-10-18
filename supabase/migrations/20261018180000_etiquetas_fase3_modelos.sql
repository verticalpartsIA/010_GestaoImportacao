-- Logística Interna · Etiquetas (fase 3) — modelos da empresa (copiar e personalizar o layout dos modelos padrão).
-- Os modelos padrão continuam no código (src/etiquetas-calc.js); esta tabela guarda só as CÓPIAS editadas pela empresa.
-- Nasce FECHADA (plano #571): lê quem é usuário ativo com etiquetas.ver; cria/edita/apaga só quem tem etiquetas.editar_modelos
-- (Administrador passa em tudo). Apagar um modelo não afeta o histórico de impressões (que guarda o que foi impresso).

create table if not exists public.etiqueta_modelos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo ~ '^[A-Z_]{3,40}$'),
  nome text not null check (length(btrim(nome)) between 3 and 80),
  base_id text not null,                                  -- id do modelo padrão de onde veio (campos e tamanho vêm dele)
  largura_mm numeric(6,1) not null check (largura_mm between 20 and 110),
  altura_mm numeric(6,1) not null check (altura_mm between 20 and 150),
  campos jsonb not null default '[]'::jsonb,              -- campos que o modelo pode usar (copiados do padrão)
  elementos jsonb not null check (jsonb_typeof(elementos) = 'array' and jsonb_array_length(elementos) between 1 and 60),
  ativo boolean not null default true,
  criado_por text not null default public.vp_email(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists etiqueta_modelos_nome_idx on public.etiqueta_modelos (tipo, lower(btrim(nome)));

alter table public.etiqueta_modelos enable row level security;
revoke all on public.etiqueta_modelos from anon, authenticated;
grant select, insert, update, delete on public.etiqueta_modelos to authenticated;
grant all on public.etiqueta_modelos to service_role;

drop policy if exists etiq_mod_sel on public.etiqueta_modelos;
create policy etiq_mod_sel on public.etiqueta_modelos for select to authenticated
  using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('etiquetas', 'ver')));
drop policy if exists etiq_mod_ins on public.etiqueta_modelos;
create policy etiq_mod_ins on public.etiqueta_modelos for insert to authenticated
  with check ((select public.vp_usuario_ativo()) and criado_por = (select public.vp_email()) and (select public.vp_tem_capacidade('etiquetas', 'editar_modelos')));
drop policy if exists etiq_mod_upd on public.etiqueta_modelos;
create policy etiq_mod_upd on public.etiqueta_modelos for update to authenticated
  using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('etiquetas', 'editar_modelos')))
  with check ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('etiquetas', 'editar_modelos')));
drop policy if exists etiq_mod_del on public.etiqueta_modelos;
create policy etiq_mod_del on public.etiqueta_modelos for delete to authenticated
  using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('etiquetas', 'editar_modelos')));

create or replace function public.etiqueta_modelos_toque() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.criado_por := old.criado_por; new.tipo := old.tipo; new.base_id := old.base_id; return new; end $$;
drop trigger if exists trg_etiqueta_modelos_toque on public.etiqueta_modelos;
create trigger trg_etiqueta_modelos_toque before update on public.etiqueta_modelos for each row execute function public.etiqueta_modelos_toque();

notify pgrst, 'reload schema';
