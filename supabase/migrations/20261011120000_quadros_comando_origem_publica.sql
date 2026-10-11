-- Respostas do formulário público de Quadro de Comando voltam para a tela
-- "Cotação Quadro de Comando" (antes só viravam Lead em Comercial > Leads).
-- A Edge Function capturar-lead-quadro-comando passa a criar também a linha em
-- quadros_comando, guardando o que o cliente respondeu (verbatim) e o vínculo
-- com o Lead. Nenhuma tabela nova: só 3 colunas aditivas.
alter table public.quadros_comando
  add column if not exists origem_envio text,          -- null = criado por um usuário; 'formulario_publico' = enviado pelo cliente
  add column if not exists lead_id text,               -- Lead criado junto (leads.id, ex.: LD-477213)
  add column if not exists respostas_publico jsonb;    -- respostas exatamente como o cliente enviou

create index if not exists idx_quadros_comando_origem_envio on public.quadros_comando(origem_envio) where origem_envio is not null;
create index if not exists idx_quadros_comando_lead_id on public.quadros_comando(lead_id) where lead_id is not null;
