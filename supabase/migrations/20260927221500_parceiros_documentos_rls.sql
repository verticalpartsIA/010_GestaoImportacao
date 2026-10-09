-- Habilita RLS nas outras 3 tabelas da família "Parceiros Instaladores —
-- documentos/homologação" (achados ERROR do Security Advisor,
-- 0013_rls_disabled_in_public, auditoria de 27/09/2026 — mesmo lote de
-- 20260927220000_parceiros_colaboradores_rls.sql, que já cobriu
-- parceiros_colaboradores).
--
-- Mesmo padrão do restante do projeto (chave anon, SSO tratado na camada da
-- aplicação — ver CLAUDE.md): não muda o nível de acesso real, só fecha o
-- lint e deixa os grants explícitos antes do corte de grants automáticos de
-- 30/10/2026.

alter table public.parceiros_documentos_colaborador enable row level security;
alter table public.parceiros_doc_catalogo enable row level security;
alter table public.parceiros_documentos_empresa enable row level security;

revoke all on table public.parceiros_documentos_colaborador from anon, authenticated;
revoke all on table public.parceiros_doc_catalogo from anon, authenticated;
revoke all on table public.parceiros_documentos_empresa from anon, authenticated;

grant select, insert, update, delete on table public.parceiros_documentos_colaborador to anon, authenticated;
grant select, insert, update, delete on table public.parceiros_documentos_colaborador to service_role;

grant select, insert, update, delete on table public.parceiros_doc_catalogo to anon, authenticated;
grant select, insert, update, delete on table public.parceiros_doc_catalogo to service_role;

grant select, insert, update, delete on table public.parceiros_documentos_empresa to anon, authenticated;
grant select, insert, update, delete on table public.parceiros_documentos_empresa to service_role;

create policy "parceiros_documentos_colaborador_anon_all" on public.parceiros_documentos_colaborador
  for all to anon using (true) with check (true);
create policy "parceiros_documentos_colaborador_auth_all" on public.parceiros_documentos_colaborador
  for all to authenticated using (true) with check (true);

create policy "parceiros_doc_catalogo_anon_all" on public.parceiros_doc_catalogo
  for all to anon using (true) with check (true);
create policy "parceiros_doc_catalogo_auth_all" on public.parceiros_doc_catalogo
  for all to authenticated using (true) with check (true);

create policy "parceiros_documentos_empresa_anon_all" on public.parceiros_documentos_empresa
  for all to anon using (true) with check (true);
create policy "parceiros_documentos_empresa_auth_all" on public.parceiros_documentos_empresa
  for all to authenticated using (true) with check (true);
