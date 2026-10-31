-- Logística Interna · Etiquetas (fase 1) — histórico de impressões e alçadas iniciais.
-- Spec: docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md. Decisões do Gelson em 17/10/2026:
--   * só quem tem alçada imprime (etiquetas.imprimir); reimpressão exige alçada própria (etiquetas.reimprimir) e motivo;
--   * carga inicial: todos do departamento "Logística/Almoxarifado/Produção" (cobre Logística, Almoxarifado, PCP e Expedição) com
--     ver + imprimir + reimprimir; editar_modelos e administrar ficam só com o Administrador (que passa em tudo).
-- Tabela nasce FECHADA (RLS, sem acesso anon), conforme o plano da issue #571. Histórico é imutável: só INSERT.
-- Os modelos padrão e os perfis de impressora ficam no código (src/etiquetas-calc.js e etiquetas-impressoras.js) nesta fase; a tabela de
-- modelos da empresa (copiar e editar) entra na fase 3.

create table if not exists public.etiqueta_impressoes (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo ~ '^[A-Z_]{3,40}$'),                 -- ENDERECO, ITEM, TESTE… (tipos novos não pedem migration)
  modelo text not null,                                               -- id do modelo padrão (ex.: ENDERECO_VIGA_100x50)
  referencia text,                                                    -- código impresso (R2A4, VPEL-156) ou resumo do lote
  dados jsonb not null default '{}'::jsonb,                           -- o que foi impresso (permite reimprimir igual)
  quantidade integer not null check (quantidade > 0),
  impressora text,
  adaptador text,
  sucesso boolean not null default true,
  erro text,
  reimpressao boolean not null default false,
  motivo text,
  usuario text not null default public.vp_email(),
  impresso_em timestamptz not null default now(),
  constraint etiqueta_impressoes_motivo check (not reimpressao or length(btrim(coalesce(motivo, ''))) >= 5),
  constraint etiqueta_impressoes_usuario check (length(btrim(usuario)) > 0)
);
create index if not exists etiqueta_impressoes_quando_idx on public.etiqueta_impressoes (impresso_em desc);
create index if not exists etiqueta_impressoes_ref_idx on public.etiqueta_impressoes (tipo, referencia);

alter table public.etiqueta_impressoes enable row level security;
revoke all on public.etiqueta_impressoes from anon, authenticated;
grant select, insert on public.etiqueta_impressoes to authenticated;
grant all on public.etiqueta_impressoes to service_role;
grant usage, select on sequence public.etiqueta_impressoes_id_seq to authenticated;

drop policy if exists etiq_imp_sel on public.etiqueta_impressoes;
create policy etiq_imp_sel on public.etiqueta_impressoes for select to authenticated
  using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('etiquetas', 'ver')));

-- Quem grava é sempre o próprio usuário logado; impressão comum pede 'imprimir', reimpressão pede 'reimprimir'.
drop policy if exists etiq_imp_ins on public.etiqueta_impressoes;
create policy etiq_imp_ins on public.etiqueta_impressoes for insert to authenticated
  with check (
    (select public.vp_usuario_ativo())
    and usuario = (select public.vp_email())
    and (select public.vp_tem_capacidade('etiquetas', case when reimpressao then 'reimprimir' else 'imprimir' end))
  );

create or replace function public.etiqueta_impressoes_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'etiquetas: o histórico de impressões não pode ser alterado nem apagado';
end $$;
drop trigger if exists trg_etiqueta_impressoes_imutavel on public.etiqueta_impressoes;
create trigger trg_etiqueta_impressoes_imutavel before update or delete on public.etiqueta_impressoes
  for each row execute function public.etiqueta_impressoes_imutavel();

-- Carga inicial de alçadas (idempotente): departamento Logística/Almoxarifado/Produção, só perfis ativos.
insert into public.alcadas_capacidade (perfil_id, modulo, capacidade, concedido_por)
select p.id, 'etiquetas', c, 'sistema (17/10/2026 — Etiquetas: Logística/Almoxarifado/Produção, pedido do Gelson)'
  from public.perfis p
  join public.colaboradores_vpsistema col on lower(col.email) = lower(p.email)
 cross join unnest(array['ver', 'imprimir', 'reimprimir']) c
 where p.ativo and col.is_active and col.departamento = 'Logística/Almoxarifado/Produção'
on conflict (perfil_id, modulo, capacidade) do nothing;

notify pgrst, 'reload schema';
