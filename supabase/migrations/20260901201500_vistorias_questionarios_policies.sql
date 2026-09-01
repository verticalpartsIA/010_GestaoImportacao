-- ============================================================
-- Políticas de acesso pras 5 tabelas do motor de questionários
-- (migration anterior habilitou RLS mas não criou política nenhuma,
-- o que bloqueava toda leitura/escrita por padrão). Segue o mesmo
-- padrão já usado em dossier_obra/vistorias_obras/equipamentos_obra
-- neste projeto: acesso aberto por tabela (auth de verdade acontece
-- na camada de SSO do app, não em RLS por usuário).
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vistorias_questionarios','vistorias_categorias','vistorias_perguntas','vistorias_atividades','vistorias_respostas']
  LOOP
    EXECUTE format('CREATE POLICY leitura_publica ON public.%I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY escrita_anon ON public.%I FOR INSERT WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY update_anon ON public.%I FOR UPDATE USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY delete_anon ON public.%I FOR DELETE USING (true)', t);
  END LOOP;
END $$;
