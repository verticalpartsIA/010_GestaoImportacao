-- O Omie precisa refletir o chão (Gelson, 21/10/2026): toda vez que o endereço de um produto muda no hub
-- (importacao_varejo_contagem.endereco), entra um pedido nesta fila e a Edge Function estoque-omie-endereco grava a
-- característica "Endereço" do produto no Omie (geral/prodcaract). Um registro por produto: sempre o endereço MAIS RECENTE.
-- Se o Omie falhar, o pedido fica na fila (status 'erro', com o motivo) e é tentado de novo; a edição no hub nunca é bloqueada.

create table if not exists public.estoque_omie_endereco_fila (
  codigo text primary key,                       -- produto, em maiúsculas
  endereco text,                                 -- texto que deve estar no Omie ('R2I8 / R2H8 / H23'); vazio/nulo = apagar a característica
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro')),
  tentativas int not null default 0,
  erro text,
  enviado_endereco text,                         -- o que o Omie confirmou ter recebido
  atualizado_em timestamptz not null default now(),
  enviado_em timestamptz
);
create index if not exists estoque_omie_endereco_fila_status_idx on public.estoque_omie_endereco_fila (status, atualizado_em);

alter table public.estoque_omie_endereco_fila enable row level security;
revoke all on public.estoque_omie_endereco_fila from anon, authenticated;
grant select on public.estoque_omie_endereco_fila to authenticated;
grant all on public.estoque_omie_endereco_fila to service_role;
drop policy if exists estoque_omie_end_fila_sel on public.estoque_omie_endereco_fila;
create policy estoque_omie_end_fila_sel on public.estoque_omie_endereco_fila for select to authenticated
  using ((select public.vp_eh_admin()));

-- Gatilho: endereço do produto mudou → pedido pendente (sobrescreve o anterior: vale o último).
create or replace function public.iv_contagem_enfileira_endereco_omie() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.endereco is distinct from old.endereco then
    insert into public.estoque_omie_endereco_fila (codigo, endereco, status, tentativas, erro, atualizado_em)
    values (upper(btrim(new.codigo)), nullif(btrim(coalesce(new.endereco, '')), ''), 'pendente', 0, null, now())
    on conflict (codigo) do update
      set endereco = excluded.endereco, status = 'pendente', tentativas = 0, erro = null, atualizado_em = now();
  end if;
  return new;
exception when others then
  return new;   -- a fila nunca pode impedir o endereço de ser gravado no hub
end $$;
revoke all on function public.iv_contagem_enfileira_endereco_omie() from public, anon, authenticated;

drop trigger if exists trg_iv_contagem_enfileira_endereco_omie on public.importacao_varejo_contagem;
create trigger trg_iv_contagem_enfileira_endereco_omie
  after insert or update of endereco on public.importacao_varejo_contagem
  for each row execute function public.iv_contagem_enfileira_endereco_omie();

-- Carga inicial: todo produto que já tem endereço no hub vai para o Omie (idempotente).
insert into public.estoque_omie_endereco_fila (codigo, endereco)
select upper(btrim(c.codigo)), btrim(c.endereco)
from public.importacao_varejo_contagem c
where coalesce(btrim(c.endereco), '') <> ''
on conflict (codigo) do nothing;

-- Quem trabalha a fila: a cada minuto. A função só lê esta tabela (não aceita dados de fora), então chamá-la é inofensivo.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'estoque-omie-endereco-sync') then
    perform cron.unschedule('estoque-omie-endereco-sync');
  end if;
  perform cron.schedule('estoque-omie-endereco-sync', '* * * * *', $job$
    select net.http_post(
      url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/estoque-omie-endereco',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
        'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$);
end $$;
