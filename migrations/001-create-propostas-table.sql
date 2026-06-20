-- Migration: Create propostas table
-- Issue #8: Proposta Supabase Persistence
-- Date: 2026-06-20

CREATE TABLE IF NOT EXISTS propostas (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Proposal metadata
  numero TEXT UNIQUE NOT NULL,
  equipamento_tipo TEXT NOT NULL CHECK (equipamento_tipo IN ('elevador', 'escada', 'esteira')),
  
  -- Relationship to dossier/obra
  dossier_id UUID REFERENCES dossier_obra(id) ON DELETE CASCADE,
  
  -- Data storage (JSONB for flexibility and indexing)
  dados_json JSONB NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'aprovada', 'rejeitada')),
  
  -- Audit timestamps
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  enviado_em TIMESTAMP WITH TIME ZONE,
  
  -- User attribution
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT dados_not_empty CHECK (dados_json IS NOT NULL AND dados_json != 'null'::jsonb)
);

-- Indexes for common queries
CREATE INDEX idx_propostas_dossier_id ON propostas(dossier_id);
CREATE INDEX idx_propostas_status ON propostas(status);
CREATE INDEX idx_propostas_numero ON propostas(numero);
CREATE INDEX idx_propostas_criado_por ON propostas(criado_por);
CREATE INDEX idx_propostas_criado_em ON propostas(criado_em DESC);
CREATE INDEX idx_propostas_equipamento ON propostas(equipamento_tipo);

-- GIN index for JSONB queries (for full-text search in dados_json if needed)
CREATE INDEX idx_propostas_dados_json ON propostas USING GIN(dados_json);

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION atualizar_timestamp_propostas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_propostas_atualizar_timestamp
BEFORE UPDATE ON propostas
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp_propostas();

-- Enable RLS
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own proposals
CREATE POLICY "Users can view own proposals" ON propostas
  FOR SELECT USING (auth.uid() = criado_por OR auth.role() = 'authenticated');

CREATE POLICY "Users can create proposals" ON propostas
  FOR INSERT WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Users can update own proposals" ON propostas
  FOR UPDATE USING (auth.uid() = criado_por)
  WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Users can delete own proposals" ON propostas
  FOR DELETE USING (auth.uid() = criado_por);

-- Optional: Allow admin to manage all proposals
CREATE POLICY "Admin can manage all proposals" ON propostas
  USING (auth.role() = 'service_role');

COMMENT ON TABLE propostas IS 'Armazena propostas comerciais de elevadores, escadas e esteiras';
COMMENT ON COLUMN propostas.numero IS 'Número único da proposta (ex: VP-2026-001)';
COMMENT ON COLUMN propostas.equipamento_tipo IS 'Tipo de equipamento: elevador, escada ou esteira';
COMMENT ON COLUMN propostas.dados_json IS 'Estrutura completa da proposta em JSON';
COMMENT ON COLUMN propostas.status IS 'Status da proposta: rascunho, enviada, aprovada, rejeitada';
