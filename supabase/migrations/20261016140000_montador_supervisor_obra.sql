-- 16/10/2026 (Gelson): "Montador entra na obra" é decisão do SUPERVISOR DE OBRA (Maurício), não do RH.
-- O RH (Karla) fica para a homologação/documentação do montador — etapa futura.
-- 1) Texto do aviso automático passa a dizer "Supervisor de Obra".
do $$
declare def text;
begin
  select pg_get_functiondef('public.decisoes_alertar_aprovadores()'::regprocedure) into def;
  if position('aprovação da Engenharia' in def) > 0 then
    execute replace(def, 'Montador entra na obra — aprovação da Engenharia', 'Montador entra na obra — aprovação do Supervisor de Obra');
  end if;
end $$;

-- 2) Decisões pendentes do montador: papel supervisor_obra, aprovador Maurício.
update public.decisoes_gerenciais
   set papel_requerido = 'supervisor_obra',
       aprovadores_esperados = array['mauricio.araujo@verticalparts.com.br'],
       aprovador_esperado_email = 'mauricio.araujo@verticalparts.com.br'
 where tipo = 'montador_entra_obra_rh' and status = 'pendente';

-- 3) Avisos: os da Karla viram do Maurício (reativa os antigos dele), texto novo.
update public.alertas
   set resolved = false, created_at = now(),
       sub = replace(sub, 'aprovação da Engenharia', 'aprovação do Supervisor de Obra')
 where id like 'dec_nova_%_mauricio.araujo@verticalparts.com.br'
   and substring(id from 'dec_nova_(.*)_mauricio') in
       (select id::text from public.decisoes_gerenciais where tipo = 'montador_entra_obra_rh' and status = 'pendente');
update public.alertas set resolved = true
 where id like 'dec_nova_%_karla.silva@verticalparts.com.br'
   and substring(id from 'dec_nova_(.*)_karla') in
       (select id::text from public.decisoes_gerenciais where tipo = 'montador_entra_obra_rh');
