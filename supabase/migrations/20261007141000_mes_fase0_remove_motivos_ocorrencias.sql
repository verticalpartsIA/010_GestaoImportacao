-- MES · Fase 0 — correção de rota (07/10/2026).
-- A migration 20261007120000 criou mes_motivos e mes_ocorrencias, mas o MES que já estava no main
-- (mes.jsx, fases 1–4: mes_bloqueios, mes_pausas, mes_nc…) cobre esse papel. Para não ter dois
-- cadastros de motivos, as duas tabelas foram removidas. Estavam sem dados reais (0 ocorrências;
-- os 23 motivos eram só a carga inicial). Já aplicada em produção.
drop table if exists public.mes_ocorrencias;
drop table if exists public.mes_motivos;
notify pgrst, 'reload schema';
