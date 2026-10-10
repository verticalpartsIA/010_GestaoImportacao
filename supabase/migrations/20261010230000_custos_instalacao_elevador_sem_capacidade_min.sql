-- "Capacidade mín. (kg)" deixou de ser usada (só a Capacidade máx. doa dado; passageiros = máx ÷ 75).
-- A coluna fica no banco (histórico), mas não é mais digitada nem lida: default 0 para novas linhas.
alter table public.custos_instalacao_elevador alter column capacidade_min_kg set default 0;
