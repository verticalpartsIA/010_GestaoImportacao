/* ============================================================
   Cadastro de Custos — Atualização de Custos (Cadastros)
   3 tabelas de referência que alimentam a Precificação por herança:
   - custos_instalacao_elevador: tração × faixa de capacidade × paradas
     → dias de montagem + qtd. montadores + valor (R$). Seed a partir de
     "Tabela MO - 18032026 - Definitivo 2026 - Rev.1" (Arilene, 28/08).
   - custos_instalacao_escada_esteira: valor fixo por tipo, SP × Outros
     Estados (Outros Estados ainda sem valor — equipe preenche).
   - custos_containers: 20 tipos ISO com specs de referência fixas +
     campos comerciais (preço USD/R$, data cotação, fornecedor,
     observações) que a equipe de importação preenche a cada cotação.
   Mesmo padrão de RLS já usado em parametros_fiscais_elevador/clientes
   (app MVP interno, protegido por SSO no frontend, não por RLS).
   ============================================================ */

create table if not exists public.custos_instalacao_elevador (
  id uuid primary key default gen_random_uuid(),
  tracao text not null check (tracao in ('2:1','4:1')),
  capacidade_min_kg integer not null,
  capacidade_max_kg integer not null,
  paradas integer not null,
  dias_montagem integer,
  qtd_montadores integer,
  valor_reajustado_rs numeric(12,2) not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
create index if not exists idx_custos_instalacao_elevador_lookup
  on public.custos_instalacao_elevador (tracao, paradas, capacidade_min_kg, capacidade_max_kg)
  where ativo;

create table if not exists public.custos_instalacao_escada_esteira (
  id uuid primary key default gen_random_uuid(),
  tipo text not null unique check (tipo in ('escada_rolante','esteira_rolante')),
  valor_sao_paulo_rs numeric(12,2),
  valor_outros_estados_rs numeric(12,2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

create table if not exists public.custos_containers (
  id uuid primary key default gen_random_uuid(),
  tipo text not null unique,
  comprimento_m numeric(6,2),
  altura_desc text,
  capacidade_m3 numeric(6,2),
  preco_usd numeric(12,2),
  preco_rs numeric(12,2),
  data_cotacao date,
  fornecedor text,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

alter table public.custos_instalacao_elevador enable row level security;
alter table public.custos_instalacao_escada_esteira enable row level security;
alter table public.custos_containers enable row level security;

drop policy if exists custos_instalacao_elevador_all_anon on public.custos_instalacao_elevador;
create policy custos_instalacao_elevador_all_anon on public.custos_instalacao_elevador for all to anon using (true) with check (true);
drop policy if exists custos_instalacao_elevador_all_auth on public.custos_instalacao_elevador;
create policy custos_instalacao_elevador_all_auth on public.custos_instalacao_elevador for all to authenticated using (true) with check (true);

drop policy if exists custos_instalacao_escada_esteira_all_anon on public.custos_instalacao_escada_esteira;
create policy custos_instalacao_escada_esteira_all_anon on public.custos_instalacao_escada_esteira for all to anon using (true) with check (true);
drop policy if exists custos_instalacao_escada_esteira_all_auth on public.custos_instalacao_escada_esteira;
create policy custos_instalacao_escada_esteira_all_auth on public.custos_instalacao_escada_esteira for all to authenticated using (true) with check (true);

drop policy if exists custos_containers_all_anon on public.custos_containers;
create policy custos_containers_all_anon on public.custos_containers for all to anon using (true) with check (true);
drop policy if exists custos_containers_all_auth on public.custos_containers;
create policy custos_containers_all_auth on public.custos_containers for all to authenticated using (true) with check (true);

/* ---------- Seed: Instalação — Elevadores (Arilene, Tabela MO 2026 Rev.1) ---------- */
insert into public.custos_instalacao_elevador (tracao, capacidade_min_kg, capacidade_max_kg, paradas, dias_montagem, qtd_montadores, valor_reajustado_rs) values
  ('2:1', 400, 630, 2, 25, 2, 11000.00),
  ('2:1', 400, 630, 3, 25, 2, 11550.00),
  ('2:1', 400, 630, 4, 25, 2, 12100.00),
  ('2:1', 400, 630, 5, 25, 2, 13200.00),
  ('2:1', 400, 630, 6, 30, 2, 14850.00),
  ('2:1', 400, 630, 7, 30, 2, 16500.00),
  ('2:1', 400, 630, 8, 30, 2, 18150.00),
  ('2:1', 400, 630, 9, 30, 2, 19800.00),
  ('2:1', 400, 630, 10, 30, 2, 21450.00),
  ('2:1', 400, 630, 11, 35, 2, 23100.00),
  ('2:1', 400, 630, 12, 35, 2, 24750.00),
  ('2:1', 400, 630, 13, 35, 2, 26400.00),
  ('2:1', 400, 630, 14, 35, 2, 28050.00),
  ('2:1', 400, 630, 15, 35, 2, 29700.00),
  ('2:1', 400, 630, 16, 40, 3, 31350.00),
  ('2:1', 400, 630, 17, 40, 3, 33000.00),
  ('2:1', 400, 630, 18, 40, 3, 34650.00),
  ('2:1', 400, 630, 19, 40, 3, 36300.00),
  ('2:1', 400, 630, 20, 40, 3, 37950.00),
  ('2:1', 400, 630, 21, 45, 3, 39600.00),
  ('2:1', 400, 630, 22, 45, 3, 41250.00),
  ('2:1', 400, 630, 23, 45, 3, 42900.00),
  ('2:1', 400, 630, 24, 45, 3, 44550.00),
  ('2:1', 400, 630, 25, 45, 3, 46200.00),
  ('2:1', 400, 630, 26, 50, 3, 47850.00),
  ('2:1', 400, 630, 27, 50, 3, 49500.00),
  ('2:1', 400, 630, 28, 50, 3, 51150.00),
  ('2:1', 400, 630, 29, 50, 3, 52800.00),
  ('2:1', 400, 630, 30, 50, 3, 54450.00),
  ('2:1', 400, 630, 31, 55, 3, 56100.00),
  ('2:1', 400, 630, 32, 55, 3, 57750.00),
  ('2:1', 400, 630, 33, 55, 3, 59400.00),
  ('2:1', 400, 630, 34, 55, 3, 61050.00),
  ('2:1', 400, 630, 35, 55, 3, 62700.00),
  ('2:1', 400, 630, 36, 60, 3, 64350.00),
  ('2:1', 400, 630, 37, 60, 3, 66000.00),
  ('2:1', 400, 630, 38, 60, 3, 67650.00),
  ('2:1', 400, 630, 39, 60, 3, 69300.00),
  ('2:1', 400, 630, 40, 60, 3, 70950.00),
  ('2:1', 631, 1000, 2, 25, 2, 11550.00),
  ('2:1', 631, 1000, 3, 25, 2, 12100.00),
  ('2:1', 631, 1000, 4, 25, 2, 13200.00),
  ('2:1', 631, 1000, 5, 25, 2, 14850.00),
  ('2:1', 631, 1000, 6, 30, 2, 16500.00),
  ('2:1', 631, 1000, 7, 30, 2, 18150.00),
  ('2:1', 631, 1000, 8, 30, 2, 19800.00),
  ('2:1', 631, 1000, 9, 30, 2, 21450.00),
  ('2:1', 631, 1000, 10, 30, 2, 23100.00),
  ('2:1', 631, 1000, 11, 35, 2, 24750.00),
  ('2:1', 631, 1000, 12, 35, 2, 26400.00),
  ('2:1', 631, 1000, 13, 35, 2, 28050.00),
  ('2:1', 631, 1000, 14, 35, 2, 29700.00),
  ('2:1', 631, 1000, 15, 35, 2, 31350.00),
  ('2:1', 631, 1000, 16, 40, 3, 33000.00),
  ('2:1', 631, 1000, 17, 40, 3, 34650.00),
  ('2:1', 631, 1000, 18, 40, 3, 36300.00),
  ('2:1', 631, 1000, 19, 40, 3, 37950.00),
  ('2:1', 631, 1000, 20, 40, 3, 39600.00),
  ('2:1', 631, 1000, 21, 45, 3, 41250.00),
  ('2:1', 631, 1000, 22, 45, 3, 42900.00),
  ('2:1', 631, 1000, 23, 45, 3, 44550.00),
  ('2:1', 631, 1000, 24, 45, 3, 46200.00),
  ('2:1', 631, 1000, 25, 45, 3, 47850.00),
  ('2:1', 631, 1000, 26, 50, 3, 49500.00),
  ('2:1', 631, 1000, 27, 50, 3, 51150.00),
  ('2:1', 631, 1000, 28, 50, 3, 52800.00),
  ('2:1', 631, 1000, 29, 50, 3, 54450.00),
  ('2:1', 631, 1000, 30, 50, 3, 56100.00),
  ('2:1', 631, 1000, 31, 55, 3, 57750.00),
  ('2:1', 631, 1000, 32, 55, 3, 59400.00),
  ('2:1', 631, 1000, 33, 55, 3, 61050.00),
  ('2:1', 631, 1000, 34, 55, 3, 62700.00),
  ('2:1', 631, 1000, 35, 55, 3, 64350.00),
  ('2:1', 631, 1000, 36, 60, 3, 66000.00),
  ('2:1', 631, 1000, 37, 60, 3, 67650.00),
  ('2:1', 631, 1000, 38, 60, 3, 69300.00),
  ('2:1', 631, 1000, 39, 60, 3, 70950.00),
  ('2:1', 631, 1000, 40, 60, 3, 72600.00),
  ('2:1', 1001, 1500, 2, 25, 2, 13200.00),
  ('2:1', 1001, 1500, 3, 25, 2, 14300.00),
  ('2:1', 1001, 1500, 4, 25, 2, 15400.00),
  ('2:1', 1001, 1500, 5, 25, 2, 17050.00),
  ('2:1', 1001, 1500, 6, 30, 2, 18700.00),
  ('2:1', 1001, 1500, 7, 30, 2, 20350.00),
  ('2:1', 1001, 1500, 8, 30, 2, 22000.00),
  ('2:1', 1001, 1500, 9, 30, 2, 23650.00),
  ('2:1', 1001, 1500, 10, 30, 2, 25300.00),
  ('2:1', 1001, 1500, 11, 35, 2, 26950.00),
  ('2:1', 1001, 1500, 12, 35, 2, 28600.00),
  ('2:1', 1001, 1500, 13, 35, 2, 30250.00),
  ('2:1', 1001, 1500, 14, 35, 2, 31900.00),
  ('2:1', 1001, 1500, 15, 35, 2, 33550.00),
  ('2:1', 1001, 1500, 16, 40, 3, 35200.00),
  ('2:1', 1001, 1500, 17, 40, 3, 36850.00),
  ('2:1', 1001, 1500, 18, 40, 3, 38500.00),
  ('2:1', 1001, 1500, 19, 40, 3, 40150.00),
  ('2:1', 1001, 1500, 20, 40, 3, 41800.00),
  ('2:1', 1001, 1500, 21, 45, 3, 43450.00),
  ('2:1', 1001, 1500, 22, 45, 3, 45100.00),
  ('2:1', 1001, 1500, 23, 45, 3, 46750.00),
  ('2:1', 1001, 1500, 24, 45, 3, 48400.00),
  ('2:1', 1001, 1500, 25, 45, 3, 50050.00),
  ('2:1', 1001, 1500, 26, 50, 3, 51700.00),
  ('2:1', 1001, 1500, 27, 50, 3, 53350.00),
  ('2:1', 1001, 1500, 28, 50, 3, 55000.00),
  ('2:1', 1001, 1500, 29, 50, 3, 56650.00),
  ('2:1', 1001, 1500, 30, 50, 3, 58300.00),
  ('2:1', 1001, 1500, 31, 55, 3, 59950.00),
  ('2:1', 1001, 1500, 32, 55, 3, 61600.00),
  ('2:1', 1001, 1500, 33, 55, 3, 63250.00),
  ('2:1', 1001, 1500, 34, 55, 3, 64900.00),
  ('2:1', 1001, 1500, 35, 55, 3, 66550.00),
  ('2:1', 1001, 1500, 36, 60, 3, 68200.00),
  ('2:1', 1001, 1500, 37, 60, 3, 69850.00),
  ('2:1', 1001, 1500, 38, 60, 3, 71500.00),
  ('2:1', 1001, 1500, 39, 60, 3, 73150.00),
  ('2:1', 1001, 1500, 40, 60, 3, 74800.00),
  ('4:1', 0, 2000, 2, 30, 2, 16500.00),
  ('4:1', 0, 2000, 3, 30, 2, 17600.00),
  ('4:1', 0, 2000, 4, 30, 2, 18700.00),
  ('4:1', 0, 2000, 5, 30, 2, 19800.00),
  ('4:1', 0, 2000, 6, 35, 2, 22550.00),
  ('4:1', 0, 2000, 7, 35, 2, 25300.00),
  ('4:1', 0, 2000, 8, 35, 2, 28050.00),
  ('4:1', 0, 2000, 9, 35, 2, 30800.00),
  ('4:1', 0, 2000, 10, 35, 2, 33550.00),
  ('4:1', 0, 2000, 11, 40, 2, 36300.00),
  ('4:1', 0, 2000, 12, 40, 2, 39050.00),
  ('4:1', 0, 2000, 13, 40, 2, 41800.00),
  ('4:1', 0, 2000, 14, 40, 2, 44550.00),
  ('4:1', 0, 2000, 15, 40, 2, 47300.00),
  ('4:1', 0, 2000, 16, 45, 2, 50050.00),
  ('4:1', 0, 2000, 17, 45, 2, 52800.00),
  ('4:1', 0, 2000, 18, 45, 2, 55550.00),
  ('4:1', 0, 2000, 19, 45, 2, 58300.00),
  ('4:1', 0, 2000, 20, 45, 2, 61050.00),
  ('4:1', 0, 2000, 21, 50, 2, 63800.00),
  ('4:1', 0, 2000, 22, 50, 2, 66550.00),
  ('4:1', 0, 2000, 23, 50, 2, 69300.00),
  ('4:1', 0, 2000, 24, 50, 2, 72050.00),
  ('4:1', 0, 2000, 25, 50, 2, 74800.00),
  ('4:1', 0, 2000, 26, 55, 2, 77550.00),
  ('4:1', 0, 2000, 27, 55, 2, 80300.00),
  ('4:1', 0, 2000, 28, 55, 2, 83050.00),
  ('4:1', 0, 2000, 29, 55, 2, 85800.00),
  ('4:1', 0, 2000, 30, 55, 3, 88550.00),
  ('4:1', 0, 2000, 31, 60, 3, 91300.00),
  ('4:1', 0, 2000, 32, 60, 3, 94050.00),
  ('4:1', 0, 2000, 33, 60, 3, 96800.00),
  ('4:1', 0, 2000, 34, 60, 3, 99550.00),
  ('4:1', 0, 2000, 35, 60, 3, 102300.00),
  ('4:1', 0, 2000, 36, 65, 3, 105050.00),
  ('4:1', 0, 2000, 37, 65, 3, 107800.00),
  ('4:1', 0, 2000, 38, 65, 3, 110550.00),
  ('4:1', 0, 2000, 39, 65, 3, 113300.00),
  ('4:1', 0, 2000, 40, 65, 3, 116050.00);

/* ---------- Seed: Instalação — Escada/Esteira Rolante ----------
   "Outros Estados" fica null — usuário não passou o valor, equipe
   preenche na tela quando tiver o dado. */
insert into public.custos_instalacao_escada_esteira (tipo, valor_sao_paulo_rs, valor_outros_estados_rs) values
  ('escada_rolante', 16000.00, null),
  ('esteira_rolante', 16000.00, null);

/* ---------- Seed: Containers (specs ISO fixas, comercial vazio) ---------- */
insert into public.custos_containers (tipo, comprimento_m, altura_desc, capacidade_m3) values
  ('20GP (Padrão)', 6.06, '2,59 m (Padrão)', 33.2),
  ('20HC (High Cube)', 6.06, '2,89 m (Alto)', 37.5),
  ('40GP (Padrão)', 12.19, '2,59 m (Padrão)', 67.3),
  ('40HC (High Cube)', 12.19, '2,89 m (Alto)', 76.3),
  ('20 Reefer (Refrigerado)', 5.89, '2,59 m (Padrão)', 28.0),
  ('40 HC Reefer (Refrigerado Alto)', 11.58, '2,89 m (Alto)', 66.1),
  ('20 Open Top (Teto aberto)', 6.06, '2,59 m (Padrão)', 32.0),
  ('40 Open Top (Teto aberto)', 12.19, '2,59 m (Padrão)', 65.0),
  ('20 Hard Top (Teto rígido removível)', 6.06, '2,59 m (Padrão)', 33.0),
  ('40 Hard Top (Teto rígido removível)', 12.19, '2,59 m (Padrão)', 67.0),
  ('20 Flat Rack (Sem laterais)', 6.06, '—', null),
  ('40 Flat Rack (Sem laterais)', 12.19, '—', null),
  ('20 Tank (Tanque para líquidos)', 6.06, '2,59 m (Padrão)', 24.0),
  ('40 Tank (Tanque para líquidos)', 12.19, '2,59 m (Padrão)', 26.0),
  ('20 Ventilated (Ventilado)', 6.06, '2,59 m (Padrão)', 33.0),
  ('40 Ventilated (Ventilado)', 12.19, '2,59 m (Padrão)', 67.0),
  ('20 Insulated (Isolado térmico)', 6.06, '2,59 m (Padrão)', 30.0),
  ('40 Insulated (Isolado térmico)', 12.19, '2,59 m (Padrão)', 62.0),
  ('20 Open Side (Abertura lateral)', 6.06, '2,59 m (Padrão)', 33.0),
  ('40 Open Side (Abertura lateral)', 12.19, '2,59 m (Padrão)', 67.0),
  ('40 Pallet Wide (Largura para pallets)', 12.19, '2,89 m (Alto)', 76.0);
