-- Q-11 (24/10/2026): "Proposta pronta" não tem prazo. Etapas abertas criadas antes já tinham prazo_em gravado (24h);
-- sem limpar, seguiriam atrasadas na tela e no aviso diário. (Aplicado em produção em 24/10/2026: 18 linhas.)
update public.gatilhos
   set prazo_em = null, due_date = null
 where evento_key = 'PROPOSTA_PREP' and concluido_em is null and coalesce(status, '') <> 'encerrado' and prazo_em is not null;
