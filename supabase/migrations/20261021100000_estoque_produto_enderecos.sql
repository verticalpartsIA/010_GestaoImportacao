-- VP Estoque · um produto, vários endereços (21/10/2026).
-- Decisão do Gelson: produto grande ocupa mais de um porta-palete (R2I8 / R2H8) e produto pequeno vai em caixa bin nas
-- prateleiras do MEZANINO (letra B–I + número 1–30, ex.: H23 / H24 / H25). Um mesmo produto pode ter os dois tipos.
-- O texto em importacao_varejo_contagem.endereco continua sendo o dado que todas as telas gravam e leem (e que o gatilho
-- iv_contagem_espelha_endereco copia para pcp_produtos.endereco): "R2I8 / R2H8 / H23". Esta migration só acrescenta a
-- tabela estruturada, DERIVADA desse texto — para responder "o que está no R2I8?" e "onde está o produto X?" sem ler texto.
-- Nada é apagado: o texto antigo de cada produto é copiado para estoque_enderecos_backup_20261021 antes de qualquer carga.

-- 0) Cópia de segurança dos endereços como estavam (rodar só uma vez: a tabela não é recriada se já existe).
create table if not exists public.estoque_enderecos_backup_20261021 as
  select codigo, endereco, atualizado_em, atualizado_por from public.importacao_varejo_contagem;
alter table public.estoque_enderecos_backup_20261021 enable row level security;
revoke all on public.estoque_enderecos_backup_20261021 from anon, authenticated;
grant all on public.estoque_enderecos_backup_20261021 to service_role;

-- 1) Endereços do produto (um registro por posição).
create table if not exists public.estoque_produto_enderecos (
  codigo text not null,                       -- código do produto, em maiúsculas (igual a importacao_varejo_contagem.codigo)
  endereco text not null,                     -- 'R2I8' | 'H23' | 'EXP' | texto antigo que não bate com o galpão
  tipo text not null check (tipo in ('porta_palete', 'prateleira', 'expedicao', 'legado')),
  ordem smallint not null,                    -- ordem em que aparece no texto do produto
  atualizado_em timestamptz not null default now(),
  primary key (codigo, endereco)
);
comment on column public.estoque_produto_enderecos.tipo is
  'porta_palete = posição R<rua><vão><nível> que existe em estoque_enderecos; prateleira = caixa bin no mezanino (B–I + 01–30); expedicao = EXP; legado = texto antigo que não bate com nenhuma regra (ex.: "R01 05"), mantido para ninguém perder o dado.';
create index if not exists estoque_produto_enderecos_end_idx on public.estoque_produto_enderecos (endereco);

alter table public.estoque_produto_enderecos enable row level security;
revoke all on public.estoque_produto_enderecos from anon, authenticated;
grant select on public.estoque_produto_enderecos to authenticated;
grant all on public.estoque_produto_enderecos to service_role;
drop policy if exists estoque_prod_end_sel on public.estoque_produto_enderecos;
create policy estoque_prod_end_sel on public.estoque_produto_enderecos for select to authenticated
  using ((select public.vp_usuario_ativo()));
-- escrita só pelo gatilho (security definer) e pelo service_role: a tela grava o texto, nunca esta tabela.

-- 2) Interpreta o texto do endereço. Separadores: "/", "," e ";". Espaços dentro de cada pedaço são ignorados.
--    Prateleira sai sempre com 2 dígitos (G9 → G09), igual à planilha do almoxarifado.
create or replace function public.estoque_enderecos_parse(p_texto text)
returns table (endereco text, tipo text, ordem int)
language sql stable security definer set search_path = public as $$
  with t as (
    select upper(regexp_replace(btrim(x), '\s+', '', 'g')) as tk, n
    from unnest(regexp_split_to_array(coalesce(p_texto, ''), '[/,;]+')) with ordinality as u(x, n)
  ), c as (
    select
      case when tk ~ '^[B-I](0?[1-9]|[12][0-9]|30)$'
           then substr(tk, 1, 1) || lpad(substr(tk, 2), 2, '0') else tk end as ed,
      n, tk
    from t where tk <> ''
  ), k as (
    select ed, n,
      case
        when ed = 'EXP' then 'expedicao'
        when exists (select 1 from public.estoque_enderecos e where e.codigo = ed and e.ativo and e.tipo = 'posicao') then 'porta_palete'
        when ed ~ '^[B-I](0[1-9]|[12][0-9]|30)$' then 'prateleira'
        else 'legado'
      end as tp
    from c
  )
  select ed, tp, (row_number() over (order by min_n))::int
  from (select ed, tp, min(n) as min_n from k group by ed, tp) z
  order by min_n;
$$;
revoke all on function public.estoque_enderecos_parse(text) from public, anon, authenticated;
grant execute on function public.estoque_enderecos_parse(text) to service_role;

-- 3) Mantém a tabela em dia sempre que o texto do endereço do produto muda.
create or replace function public.iv_contagem_sincroniza_enderecos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.estoque_produto_enderecos where codigo = upper(new.codigo);
  insert into public.estoque_produto_enderecos (codigo, endereco, tipo, ordem)
  select upper(new.codigo), p.endereco, p.tipo, p.ordem from public.estoque_enderecos_parse(new.endereco) p
  on conflict (codigo, endereco) do nothing;
  return new;
exception when others then
  return new;   -- a tabela derivada nunca pode impedir a contagem/endereço de ser gravado
end $$;
revoke all on function public.iv_contagem_sincroniza_enderecos() from public, anon, authenticated;

drop trigger if exists trg_iv_contagem_sincroniza_enderecos on public.importacao_varejo_contagem;
create trigger trg_iv_contagem_sincroniza_enderecos
  after insert or update of endereco on public.importacao_varejo_contagem
  for each row execute function public.iv_contagem_sincroniza_enderecos();

-- 4) Carga inicial a partir do texto que já existe (idempotente).
insert into public.estoque_produto_enderecos (codigo, endereco, tipo, ordem)
select upper(c.codigo), p.endereco, p.tipo, p.ordem
from public.importacao_varejo_contagem c
cross join lateral public.estoque_enderecos_parse(c.endereco) p
where coalesce(btrim(c.endereco), '') <> ''
on conflict (codigo, endereco) do nothing;
