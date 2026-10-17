-- VP Estoque · tabela de endereços do almoxarifado (hub). Decisão do Gelson em 17/10/2026:
--   4 ruas; Rua 1 e Rua 4 só com porta-palete à ESQUERDA; Ruas 2 e 3 com ESQUERDA e DIREITA;
--   cada lado com 10 vãos (A–J) e 4 níveis. Nível ÍMPAR = esquerda (1,3,5,7), PAR = direita (2,4,6,8).
--   Código = R<rua><vão><nível> (ex.: R2A4) e o QR da etiqueta é END:R2A4. O vão A de um lado fica de frente com o vão A do outro.
--   Total: 6 lados x 10 vãos x 4 níveis = 240 posições, mais o endereço único EXP (área de expedição: itens já separados
--   para um pedido de venda, aguardando a NF; sai do porta-palete no sistema sem baixar estoque).
-- Esta migration só cria a tabela, a validação e a carga das 240 posições. NÃO mexe em estoque_eventos nem nas funções existentes:
-- ligar a validação "o app recusa endereço que não existe" a estoque_registrar_eventos é um passo seguinte.
-- Tabela nasce FECHADA (RLS, sem acesso anon), conforme o plano da issue #571.

create table if not exists public.estoque_enderecos (
  codigo text primary key,                              -- 'R2A4' ou 'EXP'
  tipo text not null default 'posicao' check (tipo in ('posicao', 'expedicao')),
  rua smallint check (rua between 1 and 4),
  vao char(1) check (vao ~ '^[A-J]$'),
  nivel smallint check (nivel between 1 and 8),
  lado text generated always as (
    case when nivel is null then null when nivel % 2 = 1 then 'esquerda' else 'direita' end
  ) stored,
  ativo boolean not null default true,
  observacao text,
  criado_em timestamptz not null default now(),
  -- posição: precisa de rua, vão e nível, e o código tem que ser exatamente R<rua><vão><nível>
  -- expedição: sem rua/vão/nível, só o código EXP
  constraint estoque_enderecos_forma check (
    (tipo = 'posicao' and rua is not null and vao is not null and nivel is not null
       and codigo = 'R' || rua::text || vao || nivel::text
       -- Rua 1 e Rua 4 só têm lado esquerdo (níveis ímpares)
       and (rua in (2, 3) or nivel % 2 = 1))
    or
    (tipo = 'expedicao' and codigo = 'EXP' and rua is null and vao is null and nivel is null)
  )
);
create index if not exists estoque_enderecos_rua_idx on public.estoque_enderecos (rua, vao, nivel);

alter table public.estoque_enderecos enable row level security;
revoke all on public.estoque_enderecos from anon, authenticated;
grant select on public.estoque_enderecos to authenticated;
grant all on public.estoque_enderecos to service_role;
drop policy if exists estoque_end_sel on public.estoque_enderecos;
create policy estoque_end_sel on public.estoque_enderecos for select to authenticated
  using ((select public.vp_usuario_ativo()));
-- escrita: só administrador (ou service_role, que ignora RLS)
drop policy if exists estoque_end_adm on public.estoque_enderecos;
create policy estoque_end_adm on public.estoque_enderecos for all to authenticated
  using ((select public.vp_eh_admin())) with check ((select public.vp_eh_admin()));
grant insert, update, delete on public.estoque_enderecos to authenticated;   -- limitado pela política acima

-- Carga: 240 posições + EXP (idempotente)
insert into public.estoque_enderecos (codigo, tipo, rua, vao, nivel)
select 'R' || r || v || n, 'posicao', r, v, n
from generate_series(1, 4) as r,
     unnest(array['A','B','C','D','E','F','G','H','I','J']) as v,
     generate_series(1, 8) as n
where r in (2, 3) or n % 2 = 1
on conflict (codigo) do nothing;

insert into public.estoque_enderecos (codigo, tipo, observacao)
values ('EXP', 'expedicao', 'Área de expedição: itens separados aguardando a NF (sem baixa de estoque)')
on conflict (codigo) do nothing;

-- Normaliza e valida um texto lido do QR ('END:R2A4', ' r2a4 ', 'EXP'): devolve o código oficial ou NULL se não existe/está inativo.
-- A Edge Function do app chama isto (service_role) para recusar endereço inexistente.
create or replace function public.estoque_endereco_normalizar(p_texto text) returns text
language sql stable security definer set search_path = public as $$
  select e.codigo
  from public.estoque_enderecos e
  where e.ativo
    and e.codigo = upper(regexp_replace(regexp_replace(coalesce(p_texto, ''), '^\s*END:\s*', '', 'i'), '\s+', '', 'g'));
$$;
revoke all on function public.estoque_endereco_normalizar(text) from public, anon, authenticated;
grant execute on function public.estoque_endereco_normalizar(text) to service_role;
