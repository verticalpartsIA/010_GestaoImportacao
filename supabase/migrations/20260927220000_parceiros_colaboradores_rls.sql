-- Habilita RLS em parceiros_colaboradores (guarda CPF/RG/CNH de colaboradores
-- de parceiros instaladores — achado ERROR do Security Advisor,
-- 0013_rls_disabled_in_public, auditoria de 27/09/2026).
--
-- Grants explícitos (não só a policy) porque projetos existentes perdem o
-- grant automático de tabela nova em 30/10/2026 — e esta tabela já existe,
-- então o corte não a afeta direto, mas ficar explícito documenta a
-- intenção e evita depender de comportamento que a Supabase está
-- descontinuando.
--
-- Mesmo padrão de acesso que já existe hoje (chave anon, SSO tratado na
-- camada da aplicação — ver CLAUDE.md) e o mesmo padrão usado no restante
-- do projeto (ex.: 20260917120000_quadro_comando_schema.sql): não muda o
-- nível de proteção real (rh-homologacao-store.js continua lendo/gravando
-- direto do navegador), só fecha o lint e documenta os grants. Endurecer de
-- verdade o acesso a este dado pessoal (CPF/RG/CNH) fica para uma etapa
-- futura, via Edge Function com chave secreta.

alter table public.parceiros_colaboradores enable row level security;

revoke all on table public.parceiros_colaboradores from anon, authenticated;
grant select, insert, update, delete on table public.parceiros_colaboradores to anon, authenticated;
grant select, insert, update, delete on table public.parceiros_colaboradores to service_role;

create policy "parceiros_colaboradores_anon_all" on public.parceiros_colaboradores
  for all to anon using (true) with check (true);
create policy "parceiros_colaboradores_auth_all" on public.parceiros_colaboradores
  for all to authenticated using (true) with check (true);
