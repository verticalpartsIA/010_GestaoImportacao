-- Catálogo de Modelos de Elevador — ao escolher o Modelo (VP-200, VPY,
-- VP-004, VP-301, VP-V), o Formulário de Elevadores passa a oferecer só as
-- opções de acessório realmente compatíveis com aquele modelo (Teto Falso,
-- Piso da Cabine, Porta, Botoeira de Cabine, Botoeira de Pavimento), lidas
-- do catálogo real da VerticalParts. Ver conversa/issue de acompanhamento.

create table if not exists public.elevador_modelos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('Passageiro','Carga','Hospitalar','Panorâmico','Home Lift')),
  cabine_descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.elevador_opcoes (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('teto_falso','piso','porta','botoeira_cabine','botoeira_pavimento')),
  codigo text not null,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (categoria, codigo)
);

create table if not exists public.elevador_modelo_opcoes (
  modelo_id uuid not null references public.elevador_modelos(id) on delete cascade,
  opcao_id uuid not null references public.elevador_opcoes(id) on delete cascade,
  primary key (modelo_id, opcao_id)
);

alter table public.elevador_modelos enable row level security;
drop policy if exists elevador_modelos_all_anon on public.elevador_modelos;
create policy elevador_modelos_all_anon on public.elevador_modelos for all to anon using (true) with check (true);
drop policy if exists elevador_modelos_all_auth on public.elevador_modelos;
create policy elevador_modelos_all_auth on public.elevador_modelos for all to authenticated using (true) with check (true);

alter table public.elevador_opcoes enable row level security;
drop policy if exists elevador_opcoes_all_anon on public.elevador_opcoes;
create policy elevador_opcoes_all_anon on public.elevador_opcoes for all to anon using (true) with check (true);
drop policy if exists elevador_opcoes_all_auth on public.elevador_opcoes;
create policy elevador_opcoes_all_auth on public.elevador_opcoes for all to authenticated using (true) with check (true);

alter table public.elevador_modelo_opcoes enable row level security;
drop policy if exists elevador_modelo_opcoes_all_anon on public.elevador_modelo_opcoes;
create policy elevador_modelo_opcoes_all_anon on public.elevador_modelo_opcoes for all to anon using (true) with check (true);
drop policy if exists elevador_modelo_opcoes_all_auth on public.elevador_modelo_opcoes;
create policy elevador_modelo_opcoes_all_auth on public.elevador_modelo_opcoes for all to authenticated using (true) with check (true);

-- Novos campos na Unidade — Teto Falso, Modelo de Porta e as 2 Botoeiras
-- (COP/LOP) deixam de ser texto livre em "Opcionais" e viram catálogo.
-- Piso reaproveita a coluna `piso_cabina` já existente (passa a guardar o
-- código da opção escolhida em vez de texto livre).
alter table public.formularios_elevador_unidades
  add column if not exists modelo text,
  add column if not exists teto_falso text,
  add column if not exists porta_modelo text,
  add column if not exists botoeira_cabine text,
  add column if not exists botoeira_pavimento text;

-- ============================================================
-- Seed — extraído do catálogo real "Modelos de Elevadores VerticalParts"
-- ============================================================

insert into public.elevador_modelos (codigo, nome, tipo, cabine_descricao) values
  ('VP-200', 'Elevador de Passageiros', 'Passageiro', 'Aço Inox Escovado'),
  ('VPY',    'Elevador Maca/Leito Hospital', 'Hospitalar', 'Aço Inox Escovado'),
  ('VP-004', 'Elevador Panorâmico', 'Panorâmico', 'Aço Inox Escovado e Vidro'),
  ('VP-301', 'Elevador Cargueiro', 'Carga', 'Aço Pintado'),
  ('VP-V',   'Elevador Homelift / Acessibilidade', 'Home Lift', 'Aço Inox Escovado')
on conflict (codigo) do nothing;

insert into public.elevador_opcoes (categoria, codigo, nome) values
  -- Teto Falso
  ('teto_falso', 'SUB-001', 'Aço Inox Escovado e Led'),
  ('teto_falso', 'SUB-230', 'Aço Inox Escovado e Led (variante dourada)'),
  ('teto_falso', 'VPV-TETO-ACRILICO', 'Teto Acrílico em Led'),
  ('teto_falso', 'VPV-TETO-INOX', 'Teto Inox em Led'),
  -- Piso da Cabine
  ('piso', 'PS-102', 'PVC Cinza'),
  ('piso', 'PS-034', 'Mármore Resinado — padrão PS-034'),
  ('piso', 'PS-035', 'Mármore Resinado — padrão PS-035'),
  ('piso', 'PS-036', 'Mármore Resinado — padrão PS-036'),
  ('piso', 'PS-037', 'Mármore Resinado — padrão PS-037'),
  ('piso', 'PS-201', 'Aço Xadrez'),
  ('piso', 'CLIENTE', 'A ser instalado pelo cliente'),
  ('piso', 'REBAIXO', 'Com rebaixo (sem piso de fábrica)'),
  -- Porta
  ('porta', 'P-01', 'Aço Inox Escovado'),
  ('porta', 'P-100', 'Aço Inox Escovado (variante)'),
  ('porta', 'P-01-VIDRO', 'Aço Inox Escovado / Vidro'),
  ('porta', 'P-301', 'Aço Pintado'),
  -- Botoeira de Cabine (COP)
  ('botoeira_cabine', 'COP-05C', 'Totem em Aço Inox Escovado c/ IPD'),
  ('botoeira_cabine', 'COP-5TFT10', 'Totem em Aço Inox Escovado c/ IPD — TFT 10"'),
  ('botoeira_cabine', 'COP-004C', 'Aço Inox Escovado c/ IPD'),
  ('botoeira_cabine', 'COP-17TFT10', 'Totem em Aço Inox Escovado c/ TFT 10"'),
  ('botoeira_cabine', 'COP-29', 'Botoeira "Touch" (Homelift)'),
  ('botoeira_cabine', 'COP-26', 'Botoeira "Touch" (Homelift)'),
  ('botoeira_cabine', 'COP-27', 'Botoeira "Touch" (Homelift)'),
  -- Botoeira de Pavimento (LOP)
  ('botoeira_pavimento', 'LOP-12C', 'Aço Inox Escovado c/ IPD'),
  ('botoeira_pavimento', 'LOP-M7', 'Vidro branco c/ IPD Vermelho'),
  ('botoeira_pavimento', 'LOP-35', 'Botoeira "Touch" (Homelift)'),
  ('botoeira_pavimento', 'LOP-36', 'Botoeira "Touch" (Homelift)'),
  ('botoeira_pavimento', 'LOP-41', 'Botoeira "Touch" (Homelift)')
on conflict (categoria, codigo) do nothing;

-- Vínculos modelo → opções compatíveis
insert into public.elevador_modelo_opcoes (modelo_id, opcao_id)
select m.id, o.id from public.elevador_modelos m, public.elevador_opcoes o
where
  (m.codigo = 'VP-200' and (
    (o.categoria = 'teto_falso' and o.codigo in ('SUB-001','SUB-230')) or
    (o.categoria = 'piso' and o.codigo in ('PS-102','PS-034','PS-035','PS-036','PS-037','CLIENTE')) or
    (o.categoria = 'porta' and o.codigo = 'P-01') or
    (o.categoria = 'botoeira_cabine' and o.codigo in ('COP-05C','COP-5TFT10')) or
    (o.categoria = 'botoeira_pavimento' and o.codigo in ('LOP-12C','LOP-M7'))
  ))
  or
  (m.codigo = 'VPY' and (
    (o.categoria = 'teto_falso' and o.codigo = 'SUB-001') or
    (o.categoria = 'piso' and o.codigo in ('PS-102','PS-034','PS-035','PS-036','PS-037')) or
    (o.categoria = 'porta' and o.codigo in ('P-01','P-100')) or
    (o.categoria = 'botoeira_cabine' and o.codigo in ('COP-05C','COP-5TFT10')) or
    (o.categoria = 'botoeira_pavimento' and o.codigo = 'LOP-12C')
  ))
  or
  (m.codigo = 'VP-004' and (
    (o.categoria = 'teto_falso' and o.codigo = 'SUB-001') or
    (o.categoria = 'piso' and o.codigo in ('PS-102','PS-034','PS-035','PS-036','PS-037')) or
    (o.categoria = 'porta' and o.codigo = 'P-01-VIDRO') or
    (o.categoria = 'botoeira_cabine' and o.codigo in ('COP-05C','COP-5TFT10')) or
    (o.categoria = 'botoeira_pavimento' and o.codigo = 'LOP-12C')
  ))
  or
  (m.codigo = 'VP-301' and (
    (o.categoria = 'piso' and o.codigo = 'PS-201') or
    (o.categoria = 'porta' and o.codigo = 'P-301') or
    (o.categoria = 'botoeira_cabine' and o.codigo = 'COP-004C') or
    (o.categoria = 'botoeira_pavimento' and o.codigo = 'LOP-12C')
  ))
  or
  (m.codigo = 'VP-V' and (
    (o.categoria = 'teto_falso' and o.codigo in ('VPV-TETO-ACRILICO','VPV-TETO-INOX')) or
    (o.categoria = 'piso' and o.codigo in ('PS-034','PS-035','PS-036','PS-037','REBAIXO')) or
    (o.categoria = 'porta' and o.codigo = 'P-01') or
    (o.categoria = 'botoeira_cabine' and o.codigo in ('COP-17TFT10','COP-29','COP-26','COP-27')) or
    (o.categoria = 'botoeira_pavimento' and o.codigo in ('LOP-12C','LOP-35','LOP-36','LOP-41'))
  ))
on conflict do nothing;
