-- Revisão Codex (#1072): o id do aviso "Contrato assinado pelo montador" passa a incluir a revisão do contrato,
-- para que uma nova revisão assinada de novo gere novos avisos (antes o ON CONFLICT DO NOTHING os engolia).
do $do$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = '_ci_efeitos';
  if position('''ci-assinado-'' || c.id || ''-'' || e' in def) = 0 then raise exception 'ancora id nao encontrada'; end if;
  def := replace(def, '''ci-assinado-'' || c.id || ''-'' || e', '''ci-assinado-'' || c.id || ''-r'' || coalesce(c.revisao, 1) || ''-'' || e');
  execute def;
end $do$;
