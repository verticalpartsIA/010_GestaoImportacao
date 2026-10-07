-- issue #707 — rfq_importacao e ims_importacao nunca tinham numero_cotacao,
-- então os eventos RFQ_FRETE_ENVIADO/IMS_CONTRATADO (gatilhos-engine.js)
-- sempre saíam com numeroCotacao undefined e os nós correspondentes nunca
-- fechavam sozinhos em "Prazos & Pendências". Coluna opcional, sem FK —
-- mesmo padrão solto já usado em pi_importacao/embarques_importacao
-- (propositalmente sem acoplar a catálogos ainda não unificados).
-- Já aplicada em produção via MCP (sb_apply_migration) em 06/10/2026;
-- este arquivo só sincroniza o repositório com o estado real do banco.

alter table public.rfq_importacao add column if not exists numero_cotacao integer;
alter table public.ims_importacao add column if not exists numero_cotacao integer;
