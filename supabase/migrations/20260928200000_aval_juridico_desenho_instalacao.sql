-- Aval Jurídico (novo gate, espelha avais_financeiros) + campo pra rastrear
-- o anexo/envio do Desenho do Projeto de Instalação, que deixou de ser
-- entregue junto com o Contrato de Venda (checklist do wizard) e passou a
-- ser enviado separadamente pela Engenharia, só depois de sinal pago +
-- contrato assinado + aval Jurídico.

create table if not exists public.avais_juridicos (
  id uuid primary key default gen_random_uuid(),
  contrato_venda_id text not null,
  numero_cotacao integer,
  cliente_nome text,
  numero_documento text,
  status text not null default 'pendente', -- pendente | aprovado | reprovado
  aval jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists avais_juridicos_contrato_venda_id_key
  on public.avais_juridicos (contrato_venda_id);

alter table public.avais_juridicos enable row level security;

-- Mesmo padrão permissivo de avais_financeiros (app inteiro roda com anon
-- key, sem sessão de Auth real — ver src/supabase.js).
create policy "aj_leitura" on public.avais_juridicos for select using (true);
create policy "aj_insert" on public.avais_juridicos for insert with check (true);
create policy "aj_update" on public.avais_juridicos for update using (true) with check (true);
create policy "aj_delete" on public.avais_juridicos for delete using (true);

alter table public.contratos_venda_equipamentos
  add column if not exists desenho_instalacao jsonb;
