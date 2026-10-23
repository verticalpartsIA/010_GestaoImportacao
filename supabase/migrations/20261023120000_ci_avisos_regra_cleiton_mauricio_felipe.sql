-- 23/10/2026 — REGRA (pedido do Gelson): Cleiton, Maurício e Felipe são avisados em duas etapas do Contrato do Instalador:
--  1) links enviados (aval aprovado) e aguardando a assinatura do montador;
--  2) contrato assinado (pelo montador) e, depois, assinaturas concluídas (todos).
-- Aviso individual na Central de Notificações (e WhatsApp pelo canal de alertas). Falha ao avisar nunca impede a ação de negócio.
-- Ids novos de alerta começam com `ci-envio-` / `ci-assinado-` (o gi-avisos agrupa alertas por título em 24 h; ver PR #1045 e memória).
do $do$
declare def text; ancora text; novo text;
begin
  -- (1) _ci_disparar: o aviso deixa de ir só ao solicitante e passa a ir aos 3 (+ solicitante, sem repetir)
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = '_ci_disparar';
  ancora := E'    insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)\n    values (''ci-envio-'' || c.id || ''-'' || to_char(now(), ''YYYYMMDDHH24MISS''), ''warning'', ''Enviar o contrato ao montador'', left(texto, 900), ''Jurídico'', false, sol, ''/juridico/contrato-instalador'');';
  if position(ancora in def) = 0 then raise exception 'ancora disparar nao encontrada'; end if;
  novo := E'    insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)\n'
       || E'    select ''ci-envio-'' || c.id || ''-'' || e || ''-'' || to_char(now(), ''YYYYMMDDHH24MISS''), ''info'', ''Contrato enviado - aguardando o montador assinar'', left(texto, 900), ''Jurídico'', false, e, ''/juridico/contrato-instalador''\n'
       || E'      from (select distinct x as e from unnest(array[''cleiton.domingos@verticalparts.com.br'', ''mauricio.araujo@verticalparts.com.br'', ''felipe.barros@verticalparts.com.br'']\n'
       || E'                                         || case when sol is not null then array[sol] else array[]::text[] end) x) t;';
  def := replace(def, ancora, novo);
  ancora := '''Aval aprovado — contrato ''';
  if position(ancora in def) = 0 then raise exception 'ancora texto disparar nao encontrada'; end if;
  def := replace(def, ancora, '''Aguardando a assinatura do montador — contrato ''');
  execute def;

  -- (2a) _ci_efeitos: montador assinou -> aviso aos 3
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = '_ci_efeitos';
  ancora := E'  if tipo is not null then';
  if position(ancora in def) = 0 then raise exception 'ancora efeitos nao encontrada'; end if;
  novo := E'  if ev = ''assinado'' then\n'
       || E'    begin\n'
       || E'      insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)\n'
       || E'      select ''ci-assinado-'' || c.id || ''-'' || e, ''info'', ''Contrato assinado pelo montador'',\n'
       || E'             left(''Contrato '' || num || '' assinado por '' || coalesce(nullif(meta->>''signerName'', ''''), c.responsavel_nome, ''o montador'') || ''.'', 900),\n'
       || E'             ''Jurídico'', false, e, ''/juridico/contrato-instalador''\n'
       || E'        from unnest(array[''cleiton.domingos@verticalparts.com.br'', ''mauricio.araujo@verticalparts.com.br'', ''felipe.barros@verticalparts.com.br'']) e\n'
       || E'      on conflict (id) do nothing;\n'
       || E'    exception when others then raise warning ''[_ci_efeitos] aviso aos 3 falhou: %'', sqlerrm; end;\n'
       || E'  end if;\n'
       || ancora;
  def := replace(def, ancora, novo);
  execute def;

  -- (2b) _ci_aviso: assinaturas concluídas -> os 3 entram no WhatsApp junto da gestão (sem repetir e-mail)
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = '_ci_aviso';
  ancora := E'    dest := public._ci_dest_gestao(c);';
  if position(ancora in def) = 0 then raise exception 'ancora aviso nao encontrada'; end if;
  novo := E'    dest := public._ci_dest_gestao(c);\n'
       || E'    if p_momento = ''concluida'' then\n'
       || E'      dest := dest || coalesce((select jsonb_agg(jsonb_build_object(''nome'', v.nome, ''email'', v.email))\n'
       || E'                                  from (values (''Cleiton Domingos'', ''cleiton.domingos@verticalparts.com.br''),\n'
       || E'                                               (''Maurício Araujo'', ''mauricio.araujo@verticalparts.com.br''),\n'
       || E'                                               (''Felipe Barros'', ''felipe.barros@verticalparts.com.br'')) v(nome, email)\n'
       || E'                                 where not exists (select 1 from jsonb_array_elements(dest) d where lower(d->>''email'') = v.email)), ''[]''::jsonb);\n'
       || E'    end if;';
  def := replace(def, ancora, novo);
  execute def;
end $do$;
