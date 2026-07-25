-- Master ID Fase 2: herança em Proposta, Contrato de Venda e Contrato
-- Instalador. Mantém a numeração própria de cada documento (VPPROP/VPVE/VPNI
-- via next_doc_number) e só adiciona a referência ao Master ID + ao registro
-- de origem — pra rastreabilidade e pra puxar o payload acumulado (Fase 1 +
-- Precificação + Proposta) sem redigitar em cada etapa seguinte.

alter table public.propostas
  add column if not exists master_id text,
  add column if not exists precificacao_id uuid references public.precificacoes_elevador(id);

alter table public.contratos_venda_equipamentos
  add column if not exists master_id text,
  add column if not exists proposta_id uuid references public.propostas(id);

-- ativos_indices: quais índices de ativo (Fase 1: indice_ativo por Unidade)
-- este contrato de instalação cobre — permite associar equipamentos
-- específicos a instaladores distintos na mesma obra (ex.: Instalador X
-- monta os ativos 1 e 2; Instalador Y monta o ativo 3).
alter table public.contratos_instalador
  add column if not exists master_id text,
  add column if not exists proposta_id uuid references public.propostas(id),
  add column if not exists ativos_indices jsonb not null default '[]'::jsonb;
