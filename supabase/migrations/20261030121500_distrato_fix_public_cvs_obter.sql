-- Fix: public_cvs_obter ficou de fora da extensão aditiva pro distrato na migration
-- anterior (20261030120000_distrato_contrato_instalador.sql). Sem isso, a fila
-- (Diego/Juliana/Maurício) resolve o token certo mas não enxerga os dados do
-- distrato-pai (documento_signatarios.__contratoPai vem desta função). Mesma
-- extensão já feita em public_cvs_visualizado/_assinar/_recusar.
create or replace function public.public_cvs_obter(p_token text)
 returns jsonb language plpgsql security definer set search_path = 'public' as $function$
declare s1 contrato_venda_signatarios%rowtype; s2 documento_signatarios%rowtype; c contratos_venda_equipamentos%rowtype; ci contratos_instalador%rowtype; di contratos_instalador_distratos%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into s1 from contrato_venda_signatarios where token = p_token;
  if found then
    select * into c from contratos_venda_equipamentos where id = s1.contrato_venda_id;
    return jsonb_build_object('origem', 'cvs', 'sig', to_jsonb(s1),
      'contrato', case when c.id is null then null else to_jsonb(c) - 'token' - 'log' - 'recipient' end);
  end if;
  select * into s2 from documento_signatarios where token = p_token;
  if found then
    if s2.documento_tipo = 'contrato_venda' then select * into c from contratos_venda_equipamentos where id = s2.documento_id; end if;
    if s2.documento_tipo = 'contrato_instalador' then select * into ci from contratos_instalador where id = s2.documento_id::uuid; end if;
    if s2.documento_tipo = 'distrato_instalador' then select * into di from contratos_instalador_distratos where id = s2.documento_id::uuid; end if;
    return jsonb_build_object('origem', 'doc', 'sig', to_jsonb(s2),
      'contrato', case when c.id is not null then to_jsonb(c) - 'token' - 'log' - 'recipient'
                       when ci.id is not null then to_jsonb(ci) - 'token' - 'log' - 'recipient'
                       when di.id is not null then to_jsonb(di) - 'token' - 'log' else null end);
  end if;
  return null;
end $function$;
notify pgrst, 'reload schema';
