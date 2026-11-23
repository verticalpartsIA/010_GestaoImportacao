-- NÃO EXECUTÁVEL NO BRANCH MÍNIMO (`teste-r3`)
-- Motivo: exercita RPCs `SECURITY DEFINER` (`public_proposta_*`) e triggers reais de produção
-- (`trg_propostas_vigencia`, `trg_avais_abrir_na_proposta`, `propostas_guarda_exclusao`, `vp_valores_guarda`)
-- que dependem de tabelas fora do esquema mínimo.
-- Executar somente em ambiente completo (ou pós-aplicação com rollback).

begin;

do $$
declare
  v_id uuid;
  v_tok text := 'tok_r3c_int_' || replace(gen_random_uuid()::text, '-', '');
  v_res jsonb;
begin
  -- Cria proposta enviada como postgres/service_role (ou authenticated antes do envio)
  insert into public.propostas (id, titulo, status, token, data_json)
    values (gen_random_uuid(), 'Integração R3C', 'enviada', v_tok, '{"cliente":{"nome":"Cliente Int"}}'::jsonb)
    returning id into v_id;

  -- Simula página pública (/assinar/:token) via anon chamando as RPCs SECURITY DEFINER:
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';

  v_res := public.public_proposta_obter(v_tok);
  if v_res is null or (v_res->>'id')::uuid <> v_id then
    raise exception 'FALHA: public_proposta_obter não retornou a proposta';
  end if;

  v_res := public.public_proposta_visualizada(v_tok, '{"viewUa":"test","viewDevice":"desktop","viewIp":"127.0.0.1"}'::jsonb);
  if coalesce((v_res->>'ok')::boolean, false) is not true then
    raise exception 'FALHA: public_proposta_visualizada falhou: %', v_res;
  end if;

  v_res := public.public_proposta_assinar(
    v_tok,
    '{"signUa":"test","signDevice":"desktop","signIp":"127.0.0.1","signerName":"Teste R3C","signatureType":"drawn","signatureData":"data:image/png;base64,AA==","hash":"h"}'::jsonb,
    null
  );
  if coalesce((v_res->>'ok')::boolean, false) is not true then
    raise exception 'FALHA: public_proposta_assinar falhou: %', v_res;
  end if;

  execute 'reset role';
end $$;

rollback;
