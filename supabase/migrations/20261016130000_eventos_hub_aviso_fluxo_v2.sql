-- Central de Eventos — Fase A, v2 (16/10/2026). Complementa 20261016120000_eventos_hub_aviso_fluxo.sql.
-- 1) Engenharia passa a ser Mauricio Araujo (não Gelson Simoes) na tabela de destinatários globais.
-- 2) Duas fontes novas de hub.aviso_fluxo, além de alertas e gatilhos:
--      eventos_fluxo (AFTER INSERT)  -> origem_aviso = 'eventos_fluxo', etapa = rótulo do evento, ator_nome, ator_papel
--      cotacoes_elevador_fornecedor (responded_at nulo -> preenchido) -> origem_aviso = 'fornecedor_respondeu' (SEM preço)
-- 3) Campos novos no payload de TODO hub.aviso_fluxo (os atuais continuam iguais):
--      numero_cotacao, vendedor{nome,email}, evento_key (gatilhos), prazo_em (gatilhos), alerta_id e decisao_tipo (alertas)
-- Publica tudo: nada é filtrado nem agrupado no HUB. Sem telefone e sem preço de fornecedor no payload. Nenhum disparo é ligado:
-- o envio é do gi-avisos; a Central mantém hub.aviso_fluxo em sombra. Falha ao enfileirar nunca impede a ação de negócio.

-- ---------- 1) Engenharia = Mauricio Araujo ----------
update public.eventos_destino_modulo
   set nome = 'Mauricio Araujo', email = 'mauricio.araujo@verticalparts.com.br', observacao = 'Engenharia (definido pelo usuário em 16/10/2026)'
 where modulo = 'Engenharia' and lower(email) = 'gelson.simoes@verticalparts.com.br';
insert into public.eventos_destino_modulo (modulo, nome, email, observacao)
select 'Engenharia', 'Mauricio Araujo', 'mauricio.araujo@verticalparts.com.br', 'Engenharia (definido pelo usuário em 16/10/2026)'
 where not exists (select 1 from public.eventos_destino_modulo where modulo = 'Engenharia' and lower(email) = 'mauricio.araujo@verticalparts.com.br');

-- ---------- Auxiliares ----------
-- Nº da cotação que aparece no texto/id de um aviso: "cotação Nº 991", "VPEL-EL0991", "VPPC-0991"/"VPPR-"/"VPCV-"/"VPCT-"
create or replace function public._evt_numero_cotacao_texto(p text) returns integer language sql immutable as $$
  select nullif(coalesce(
    substring(lower(p) from 'cota[cç][aã]o\s*n?[ºo°.]*\s*0*(\d{3,6})'),
    substring(lower(p) from 'vpel-el0*(\d{3,6})'),
    substring(lower(p) from 'vp(?:pc|pr|cv|ct)-0*(\d{3,6})')
  ), '')::integer
$$;
revoke execute on function public._evt_numero_cotacao_texto(text) from public, anon, authenticated;

-- Vendedor = dono da cotação (formularios_elevador.created_by)
create or replace function public._evt_vendedor(p_num integer) returns jsonb language sql stable security definer set search_path = public as $$
  select case when p_num is null then null else
    (select jsonb_build_object('nome', _evt_nome_usuario(f.created_by), 'email', lower(f.created_by))
       from formularios_elevador f where f.numero_cotacao = p_num and nullif(f.created_by, '') is not null limit 1)
  end
$$;
revoke execute on function public._evt_vendedor(integer) from public, anon, authenticated;

-- Módulo de destino (quem cuida) de cada módulo do eventos_fluxo
create or replace function public._evt_modulo_fluxo(p text) returns text language sql immutable as $$
  select case
    when p in ('Embarques','P.I.','IMS') then 'Importação'
    when p in ('Instalação','Documentação','Data Book','Dossiê da Obra','Engenharia') then 'Engenharia'
    when p in ('Contrato Instalador','Contrato de Venda','Aval Jurídico') then 'Jurídico'
    when p in ('Aval Financeiro') then 'Financeiro'
    else 'Comercial'
  end
$$;
revoke execute on function public._evt_modulo_fluxo(text) from public, anon, authenticated;

-- ---------- Alertas: + numero_cotacao, vendedor, alerta_id, decisao_tipo ----------
create or replace function public.trg_evt_aviso_alerta() returns trigger language plpgsql security definer set search_path = public as $$
declare dest jsonb; etapa text; num integer; dtipo text; duuid text;
begin
  begin
    dest := _evt_destinatarios(new.destinatario_email, new.module);
    etapa := nullif(regexp_replace(new.id, '[-_0-9a-f]{6,}.*$', ''), '');
    duuid := substring(new.id from '^dec_nova_([0-9a-f-]{36})');
    if duuid is not null then
      select d.tipo, d.numero_cotacao into dtipo, num from decisoes_gerenciais d where d.id::text = duuid;
    end if;
    num := coalesce(num, _evt_numero_cotacao_texto(coalesce(new.title, '') || ' ' || coalesce(new.sub, '') || ' ' || new.id));
    perform evento_enfileirar('hub.aviso_fluxo', 'hub.aviso:alerta:' || new.id,
      'alerta', new.id, num::text,
      jsonb_build_object(
        'titulo', new.title,
        'texto', trim(both ' ' from coalesce(new.title, '') || case when coalesce(new.sub, '') <> '' then ' — ' || new.sub else '' end),
        'nivel', new.level, 'modulo', new.module, 'etapa', etapa, 'link', new.rota, 'origem_aviso', 'alertas',
        'alerta_id', new.id, 'decisao_tipo', dtipo,
        'numero_cotacao', num, 'vendedor', _evt_vendedor(num),
        'destinatarios', dest,
        'dono', case when jsonb_array_length(dest) > 0 then dest->0 else null end,
        'sem_destinatario', jsonb_array_length(dest) = 0),
      jsonb_build_object('sistema', 'vphub'));
  exception when others then null;
  end;
  return new;
end $$;

-- ---------- Gatilhos: + evento_key, numero_cotacao, vendedor (prazo_em já existia, nasceu e concluída) ----------
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
        'nivel', 'info', 'modulo', modulo, 'etapa', new.evento_key, 'evento_key', new.evento_key, 'momento', momento,
        'prazo_em', new.prazo_em, 'cotacao', new.numero_cotacao, 'numero_cotacao', new.numero_cotacao,
        'vendedor', _evt_vendedor(new.numero_cotacao),
        'link', '/adm-financeiro/financeiro', 'origem_aviso', 'gatilhos',
        'destinatarios', dest,
        'dono', case when jsonb_array_length(dest) > 0 then dest->0 else null end,
        'sem_destinatario', jsonb_array_length(dest) = 0),
      jsonb_build_object('sistema', 'vphub'));
  exception when others then null;
  end;
  return new;
end $$;

-- ---------- Nova fonte: eventos_fluxo (todo evento do fluxo) ----------
create or replace function public.trg_evt_aviso_evfluxo() returns trigger language plpgsql security definer set search_path = public as $$
declare dest jsonb; vend jsonb;
begin
  begin
    vend := _evt_vendedor(new.numero_cotacao);
    dest := _evt_destinatarios(null, _evt_modulo_fluxo(new.modulo));
    if jsonb_array_length(dest) = 0 and vend is not null then dest := jsonb_build_array(vend); end if;
    perform evento_enfileirar('hub.aviso_fluxo', 'hub.aviso:evfluxo:' || new.id,
      'evento_fluxo', new.id::text, new.numero_cotacao::text,
      jsonb_build_object(
        'titulo', new.evento,
        'texto', new.evento || case when nullif(new.alvo_label, '') is not null then ' — ' || new.alvo_label else '' end
                 || case when new.numero_cotacao is not null then ' (Cotação Nº ' || new.numero_cotacao || ')' else '' end,
        'nivel', 'info', 'modulo', new.modulo, 'etapa', new.evento, 'origem_aviso', 'eventos_fluxo',
        'ator_nome', new.ator_nome, 'ator_papel', new.ator_papel, 'alvo_id', new.alvo_id,
        'numero_cotacao', new.numero_cotacao, 'vendedor', vend,
        'link', null,
        'destinatarios', dest,
        'dono', case when jsonb_array_length(dest) > 0 then dest->0 else null end,
        'sem_destinatario', jsonb_array_length(dest) = 0),
      jsonb_build_object('sistema', 'vphub', 'nome', new.ator_nome, 'papel', new.ator_papel));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_evt_aviso_evfluxo on public.eventos_fluxo;
create trigger trg_evt_aviso_evfluxo after insert on public.eventos_fluxo for each row execute function public.trg_evt_aviso_evfluxo();

-- ---------- Nova fonte: fornecedor respondeu pelo link (SEM preço) ----------
create or replace function public.trg_evt_aviso_fornecedor_respondeu() returns trigger language plpgsql security definer set search_path = public as $$
declare dest jsonb; vend jsonb; num integer;
begin
  begin
    if old.responded_at is not null or new.responded_at is null then return new; end if;
    select f.numero_cotacao into num from formularios_elevador f where f.id::text = new.formulario_elevador_id::text limit 1;
    vend := _evt_vendedor(num);
    dest := case when vend is not null then jsonb_build_array(vend) else _evt_destinatarios(null, 'Comercial') end;
    perform evento_enfileirar('hub.aviso_fluxo',
      'hub.aviso:fornecedor-respondeu:' || new.id || ':' || to_char(new.responded_at at time zone 'UTC', 'YYYYMMDDHH24MISSMS'),
      'cotacao_fornecedor', new.id::text, num::text,
      jsonb_build_object(
        'titulo', 'Fornecedor respondeu pelo link',
        'texto', 'O fornecedor ' || coalesce(new.fornecedor, '—') || ' respondeu a cotação'
                 || case when num is not null then ' Nº ' || num else '' end || ' pelo link.',
        'nivel', 'info', 'modulo', 'Comercial', 'etapa', 'FORNECEDOR_RESPONDEU', 'origem_aviso', 'fornecedor_respondeu',
        'fornecedor_nome', new.fornecedor, 'cotacao_fornecedor_id', new.id,
        'numero_cotacao', num, 'vendedor', vend,
        'link', '/comercial/cotacao-fornecedor-detail/' || new.id || '/tratativas',
        'destinatarios', dest,
        'dono', case when jsonb_array_length(dest) > 0 then dest->0 else null end,
        'sem_destinatario', jsonb_array_length(dest) = 0),
      jsonb_build_object('sistema', 'vphub', 'nome', new.fornecedor));
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_evt_aviso_fornecedor_respondeu on public.cotacoes_elevador_fornecedor;
create trigger trg_evt_aviso_fornecedor_respondeu after update on public.cotacoes_elevador_fornecedor
  for each row execute function public.trg_evt_aviso_fornecedor_respondeu();
