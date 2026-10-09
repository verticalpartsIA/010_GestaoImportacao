-- PCP · etapa 3 (PCP → Omie): a fila passa a aceitar estrutura (BOM), cadastro do produto e estoque mínimo.
alter table public.pcp_omie_fila drop constraint if exists pcp_omie_fila_tipo_check;
alter table public.pcp_omie_fila add constraint pcp_omie_fila_tipo_check
  check (tipo in ('requisicao_compra', 'ajuste_estoque', 'estrutura', 'cadastro_produto', 'estoque_minimo'));
