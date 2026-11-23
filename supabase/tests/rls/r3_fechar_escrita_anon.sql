-- Testes de RLS e Guardas do R3 (PR-A) — executável no esquema mínimo do branch `teste-r3`
-- Usa APENAS as 7 tabelas do esquema mínimo (perfis, alcadas_capacidade, decisoes_gerenciais,
-- avais_financeiros, avais_juridicos, pi_importacao, vp_policy_backup).
-- Pré-requisito: pressupõe `perfis` e `alcadas_capacidade` legíveis por `authenticated` (como em produção hoje).
-- Autocontido em transação (BEGIN; ... ROLLBACK;) — não deixa rastro.
-- NÃO cobre: vp_valores_*, triggers SECURITY DEFINER reais de produção, RPCs public_proposta_* e service_role.

begin;

do $$
declare
  v_comum uuid;
  v_editor uuid;
  v_admin_sem uuid;
  v_admin_com uuid;
  v_dec_id uuid;
  v_dec_dep uuid;
  v_dec_reabrir uuid;
  v_dec_ok uuid;
  v_pi_id uuid;
  v_aj_id uuid;
  v_af_id uuid;
  v_cv1 uuid := gen_random_uuid();
  v_cv2 uuid := gen_random_uuid();
  v_rows int;
  v_dec_em timestamptz;
begin
  -- Perfis de teste (UUIDs válidos via gen_random_uuid())
  insert into public.perfis (id, email, nome, nivel, ativo)
    values (gen_random_uuid(), 'r3.comum@verticalparts.com.br', 'R3 Comum', 'Colaborador', true)
    returning id into v_comum;
  insert into public.perfis (id, email, nome, nivel, ativo)
    values (gen_random_uuid(), 'r3.editor@verticalparts.com.br', 'R3 Editor', 'Colaborador', true)
    returning id into v_editor;
  insert into public.perfis (id, email, nome, nivel, ativo)
    values (gen_random_uuid(), 'r3.admin.sem@verticalparts.com.br', 'R3 Admin Sem Alcada', 'Administrador', true)
    returning id into v_admin_sem;
  insert into public.perfis (id, email, nome, nivel, ativo)
    values (gen_random_uuid(), 'r3.admin.com@verticalparts.com.br', 'R3 Admin Com Alcada', 'Administrador', true)
    returning id into v_admin_com;

  insert into public.alcadas_capacidade (perfil_id, modulo, capacidade) values
    (v_editor, 'pi-importacao', 'excluir'),
    (v_editor, 'aval-juridico', 'editar'),
    (v_editor, 'aval-financeiro', 'editar'),
    (v_editor, 'decisoes', 'ceo'),
    (v_admin_com, 'decisoes', 'ceo');

  -- Dados base (como owner/definer)
  insert into public.pi_importacao (numero_pi, status) values ('TESTE-R3-PI', 'Em andamento') returning id into v_pi_id;
  insert into public.avais_juridicos (numero_documento, status) values ('TESTE-R3-AJ', 'pendente') returning id into v_aj_id;
  insert into public.avais_financeiros (numero_documento, status, contrato_venda_id) values ('TESTE-R3-AF', 'pendente_consulta', v_cv1) returning id into v_af_id;
  insert into public.decisoes_gerenciais (tipo, papel_requerido, aprovadores_esperados, status, solicitado_por)
    values ('compra_equipamento_ceo', 'ceo', array['outro.aprovador@verticalparts.com.br'], 'pendente', 'r3.comum@verticalparts.com.br')
    returning id into v_dec_id;
  insert into public.decisoes_gerenciais (tipo, papel_requerido, aprovadores_esperados, status, depende_de)
    values ('compra_equipamento_ceo', 'ceo', array['outro.aprovador@verticalparts.com.br'], 'bloqueada_por_dependencia', array[v_dec_id])
    returning id into v_dec_dep;

  -- 0) anon negado nas 4 tabelas (SELECT deve retornar 0 linhas ou erro)
  execute 'set local role anon';
  begin
    perform 1 from public.pi_importacao where id = v_pi_id;
    raise exception 'FALHA: anon conseguiu ler pi_importacao';
  exception when sqlstate '42501' then null; end;
  begin
    perform 1 from public.decisoes_gerenciais where id = v_dec_id;
    raise exception 'FALHA: anon conseguiu ler decisoes_gerenciais';
  exception when sqlstate '42501' then null; end;
  execute 'reset role';

  -- 1) Usuário comum (authenticated)
  perform set_config('request.jwt.claims', '{"email":"r3.comum@verticalparts.com.br","role":"authenticated"}', true);
  execute 'set local role authenticated';

  -- pi_importacao: comum NÃO deleta (0 linhas pela política vp_int_del)
  delete from public.pi_importacao where id = v_pi_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FALHA: pi_importacao DELETE passou para comum (rows=%)', v_rows; end if;

  -- avais_juridicos: comum NÃO altera status nem insere aprovado (confere mensagem exata)
  begin
    update public.avais_juridicos set status = 'aprovado' where id = v_aj_id;
    raise exception 'FALHA: avais_juridicos UPDATE status passou para comum';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Sem alçada para alterar Aval Jurídico%' then raise exception 'FALHA msg AJ upd: %', sqlerrm; end if;
  end;
  begin
    insert into public.avais_juridicos (numero_documento, status) values ('X', 'aprovado');
    raise exception 'FALHA: avais_juridicos INSERT aprovado passou para comum';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Sem alçada para criar Aval Jurídico%' then raise exception 'FALHA msg AJ ins: %', sqlerrm; end if;
  end;

  -- avais_financeiros: comum NÃO altera sinal_pago, MAS troca contrato_venda_id (D3)
  begin
    update public.avais_financeiros set sinal_pago = true where id = v_af_id;
    raise exception 'FALHA: avais_financeiros UPDATE sinal_pago passou para comum';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Sem alçada para alterar Aval Financeiro%' then raise exception 'FALHA msg AF upd: %', sqlerrm; end if;
  end;
  update public.avais_financeiros set contrato_venda_id = v_cv2 where id = v_af_id;

  -- decisoes_gerenciais: C3 (INSERT aprovado), C2 (alterar aprovadores), C1/C7 (aprovar sem ser aprovador), C5 (cascata forjada), C11 (meio decidido)
  begin
    insert into public.decisoes_gerenciais (tipo, aprovadores_esperados, status) values ('compra_equipamento_ceo', array['r3.comum@verticalparts.com.br'], 'aprovada');
    raise exception 'FALHA: C3 INSERT aprovada passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Nova decisão deve nascer%' then raise exception 'FALHA msg C3: %', sqlerrm; end if;
  end;
  begin
    update public.decisoes_gerenciais set aprovadores_esperados = array['r3.comum@verticalparts.com.br'] where id = v_dec_id;
    raise exception 'FALHA: C2 UPDATE aprovadores_esperados passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Lista de aprovadores%' then raise exception 'FALHA msg C2: %', sqlerrm; end if;
  end;
  begin
    update public.decisoes_gerenciais set status = 'aprovada', decidido_por = 'r3.comum@verticalparts.com.br', decidido_em = now() where id = v_dec_id;
    raise exception 'FALHA: C1/C7 aprovar por comum passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Apenas um aprovador esperado%' then raise exception 'FALHA msg C7: %', sqlerrm; end if;
  end;
  begin
    update public.decisoes_gerenciais set status = 'cancelada', decidido_por = 'sistema' where id = v_dec_dep;
    raise exception 'FALHA: C5 cascata forjada passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Sem permissão para cancelar%' then raise exception 'FALHA msg C5: %', sqlerrm; end if;
  end;
  begin
    update public.decisoes_gerenciais set motivo = 'meio decidido' where id = v_dec_id;
    raise exception 'FALHA: C11 meio decidido passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Decisão aberta não pode ter%' then raise exception 'FALHA msg C11: %', sqlerrm; end if;
  end;

  -- 2) D1: Administrador SEM alçada e fora da lista NÃO aprova (42501)
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"email":"r3.admin.sem@verticalparts.com.br","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    update public.decisoes_gerenciais set status = 'aprovada', decidido_por = 'r3.admin.sem@verticalparts.com.br', decidido_em = now() where id = v_dec_id;
    raise exception 'FALHA: D1 admin sem alcada conseguiu aprovar';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Apenas um aprovador esperado%' then raise exception 'FALHA msg D1: %', sqlerrm; end if;
  end;

  -- 3) D1 + D2: Administrador COM alçada aprova mesmo com relógio 15 min atrasado -> PASSA e servidor grava now()
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"email":"r3.admin.com@verticalparts.com.br","role":"authenticated"}', true);
  execute 'set local role authenticated';
  update public.decisoes_gerenciais
     set status = 'aprovada', decidido_por = 'r3.admin.com@verticalparts.com.br', decidido_em = now() - interval '15 minutes'
   where id = v_dec_id
   returning decidido_em into v_dec_em;
  if abs(extract(epoch from (now() - v_dec_em))) > 10 then
    raise exception 'FALHA: D2 servidor não sobrescreveu decidido_em';
  end if;

  -- Desbloqueio legítimo (pai aprovada -> bloqueada vira pendente) -> PASSA
  update public.decisoes_gerenciais set status = 'pendente' where id = v_dec_dep;

  -- C4 + C11: ninguém reabre aprovada nem altera contexto em aprovada
  begin
    update public.decisoes_gerenciais set status = 'pendente', decidido_por = null, decidido_em = null where id = v_dec_id;
    raise exception 'FALHA: C4 aprovada -> pendente passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Decisão já aprovada é imutável%' then raise exception 'FALHA msg C4: %', sqlerrm; end if;
  end;
  begin
    update public.decisoes_gerenciais set contexto = '{"fraude":true}'::jsonb where id = v_dec_id;
    raise exception 'FALHA: C11 contexto em aprovada passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Decisão já aprovada é imutável%' then raise exception 'FALHA msg C11 ctx: %', sqlerrm; end if;
  end;

  -- 4) Editor (alçadas) + C10 (decidido_por alheio bloqueado) + cascata legítima
  execute 'reset role';
  insert into public.decisoes_gerenciais (tipo, papel_requerido, aprovadores_esperados, status)
    values ('compra_equipamento_ceo', 'ceo', array['outro@verticalparts.com.br'], 'pendente') returning id into v_dec_ok;
  insert into public.decisoes_gerenciais (tipo, papel_requerido, aprovadores_esperados, status, depende_de)
    values ('compra_equipamento_ceo', 'ceo', array['outro@verticalparts.com.br'], 'bloqueada_por_dependencia', array[v_dec_ok]) returning id into v_dec_reabrir;

  perform set_config('request.jwt.claims', '{"email":"r3.editor@verticalparts.com.br","role":"authenticated"}', true);
  execute 'set local role authenticated';

  begin
    update public.decisoes_gerenciais set status = 'reprovada', decidido_por = 'outro@verticalparts.com.br', motivo = 'teste' where id = v_dec_ok;
    raise exception 'FALHA: C10 decidido_por alheio passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%decidido_por deve corresponder%' then raise exception 'FALHA msg C10: %', sqlerrm; end if;
  end;

  update public.decisoes_gerenciais set status = 'reprovada', decidido_por = 'r3.editor@verticalparts.com.br', motivo = 'teste' where id = v_dec_ok;
  update public.avais_juridicos set status = 'aprovado' where id = v_aj_id;
  update public.avais_financeiros set sinal_pago = true where id = v_af_id;
  delete from public.pi_importacao where id = v_pi_id;

  -- 5) Cascata legítima + C8/C9 reabrir como usuário comum
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"email":"r3.comum@verticalparts.com.br","role":"authenticated"}', true);
  execute 'set local role authenticated';

  -- Cascata legítima (pai reprovada -> cancela dependente com 'sistema') -> PASSA
  update public.decisoes_gerenciais set status = 'cancelada', decidido_por = 'sistema' where id = v_dec_reabrir;

  -- C8: comum tentando injetar a si mesmo ao reabrir -> 42501
  begin
    update public.decisoes_gerenciais
       set status = 'pendente', decidido_por = null, decidido_em = null, motivo = null,
           aprovadores_esperados = array['r3.comum@verticalparts.com.br']
     where id = v_dec_ok;
    raise exception 'FALHA: C8 injetar aprovador passou';
  exception when sqlstate '42501' then
    if sqlerrm not like '%Não é permitido incluir aprovador%' then raise exception 'FALHA msg C8: %', sqlerrm; end if;
  end;

  -- C8/C9: comum reabre dentro de (lista antiga U alçada) -> PASSA
  update public.decisoes_gerenciais
     set status = 'pendente', decidido_por = null, decidido_em = null, motivo = null,
         aprovadores_esperados = array['outro@verticalparts.com.br', 'r3.editor@verticalparts.com.br']
   where id = v_dec_ok;

  -- Em ambientes que não exibem NOTICE (ex.: chamadas via API), troque o comentário abaixo
  -- por `raise exception 'R3_TESTES_OK';` para forçar o rollback e confirmar o término com sucesso.
end $$;

rollback;
