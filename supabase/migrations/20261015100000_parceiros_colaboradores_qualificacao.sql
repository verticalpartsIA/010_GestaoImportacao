-- Qualificação do responsável legal (Contrato do Instalador): nacionalidade, estado civil e profissão.
alter table public.parceiros_colaboradores
  add column if not exists nacionalidade text,
  add column if not exists estado_civil text,
  add column if not exists profissao text;
notify pgrst, 'reload schema';
