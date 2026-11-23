-- Boletos Avisos > aba "Tratativas": caso por cliente + historico imutavel de tratativas (19/11/2026, pedido do Gelson).
-- Etapa 1 (so a tela, as anotacoes e o caso). Responder por e-mail e a etapa 2 (funcao boletos-avisos).
-- Quem trata: os 3 fixos (boletos_avisos_email_permitido) OU quem recebeu a caixa "tratar" em Administracao > Aladas.
-- Quem so tem "ver"/"atualizar" le a aba e nao grava nada. Tabelas nascem com RLS fechada; a gravacao so passa pelas funcoes
-- abaixo (SECURITY DEFINER), que conferem a alcada, gravam o caso e o historico juntos e nunca deixam apagar nem editar o historico.

-- 1) Quem pode tratar ---------------------------------------------------------------------------------------------
create or replace function public.boletos_avisos_email_pode_tratar(p_email text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.boletos_avisos_email_permitido(p_email)
      or exists (
        select 1 from public.alcadas_capacidade a
        join public.perfis p on p.id = a.perfil_id
        where lower(p.email) = lower(coalesce(p_email, ''))
          and p.ativo
          and a.modulo = 'boletos-avisos'
          and a.capacidade = 'tratar'
      );
$$;
revoke all on function public.boletos_avisos_email_pode_tratar(text) from public, anon, authenticated;
grant execute on function public.boletos_avisos_email_pode_tratar(text) to service_role;

create or replace function public.boletos_avisos_pode_tratar()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.vp_usuario_ativo())
     and public.boletos_avisos_email_pode_tratar((select public.vp_email()));
$$;
revoke all on function public.boletos_avisos_pode_tratar() from public, anon;
grant execute on function public.boletos_avisos_pode_tratar() to authenticated;

-- quem tem "tratar" tambem ve a tela (como "ver" e "atualizar")
create or replace function public.boletos_avisos_pode()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.vp_usuario_ativo())
     and (
       public.boletos_avisos_email_permitido((select public.vp_email()))
       or exists (
         select 1 from public.alcadas_capacidade a
         join public.perfis p on p.id = a.perfil_id
         where lower(p.email) = (select public.vp_email())
           and p.ativo
           and a.modulo = 'boletos-avisos'
           and a.capacidade in ('ver', 'atualizar', 'tratar')
       )
     );
$$;

-- 2) Tabelas -------------------------------------------------------------------------------------------------------
create table if not exists public.boletos_avisos_casos (
  codigo_cliente_omie bigint primary key,
  status              text not null default 'aberto'
                        check (status in ('aberto', 'em_tratativa', 'aguardando_cliente', 'resolvido')),
  responsavel_email   text,
  promessa_pagamento  date,
  aberto_em           timestamptz not null default now(),
  resolvido_em        timestamptz,
  atualizado_em       timestamptz not null default now(),
  atualizado_por      text
);

create table if not exists public.boletos_avisos_tratativas (
  id                  uuid primary key default gen_random_uuid(),
  codigo_cliente_omie bigint not null,
  tipo                text not null check (tipo in ('nota', 'status', 'promessa', 'atribuicao', 'resposta_enviada')),
  texto               text,
  autor               text not null,
  criado_em           timestamptz not null default now(),
  meta                jsonb not null default '{}'::jsonb
);
create index if not exists boletos_avisos_tratativas_cliente_idx
  on public.boletos_avisos_tratativas (codigo_cliente_omie, criado_em desc);

alter table public.boletos_avisos_casos      enable row level security;
alter table public.boletos_avisos_tratativas enable row level security;

revoke all on public.boletos_avisos_casos, public.boletos_avisos_tratativas from anon, authenticated;
grant select on public.boletos_avisos_casos, public.boletos_avisos_tratativas to authenticated;   -- so leitura; escrita so pelas funcoes
grant all on public.boletos_avisos_casos, public.boletos_avisos_tratativas to service_role;

drop policy if exists boletos_avisos_casos_sel on public.boletos_avisos_casos;
create policy boletos_avisos_casos_sel on public.boletos_avisos_casos for select to authenticated
  using ((select public.boletos_avisos_pode()));
drop policy if exists boletos_avisos_tratativas_sel on public.boletos_avisos_tratativas;
create policy boletos_avisos_tratativas_sel on public.boletos_avisos_tratativas for select to authenticated
  using ((select public.boletos_avisos_pode()));

-- 3) Gravacao (as unicas portas) ---------------------------------------------------------------------------------
-- Muda o caso. p_patch aceita as chaves: status, responsavel_email, promessa_pagamento (valor null limpa). Cada campo que MUDOU vira uma
-- linha no historico (tipo status/atribuicao/promessa) com meta {de, para}. Devolve a linha do caso.
create or replace function public.boletos_avisos_caso_mudar(p_cliente bigint, p_patch jsonb)
returns public.boletos_avisos_casos
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := (select public.vp_email());
  v_antes public.boletos_avisos_casos;
  v_novo  public.boletos_avisos_casos;
  v_status text; v_resp text; v_prom date;
begin
  if not (select public.boletos_avisos_pode_tratar()) then
    raise exception 'Sem permissão para tratar casos de Boletos Avisos.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.boletos_avisos_clientes where codigo_cliente_omie = p_cliente) then
    raise exception 'Cliente % não encontrado em Boletos Avisos.', p_cliente using errcode = '22023';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Nada para mudar.' using errcode = '22023';
  end if;

  select * into v_antes from public.boletos_avisos_casos where codigo_cliente_omie = p_cliente;
  v_status := coalesce(case when p_patch ? 'status' then p_patch->>'status' end, v_antes.status, 'aberto');
  if v_status not in ('aberto', 'em_tratativa', 'aguardando_cliente', 'resolvido') then
    raise exception 'Status inválido: %', v_status using errcode = '22023';
  end if;
  v_resp := case when p_patch ? 'responsavel_email' then nullif(lower(btrim(p_patch->>'responsavel_email')), '') else v_antes.responsavel_email end;
  if v_resp is not null and not exists (select 1 from public.perfis where lower(email) = v_resp and ativo) then
    raise exception 'Responsável não é um usuário ativo: %', v_resp using errcode = '22023';
  end if;
  v_prom := case when p_patch ? 'promessa_pagamento' then nullif(p_patch->>'promessa_pagamento', '')::date else v_antes.promessa_pagamento end;
  if v_prom is not null and v_prom < (now() at time zone 'America/Sao_Paulo')::date
     and v_prom is distinct from v_antes.promessa_pagamento then
    raise exception 'A promessa de pagamento não pode ser uma data passada.' using errcode = '22023';
  end if;

  insert into public.boletos_avisos_casos as c (codigo_cliente_omie, status, responsavel_email, promessa_pagamento, resolvido_em, atualizado_em, atualizado_por)
  values (p_cliente, v_status, v_resp, v_prom, case when v_status = 'resolvido' then now() end, now(), v_email)
  on conflict (codigo_cliente_omie) do update set
    status = excluded.status,
    responsavel_email = excluded.responsavel_email,
    promessa_pagamento = excluded.promessa_pagamento,
    resolvido_em = case when excluded.status = 'resolvido' then coalesce(c.resolvido_em, now()) else null end,
    atualizado_em = now(),
    atualizado_por = v_email
  returning * into v_novo;

  if v_antes.codigo_cliente_omie is null then
    insert into public.boletos_avisos_tratativas (codigo_cliente_omie, tipo, texto, autor, meta)
    values (p_cliente, 'status', 'Caso aberto', v_email, jsonb_build_object('de', null, 'para', v_novo.status));
  elsif v_antes.status is distinct from v_novo.status then
    insert into public.boletos_avisos_tratativas (codigo_cliente_omie, tipo, texto, autor, meta)
    values (p_cliente, 'status', 'Status do caso mudou', v_email, jsonb_build_object('de', v_antes.status, 'para', v_novo.status));
  end if;
  if v_antes.responsavel_email is distinct from v_novo.responsavel_email and (v_antes.codigo_cliente_omie is not null or v_novo.responsavel_email is not null) then
    insert into public.boletos_avisos_tratativas (codigo_cliente_omie, tipo, texto, autor, meta)
    values (p_cliente, 'atribuicao', 'Responsável do caso mudou', v_email, jsonb_build_object('de', v_antes.responsavel_email, 'para', v_novo.responsavel_email));
  end if;
  if v_antes.promessa_pagamento is distinct from v_novo.promessa_pagamento and (v_antes.codigo_cliente_omie is not null or v_novo.promessa_pagamento is not null) then
    insert into public.boletos_avisos_tratativas (codigo_cliente_omie, tipo, texto, autor, meta)
    values (p_cliente, 'promessa', 'Promessa de pagamento mudou', v_email, jsonb_build_object('de', v_antes.promessa_pagamento, 'para', v_novo.promessa_pagamento));
  end if;
  return v_novo;
end;
$$;
revoke all on function public.boletos_avisos_caso_mudar(bigint, jsonb) from public, anon;
grant execute on function public.boletos_avisos_caso_mudar(bigint, jsonb) to authenticated;

-- Anotacao interna (nada vai ao cliente). Abre o caso como "em tratativa" se ainda nao existe.
create or replace function public.boletos_avisos_tratativa_nota(p_cliente bigint, p_texto text)
returns public.boletos_avisos_tratativas
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := (select public.vp_email());
  v_texto text := btrim(coalesce(p_texto, ''));
  v_linha public.boletos_avisos_tratativas;
begin
  if not (select public.boletos_avisos_pode_tratar()) then
    raise exception 'Sem permissão para tratar casos de Boletos Avisos.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.boletos_avisos_clientes where codigo_cliente_omie = p_cliente) then
    raise exception 'Cliente % não encontrado em Boletos Avisos.', p_cliente using errcode = '22023';
  end if;
  if char_length(v_texto) < 3 or char_length(v_texto) > 4000 then
    raise exception 'A anotação precisa ter de 3 a 4000 caracteres.' using errcode = '22023';
  end if;
  insert into public.boletos_avisos_casos (codigo_cliente_omie, status, atualizado_por)
  values (p_cliente, 'em_tratativa', v_email)
  on conflict (codigo_cliente_omie) do nothing;
  insert into public.boletos_avisos_tratativas (codigo_cliente_omie, tipo, texto, autor)
  values (p_cliente, 'nota', v_texto, v_email)
  returning * into v_linha;
  return v_linha;
end;
$$;
revoke all on function public.boletos_avisos_tratativa_nota(bigint, text) from public, anon;
grant execute on function public.boletos_avisos_tratativa_nota(bigint, text) to authenticated;
