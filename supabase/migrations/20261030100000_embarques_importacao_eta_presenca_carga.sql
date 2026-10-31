-- ETA original/atual e Presença de carga (aba Embarque / Aduaneiro).
-- eta_santos continua existindo e acompanha o ETA atual (Evolução e rastreio ainda leem essa coluna).
alter table public.embarques_importacao
  add column if not exists eta_original date,
  add column if not exists eta_atual date,
  add column if not exists presenca_carga date;

-- Registros antigos: o eta_santos vale como ETA original/atual. Presença de carga fica em branco
-- na carga (a tela usa eta_santos como valor de leitura até alguém preencher).
update public.embarques_importacao
   set eta_original = coalesce(eta_original, eta_santos),
       eta_atual    = coalesce(eta_atual, eta_santos)
 where eta_santos is not null;

notify pgrst, 'reload schema';
