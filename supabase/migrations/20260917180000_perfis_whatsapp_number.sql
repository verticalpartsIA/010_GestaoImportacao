-- Coluna de WhatsApp por colaborador — usada pela notificação automática da
-- Central de Decisões (docs/superpowers/specs/2026-09-17-whatsapp-central-decisoes-design.md).
-- Formato: DDI+DDD+número, só dígitos (ex.: 5511999999999) — mesmo formato
-- aceito pela Evolution API.
alter table perfis
  add column if not exists whatsapp_number text;
