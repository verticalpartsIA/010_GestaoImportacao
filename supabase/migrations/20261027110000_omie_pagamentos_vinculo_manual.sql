-- Vínculo manual título Omie -> obra (dossier_obra), à prova do sync diário.
-- A Edge Function omie_sync_pagamentos_instaladores regrava dossier_id a cada rodada
-- (null quando a regra automática não acha obra). Este gatilho reaplica o vínculo manual.
create table if not exists public.omie_pagamentos_vinculo_manual (
  codigo_lancamento_omie bigint primary key,
  dossier_id text not null,
  motivo text,
  criado_em timestamptz not null default now()
);
alter table public.omie_pagamentos_vinculo_manual enable row level security;
-- sem políticas: só service_role / funções SECURITY DEFINER leem e gravam.

create or replace function public.omie_pagamentos_aplicar_vinculo_manual()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.dossier_id is null then
    select v.dossier_id into new.dossier_id
    from public.omie_pagamentos_vinculo_manual v
    where v.codigo_lancamento_omie = new.codigo_lancamento_omie;
  end if;
  return new;
end $$;

create trigger trg_omie_pagamentos_vinculo_manual
  before insert or update on public.omie_pagamentos_cache
  for each row execute function public.omie_pagamentos_aplicar_vinculo_manual();

-- Paraguaçu 25268D (Omie: "Elevador N" -> série 0372/0373/0374/0380, pela ordem) e Urban 23154D (Nº doc = série)
insert into public.omie_pagamentos_vinculo_manual (codigo_lancamento_omie, dossier_id, motivo) values
  (9208190852,'DOS-M035','Paraguaçu 25268D - Elevador 1'),(9208190956,'DOS-M035','Paraguaçu 25268D - Elevador 1'),(9208190957,'DOS-M035','Paraguaçu 25268D - Elevador 1'),
  (9208191455,'DOS-M036','Paraguaçu 25268D - Elevador 2'),(9208192062,'DOS-M036','Paraguaçu 25268D - Elevador 2'),(9208192063,'DOS-M036','Paraguaçu 25268D - Elevador 2'),
  (9208192392,'DOS-M037','Paraguaçu 25268D - Elevador 3'),(9208192533,'DOS-M037','Paraguaçu 25268D - Elevador 3'),(9208192534,'DOS-M037','Paraguaçu 25268D - Elevador 3'),
  (9209881362,'DOS-M043','Paraguaçu 25268D - Elevador 4 (750kg)'),(9209881461,'DOS-M043','Paraguaçu 25268D - Elevador 4 (750kg)'),(9209881462,'DOS-M043','Paraguaçu 25268D - Elevador 4 (750kg)'),
  (9236226115,'DOS-M009','Urban 23154D - série 500.0333'),(9236226169,'DOS-M009','Urban 23154D - série 500.0333'),(9236226170,'DOS-M009','Urban 23154D - série 500.0333'),(9236226171,'DOS-M009','Urban 23154D - série 500.0333'),
  (9236226295,'DOS-M010','Urban 23154D - série 500.0334'),(9236226455,'DOS-M010','Urban 23154D - série 500.0334'),(9236226456,'DOS-M010','Urban 23154D - série 500.0334'),(9236226458,'DOS-M010','Urban 23154D - série 500.0334')
on conflict (codigo_lancamento_omie) do nothing;

-- aplica nos títulos que já estão no cache
update public.omie_pagamentos_cache c
   set dossier_id = v.dossier_id
  from public.omie_pagamentos_vinculo_manual v
 where v.codigo_lancamento_omie = c.codigo_lancamento_omie
   and c.dossier_id is null;
