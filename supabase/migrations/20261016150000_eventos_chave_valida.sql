-- 16/10/2026: a Central de Eventos só aceita idempotency_key com letras, números e . : _ - (até 200).
-- Avisos cujo id tem e-mail (dec_nova_<id>_<email>, com "@") eram recusados para sempre
-- ("envelope_invalido"). A chave passa a ser limpa na origem; chave longa ganha resumo md5.
create or replace function public._evt_chave(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when length(k) <= 200 then k
    else left(k, 167) || ':' || md5(p)
  end
  from (select regexp_replace(coalesce(p, ''), '[^A-Za-z0-9_.:-]', '_', 'g') as k) s
$$;
revoke execute on function public._evt_chave(text) from public, anon, authenticated;

create or replace function public.evento_enfileirar(p_tipo text, p_key text, p_ent_tipo text, p_ent_id text, p_ent_num text, p_payload jsonb, p_ator jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into eventos_outbox (tipo, idempotency_key, ator, entidade, payload)
  values (p_tipo, _evt_chave(p_key), p_ator, jsonb_build_object('tipo', p_ent_tipo, 'id', p_ent_id, 'numero', p_ent_num), coalesce(p_payload, '{}'::jsonb))
  on conflict (idempotency_key) do nothing;
exception when others then null;
end $$;

-- Itens já presos na fila: limpa a chave e devolve à fila sem esperar o próximo intervalo.
update public.eventos_outbox
   set idempotency_key = public._evt_chave(idempotency_key),
       tentativas = 0, proximo_em = now(), ultimo_erro = null
 where status in ('pendente', 'falha')
   and idempotency_key !~ '^[A-Za-z0-9_.:-]{1,200}$'
   and ultimo_erro like 'envelope_invalido%';
