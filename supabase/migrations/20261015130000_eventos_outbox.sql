-- Central de Eventos (vpsistema.com/eventos) — lado do HUB: fila local de saída (outbox), 15/10/2026.
-- Desenho da Central: a origem grava o evento numa tabela local NA MESMA TRANSAÇÃO da mudança de negócio e um job local envia
-- com retry; assim a Central fora do ar nunca perde evento nem trava a operação. Quem decide COMO e PARA QUEM avisar (WhatsApp,
-- destinatários, texto, horário) é a Central; aqui só se publica o fato. Origem: 'vphub'.
-- Eventos novos (precisam estar no catálogo da origem vphub na Central — ver docs/eventos/vphub-instalador.md):
--   instalador.aval_pendente   — contrato do instalador aguardando o aval do CEO (obra, qtd de elevadores, preço)
--   instalador.contrato_assinado — contrato do instalador assinado
--   instalador.recibo_assinado — montador assinou o recibo de pagamento
-- Falha ao enfileirar NUNCA impede a ação de negócio (exception when others).

create table if not exists public.eventos_outbox (
  id bigserial primary key,
  tipo text not null,
  idempotency_key text not null unique,
  ocorrido_em timestamptz not null default now(),
  ator jsonb,
  entidade jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente','enviado','falha')),
  tentativas integer not null default 0,
  proximo_em timestamptz not null default now(),
  ultimo_erro text,
  enviado_em timestamptz,
  evento_id text,
  criado_em timestamptz not null default now()
);
create index if not exists eventos_outbox_fila_idx on public.eventos_outbox (proximo_em) where status = 'pendente';
alter table public.eventos_outbox enable row level security;
revoke all on public.eventos_outbox from anon, authenticated;     -- sem política: só o servidor (service_role) lê e grava

create or replace function public.evento_enfileirar(p_tipo text, p_key text, p_ent_tipo text, p_ent_id text, p_ent_num text, p_payload jsonb, p_ator jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into eventos_outbox (tipo, idempotency_key, ator, entidade, payload)
  values (p_tipo, left(p_key, 200), p_ator, jsonb_build_object('tipo', p_ent_tipo, 'id', p_ent_id, 'numero', p_ent_num), coalesce(p_payload, '{}'::jsonb))
  on conflict (idempotency_key) do nothing;
exception when others then null;
end $$;
revoke execute on function public.evento_enfileirar(text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;

-- "18.000,00" independente do idioma do banco
create or replace function public._evt_brl(v numeric) returns text language sql immutable as $$
  select 'R$ ' || translate(to_char(coalesce(v, 0), 'FM999,999,990.00'), ',.', '.,')
$$;
revoke execute on function public._evt_brl(numeric) from public, anon, authenticated;

-- ---------- 1) Contrato do instalador aguardando o aval do CEO (decisão criada) ----------
create or replace function public.trg_evt_aval_instalador() returns trigger language plpgsql security definer set search_path = public as $$
declare cid text; c contratos_instalador%rowtype; qtd int; obra text;
begin
  if new.tipo <> 'contratacao_mao_obra_ceo' then return new; end if;
  begin
    cid := coalesce(new.contexto->>'contratoInstaladorId', case when new.referencia_tabela = 'contratos_instalador' then new.referencia_id end);
    if cid is not null then select * into c from contratos_instalador where id::text = cid; end if;
    qtd := greatest(coalesce(array_length(c.dossier_ids, 1), 0),
                    coalesce(jsonb_array_length(c.form_state->'equipamentosManuais'), 0) + coalesce(jsonb_array_length(c.ativos_indices), 0), 1);
    obra := coalesce(nullif(c.form_state->>'clienteObraNome', ''), nullif(c.form_state->>'localServico', ''), c.titulo, 'obra');
    perform evento_enfileirar('instalador.aval_pendente', 'instalador.aval_pendente:' || new.id,
      'decisao', new.id::text, c.numero_documento,
      jsonb_build_object('obra', obra, 'quantidade_elevadores', qtd, 'valor', coalesce(c.valor_total, (new.contexto->>'valor')::numeric),
        'valor_fmt', _evt_brl(coalesce(c.valor_total, nullif(new.contexto->>'valor', '')::numeric)),
        'instalador', coalesce(c.contratada_nome, new.contexto->>'contratada'), 'contrato', c.numero_documento, 'cotacao', new.numero_cotacao),
      jsonb_build_object('email', new.solicitado_por));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_evt_aval_instalador on public.decisoes_gerenciais;
create trigger trg_evt_aval_instalador after insert on public.decisoes_gerenciais for each row execute function public.trg_evt_aval_instalador();

-- ---------- 2) Contrato do instalador assinado ----------
create or replace function public.trg_evt_contrato_instalador_assinado() returns trigger language plpgsql security definer set search_path = public as $$
declare qtd int; obra text;
begin
  if new.status = 'assinado' and old.status is distinct from 'assinado' then
    begin
      qtd := greatest(coalesce(array_length(new.dossier_ids, 1), 0),
                      coalesce(jsonb_array_length(new.form_state->'equipamentosManuais'), 0) + coalesce(jsonb_array_length(new.ativos_indices), 0), 1);
      obra := coalesce(nullif(new.form_state->>'clienteObraNome', ''), nullif(new.form_state->>'localServico', ''), new.titulo, 'obra');
      perform evento_enfileirar('instalador.contrato_assinado', 'instalador.contrato_assinado:' || new.id,
        'contrato_instalador', new.id::text, new.numero_documento,
        jsonb_build_object('obra', obra, 'quantidade_elevadores', qtd, 'valor', new.valor_total, 'valor_fmt', _evt_brl(new.valor_total),
          'instalador', new.contratada_nome, 'contrato', new.numero_documento,
          'dossies', coalesce(to_jsonb(new.dossier_ids), '[]'::jsonb), 'assinante', new.audit->>'signerName'),
        jsonb_build_object('nome', new.audit->>'signerName'));
    exception when others then null;
    end;
  end if;
  return new;
end $$;
drop trigger if exists trg_evt_contrato_instalador_assinado on public.contratos_instalador;
create trigger trg_evt_contrato_instalador_assinado after update on public.contratos_instalador for each row execute function public.trg_evt_contrato_instalador_assinado();

-- ---------- 3) Recibo assinado pelo montador ----------
create or replace function public.trg_evt_recibo_assinado() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'assinado' and old.status is distinct from 'assinado' then
    begin
      perform evento_enfileirar('instalador.recibo_assinado', 'instalador.recibo_assinado:' || new.id,
        'recibo_instalador', new.id, new.dossier_id,
        jsonb_build_object('recibo', new.id, 'instalador', new.instalador_nome, 'dossie', new.dossier_id, 'tipo', new.tipo,
          'valor', new.valor, 'valor_fmt', _evt_brl(new.valor), 'data_pagamento', new.data_pagamento, 'assinante', new.audit->>'signerName'),
        jsonb_build_object('nome', new.audit->>'signerName'));
    exception when others then null;
    end;
  end if;
  return new;
end $$;
drop trigger if exists trg_evt_recibo_assinado on public.instalador_recibos;
create trigger trg_evt_recibo_assinado after update on public.instalador_recibos for each row execute function public.trg_evt_recibo_assinado();

-- ---------- Envio: a cada minuto, a função eventos-publicar assina (HMAC) e publica na Central ----------
select cron.schedule('eventos-publicar-outbox', '* * * * *', $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/eventos-publicar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
