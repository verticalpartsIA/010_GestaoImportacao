-- Paraguaçu 26936A (Elevador Salvador) -> DOS-M043, indicado pelo usuário (27/10/2026).
-- Já aplicado em produção; arquivo mantém o repositório em sincronia.
insert into public.omie_pagamentos_vinculo_manual (codigo_lancamento_omie, dossier_id, motivo) values
  (9224258934,'DOS-M043','Paraguaçu 26936A - Elevador Salvador (indicado pelo usuário)')
on conflict (codigo_lancamento_omie) do update set dossier_id = excluded.dossier_id, motivo = excluded.motivo;

update public.omie_pagamentos_cache set dossier_id = 'DOS-M043' where codigo_lancamento_omie = 9224258934;
