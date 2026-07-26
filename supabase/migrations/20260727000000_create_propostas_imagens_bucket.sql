-- Bucket PRIVADO (não público) — acesso só via URL assinada.
-- Mesma decisão da fichas-imagens: lição do incidente vp-automations-hub,
-- nunca expor foto/desenho de produto publicamente.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'propostas-imagens',
  'propostas-imagens',
  false,                                           -- PRIVADO
  5242880,                                         -- 5MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: anon pode inserir/ler/atualizar/deletar APENAS nesse bucket.
-- (Quando entrar SSO real, troca pra authenticated — mesmo padrão da
-- fichas-imagens.)
CREATE POLICY "propostas_imagens_anon_insert"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'propostas-imagens');

CREATE POLICY "propostas_imagens_anon_select"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'propostas-imagens');

CREATE POLICY "propostas_imagens_anon_update"
  ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'propostas-imagens')
  WITH CHECK (bucket_id = 'propostas-imagens');

CREATE POLICY "propostas_imagens_anon_delete"
  ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'propostas-imagens');
