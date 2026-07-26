-- Proposta como destino do pipeline (Formulário → Cotação → Precificação →
-- Proposta), com a possibilidade de nascer do zero também.
--
-- 1) vendedor_id era NOT NULL sem default e o editor nunca o enviava — toda
--    tentativa de criar proposta nova pelo editor falhava no INSERT, e o erro
--    era engolido pelo catch (o usuário via "salva localmente"). Passa a
--    aceitar nulo; quando o e-mail do SSO casa com public.perfis, o editor
--    preenche o vendedor.
alter table public.propostas alter column vendedor_id drop not null;

-- 2) numero_cotacao: a chave que o vendedor digita pra proposta herdar os
--    dados já coletados (formulário do cliente, especificação enviada ao
--    fornecedor e valores fechados pelo Financeiro). Fica persistido pra
--    rastrear a origem, não só no data_json.
alter table public.propostas
  add column if not exists numero_cotacao integer;

create index if not exists propostas_numero_cotacao_idx on public.propostas (numero_cotacao);
