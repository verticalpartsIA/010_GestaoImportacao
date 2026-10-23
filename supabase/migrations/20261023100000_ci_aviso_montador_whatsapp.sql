-- 23/10/2026 — Contrato Instalador: o link de assinatura do MONTADOR (externo) sai sozinho por WhatsApp.
-- Antes: o link só ia para quem pediu o envio (Cleiton), que encaminhava à mão. O gi-avisos (VPS) passou a aceitar destinatário
-- só com telefone (payload.destinatarios[].telefone, sem email) — contrato definido com a sessão da VPS em 23/10.
-- `_ci_disparar` (roda quando o aval é aprovado e o contrato vai às assinaturas) agora também enfileira esse aviso.
-- Só vale para contratos que passam por `_ci_disparar` daqui para frente; os já enviados não são reenviados.
-- O aviso a quem pediu o envio continua como reserva (texto ajustado).
do $do$
declare def text; ancora text; novo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = '_ci_disparar';
  if def is null then raise exception '_ci_disparar nao encontrada'; end if;

  -- variáveis novas
  ancora := 'declare cid text;';
  if position(ancora in def) = 0 then raise exception 'ancora declare nao encontrada'; end if;
  def := replace(def, ancora, 'declare tel_m text; nome_m text; cid text;');

  -- enfileira o aviso ao montador (antes da mensagem ao solicitante)
  ancora := E'  sol := lower(nullif(trim(d.solicitado_por), ''''));';
  if position(ancora in def) = 0 then raise exception 'ancora sol nao encontrada'; end if;
  novo := E'  -- WhatsApp direto ao montador (externo, só telefone). Telefone inválido: não envia e o aviso ao solicitante cobre.\n'
       || E'  tel_m := regexp_replace(coalesce(c.recipient->>''contact'', ''''), ''\\D'', '''', ''g'');\n'
       || E'  if length(tel_m) in (10, 11) then tel_m := ''55'' || tel_m; end if;\n'
       || E'  nome_m := coalesce(nullif(trim(c.recipient->>''name''), ''''), nullif(trim(c.responsavel_nome), ''''), c.contratada_nome, ''Montador'');\n'
       || E'  if length(tel_m) >= 12 and c.token ~ ''^[A-Za-z0-9_-]{8,}$'' then\n'
       || E'    begin\n'
       || E'      perform evento_enfileirar(''hub.aviso_fluxo'', ''hub.aviso:assinatura:montador:'' || c.id || '':'' || c.token,\n'
       || E'        ''contrato_instalador'', c.id::text, c.numero_documento,\n'
       || E'        jsonb_strip_nulls(jsonb_build_object(''origem_aviso'', ''assinatura'', ''momento'', ''pendente'', ''papel'', ''Contratado'',\n'
       || E'          ''titulo'', ''Assinatura pendente — '' || c.numero_documento, ''contrato'', c.numero_documento,\n'
       || E'          ''obra'', nullif(public._ci_obra(c), ''''), ''instalador'', c.contratada_nome,\n'
       || E'          ''link_assinatura'', ''https://hub.vpsistema.com/assinar/'' || c.token,\n'
       || E'          ''destinatarios'', jsonb_build_array(jsonb_build_object(''nome'', nome_m, ''telefone'', tel_m, ''externo'', true)))),\n'
       || E'        jsonb_build_object(''nome'', nome_m));\n'
       || E'    exception when others then null; end;\n'
       || E'  end if;\n\n'
       || ancora;
  def := replace(def, ancora, novo);

  -- texto do aviso reserva ao solicitante
  ancora := '''Envie ao montador ''';
  if position(ancora in def) = 0 then raise exception 'ancora texto nao encontrada'; end if;
  def := replace(def, ancora, '''O link também foi enviado ao montador por WhatsApp automaticamente (confira se chegou); se não chegar, envie você ao montador ''');

  execute def;
end $do$;
