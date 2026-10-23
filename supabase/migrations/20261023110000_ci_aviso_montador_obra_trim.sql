-- Aviso ao montador: o nome da obra vem com espaços no fim em alguns contratos; tira antes de ir ao texto do WhatsApp.
do $do$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = '_ci_disparar';
  if position('nullif(public._ci_obra(c), '''')' in def) = 0 then raise exception 'ancora obra nao encontrada'; end if;
  def := replace(def, 'nullif(public._ci_obra(c), '''')', 'nullif(trim(public._ci_obra(c)), '''')');
  execute def;
end $do$;
