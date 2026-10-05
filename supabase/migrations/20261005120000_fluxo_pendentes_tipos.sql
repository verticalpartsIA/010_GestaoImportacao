-- Segurança real (#571) · Fase 3 — a fila só entrega ao navegador os tipos que ele SABE executar (05/10/2026).
-- Achado no teste da Task 11: um navegador com a versão antiga do app (cache) reivindicava itens de tipo novo, não sabia executá-los
-- e os marcava como "falhou" para sempre. Agora o chamador informa os tipos que conhece (p_tipos); quem não informa (versão antiga)
-- só recebe os tipos `proposta_%`, que era tudo o que existia quando aquela versão foi escrita.
drop function if exists public.fluxo_pendentes_reivindicar(integer);

create or replace function public.fluxo_pendentes_reivindicar(p_max integer default 5, p_tipos text[] default null) returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  return query
  with pegos as (
    select id from fluxo_pendentes
     where (status = 'pendente' or (status = 'processando' and reivindicado_em < now() - interval '5 minutes'))
       and tentativas < 5
       and (case when p_tipos is null then tipo like 'proposta\_%' else tipo = any(p_tipos) end)
     order by id limit greatest(1, least(coalesce(p_max, 5), 20)) for update skip locked
  ), upd as (
    update fluxo_pendentes f set status = 'processando', reivindicado_em = now(), tentativas = f.tentativas + 1
      from pegos where f.id = pegos.id returning f.*
  )
  select jsonb_build_object('id', id, 'tipo', tipo, 'proposta_id', proposta_id, 'numero_cotacao', numero_cotacao, 'payload', payload, 'tentativas', tentativas) from upd;
end $$;

revoke execute on function public.fluxo_pendentes_reivindicar(integer, text[]) from public;
grant execute on function public.fluxo_pendentes_reivindicar(integer, text[]) to anon, authenticated;
