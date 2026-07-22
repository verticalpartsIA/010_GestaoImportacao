-- Formulário de Elevadores: pergunta condicional "instalado em endereço
-- diferente?" — quando false, a obra usa o mesmo endereço do cliente.
alter table public.formularios_elevador
  add column if not exists endereco_obra_diferente boolean not null default false;
