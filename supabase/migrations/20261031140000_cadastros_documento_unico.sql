-- ============================================================
-- T2 #1222 (31/10/2026) — o mesmo CNPJ/CPF não pode ter dois cadastros.
-- Medido antes de aplicar: 0 documentos repetidos em clientes (1.060 CNPJ, 75 CPF)
-- e em fornecedores (3 CNPJ); todos gravados só com dígitos. Índices únicos
-- parciais: documento vazio/nulo (cadastro com documento pendente) continua livre.
-- Inativo também conta: para voltar a usar, reative o cadastro antigo.
-- ============================================================
create unique index if not exists clientes_cnpj_unico     on public.clientes (cnpj)     where cnpj is not null and cnpj <> '';
create unique index if not exists clientes_cpf_unico      on public.clientes (cpf)      where cpf  is not null and cpf  <> '';
create unique index if not exists fornecedores_cnpj_unico on public.fornecedores (cnpj) where cnpj is not null and cnpj <> '';
create unique index if not exists fornecedores_cpf_unico  on public.fornecedores (cpf)  where cpf  is not null and cpf  <> '';
