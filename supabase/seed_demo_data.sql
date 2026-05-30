-- ============================================================
-- seed_demo_data.sql — Dados de demonstração do VP PRD
-- ------------------------------------------------------------
-- Projeto Supabase: jxtqwzmpgofwctqajewt
-- Estes dados deixam as telas (Jurídico, Logística/navios, etc.)
-- completas como no protótipo do Claude Designer, mantendo tudo
-- persistente no Supabase real.
--
-- Conforme Workflow.md (seção DADOS DE TESTE): dados fictícios são
-- permitidos desde que exista rotina de limpeza/reset (abaixo).
--
-- Uso (psql ou SQL editor do Supabase):
--   1) Para repovoar o alinhamento de demonstração: rode o bloco SEED.
--   2) Para limpar dados de teste: rode o bloco RESET.
-- ============================================================

-- ============================================================
-- SEED — alinhamento de demonstração
-- ============================================================

-- Contratos (Jurídico): status batendo com KPIs + contagem de redações
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS redacted integer DEFAULT 0;
UPDATE public.contratos SET status='Assinado',              redacted=2, pages=18 WHERE id='CTR-001';
UPDATE public.contratos SET status='Em redação',            redacted=3, pages=24 WHERE id='CTR-002';
UPDATE public.contratos SET status='Aguardando assinatura', redacted=0, pages=14 WHERE id='CTR-003';
UPDATE public.contratos SET status='Em assinatura digital', redacted=4, pages=34 WHERE id='CTR-004';

-- Embarques (Logística/Importação): identificadores, invoice, container,
-- posição/geo, e timeline padrão de 9 fases do workflow de importação.
UPDATE public.embarques SET
  position=0.62,
  imo='9839430', supplier='Tianjin Control Systems Co., Ltd.',
  invoice_number='HSL-2026-0418', invoice_value=128400, invoice_currency='USD',
  container_number='MSCU9382821', seal='SH4471092', freight_condition='FCL',
  docs = '["BL ✓","Invoice ✓","Packing List ✓","Certificado de Origem ✓","Seguro pendente"]'::jsonb,
  milestones = '[
   {"label":"Produção concluída","date":"2026-04-12","state":"done"},
   {"label":"Embarcado (gate-in / load)","date":"2026-04-18","state":"done"},
   {"label":"Saiu do porto de origem","date":"2026-04-20","state":"done"},
   {"label":"Em trânsito marítimo","date":"—","state":"current","note":"Atraso de ~5 dias vs. ETA original"},
   {"label":"Chegada prevista (ETA)","date":"2026-06-02","state":"future"},
   {"label":"Atracação","date":"—","state":"future"},
   {"label":"Desembaraço aduaneiro","date":"—","state":"future"},
   {"label":"Transporte nacional","date":"—","state":"future"},
   {"label":"Entregue na obra","date":"—","state":"future"}
  ]'::jsonb
WHERE id='EMB-001';

UPDATE public.embarques SET
  position=0.97, lat=-23.00, lng=-44.05, speed=0, heading=0,
  imo='9784271', supplier='Shanghai Vertical Tech Co., Ltd.',
  invoice_number='SVT-2026-0502', invoice_value=246800, invoice_currency='USD',
  container_number='COSU7741200', seal='CN8820133', freight_condition='FCL',
  docs = '["BL ✓","Invoice ✓","Packing List ✓","DI registrada"]'::jsonb,
  milestones = '[
   {"label":"Produção concluída","date":"2026-04-28","state":"done"},
   {"label":"Embarcado (gate-in / load)","date":"2026-05-03","state":"done"},
   {"label":"Saiu do porto de origem","date":"2026-05-05","state":"done"},
   {"label":"Em trânsito marítimo","date":"2026-05-06","state":"done"},
   {"label":"Chegada prevista (ETA)","date":"2026-06-18","state":"done"},
   {"label":"Atracação","date":"2026-06-18","state":"done"},
   {"label":"Desembaraço aduaneiro","date":"—","state":"current","note":"Canal vermelho — inspeção física"},
   {"label":"Transporte nacional","date":"—","state":"future"},
   {"label":"Entregue na obra","date":"—","state":"future"}
  ]'::jsonb
WHERE id='EMB-002';

UPDATE public.embarques SET
  position=0.45,
  imo='9461562', supplier='Hamburg Lift Components GmbH',
  invoice_number='HLC-2026-0429', invoice_value=312500, invoice_currency='USD',
  container_number='HLBU4421098', seal='DE5523088', freight_condition='FCL',
  docs = '["BL ✓","Invoice ✓","Packing List ✓","Origem aguardando"]'::jsonb,
  milestones = '[
   {"label":"Produção concluída","date":"2026-04-20","state":"done"},
   {"label":"Embarcado (gate-in / load)","date":"2026-04-26","state":"done"},
   {"label":"Saiu do porto de origem","date":"2026-04-28","state":"done"},
   {"label":"Em trânsito marítimo","date":"—","state":"current"},
   {"label":"Chegada prevista (ETA)","date":"2026-06-05","state":"future"},
   {"label":"Atracação","date":"—","state":"future"},
   {"label":"Desembaraço aduaneiro","date":"—","state":"future"},
   {"label":"Transporte nacional","date":"—","state":"future"},
   {"label":"Entregue na obra","date":"—","state":"future"}
  ]'::jsonb
WHERE id='EMB-003';

-- Usuários: remover entradas fictícias (placeholder e duplicata mal grafada)
DELETE FROM public.usuarios WHERE email='gelsonsimoes@gmail.com' AND name='Fulano de Tal';
DELETE FROM public.usuarios WHERE email='ariliene.avila@verticalparts.com.br';

-- ============================================================
-- RESET — limpeza de dados de teste transacionais
-- (descomente para usar; NÃO apaga colaboradores/usuários reais)
-- ============================================================
-- DELETE FROM public.leads      WHERE id LIKE 'LD-E2E%' OR building ILIKE '%teste e2e%';
-- DELETE FROM public.cotacoes   WHERE id LIKE 'CT-E2E%';
-- DELETE FROM public.embarques  WHERE id LIKE 'EM-E2E%';
-- DELETE FROM public.contratos  WHERE id LIKE 'CO-E2E%';
