-- 25/10/2026 — achado do Codex no PR #1091: dossier_obra tem políticas abertas (update_anon/escrita_anon), então quem
-- não tem a alçada mapa-obras.pausar poderia gravar pausada_ate direto na tabela (sem motivo, sem histórico, sem limite de 60 dias).
-- Agora as colunas de pausa só mudam dentro de evolucao_pausar_obra: ela liga a marca local vp.pausa_ok (vale só na transação),
-- e o gatilho abaixo recusa qualquer outra escrita nessas colunas. O resto do dossiê continua editável como sempre.
create or replace function public.dossier_obra_protege_pausa() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('vp.pausa_ok', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    if new.pausada_ate is not null or new.pausa_motivo is not null or new.pausa_por is not null or new.pausa_em is not null then
      raise exception 'A pausa da obra só pode ser gravada pela função evolucao_pausar_obra.';
    end if;
  elsif new.pausada_ate is distinct from old.pausada_ate or new.pausa_motivo is distinct from old.pausa_motivo
     or new.pausa_por is distinct from old.pausa_por or new.pausa_em is distinct from old.pausa_em then
    raise exception 'A pausa da obra só pode ser alterada pela função evolucao_pausar_obra.';
  end if;
  return new;
end $$;

drop trigger if exists trg_dossier_obra_protege_pausa on public.dossier_obra;
create trigger trg_dossier_obra_protege_pausa before insert or update on public.dossier_obra
  for each row execute function public.dossier_obra_protege_pausa();

create or replace function public.evolucao_pausar_obra(p_dossier text, p_ate date, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $f$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if not public.vp_tem_capacidade('mapa-obras', 'pausar') then raise exception 'Sem permissão para pausar obra (alçada mapa-obras.pausar).'; end if;
  perform set_config('vp.pausa_ok', '1', true);
  if p_ate is null then
    update dossier_obra set pausada_ate = null, pausa_motivo = null, pausa_por = null, pausa_em = null where id::text = p_dossier;
    update dossier_obra_pausas set cancelada_em = now() where dossier_id = p_dossier and cancelada_em is null;
    return jsonb_build_object('ok', true, 'pausa', null);
  end if;
  if length(v_motivo) < 10 then raise exception 'Informe o motivo da pausa (mínimo 10 letras).'; end if;
  if p_ate < v_hoje or p_ate > v_hoje + 60 then raise exception 'A pausa vai de hoje até no máximo 60 dias (até %).', v_hoje + 60; end if;
  update dossier_obra set pausada_ate = p_ate, pausa_motivo = v_motivo, pausa_por = public.vp_email(), pausa_em = now() where id::text = p_dossier;
  if not found then raise exception 'Obra não encontrada.'; end if;
  insert into dossier_obra_pausas (dossier_id, pausada_ate, motivo) values (p_dossier, p_ate, v_motivo);
  return jsonb_build_object('ok', true, 'pausa', p_ate);
end $f$;
revoke all on function public.evolucao_pausar_obra(text, date, text) from public, anon;
grant execute on function public.evolucao_pausar_obra(text, date, text) to authenticated;
