-- ============================================================
-- Cache de pagamentos do Omie (Contas a Pagar) pras Empresas
-- Instaladoras — issue "Pagamentos: Vamos trazer isso do Omie".
--
-- O Omie não expõe vínculo formal Fornecedor→Cliente/Obra: quem
-- paga a instalação pode ser o CNPJ da empresa OU o CPF/CNPJ MEI de
-- um colaborador individual (confirmado com print real do usuário
-- em 04/09 — título pago pra pessoa física que também é uma das
-- "empresas instaladoras" cadastradas aqui). O campo "Projeto" é
-- texto livre lançado pelo Financeiro (ex.: "MURANO 23573 720
-- D/2026 - ELEVADOR - SÃO PAULO"), sem código estruturado — mas
-- repete o MESMO texto em todas as parcelas da mesma obra
-- (recorrência), então dá pra agrupar por esse texto e tentar casar
-- com building_name de dossier_obra por aproximação (melhor
-- esforço, dossier_id fica null quando não há match confiável).
--
-- Sincronizada por uma Edge Function (omie_sync_pagamentos_instalador
-- -es), nunca escrita direto pelo frontend — só leitura via RLS
-- aberta, mesmo padrão de vistorias_questionarios_policies.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.omie_pagamentos_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_lancamento_omie integer NOT NULL,
  cpf_cnpj_consultado text NOT NULL,          -- documento (só dígitos) usado na busca no Omie
  empresa_id text REFERENCES public.parceiros_instaladores(id) ON DELETE SET NULL,
  colaborador_id text REFERENCES public.parceiros_colaboradores(id) ON DELETE SET NULL,
  fonte text NOT NULL DEFAULT 'empresa',      -- 'empresa' (achou pelo CNPJ) | 'colaborador' (achou pelo CPF do colaborador)
  projeto_texto text,                          -- texto livre do campo "Projeto" no Omie
  dossier_id text REFERENCES public.dossier_obra(id) ON DELETE SET NULL, -- match por building_name, melhor esforço
  valor_documento numeric,
  status_titulo text,
  pago boolean NOT NULL DEFAULT false,
  data_vencimento date,
  data_previsao date,
  data_registro date,
  numero_documento_fiscal text,
  numero_pedido text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codigo_lancamento_omie, cpf_cnpj_consultado)
);

CREATE INDEX IF NOT EXISTS idx_omie_pagamentos_empresa ON public.omie_pagamentos_cache(empresa_id);
CREATE INDEX IF NOT EXISTS idx_omie_pagamentos_colaborador ON public.omie_pagamentos_cache(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_omie_pagamentos_dossier ON public.omie_pagamentos_cache(dossier_id);

-- Registro de cada rodada de sincronização (visibilidade pro botão
-- "Atualizar agora" / diagnóstico de erro do Omie na tela).
CREATE TABLE IF NOT EXISTS public.omie_pagamentos_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  empresas_consultadas integer,
  titulos_gravados integer,
  erro text
);

ALTER TABLE public.omie_pagamentos_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omie_pagamentos_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY leitura_publica ON public.omie_pagamentos_cache FOR SELECT USING (true);
CREATE POLICY leitura_publica ON public.omie_pagamentos_sync_log FOR SELECT USING (true);
-- Sem política de INSERT/UPDATE/DELETE pro anon/authenticated: só a
-- Edge Function grava, usando a service role key (bypassa RLS).
