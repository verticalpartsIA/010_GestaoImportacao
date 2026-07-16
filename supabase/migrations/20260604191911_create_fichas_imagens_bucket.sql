
-- Bucket PRIVADO (não público) — acesso só via URL assinada.
-- Lição do incidente vp-automations-hub: nunca expor foto/desenho de produto.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fichas-imagens',
  'fichas-imagens',
  false,                                           -- PRIVADO
  5242880,                                         -- 5MB (limite Anthropic)
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: anon pode inserir/ler/deletar APENAS nesse bucket.
-- (Quando entrar SSO real, troca pra authenticated.)
CREATE POLICY "fichas_imagens_anon_insert"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'fichas-imagens');

CREATE POLICY "fichas_imagens_anon_select"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'fichas-imagens');

CREATE POLICY "fichas_imagens_anon_update"
  ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'fichas-imagens')
  WITH CHECK (bucket_id = 'fichas-imagens');

CREATE POLICY "fichas_imagens_anon_delete"
  ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'fichas-imagens');
