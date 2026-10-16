-- Lead: o vendedor informa se o cliente é Contribuinte de ICMS já na captação (define quem recolhe o DIFAL).
-- Nulo = não informado (leads antigos). O cliente criado a partir do lead herda o valor.
alter table public.leads add column if not exists contribuinte_icms boolean;
