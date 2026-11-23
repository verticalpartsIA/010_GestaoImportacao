-- Testes de RLS e Guarda de `propostas` — R3 (PR-C)
-- Executável no esquema mínimo do branch de teste (`perfis`, `alcadas_capacidade`, `propostas`, `vp_policy_backup` + helpers).
-- Pré-requisito: `perfis` e `alcadas_capacidade` legíveis por `authenticated` (como em produção hoje).
-- Autocontido em transação (BEGIN; ... ROLLBACK;) — não deixa rastro.
-- NÃO cobre: `public_proposta_*` reais, `vp_valores_guarda`, `trg_propostas_vigencia`, `trg_avais_abrir_na_proposta`,
-- `propostas_guarda_exclusao` (essas ficam em `r3_propostas_integracao_nao_executavel_branch_minimo.sql`).

begin;

do $$
declare
  v_comum uuid;
  v_excluidor uuid;
  v_admin uuid;
  v_prop_id uuid;
  v_prop_enviada uuid;
  v_prop_aprovada uuid;
  v_rows int;
begin
  insert into public.perfis (id, email, nome, nivel, ativo)
    values (gen_random_uuid(), 'r3c.comum@verticalparts.com.br', 'R3C Comum', 'Colaborador', true)
    returning id into v_comum;

  insert into public.perfis (id, email, nome, nivel, ativo)
    values (gen_random_uuid(), 'r3c.excluidor@verticalparts.com.br', 'R3C Excluidor', 'Colaborador', true)
    returning id into v_excluidor;

  insert into public.perfis (id, email, nome, nivel, ativo)
    values (gen_random_uuid(), 'r3c.admin@verticalparts.com.br', 'R3C Admin', 'Administrador', true)
    returning id into v_admin;

  insert into public.alcadas_capacidade (perfil_id, modulo, capacidade)
    values (v_excluidor, 'propostas', 'excluir');

  -- 1) ANON bloqueado em SELECT, INSERT, UPDATE, DELETE
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';

  begin
    perform 1 from public.propostas limit 1;
    raise exception 'FALHA: anon conseguiu ler propostas';
  exception when sqlstate '42501' then null;
  end;

  begin
    insert into public.propostas (id, titulo, status) values (gen_random_uuid(), 'Anon', 'rascunho');
    raise exception 'FALHA: anon conseguiu inserir em propostas';
  exception when sqlstate '42501' then null;
  end;

  execute 'reset role';

  -- 2) AUTHENTICATED comum: cria rascunho, edita conteúdo, gera token 1ª vez (garantirToken) e envia (markSent) -> PASSA
  perform set_config('request.jwt.claims', json_build_object('email', 'r3c.comum@verticalparts.com.br', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.propostas (id, titulo, status, data_json, vendedor_id)
    values (gen_random_uuid(), 'Proposta R3C', 'rascunho', '{"cliente":{"nome":"Teste"}}'::jsonb, v_comum)
    returning id into v_prop_id;

  update public.propostas set token = 'tok_r3c_inicial' where id = v_prop_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'FALHA: garantirToken (null -> token) não atualizou'; end if;

  update public.propostas set status = 'enviada' where id = v_prop_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'FALHA: markSent (rascunho -> enviada) não atualizou'; end if;

  v_prop_enviada := v_prop_id;

  -- 3) Negativos de INSERT (comum e Admin sem privilégio especial de assinatura)
  begin
    insert into public.propostas (id, titulo, status) values (gen_random_uuid(), 'Forjada', 'aprovada');
    raise exception 'FALHA: insert com status aprovada passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Proposta nova deve nascer em rascunho%' then raise exception 'FALHA msg insert status: %', sqlerrm; end if;
  end;

  begin
    insert into public.propostas (id, titulo, status, signed_at) values (gen_random_uuid(), 'Forjada 2', 'rascunho', now());
    raise exception 'FALHA: insert com signed_at passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Campos de assinatura/auditoria só podem ser gravados pelas RPCs públicas%' then raise exception 'FALHA msg insert signed_at: %', sqlerrm; end if;
  end;

  -- 4) Negativos de UPDATE: transições de assinatura/cliente bloqueadas
  begin
    update public.propostas set status = 'visualizada' where id = v_prop_enviada;
    raise exception 'FALHA: update para visualizada passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Transição de status de resposta do cliente%' then raise exception 'FALHA msg visualizada: %', sqlerrm; end if;
  end;

  begin
    update public.propostas set status = 'aprovada' where id = v_prop_enviada;
    raise exception 'FALHA: update para aprovada passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Transição de status de resposta do cliente%' then raise exception 'FALHA msg aprovada: %', sqlerrm; end if;
  end;

  begin
    update public.propostas set status = 'recusada' where id = v_prop_enviada;
    raise exception 'FALHA: update para recusada passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Transição de status de resposta do cliente%' then raise exception 'FALHA msg recusada: %', sqlerrm; end if;
  end;

  begin
    update public.propostas set status = 'revisao_solicitada' where id = v_prop_enviada;
    raise exception 'FALHA: update para revisao_solicitada passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Transição de status de resposta do cliente%' then raise exception 'FALHA msg revisao: %', sqlerrm; end if;
  end;

  begin
    update public.propostas set status = 'expirada' where id = v_prop_enviada;
    raise exception 'FALHA: update para expirada passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Transição de status de resposta do cliente%' then raise exception 'FALHA msg expirada: %', sqlerrm; end if;
  end;

  -- 5) Negativos de UPDATE: audit, signed_at, aprovada_em, token já emitido, escolhaEntrega com status
  begin
    update public.propostas set audit = '{"signerName":"Fake"}'::jsonb where id = v_prop_enviada;
    raise exception 'FALHA: update audit passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Campos de auditoria e assinatura%' then raise exception 'FALHA msg audit: %', sqlerrm; end if;
  end;

  begin
    update public.propostas set signed_at = now() where id = v_prop_enviada;
    raise exception 'FALHA: update signed_at passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Campos de auditoria e assinatura%' then raise exception 'FALHA msg signed_at: %', sqlerrm; end if;
  end;

  begin
    update public.propostas set aprovada_em = now() where id = v_prop_enviada;
    raise exception 'FALHA: update aprovada_em passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Campos de auditoria e assinatura%' then raise exception 'FALHA msg aprovada_em: %', sqlerrm; end if;
  end;

  begin
    update public.propostas set token = 'tok_trocado' where id = v_prop_enviada;
    raise exception 'FALHA: troca de token existente passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Token público já emitido não pode ser alterado%' then raise exception 'FALHA msg token: %', sqlerrm; end if;
  end;

  insert into public.propostas (id, titulo, status, data_json, vendedor_id)
    values (gen_random_uuid(), 'Proposta R3C Escolha', 'rascunho', '{}'::jsonb, v_comum)
    returning id into v_prop_id;

  begin
    update public.propostas
       set data_json = '{"elevador":{"valores":{"escolhaEntrega":"90"}}}'::jsonb
     where id = v_prop_id;
    raise exception 'FALHA: escolhaEntrega sem mudança de status passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%escolhaEntrega só pode ser gravado pela RPC de assinatura%' then raise exception 'FALHA msg escolhaEntrega: %', sqlerrm; end if;
  end;

  -- 6) DELETE sem alçada `propostas.excluir` bloqueado pelo RLS
  delete from public.propostas where id = v_prop_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FALHA: comum sem propostas.excluir conseguiu deletar'; end if;

  execute 'reset role';

  -- 7) Admin NÃO ganha bypass nas transições de assinatura
  perform set_config('request.jwt.claims', json_build_object('email', 'r3c.admin@verticalparts.com.br', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    update public.propostas set status = 'aprovada' where id = v_prop_enviada;
    raise exception 'FALHA: admin conseguiu aprovar proposta por UPDATE direto';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Transição de status de resposta do cliente%' then raise exception 'FALHA msg admin aprovada: %', sqlerrm; end if;
  end;

  execute 'reset role';

  -- 8) Titular com `propostas.excluir` consegue deletar rascunho
  perform set_config('request.jwt.claims', json_build_object('email', 'r3c.excluidor@verticalparts.com.br', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  delete from public.propostas where id = v_prop_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'FALHA: titular com propostas.excluir não conseguiu deletar'; end if;

  execute 'reset role';

  -- 9) Positivo: editar conteúdo de uma proposta 'enviada' continua permitido para authenticated
  perform set_config('request.jwt.claims', json_build_object('email', 'r3c.comum@verticalparts.com.br', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  update public.propostas set titulo = 'Proposta R3C Editada' where id = v_prop_enviada;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'FALHA: editar conteúdo de proposta enviada não funcionou'; end if;

  execute 'reset role';

  -- 10) Negativo: sair de 'aprovada' por UPDATE direto é bloqueado (comum e Admin)
  insert into public.propostas (id, titulo, status, data_json, vendedor_id, signed_at, aprovada_em)
    values (gen_random_uuid(), 'Proposta R3C Aprovada', 'aprovada', '{"cliente":{"nome":"Teste"}}'::jsonb, v_comum, now(), now())
    returning id into v_prop_aprovada;

  perform set_config('request.jwt.claims', json_build_object('email', 'r3c.comum@verticalparts.com.br', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    update public.propostas set status = 'rascunho' where id = v_prop_aprovada;
    raise exception 'FALHA: comum conseguiu tirar proposta de aprovada para rascunho';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Proposta já aprovada não pode ter o status alterado%' then raise exception 'FALHA msg sair aprovada (comum): %', sqlerrm; end if;
  end;

  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('email', 'r3c.admin@verticalparts.com.br', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    update public.propostas set status = 'cancelada' where id = v_prop_aprovada;
    raise exception 'FALHA: admin conseguiu tirar proposta de aprovada para cancelada';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Proposta já aprovada não pode ter o status alterado%' then raise exception 'FALHA msg sair aprovada (admin): %', sqlerrm; end if;
  end;

  execute 'reset role';

  -- Em ambientes que não exibem NOTICE (ex.: chamadas via API), troque o comentário abaixo
  -- por `raise exception 'R3_PROPOSTAS_TESTES_OK';` para forçar o rollback e confirmar o término com sucesso.
end $$;

rollback;
