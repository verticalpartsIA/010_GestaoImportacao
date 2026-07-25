-- Proposta Comercial ganha o MESMO fluxo de assinatura digital já usado em
-- Contrato Instalador e Contrato Venda de Equipamentos: link público
-- (/assinar/:token), cliente lê + assina (desenho ou nome digitado) sem
-- login, e pode baixar sua própria cópia (PDF) — em vez do botão "Enviar
-- p/ Cliente" que hoje só marca status='enviada' internamente, sem nunca
-- gerar nenhum link real.
alter table public.propostas
  add column if not exists token text unique,
  add column if not exists channel text,
  add column if not exists recipient jsonb,
  add column if not exists audit jsonb not null default '{}'::jsonb,
  add column if not exists log jsonb not null default '[]'::jsonb,
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists expires_at timestamptz;
