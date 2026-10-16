-- Central de Eventos — Fase A (16/10/2026): todo aviso do HUB também é PUBLICADO na Central como `hub.aviso_fluxo`.
-- O HUB só publica o fato, com texto e destinatário (nome + e-mail) já resolvidos; a Central só entrega.
-- NADA aqui liga WhatsApp: o tipo `hub.aviso_fluxo` está em modo SOMBRA na Central. Nenhum aviso atual do HUB é alterado.
-- Pontos de captura (todo aviso do HUB passa por um deles):
--   1) alertas  — AFTER INSERT: todos os crons, triggers e funções que gravam aviso interno (decisões, avais, inbox, PCP,
--                 embarque, prazos, contratos…). Um evento por aviso.
--   2) gatilhos — AFTER INSERT (etapa nasceu) e AFTER UPDATE (etapa concluída): etapas do fluxo que não geram alerta
--                 (Cargo Ready, instalação, handover…). Etapas "retroativas" (preenchidas à força) NÃO são publicadas.
-- Payload (só identificadores e texto pronto; NUNCA telefone — a Central acha o WhatsApp pelo cadastro dela, pelo e-mail):
--   titulo, texto, nivel, modulo, etapa, link, origem_aviso, destinatarios[{nome,email}], dono{nome,email}, sem_destinatario
-- Falha ao enfileirar NUNCA impede a gravação do aviso nem da etapa (exception when others).

-- ---------- Quem recebe os avisos GLOBAIS (sem destinatario_email) — por módulo, com o NOME do usuário ----------
create table if not exists public.eventos_destino_modulo (
  id bigserial primary key,
  modulo text not null,
  nome text not null,
  email text not null,
  ativo boolean not null default true,
  observacao text,
  criado_em timestamptz not null default now(),
  unique (modulo, email)
);
alter table public.eventos_destino_modulo enable row level security;
revoke all on public.eventos_destino_modulo from anon, authenticated;     -- sem política: só o servidor lê e grava (ajuste por migration/SQL)

-- Sugestão inicial: líderes de cada área (conferidos em colaboradores_vpsistema em 16/10/2026). O usuário corrige.
insert into public.eventos_destino_modulo (modulo, nome, email, observacao) values
  ('Jurídico',            'Bianca Mayumi',    'bianca@verticalparts.com.br',           'líder Jurídico/Importação/Suprimentos'),
  ('Importação',          'Bianca Mayumi',    'bianca@verticalparts.com.br',           'líder Jurídico/Importação/Suprimentos'),
  ('Compras',             'Bianca Mayumi',    'bianca@verticalparts.com.br',           'líder Jurídico/Importação/Suprimentos'),
  ('Financeiro',          'Juliana Anderson', 'juliana@verticalparts.com.br',          'líder Adm/Financeiro'),
  ('Comercial',           'Regiane Rocha',    'regiane.rocha@verticalparts.com.br',    'líder Comercial'),
  ('Comercial',           'Guilherme Garcia', 'guilherme@verticalparts.com.br',        'líder Comercial'),
  ('Inbox',               'Regiane Rocha',    'regiane.rocha@verticalparts.com.br',    'líder Comercial (e-mails sem dono)'),
  ('Engenharia',          'Gelson Simoes',    'gelson.simoes@verticalparts.com.br',    'líder Engenharia'),
  ('Almoxarifado',        'Danilo Oliveira',  'danilo@verticalparts.com.br',           'líder Logística/Almoxarifado/Produção'),
  ('Central de Decisões', 'Diego Maeno',      'diego@verticalparts.com.br',            'CEO (resultados sem solicitante)')
on conflict (modulo, email) do nothing;

-- Nome do usuário a partir do e-mail (colaboradores → perfis → parte local do e-mail)
create or replace function public._evt_nome_usuario(p_email text) returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nome from colaboradores_vpsistema where lower(email) = lower(p_email) and nome is not null limit 1),
    (select nome from perfis where lower(email) = lower(p_email) and nome is not null limit 1),
    initcap(replace(split_part(coalesce(p_email, ''), '@', 1), '.', ' '))
  )
$$;
revoke execute on function public._evt_nome_usuario(text) from public, anon, authenticated;

-- Módulo (quem cuida) de cada etapa do motor de gatilhos
create or replace function public._evt_modulo_etapa(p_key text) returns text language sql immutable as $$
  select case
    when p_key in ('CONTRATO_ENVIADO','AGUARDA_ASSINATURA','AVAL_JURIDICO','CI_GERADO','CI_ASSINADO','INSTALADOR_VINCULADO') then 'Jurídico'
    when p_key in ('PRECIFICACAO','AGUARDA_BOLETO','AVAL_PAGAMENTO','FIN_SCORE','FIN_AVAL_VENDA','CEO_APROVOU','OWNER_APROVOU') then 'Financeiro'
    when p_key in ('COMPRA_LIBERADA','IMPORTACAO_A_INICIAR','NEGOCIACAO_COMPRA','PI_CRIADA','CARGO_READY','RFQ_FRETE','AGENTE_DEFINIDO','IMS_CONTRATADO')
         or p_key like 'EMBARQUE%' then 'Importação'
    when p_key like 'PROJETO%' or p_key like 'INSTALACAO%' or p_key like 'VISTORIA%' or p_key like 'TERMO%'
         or p_key in ('AVAL_ENGENHARIA','FICHA_CRIADA','DOSSIE_CRIADO','PENDENCIAS_RESOLVIDAS','ART_EMITIDA','DATA_BOOK_MONTADO','HANDOVER_CONCLUIDO') then 'Engenharia'
    else 'Comercial'
  end
$$;
revoke execute on function public._evt_modulo_etapa(text) from public, anon, authenticated;

-- Destinatários [{nome,email}]: o individual do aviso, senão os do módulo
create or replace function public._evt_destinatarios(p_email text, p_modulo text) returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when nullif(p_email, '') is not null then
      jsonb_build_array(jsonb_build_object('nome', _evt_nome_usuario(p_email), 'email', lower(p_email)))
    else coalesce((select jsonb_agg(jsonb_build_object('nome', d.nome, 'email', lower(d.email)) order by d.id)
                     from eventos_destino_modulo d where d.ativo and d.modulo = p_modulo), '[]'::jsonb)
  end
$$;
revoke execute on function public._evt_destinatarios(text, text) from public, anon, authenticated;

-- ---------- 1) Todo aviso gravado em `alertas` vira um evento ----------
create or replace function public.trg_evt_aviso_alerta() returns trigger language plpgsql security definer set search_path = public as $$
declare dest jsonb; etapa text;
begin
  begin
    dest := _evt_destinatarios(new.destinatario_email, new.module);
    etapa := nullif(regexp_replace(new.id, '[-_0-9a-f]{6,}.*$', ''), '');
    perform evento_enfileirar('hub.aviso_fluxo', 'hub.aviso:alerta:' || new.id,
      'alerta', new.id, null,
      jsonb_build_object(
        'titulo', new.title,
        'texto', trim(both ' ' from coalesce(new.title, '') || case when coalesce(new.sub, '') <> '' then ' — ' || new.sub else '' end),
        'nivel', new.level, 'modulo', new.module, 'etapa', etapa, 'link', new.rota, 'origem_aviso', 'alertas',
        'destinatarios', dest,
        'dono', case when jsonb_array_length(dest) > 0 then dest->0 else null end,
        'sem_destinatario', jsonb_array_length(dest) = 0),
      jsonb_build_object('sistema', 'vphub'));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_evt_aviso_alerta on public.alertas;
create trigger trg_evt_aviso_alerta after insert on public.alertas for each row execute function public.trg_evt_aviso_alerta();

-- ---------- 2) Etapas do fluxo: nasceu / concluída (sem as retroativas) ----------
create or replace function public.trg_evt_aviso_gatilho() returns trigger language plpgsql security definer set search_path = public as $$
declare dest jsonb; modulo text; momento text; txt text;
begin
  begin
    if coalesce(new.conclusao_tipo, '') = 'retroativo' or new.evento_key is null then return new; end if;
    if tg_op = 'INSERT' and new.status = 'pendente' then
      momento := 'nasceu';
    elsif tg_op = 'UPDATE' and new.status = 'ok' and old.status is distinct from 'ok' then
      momento := 'concluida';
    else
      return new;
    end if;
    modulo := _evt_modulo_etapa(new.evento_key);
    dest := _evt_destinatarios(null, modulo);
    txt := case when momento = 'nasceu' then 'Etapa aberta' else 'Etapa concluída' end
           || case when new.numero_cotacao is not null then ' — Cotação Nº ' || new.numero_cotacao else '' end
           || ': ' || coalesce(new.trigger_name, new.evento_key);
    perform evento_enfileirar('hub.aviso_fluxo', 'hub.aviso:etapa-' || momento || ':' || new.id,
      'cotacao', new.id, new.numero_cotacao::text,
      jsonb_build_object(
        'titulo', coalesce(new.trigger_name, new.evento_key), 'texto', txt,
        'nivel', 'info', 'modulo', modulo, 'etapa', new.evento_key, 'momento', momento,
        'prazo_em', new.prazo_em, 'cotacao', new.numero_cotacao,
        'link', '/adm-financeiro/financeiro', 'origem_aviso', 'gatilhos',
        'destinatarios', dest,
        'dono', case when jsonb_array_length(dest) > 0 then dest->0 else null end,
        'sem_destinatario', jsonb_array_length(dest) = 0),
      jsonb_build_object('sistema', 'vphub'));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_evt_aviso_gatilho_ins on public.gatilhos;
create trigger trg_evt_aviso_gatilho_ins after insert on public.gatilhos for each row execute function public.trg_evt_aviso_gatilho();
drop trigger if exists trg_evt_aviso_gatilho_upd on public.gatilhos;
create trigger trg_evt_aviso_gatilho_upd after update on public.gatilhos for each row execute function public.trg_evt_aviso_gatilho();
