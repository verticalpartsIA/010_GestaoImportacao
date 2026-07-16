
-- Biblioteca persistente: categorias e campos personalizados que o usuário
-- cria na Ficha Técnica viram parte da biblioteca da Engenharia inteira.
-- Apareceem na sidebar de TODA ficha nova (mescla com as 9 categorias pré-prontas).

CREATE TABLE IF NOT EXISTS public.fichas_lib_categorias (
  id text PRIMARY KEY,                          -- slug, ex.: c_madeira_xyzw
  nome text NOT NULL,
  icon text DEFAULT 'folder',
  criado_por uuid REFERENCES public.perfis(id),
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fichas_lib_campos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id text NOT NULL,                         -- pode ser id de LIB (dimensoes) ou de custom cat
  k text NOT NULL,                              -- slug do campo
  nome text NOT NULL,
  unidade text DEFAULT '',
  tipo text DEFAULT 'number',
  criado_por uuid REFERENCES public.perfis(id),
  criado_em timestamptz DEFAULT now(),
  UNIQUE (cat_id, k)                            -- não duplica mesma combinação
);

ALTER TABLE public.fichas_lib_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichas_lib_campos     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fl_cat_all_anon" ON public.fichas_lib_categorias
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "fl_cmp_all_anon" ON public.fichas_lib_campos
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS fl_cmp_cat_idx ON public.fichas_lib_campos(cat_id);
