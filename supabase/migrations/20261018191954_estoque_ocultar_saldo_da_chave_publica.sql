-- Aplicada direto no banco em 18/10/2026 (versão 20261018191954) sem arquivo em supabase/migrations/.
-- O mesmo SQL existia só como docs/seguranca/estoque-ocultar-saldo.sql. Trazida para o git na issue #965
-- com o SQL EXATO de supabase_migrations.schema_migrations. Já está em produção: NÃO reaplicar.
-- Fecha para a chave pública o saldo do estoque (catálogo com saldo e lista_esperada das sessões).

revoke select on public.estoque_sessoes from anon, authenticated;
grant select (id, tipo, nome, escopo, estado, limite_aparelhos, criado_por, criado_em, fechado_em, total_itens, tolerancia, recontagem_obrigatoria)
  on public.estoque_sessoes to anon, authenticated;
revoke all on public.estoque_catalogo_v from anon, authenticated;
notify pgrst, 'reload schema';
