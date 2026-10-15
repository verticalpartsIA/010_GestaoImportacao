-- Preço COMBINADO com o montador, por equipamento/Dossiê (15/10/2026).
-- A tabela de Atualização de Custos é só referência (Precificação); o que vale pro contrato e pro pagamento é o que foi fechado.
-- Um acordo = 1 equipamento (hoje o Dossiê DOS-Mxxx = 1 equipamento; no futuro o código do equipamento da Proposta, ex. VPEL-EL0955-1).
-- Quem cadastra: Engenharia. Tabela nasce FECHADA (só usuário logado e ativo), sem DELETE (cancelar = status).

create table if not exists public.instalador_acordos (
  id text primary key,
  dossier_id text not null,                    -- DOS-M013
  equipamento_codigo text not null,            -- por ora = dossier_id; depois VPEL-EL0955-1
  parceiro_instalador_id text not null,        -- MNT-...
  instalador_nome text,                        -- foto do nome no momento do acordo
  valor_tabela numeric(14,2),                  -- referência (opcional)
  valor_combinado numeric(14,2) not null check (valor_combinado > 0),
  parcelas_qtd integer not null default 2 check (parcelas_qtd between 1 and 12),
  observacao text,
  status text not null default 'combinado' check (status in ('combinado','contratado','cancelado')),
  contrato_id uuid,                            -- preenchido quando o contrato nasce
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists instalador_acordos_equip_uq
  on public.instalador_acordos (equipamento_codigo) where status <> 'cancelado';
create index if not exists instalador_acordos_dossier_idx on public.instalador_acordos (dossier_id);
create index if not exists instalador_acordos_parceiro_idx on public.instalador_acordos (parceiro_instalador_id);

alter table public.instalador_acordos enable row level security;
revoke all on public.instalador_acordos from anon;
drop policy if exists ia_select on public.instalador_acordos;
drop policy if exists ia_insert on public.instalador_acordos;
drop policy if exists ia_update on public.instalador_acordos;
create policy ia_select on public.instalador_acordos for select to authenticated using (public.vp_usuario_ativo());
create policy ia_insert on public.instalador_acordos for insert to authenticated with check (public.vp_usuario_ativo());
create policy ia_update on public.instalador_acordos for update to authenticated using (public.vp_usuario_ativo()) with check (public.vp_usuario_ativo());
grant select, insert, update on public.instalador_acordos to authenticated;

notify pgrst, 'reload schema';
