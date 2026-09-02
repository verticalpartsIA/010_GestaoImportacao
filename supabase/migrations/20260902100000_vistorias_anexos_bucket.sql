-- ============================================================
-- Bucket de anexos da execução de vistoria (Fase 3) — fotos e
-- assinatura enviadas pelo técnico na página pública standalone
-- vistoria-execucao.html. Sem SSO ali, então políticas de storage
-- por role anon, igual ao padrão já usado em
-- cotacao-fornecedor-anexos / formulario-elevador-anexos.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vistorias-anexos', 'vistorias-anexos', true, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY vistorias_anexos_anon_insert ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'vistorias-anexos');
CREATE POLICY vistorias_anexos_anon_select ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'vistorias-anexos');
