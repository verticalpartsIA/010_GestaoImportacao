-- PCP · códigos antigos dos quadros de comando (pedidos antigos do Omie ainda usam VPB-xxx).
-- Fonte: aba "Tabela Cód Atual" da planilha QUADROS DE COMANDO - VP.
create table if not exists public.pcp_codigo_alias (
  codigo_antigo text primary key,
  codigo_atual text not null,
  observacao text
);
insert into public.pcp_codigo_alias (codigo_antigo, codigo_atual, observacao) values
 ('VPB-377', 'VPEL-710a', 'Sistema de comando MA 15KW/220V'),
 ('VPB-376', 'VPEL-709b', 'Sistema de comando MS 30KW/380V'),
 ('VPB-089', 'VPEL-702b', 'Sistema de comando MS 4,0KW/220V'),
 ('VPB-088', 'VPEL-702b', 'Sistema de comando MA 4,0KW/220V'),
 ('VPB-094', 'VPEL-704b', 'Sistema de comando MA 15KW/380V')
on conflict (codigo_antigo) do nothing;
alter table public.pcp_codigo_alias enable row level security;
create policy "pcp_codigo_alias_leitura" on public.pcp_codigo_alias for select using (true);
alter table public.pcp_pedido_itens add column if not exists codigo_original text;
