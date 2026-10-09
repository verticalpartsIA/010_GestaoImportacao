-- Projeto de Instalação da Obra assinado pelo cliente (05/10/2026).
-- A Engenharia sobe o PDF (projetos_elevador_desenhos) e o representante do cliente assina em /assinar/<token>.
-- Reaproveita documento_signatarios: só precisa aceitar o novo tipo de documento.
-- Aditiva: os tipos que já existiam continuam aceitos; nada é apagado nem alterado.
alter table public.documento_signatarios drop constraint if exists documento_signatarios_documento_tipo_check;
alter table public.documento_signatarios
  add constraint documento_signatarios_documento_tipo_check
  check (documento_tipo = any (array['proposta'::text, 'contrato_venda'::text, 'contrato_instalador'::text, 'projeto_instalacao'::text]));
