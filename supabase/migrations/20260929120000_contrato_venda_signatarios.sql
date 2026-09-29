-- Signatários adicionais do Contrato de Venda (sócios/jurídico do Comprador,
-- pedido explícito do usuário) — além do representante principal, que
-- continua usando o fluxo já existente (token/audit na própria linha de
-- contratos_venda_equipamentos, intocado). Cada signatário extra tem seu
-- próprio token individual (1 link por pessoa), assina em qualquer ordem;
-- o contrato só vira 'assinado' de verdade quando o representante + todos
-- os signatários aqui tiverem assinado — ver contrato-venda-store.js
-- (markSigned/tentarFinalizarAposSignatarioExtra).

create table if not exists public.contrato_venda_signatarios (
  id uuid primary key default gen_random_uuid(),
  contrato_venda_id text not null references public.contratos_venda_equipamentos(id) on delete cascade,
  papel text not null,
  nome text,
  email text,
  telefone text,
  token text not null,
  status text not null default 'pendente', -- pendente | enviado | visualizado | assinado | recusado
  channel text,
  recipient jsonb,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  audit jsonb,
  log jsonb not null default '[]',
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists contrato_venda_signatarios_token_key
  on public.contrato_venda_signatarios (token);
create index if not exists contrato_venda_signatarios_contrato_idx
  on public.contrato_venda_signatarios (contrato_venda_id);

alter table public.contrato_venda_signatarios enable row level security;

-- Mesmo padrão permissivo do resto do app (anon key, sem sessão de Auth
-- real — ver src/supabase.js).
create policy "cvs_leitura" on public.contrato_venda_signatarios for select using (true);
create policy "cvs_insert" on public.contrato_venda_signatarios for insert with check (true);
create policy "cvs_update" on public.contrato_venda_signatarios for update using (true) with check (true);
create policy "cvs_delete" on public.contrato_venda_signatarios for delete using (true);
