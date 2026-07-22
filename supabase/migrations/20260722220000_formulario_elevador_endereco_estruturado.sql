-- Endereço estruturado (Logradouro/Complemento/Bairro/CEP/Cidade/UF) em vez
-- de texto livre. Coluna `endereco`/`endereco_obra` viram cache da string
-- já formatada (ver formatarEndereco() no front), pra quem só precisa do
-- texto pronto não precisar remontar a partir das partes.

alter table public.clientes
  add column if not exists endereco_logradouro text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro text,
  add column if not exists endereco_cep text,
  add column if not exists endereco_cidade text,
  add column if not exists endereco_estado text;

alter table public.formularios_elevador
  add column if not exists endereco_logradouro text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro text,
  add column if not exists endereco_cep text,
  add column if not exists endereco_cidade text,
  add column if not exists endereco_estado text,
  add column if not exists endereco_obra_logradouro text,
  add column if not exists endereco_obra_complemento text,
  add column if not exists endereco_obra_bairro text,
  add column if not exists endereco_obra_cep text,
  add column if not exists endereco_obra_cidade text,
  add column if not exists endereco_obra_estado text;
