-- Etapa 2.2: avais por revisão. Falha = "FALHOU: <caso>".
do $$
declare v uuid; o uuid; a uuid; r jsonb; n int; fin record; jur record; al record;
        base jsonb := '{"numero":"X","cliente":{"nome":"ACME"},"obra":{"nome":"Obra 1"},
          "elevador":{"valores":{"itens":[{"equipamento":"VPEL-1","valorUnit":"100,00"}]},"ajustes":{"taxasExcluidas":"DIFAL"},
                      "prazo":{"prazo":"120 dias"},"acabamentosCats":[{"nome":"Piso","v":"Inox"}],"especificacoes":[{"codigo":"VPEL-1","paradas":"4"}]}}';
  procedure_dummy int;
begin
  insert into perfis (email, nome, nivel) values ('v@x','V','Vendedor') returning id into v;
  perform set_config('request.jwt.claims', '{"email":"v@x"}', false);

  -- cria uma família já "toda OK": original aprovada com avais concluídos
  create temp table _f (n int, oid uuid, aid uuid) on commit drop;
  for n in 1..6 loop
    insert into propostas (numero_documento, numero_cotacao, proposal_type, status, sent_at, vendedor_id, valor_total, data_json, token)
    values ('VPPR-'||(1000+n), 1000+n, 'elevador', 'enviada', now(), v, 1000, base, 'tk'||n||'aaaaaaaaaaaaaa') returning id into o;
    update propostas set status='aprovada', aprovada_em=now()-interval '1 day' where id=o;
    update avais_financeiros set status='aprovado', sinal_pago=true, aval_pagamento_confirmado=true, aprovacao_ceo_em=now(), aprovacao_ceo_por='ceo@x', contrato_venda_id='CV-'||n where proposta_id=o;
    update avais_juridicos set status='aprovado', aval='{"ok":true}', contrato_venda_id='CV-'||n where proposta_id=o;
    insert into _f values (n, o, null);
  end loop;

  -- T1 original: avais criados
  if (select count(*) from avais_financeiros where numero_cotacao=1001) <> 1 or (select count(*) from avais_juridicos where numero_cotacao=1001) <> 1 then raise exception 'FALHOU: T1 avais da original'; end if;

  -- helper: cria revisão, enviada → aprovada, e devolve id
  create or replace function pg_temp.rev(p_base uuid, p_dj jsonb, p_valor numeric default 1000) returns uuid language plpgsql as $f$
  declare r jsonb; v_id uuid;
  begin
    r := proposta_criar_revisao(p_base, 'Revisão de teste automatizado');
    v_id := (r->>'id')::uuid;
    update propostas set data_json = p_dj, valor_total = p_valor where propostas.id = v_id;
    update propostas set status='enviada', sent_at=now() where id = (r->>'id')::uuid;
    update propostas set status='aprovada', aprovada_em=now() where id = (r->>'id')::uuid;
    return (r->>'id')::uuid;
  end $f$;

  -- T2 só acabamento muda → herda os dois, sem reabrir; contrato_venda_id não é copiado
  select f.oid into o from _f f where f.n=1;
  a := pg_temp.rev(o, jsonb_set(base, '{elevador,acabamentosCats}', '[{"nome":"Piso","v":"Granito"}]'));
  select * into fin from avais_financeiros where proposta_id=a; select * into jur from avais_juridicos where proposta_id=a;
  if fin.status <> 'aprovado' or not fin.aval_pagamento_confirmado or fin.aprovacao_ceo_em is null or fin.herdado_de_proposta_id <> o or fin.motivo_reabertura is not null or fin.contrato_venda_id is not null then raise exception 'FALHOU: T2 financeiro herdado: %', to_jsonb(fin); end if;
  if jur.status <> 'aprovado' or jur.herdado_de_proposta_id <> o or jur.motivo_reabertura is not null or jur.contrato_venda_id is not null then raise exception 'FALHOU: T2 jurídico herdado: %', to_jsonb(jur); end if;
  select * into al from alertas where id='avais-abertos-'||a; if al.level <> 'info' or al.sub not like '%MANTIDOS%' then raise exception 'FALHOU: T2 alerta: %', to_jsonb(al); end if;
  if (select count(*) from avais_financeiros where numero_cotacao=1001) <> 2 then raise exception 'FALHOU: T2 deveria ter 1 aval por revisão'; end if;

  -- T3 só o valor muda → Financeiro reabre (sinal pago permanece), Jurídico herdado
  select f.oid into o from _f f where f.n=2;
  a := pg_temp.rev(o, jsonb_set(base, '{elevador,valores,itens}', '[{"equipamento":"VPEL-1","valorUnit":"90,00"}]'), 900);
  select * into fin from avais_financeiros where proposta_id=a; select * into jur from avais_juridicos where proposta_id=a;
  if fin.status <> 'pendente_consulta' or fin.aval_pagamento_confirmado or fin.aprovacao_ceo_em is not null or not fin.sinal_pago or fin.motivo_reabertura is null or fin.valor_total <> 900 then raise exception 'FALHOU: T3 financeiro reaberto: %', to_jsonb(fin); end if;
  if jur.status <> 'aprovado' or jur.motivo_reabertura is not null then raise exception 'FALHOU: T3 jurídico deveria herdar: %', to_jsonb(jur); end if;
  select * into al from alertas where id='avais-abertos-'||a; if al.level <> 'warning' or al.sub not like '%Aval Financeiro REABERTO%' then raise exception 'FALHOU: T3 alerta: %', to_jsonb(al); end if;

  -- T4 só uma cláusula muda → Jurídico reabre, Financeiro herdado... (ajustes entra nos dois grupos, então reabre os DOIS: conservador)
  select f.oid into o from _f f where f.n=3;
  a := pg_temp.rev(o, jsonb_set(base, '{elevador,ajustes,taxasExcluidas}', '"DIFAL e frete"'));
  select * into fin from avais_financeiros where proposta_id=a; select * into jur from avais_juridicos where proposta_id=a;
  if jur.status <> 'pendente' or jur.motivo_reabertura is null or jur.aval is not null then raise exception 'FALHOU: T4 jurídico reaberto: %', to_jsonb(jur); end if;
  if fin.status <> 'pendente_consulta' then raise exception 'FALHOU: T4 ajustes é conservador e reabre o financeiro também: %', to_jsonb(fin); end if;

  -- T5 prazo muda (só jurídico) → Jurídico reabre, Financeiro herdado
  select f.oid into o from _f f where f.n=4;
  a := pg_temp.rev(o, jsonb_set(base, '{elevador,prazo,prazo}', '"90 dias"'));
  select * into fin from avais_financeiros where proposta_id=a; select * into jur from avais_juridicos where proposta_id=a;
  if jur.status <> 'pendente' or fin.status <> 'aprovado' or fin.motivo_reabertura is not null then raise exception 'FALHOU: T5 prazo: fin=% jur=%', to_jsonb(fin), to_jsonb(jur); end if;

  -- T6 cliente muda (parte do contrato) → Jurídico reabre
  select f.oid into o from _f f where f.n=5;
  a := pg_temp.rev(o, jsonb_set(base, '{cliente,nome}', '"OUTRA EMPRESA"'));
  select * into jur from avais_juridicos where proposta_id=a; if jur.status <> 'pendente' then raise exception 'FALHOU: T6 cliente'; end if;

  -- T7 só a especificação/projeto muda → NÃO reabre financeiro nem jurídico (Aval Engenharia é por cotação)
  select f.oid into o from _f f where f.n=6;
  a := pg_temp.rev(o, jsonb_set(base, '{elevador,especificacoes}', '[{"codigo":"VPEL-1","paradas":"6"}]'));
  select * into fin from avais_financeiros where proposta_id=a; select * into jur from avais_juridicos where proposta_id=a;
  if fin.status <> 'aprovado' or jur.status <> 'aprovado' then raise exception 'FALHOU: T7 projeto não deveria reabrir fin/jur'; end if;

  -- T8 idempotência: aprovar de novo / atualizar status não duplica
  update propostas set status='visualizada' where id=a; update propostas set status='aprovada' where id=a;
  if (select count(*) from avais_financeiros where proposta_id=a) <> 1 or (select count(*) from avais_juridicos where proposta_id=a) <> 1 then raise exception 'FALHOU: T8 duplicou'; end if;

  -- T9 revisão aprovada de uma família cuja anterior NUNCA teve aval → comportamento de sempre (pendentes)
  insert into propostas (numero_documento, numero_cotacao, proposal_type, status, sent_at, vendedor_id, valor_total, data_json, token)
  values ('VPPR-2001', 2001, 'elevador', 'enviada', now(), v, 500, base, 'tk2001aaaaaaaaaaaa') returning id into o;
  r := proposta_criar_revisao(o, 'Revisão antes de aprovar a original'); a := (r->>'id')::uuid;
  update propostas set status='enviada', sent_at=now() where id=a; update propostas set status='aprovada', aprovada_em=now() where id=a;
  select * into fin from avais_financeiros where proposta_id=a;
  if fin.status <> 'pendente_consulta' or fin.herdado_de_proposta_id is not null then raise exception 'FALHOU: T9 %', to_jsonb(fin); end if;

  -- T10 a função de hash é estável (mesmo jsonb → mesmo hash; chaves em outra ordem → mesmo hash)
  if proposta_hash_grupo('{"elevador":{"valores":{"a":1,"b":2}}}','elevador','fin') <> proposta_hash_grupo('{"elevador":{"valores":{"b":2,"a":1}}}','elevador','fin') then raise exception 'FALHOU: T10 hash instável'; end if;
end $$;
select 'ETAPA 2.2 (AVAIS): TODOS OS TESTES OK' as resultado;
