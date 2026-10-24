-- Calendário de feriados: separa "bloqueia o ENVIO de avisos" de "não conta como dia útil no PRAZO" (24/10/2026, decisão do Gelson).
-- Regra: avisos automáticos não saem em fim de semana nem em feriado de Guarulhos/SP (nacionais + estaduais SP + municipais de Guarulhos).
-- Ponto facultativo (Carnaval) e 25/01 (cidade de SP) continuam fora do envio. O prazo (conta_no_sla) NÃO muda para nenhuma data que já existia.
-- Quem lê para o envio: gi-avisos (VPS), com a chave pública, filtro: ativo=is.true&bloqueia_envio=is.true

alter table public.calendario_feriados
  add column if not exists bloqueia_envio boolean not null default false;
comment on column public.calendario_feriados.bloqueia_envio is
  'true = nenhum aviso automático (WhatsApp) sai neste dia; o aviso espera e sai às 09:30 do próximo dia útil. Independe de conta_no_sla (prazos).';

-- Guarulhos passa a ser uma abrangência própria (Corpus Christi e 08/12 são municipais de Guarulhos).
alter table public.calendario_feriados drop constraint if exists calendario_feriados_abrangencia_check;
alter table public.calendario_feriados add constraint calendario_feriados_abrangencia_check
  check (abrangencia in ('nacional', 'sp_estado', 'sp_cidade', 'guarulhos', 'outro'));

-- Corpus Christi não é feriado nacional: em Guarulhos é municipal. conta_no_sla continua true (prazos não mudam).
update public.calendario_feriados set abrangencia = 'guarulhos' where descricao = 'Corpus Christi';

-- Aniversário de Guarulhos (08/12, N. Sra. da Conceição) — não existia. Fábrica parada: conta no SLA e bloqueia envio.
insert into public.calendario_feriados (data, descricao, abrangencia, conta_no_sla, bloqueia_envio) values
  ('2026-12-08', 'Aniversário de Guarulhos (N. Sra. da Conceição)', 'guarulhos', true, true),
  ('2027-12-08', 'Aniversário de Guarulhos (N. Sra. da Conceição)', 'guarulhos', true, true),
  ('2028-12-08', 'Aniversário de Guarulhos (N. Sra. da Conceição)', 'guarulhos', true, true)
on conflict (data) do nothing;

-- Quem bloqueia o envio: nacionais, estaduais de SP e municipais de Guarulhos. Fora: Carnaval (facultativo) e sp_cidade.
update public.calendario_feriados set bloqueia_envio = true
 where ativo and abrangencia in ('nacional', 'sp_estado', 'guarulhos') and descricao not ilike 'Carnaval%';
update public.calendario_feriados set bloqueia_envio = false
 where abrangencia = 'sp_cidade' or descricao ilike 'Carnaval%';

-- Leitura pela chave pública (feriado não é dado sensível) e higiene de permissões:
-- anon só lê o que está ativo; ninguém precisa de TRUNCATE/REFERENCES/TRIGGER. A escrita segue só por administrador (políticas vp_cal_*).
drop policy if exists vp_cal_sel_anon on public.calendario_feriados;
create policy vp_cal_sel_anon on public.calendario_feriados for select to anon using (ativo);
revoke truncate, references, trigger on public.calendario_feriados from anon, authenticated;
revoke insert, update, delete on public.calendario_feriados from anon;
