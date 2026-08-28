-- Lead pode ser Pessoa Física (CPF) e um vendedor pode não ter o
-- CNPJ/CPF do cliente na hora do cadastro — o checkbox "CPF ou CNPJ será
-- inserido depois" (Lead) marca essa pendência e destrava o cadastro sem
-- documento. `clientes.documento_pendente` é o mesmo sinal quando o
-- Formulário de Cotação cria um cliente provisório sem CNPJ/CPF (usando
-- Contato ou Prédio/Empreendimento como identificação).
alter table public.leads add column if not exists documento_pendente boolean not null default false;
alter table public.clientes add column if not exists documento_pendente boolean not null default false;

-- Formulário de Cotação aceita gerar a cotação usando só o nome do
-- prédio/empreendimento como identificação provisória, quando ainda não
-- há Nome/Razão Social nem CNPJ/CPF (ex.: Lead sem documento).
alter table public.formularios_elevador add column if not exists predio_empreendimento text;
