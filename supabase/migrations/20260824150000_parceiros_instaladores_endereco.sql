-- Adiciona campos de endereço estruturado a parceiros_instaladores, no mesmo
-- formato usado por fornecedores/clientes (endereco_logradouro, _complemento,
-- _bairro, _cep, _cidade, _estado). Sem isso, o formulário "Novo parceiro"
-- em rh-homologacao.jsx tentava salvar um campo "endereco" que não existia
-- na tabela e o cadastro completo (endereço, telefone) nunca ficava editável
-- depois de criado.
alter table parceiros_instaladores
  add column if not exists endereco_logradouro text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro text,
  add column if not exists endereco_cep text,
  add column if not exists endereco_cidade text,
  add column if not exists endereco_estado text;
