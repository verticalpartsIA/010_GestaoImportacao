-- Trava do Formulário após a 1ª Precificação: o Líder destrava com motivo.
alter table public.formularios_elevador
  add column if not exists destravado_em timestamptz,
  add column if not exists destravado_por text,
  add column if not exists destrave_motivo text;
