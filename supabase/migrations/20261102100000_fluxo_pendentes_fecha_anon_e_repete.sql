-- Fila fluxo_pendentes: fecha o acesso da chave pública e deixa o erro passageiro voltar para a fila (02/11/2026).
-- Achados da revisão de código do módulo Geral:
--  P1-a) reivindicar/concluir estavam abertas a `anon`: quem tem a chave pública gastava as 5 tentativas de qualquer item,
--        lia o payload (nome de quem assinou, motivo da recusa) ou marcava item como concluído/falho.
--  P1-b) concluir com erro marcava `falhou` para sempre; o "até 5 tentativas" só valia para aba que travou no meio.
-- Quem processa a fila é só o sistema interno com sessão (fluxo-pendentes.js, `logado()`); a página pública /assinar só ENFILEIRA
-- pelas RPCs public_*, que não mudam.
-- Repetição segura: só quando o chamador diz que NADA foi executado (p_repetir). O EventosFluxo.registrar não é idempotente,
-- então erro depois de efeitos parciais continua `falhou` (decisão consciente, ver docs/modulos/01_geral.md PC-3).

drop function if exists public.fluxo_pendentes_reivindicar(integer, text[]);
drop function if exists public.fluxo_pendentes_reivindicar(integer);
drop function if exists public.fluxo_pendentes_concluir(bigint, text);

create or replace function public.fluxo_pendentes_reivindicar(p_max integer default 5, p_tipos text[] default null) returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then return; end if;
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

create or replace function public.fluxo_pendentes_concluir(p_id bigint, p_erro text default null, p_repetir boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then return; end if;
  update fluxo_pendentes
     set status = case
           when p_erro is null then 'concluido'
           when coalesce(p_repetir, false) and tentativas < 5 then 'pendente'
           else 'falhou' end,
         concluido_em = case when p_erro is not null and coalesce(p_repetir, false) and tentativas < 5 then null else now() end,
         erro = left(p_erro, 1000)
   where id = p_id and status = 'processando';
end $$;

revoke execute on function public.fluxo_pendentes_reivindicar(integer, text[]) from public, anon;
revoke execute on function public.fluxo_pendentes_concluir(bigint, text, boolean) from public, anon;
grant execute on function public.fluxo_pendentes_reivindicar(integer, text[]) to authenticated;
grant execute on function public.fluxo_pendentes_concluir(bigint, text, boolean) to authenticated;
