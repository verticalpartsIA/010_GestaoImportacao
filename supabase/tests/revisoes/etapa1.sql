-- Testes da Etapa 1 (revisões comerciais). Qualquer falha aborta com "FALHOU: <caso>".
create or replace function pg_temp.eu(p_email text) returns void language sql as
  $$ select set_config('request.jwt.claims', json_build_object('email', p_email)::text, false) $$;

do $$
declare
  vend uuid; outro uuid; gest uuid; adm uuid; o uuid; a uuid; b uuid; c uuid; r jsonb; n int; s text; t1 text; t2 text;
begin
  -- 1) letras
  if not (proposta_proxima_letra(null) = 'A' and proposta_proxima_letra('A') = 'B' and proposta_proxima_letra('Z') = 'AA'
          and proposta_proxima_letra('AZ') = 'BA' and proposta_proxima_letra('ZZ') = 'AAA' and proposta_proxima_letra('AA') = 'AB') then
    raise exception 'FALHOU: letras';
  end if;
  if proposta_tipo_norm('Elevador de Passageiros') <> 'elevador' or proposta_tipo_norm('Escada Rolante') <> 'escada'
     or proposta_tipo_norm(null) <> 'elevador' or proposta_tipo_norm('esteira') <> 'esteira' then raise exception 'FALHOU: tipo_norm'; end if;

  insert into perfis (email, nome, nivel) values ('vend@x','Vend','Vendedor') returning id into vend;
  insert into perfis (email, nome, nivel) values ('outro@x','Outro','Vendedor') returning id into outro;
  insert into perfis (email, nome, nivel) values ('gest@x','Gest','Gestor') returning id into gest;
  insert into perfis (email, nome, nivel) values ('adm@x','Adm','Administrador') returning id into adm;
  insert into alcadas_capacidade values (gest, 'propostas', 'reativar_revisao'), (gest, 'propostas', 'validar_financeira');

  -- Família 990: original enviada
  insert into propostas (numero_documento, numero_cotacao, proposal_type, status, sent_at, vendedor_id, token, data_json, valor_total)
  values ('VPPR-0990', 990, 'elevador', 'enviada', now(), vend, 'tok0990aaaaaaaaaa', '{"numero":"VPPR-0990","x":1}', 1000) returning id into o;

  -- 2) permissões e validações
  perform pg_temp.eu('outro@x');
  r := proposta_criar_revisao(o, 'motivo suficientemente longo');
  if r->>'erro' is distinct from 'sem_permissao' then raise exception 'FALHOU: outro vendedor deveria ser negado: %', r; end if;
  perform pg_temp.eu('vend@x');
  r := proposta_criar_revisao(o, 'curto');
  if r->>'erro' is distinct from 'motivo_curto' then raise exception 'FALHOU: motivo curto: %', r; end if;
  perform pg_temp.eu('');
  r := proposta_criar_revisao(o, 'motivo suficientemente longo');
  if r->>'erro' is distinct from 'nao_autenticado' then raise exception 'FALHOU: sem login: %', r; end if;

  -- 3) criar A
  perform pg_temp.eu('vend@x');
  r := proposta_criar_revisao(o, 'Cliente pediu alterar a cabine', null, 'k-990-a');
  if not (r->>'ok')::boolean or r->>'revisao_codigo' <> 'A' or r->>'numero_documento' <> 'VPPR-0990-A' then raise exception 'FALHOU: criar A: %', r; end if;
  a := (r->>'id')::uuid;
  select count(*) into n from propostas where id = a and status = 'rascunho' and vigencia = 'em_negociacao' and revisao_indice = 1
     and proposta_base_id = o and proposta_raiz_id = o and version = 1 and versao_publicada is null and sent_at is null
     and token <> 'tok0990aaaaaaaaaa' and data_json->>'numero' = 'VPPR-0990-A' and (data_json->>'x') = '1' and audit = '{}'::jsonb;
  if n <> 1 then raise exception 'FALHOU: estado da revisão A'; end if;
  if (select vigencia from propostas where id = o) <> 'vigente' then raise exception 'FALHOU: original deveria seguir vigente'; end if;
  if (select status from propostas where id = o) <> 'enviada' or (select data_json->>'numero' from propostas where id = o) <> 'VPPR-0990' then
    raise exception 'FALHOU: original foi alterada'; end if;
  if not exists (select 1 from proposta_tokens where proposta_id = a) or not exists (select 1 from proposta_eventos where proposta_id = a and evento = 'PROPOSTA_REVISAO_CRIADA') then
    raise exception 'FALHOU: token/evento da revisão'; end if;

  -- 4) idempotência
  r := proposta_criar_revisao(o, 'Cliente pediu alterar a cabine', null, 'k-990-a');
  if not (r->>'repetido')::boolean or (r->>'id')::uuid <> a then raise exception 'FALHOU: idempotência: %', r; end if;
  if (select count(*) from propostas where numero_cotacao = 990) <> 2 then raise exception 'FALHOU: idempotência duplicou'; end if;

  -- 5) rascunho não é base
  r := proposta_criar_revisao(a, 'motivo suficientemente longo');
  if r->>'erro' is distinct from 'base_em_rascunho' then raise exception 'FALHOU: base rascunho: %', r; end if;

  -- 6) A enviada vira vigente (ninguém aprovou); original vira histórica
  update propostas set status = 'enviada', sent_at = now() where id = a;
  if (select vigencia from propostas where id = a) <> 'vigente' or (select vigencia from propostas where id = o) <> 'historica'
     or (select substituida_por_id from propostas where id = o) <> a then raise exception 'FALHOU: A deveria virar vigente'; end if;

  -- 7) B a partir de A; C a partir da ORIGINAL (retorno ao plano antigo) — nada se perde
  r := proposta_criar_revisao(a, 'Segunda rodada de ajustes'); b := (r->>'id')::uuid;
  if r->>'revisao_codigo' <> 'B' or r->>'revisao_indice' <> '2' then raise exception 'FALHOU: B: %', r; end if;
  r := proposta_criar_revisao(o, 'Cliente quer voltar ao plano original'); c := (r->>'id')::uuid;
  if r->>'revisao_codigo' <> 'C' or r->>'numero_documento' <> 'VPPR-0990-C' or r->>'revisao_indice' <> '3' then raise exception 'FALHOU: C: %', r; end if;
  if (select proposta_base_id from propostas where id = c) <> o then raise exception 'FALHOU: C deveria ter base na original'; end if;
  if (select count(*) from propostas where numero_cotacao = 990) <> 4 then raise exception 'FALHOU: família deveria ter 4'; end if;
  -- índices únicos
  begin
    insert into propostas (numero_documento, numero_cotacao, proposal_type, revisao_indice) values ('DUP', 990, 'Elevador de Passageiros', 1);
    raise exception 'FALHOU: índice (família, revisão) não barrou';
  exception when unique_violation then null; end;
  begin
    insert into propostas (numero_documento, numero_cotacao, proposal_type, revisao_indice, vigencia) values ('DUP2', 990, 'elevador', 9, 'vigente');
    raise exception 'FALHOU: 2ª vigente não barrada';
  exception when unique_violation then null; end;

  -- 8) aprovação do cliente: família 991 (aprovada → revisão enviada → revisão aprovada → reativação)
  insert into propostas (numero_documento, numero_cotacao, proposal_type, status, sent_at, aprovada_em, vendedor_id, token, data_json)
  values ('VPPR-0991', 991, 'elevador', 'aprovada', now() - interval '3 day', now() - interval '2 day', vend, 'tok0991aaaaaaaaaa', '{"numero":"VPPR-0991"}') returning id into o;
  if (select vigencia from propostas where id = o) <> 'vigente' then raise exception 'FALHOU: 991 original vigente'; end if;
  r := proposta_criar_revisao(o, 'Pedido do jurídico do cliente após aprovar'); a := (r->>'id')::uuid;   -- base APROVADA é permitida
  update propostas set status = 'enviada', sent_at = now() where id = a;
  if (select vigencia from propostas where id = o) <> 'vigente' or (select vigencia from propostas where id = a) <> 'em_negociacao' then
    raise exception 'FALHOU: aprovada continua vigente enquanto a revisão aguarda o cliente'; end if;
  update propostas set status = 'aprovada', aprovada_em = now() where id = a;
  if (select vigencia from propostas where id = a) <> 'vigente' or (select vigencia from propostas where id = o) <> 'historica' then
    raise exception 'FALHOU: revisão aprovada vira vigente'; end if;

  -- 9) reativação: só quem tem alçada; muda o link; antigo vira não-assinável
  perform pg_temp.eu('vend@x');
  r := proposta_reativar_revisao(o, 'Cliente quer voltar ao plano original');
  if r->>'erro' is distinct from 'sem_permissao' then raise exception 'FALHOU: vendedor não reativa: %', r; end if;
  perform pg_temp.eu('gest@x');
  r := proposta_reativar_revisao(o, 'curto');
  if r->>'erro' is distinct from 'motivo_curto' then raise exception 'FALHOU: motivo reativação'; end if;
  select token into t1 from propostas where id = o;
  r := proposta_reativar_revisao(o, 'Cliente quer voltar ao plano original');
  if not (r->>'ok')::boolean then raise exception 'FALHOU: reativar: %', r; end if;
  select token into t2 from propostas where id = o;
  if t1 = t2 or r->>'token' <> t2 then raise exception 'FALHOU: link deveria mudar'; end if;
  if exists (select 1 from proposta_tokens where proposta_id = o and token = t1 and assinavel) or not exists (select 1 from proposta_tokens where token = t2 and assinavel and motivo = 'reativacao') then
    raise exception 'FALHOU: tokens da reativação'; end if;
  if (select vigencia from propostas where id = o) <> 'vigente' or (select vigencia from propostas where id = a) <> 'historica' then
    raise exception 'FALHOU: vigência após reativar'; end if;
  if (select status from propostas where id = o) <> 'aprovada' then raise exception 'FALHOU: reativar não altera status aprovada'; end if;
  r := proposta_reativar_revisao(o, 'Cliente quer voltar ao plano original');
  if r->>'erro' is distinct from 'ja_vigente' then raise exception 'FALHOU: já vigente: %', r; end if;

  -- 10) contrato assinado manda: família 992
  insert into propostas (numero_documento, numero_cotacao, proposal_type, status, sent_at, aprovada_em, vendedor_id, token)
  values ('VPPR-0992', 992, 'elevador', 'aprovada', now() - interval '5 day', now() - interval '4 day', vend, 'tok0992aaaaaaaaaa') returning id into o;
  insert into contratos_venda_equipamentos values ('CVE-992', o, 'assinado', now() - interval '1 day');
  perform pg_temp.eu('vend@x');
  r := proposta_criar_revisao(o, 'Cliente pede troca de acabamento'); a := (r->>'id')::uuid;
  update propostas set status = 'enviada', sent_at = now() where id = a;
  update propostas set status = 'aprovada', aprovada_em = now() where id = a;
  if (select vigencia from propostas where id = o) <> 'vigente' or (select vigencia from propostas where id = a) <> 'pendente_aditivo' then
    raise exception 'FALHOU: com contrato assinado a revisão aprovada vira pendente_aditivo'; end if;
  perform pg_temp.eu('gest@x');
  r := proposta_reativar_revisao(a, 'Tentando reativar com contrato assinado');
  if r->>'erro' is distinct from 'contrato_assinado_em_outra_revisao' then raise exception 'FALHOU: reativar com contrato: %', r; end if;

  -- 11) exclusão
  perform pg_temp.eu('vend@x');
  begin delete from propostas where id = o; raise exception 'FALHOU: excluiu original com revisões';
  exception when foreign_key_violation then null; end;
  insert into propostas (numero_documento, status, sent_at, vendedor_id) values ('ENVIADA-SOLTA', 'enviada', now(), vend) returning id into o;
  begin delete from propostas where id = o; raise exception 'FALHOU: vendedor excluiu proposta enviada';
  exception when insufficient_privilege then null; end;
  perform pg_temp.eu('adm@x');
  delete from propostas where id = o;   -- administrador pode
  perform pg_temp.eu('vend@x');
  insert into propostas (numero_documento, status, vendedor_id) values ('RASC-SOLTO', 'rascunho', vend) returning id into o;
  delete from propostas where id = o;   -- rascunho livre

  -- 12) solicitações por trilha (família 993, aprovada: pedido PÓS-aprovação não muda o status)
  insert into propostas (numero_documento, numero_cotacao, proposal_type, status, sent_at, aprovada_em, vendedor_id, token)
  values ('VPPR-0993', 993, 'elevador', 'aprovada', now(), now(), vend, 'tok0993aaaaaaaaaa') returning id into o;
  r := proposta_registrar_solicitacao(o, 'juridica', 'link_publico', 'Dra. X', 'advogada do cliente', 'x@cli', 'Incluir cláusula de multa recíproca');
  if r->>'erro' is distinct from 'origem_invalida' then raise exception 'FALHOU: link_publico é reservado à RPC pública: %', r; end if;
  r := proposta_registrar_solicitacao(o, 'juridica', 'email', 'Dra. X', 'advogada do cliente', 'x@cli', 'Incluir cláusula de multa recíproca');
  if not (r->>'ok')::boolean then raise exception 'FALHOU: registrar solicitação: %', r; end if;
  s := r->>'id';
  r := proposta_registrar_solicitacao(o, 'tecnica', 'reuniao', 'Eng. Y', 'engenheiro do cliente', null, 'Reduzir cabine em 100 mm');
  if (select status from propostas where id = o) <> 'aprovada' then raise exception 'FALHOU: pedido pós-aprovação não pode trocar status'; end if;
  if (select count(*) from proposta_alinhamentos where proposta_id = o and estado = 'pediu_revisao') <> 2 then raise exception 'FALHOU: alinhamento automático'; end if;
  r := proposta_decidir_solicitacao(s::uuid, 'recusada');
  if r->>'erro' is distinct from 'motivo_obrigatorio' then raise exception 'FALHOU: recusa exige motivo: %', r; end if;
  r := proposta_decidir_solicitacao(s::uuid, 'aceita');
  if not (r->>'ok')::boolean then raise exception 'FALHOU: aceitar: %', r; end if;
  perform pg_temp.eu('outro@x');
  r := proposta_decidir_solicitacao(s::uuid, 'aceita');
  if r->>'erro' is distinct from 'sem_permissao' then raise exception 'FALHOU: outro vendedor decide: %', r; end if;
  perform pg_temp.eu('vend@x');
  r := proposta_criar_revisao(o, 'Atende pedidos do jurídico e da engenharia do cliente', array[s::uuid]);
  if (select proposta_resultante_id from proposta_solicitacoes_revisao where id = s::uuid) <> (r->>'id')::uuid then raise exception 'FALHOU: solicitação não ligou à revisão'; end if;
  r := proposta_alinhar(o, 'comercial', 'de_acordo', 'Compras', 'comprador', 'c@cli', 'email');
  if not (r->>'ok')::boolean then raise exception 'FALHOU: alinhar: %', r; end if;

  -- 13) validação por trilha
  r := proposta_validar_trilha(o, 'financeira', 'validada');
  if r->>'erro' is distinct from 'sem_permissao' then raise exception 'FALHOU: validar sem alçada: %', r; end if;
  perform pg_temp.eu('gest@x');
  r := proposta_validar_trilha(o, 'financeira', 'dispensada');
  if r->>'erro' is distinct from 'justificativa_obrigatoria' then raise exception 'FALHOU: dispensa exige justificativa: %', r; end if;
  r := proposta_validar_trilha(o, 'financeira', 'validada');
  if not (r->>'ok')::boolean then raise exception 'FALHOU: validar: %', r; end if;

  -- 14) append-only
  begin update proposta_eventos set evento = 'x'; raise exception 'FALHOU: evento alterado';
  exception when raise_exception then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from proposta_eventos; raise exception 'FALHOU: evento apagado';
  exception when raise_exception then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- 15) backfill: token original e vigência padrão das linhas "antigas"
  if exists (select 1 from propostas where token is not null and token not in (select token from proposta_tokens)) then
    raise exception 'FALHOU: toda proposta com token deve ter linha em proposta_tokens'; end if;
  perform pg_temp.eu('vend@x');
end $$;

-- 16) papéis: anon não vê nada; authenticated lê mas não escreve direto; internas não executáveis
do $$
declare ok boolean;
begin
  perform set_config('request.jwt.claims', '{"email":"vend@x"}', false);
  set local role authenticated;
  perform 1 from proposta_eventos limit 1;
  perform 1 from propostas_vigentes limit 1;
  begin insert into proposta_eventos (evento) values ('x'); raise exception 'FALHOU: authenticated inseriu evento';
  exception when insufficient_privilege then null; end;
  begin update proposta_solicitacoes_revisao set texto = 'x'; raise exception 'FALHOU: authenticated alterou solicitação';
  exception when insufficient_privilege then null; end;
  begin perform proposta_aplicar_vigencia(990, 'elevador'); raise exception 'FALHOU: authenticated executou função interna';
  exception when insufficient_privilege then null; end;
  perform proposta_criar_revisao('00000000-0000-0000-0000-000000000000', 'motivo suficientemente longo');   -- executável
  reset role;
  set local role anon;
  begin perform 1 from proposta_eventos; raise exception 'FALHOU: anon leu eventos';
  exception when insufficient_privilege then null; end;
  begin perform proposta_criar_revisao('00000000-0000-0000-0000-000000000000', 'motivo suficientemente longo'); raise exception 'FALHOU: anon executou RPC';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

select 'ETAPA 1: TODOS OS TESTES OK' as resultado;
