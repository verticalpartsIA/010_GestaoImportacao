-- Cadastros > Atualização de Custos > Frete (10/10/2026)
-- Tabela de frete interno (Santos -> capitais) das 2 transportadoras, copiada da aba FRETE da
-- planilha "JA - COTAÇÃO N° 963" do Financeiro (que não tem fórmulas: é só consulta digitada).
-- A Precificação sugere o frete interno a partir daqui (cidade da obra x nº de containers).
create table if not exists public.custos_frete_interno (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'Santos',
  destino text not null,
  uf text,
  descricao text,
  transp1_l_rs numeric(14,2),
  transp1_ls_rs numeric(14,2),
  transp2_l_rs numeric(14,2),
  transp2_ls_rs numeric(14,2),
  transp1_l_obs text,
  valor_carga_rs numeric(14,2),
  mercadoria text,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  unique (origem, destino)
);
create table if not exists public.custos_frete_observacoes (
  id uuid primary key default gen_random_uuid(),
  bloco text not null check (bloco in ('geral','transportadora_1','transportadora_2')),
  ordem int not null,
  texto text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  unique (bloco, ordem)
);
alter table public.custos_frete_interno enable row level security;
alter table public.custos_frete_observacoes enable row level security;
drop policy if exists custos_frete_interno_all_anon on public.custos_frete_interno;
create policy custos_frete_interno_all_anon on public.custos_frete_interno for all to anon using (true) with check (true);
drop policy if exists custos_frete_interno_all_auth on public.custos_frete_interno;
create policy custos_frete_interno_all_auth on public.custos_frete_interno for all to authenticated using (true) with check (true);
drop policy if exists custos_frete_observacoes_all_anon on public.custos_frete_observacoes;
create policy custos_frete_observacoes_all_anon on public.custos_frete_observacoes for all to anon using (true) with check (true);
drop policy if exists custos_frete_observacoes_all_auth on public.custos_frete_observacoes;
create policy custos_frete_observacoes_all_auth on public.custos_frete_observacoes for all to authenticated using (true) with check (true);

insert into public.custos_frete_interno (origem, destino, uf, descricao, transp1_l_rs, transp1_ls_rs, transp2_l_rs, transp2_ls_rs, transp1_l_obs, valor_carga_rs, mercadoria) values
  ('Santos', 'Rio Branco', 'AC', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 58800, 54650, 55850, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Maceió', 'AL', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 38800, 38850, 39520, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Macapá', 'AP', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 54200, 52100, 53800, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Manaus', 'AM', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 64400, 63400, 65200, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Salvador', 'BA', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 32200, 33500, 34700, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Fortaleza', 'CE', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 21000, 47100, 47900, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Brasília', 'DF', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 19500, 18500, 19800, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Vitória', 'ES', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 15900, 20800, 21300, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Goiânia', 'GO', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 17600, 19200, 19700, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'São Luís', 'MA', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 48800, 44700, 45200, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Cuiabá', 'MT', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 28000, 26200, 27300, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Campo Grande', 'MS', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 19200, 22600, 23000, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Belo Horizonte', 'MG', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 11000, 14100, 14300, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Belém', 'PA', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 19200, 44600, 44900, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'João Pessoa', 'PB', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 44000, 42600, 43500, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Curitiba', 'PR', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 7000, 10200, 10500, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Recife', 'PE', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 42300, 40600, 40900, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Teresina', 'PI', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 44800, 41300, 41600, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Rio de Janeiro', 'RJ', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 9200, 10300, 10600, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Natal', 'RN', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 46500, 46500, 46900, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Porto Alegre', 'RS', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 18400, 19600, 19900, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Porto Velho', 'RO', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 51300, 46900, 47300, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Boa Vista', 'RR', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 75700, 73200, 74600, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Florianópolis', 'SC', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 11500, 12900, 13200, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'São Paulo', 'SP', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 2200, 3600, 3600, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Aracaju', 'SE', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 35000, 36200, 36700, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral'),
  ('Santos', 'Palmas', 'TO', 'CONTAINER DE 40'' - De 1 até 15 Tons- Carreta L e LS', null, 31200, 23500, 24900, 'COTADO CASO A CASO POIS PRECISAM DE PESO E CUBAGEM ESPECÍFICA', 250000, 'Carga Geral')
on conflict (origem, destino) do nothing;

insert into public.custos_frete_observacoes (bloco, ordem, texto) values
  ('geral', 1, '1. “Frete L” refere-se a caminhão menor, compatível com carga solta.'),
  ('geral', 2, '2. Frete LS refere-se a caminhão maior, compatível com container fechado'),
  ('geral', 3, '3. Caso o valor da carga ultrapasse R$ 250.000,00, a cotação deverá ser refeita.'),
  ('geral', 4, '4. Caso o local do serviço esteja a mais de 20 km da capital considerada, a cotação deverá ser refeita.'),
  ('geral', 5, '5. Valor aplicado por container ou por carga solta'),
  ('transportadora_1', 1, 'Ad Valorem – 1/1000'),
  ('transportadora_1', 2, 'Pedágios Inclusos'),
  ('transportadora_1', 3, 'Seguro do contêiner - C40’ = R$ 40,00 / Reefer de 40’ = R$ 160,00 / C20'' = R$20,00 /Reefer de 20'' = R$80,00'),
  ('transportadora_1', 4, 'Kit Carga Perigosa (IMO) = 25% sobre o valor do frete'),
  ('transportadora_1', 5, 'Adicional LS (Acima de 25 tons) = acrescentar 20% sobre o valor do frete'),
  ('transportadora_1', 6, 'Retiradas ou entregas de contêiner no Guarujá = R$ 490,00'),
  ('transportadora_1', 7, 'Retiradas ou entregas de contêiner em São Vicente / Cubatão / Praia Grande = R$ 380,00'),
  ('transportadora_1', 8, 'Free time = 8 horas livres para carga e descarga'),
  ('transportadora_1', 9, 'Estadia = R$ 550,00 a cada 12 horas'),
  ('transportadora_1', 10, 'Ajudante em Santos = R$290,00 cada'),
  ('transportadora_1', 11, 'Ajudante fora de Santos = R$ 390,00 cada'),
  ('transportadora_1', 12, 'ICMS aplicado conforme legislação'),
  ('transportadora_1', 13, 'DTA = R$ 330,00 + impostos'),
  ('transportadora_2', 1, '1. Para coletas e devoluções fora da margem direita, aplica-se adicional de R$ 400,00'),
  ('transportadora_2', 2, '2. Repasse integral do pedágio conforme rota e modalidade'),
  ('transportadora_2', 3, '3. Notas acima de R$ 250.000,00 aplicasse adicional de 0,1% a 0,25% sobre o valor da nota'),
  ('transportadora_2', 4, '4. Consultar periodo de carregamento e descarga free, para não ocorrer despesas com estadia'),
  ('transportadora_2', 5, '5. Valor aplicado por container ou por carga solta')
on conflict (bloco, ordem) do nothing;
