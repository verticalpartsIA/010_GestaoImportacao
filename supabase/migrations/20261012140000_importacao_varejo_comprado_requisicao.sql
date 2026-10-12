-- Importação Varejo (#843 A2): a Requisição de Compra enviada ao Omie passa a ficar registrada em
-- importacao_varejo_comprado, para a sugestão de compra abater o que já foi pedido (sem reenvio).
alter table public.importacao_varejo_comprado
  add column if not exists requisicao_omie bigint,
  add column if not exists origem text not null default 'manual';

alter table public.importacao_varejo_comprado
  drop constraint if exists importacao_varejo_comprado_origem_check;
alter table public.importacao_varejo_comprado
  add constraint importacao_varejo_comprado_origem_check check (origem in ('manual', 'requisicao'));

notify pgrst, 'reload schema';
