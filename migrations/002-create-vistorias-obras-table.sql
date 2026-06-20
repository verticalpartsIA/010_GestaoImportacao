-- Migration: Create vistorias_obras table
-- Módulo: Vistorias de Obras
-- Date: 2026-06-20

CREATE TABLE IF NOT EXISTS vistorias_obras (
  -- Primary key
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relationship to obra/projeto
  obra_id TEXT NOT NULL,

  -- Vistoria info
  vistoriador TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'vistoria' CHECK (tipo IN ('vistoria', 'pre_obra', 'insercao', 'pos_venda')),
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'em_progresso', 'concluida', 'cancelada')),

  -- Scheduling
  data_agendada TIMESTAMP WITH TIME ZONE NOT NULL,
  data_conclusao TIMESTAMP WITH TIME ZONE,

  -- Notes
  observacoes TEXT,

  -- Files (JSONB arrays)
  documentos JSONB DEFAULT '[]'::jsonb,
  imagens JSONB DEFAULT '[]'::jsonb,

  -- Audit timestamps
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- User attribution
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Foreign key constraint
  CONSTRAINT fk_obra FOREIGN KEY (obra_id) REFERENCES dossier_obra(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_vistorias_obra_id ON vistorias_obras(obra_id);
CREATE INDEX idx_vistorias_status ON vistorias_obras(status);
CREATE INDEX idx_vistorias_data_agendada ON vistorias_obras(data_agendada DESC);
CREATE INDEX idx_vistorias_vistoriador ON vistorias_obras(vistoriador);
CREATE INDEX idx_vistorias_tipo ON vistorias_obras(tipo);
CREATE INDEX idx_vistorias_criado_em ON vistorias_obras(criado_em DESC);

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION atualizar_timestamp_vistorias()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vistorias_atualizar_timestamp
BEFORE UPDATE ON vistorias_obras
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp_vistorias();

-- Enable RLS
ALTER TABLE vistorias_obras ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view vistorias of their dossiers" ON vistorias_obras
  FOR SELECT USING (
    obra_id IN (
      SELECT id FROM dossier_obra
      WHERE criado_por = auth.uid() OR auth.role() = 'authenticated'
    )
  );

CREATE POLICY "Users can create vistorias" ON vistorias_obras
  FOR INSERT WITH CHECK (
    obra_id IN (
      SELECT id FROM dossier_obra
      WHERE criado_por = auth.uid()
    )
  );

CREATE POLICY "Users can update own vistorias" ON vistorias_obras
  FOR UPDATE USING (criado_por = auth.uid())
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Users can delete own vistorias" ON vistorias_obras
  FOR DELETE USING (criado_por = auth.uid());

-- Optional: Admin can manage all vistorias
CREATE POLICY "Admin can manage all vistorias" ON vistorias_obras
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE vistorias_obras IS 'Registro de vistorias de obras com documentação (PDF, imagens) e rastreamento de vistoriadores';
COMMENT ON COLUMN vistorias_obras.tipo IS 'Tipo de vistoria: vistoria, pré-obra, inserção ou pós-venda';
COMMENT ON COLUMN vistorias_obras.status IS 'Status: agendada, em_progresso, concluída ou cancelada';
COMMENT ON COLUMN vistorias_obras.documentos IS 'Array JSON de documentos (PDF, Word) com {nome, tipo, tamanho, dados}';
COMMENT ON COLUMN vistorias_obras.imagens IS 'Array JSON de imagens com {nome, tipo, tamanho, dados}';