-- Boletos Avisos › leitura pela grade de alçadas (17/11/2026, pedido do Gelson).
-- Regra: os 3 e-mails fixos (Gelson, Diego, Juliana) continuam com acesso total, sem depender da grade.
-- Quem tiver a alçada `boletos-avisos` › `ver` (Administração › Alçadas) só LÊ: lista, boletos, log e resumo.
-- Nada de gravar: aviso manual, "Atualizar do Omie" e envio automático seguem só dos 3 fixos (a Edge Function
-- `boletos-avisos` não muda: ela continua usando boletos_avisos_email_permitido(), então quem só lê recebe 403).
-- Sem bypass de Administrador (igual à regra de 11/11): a conferência olha a grade direto, não vp_tem_capacidade().
-- Rollback: reaplicar a definição de boletos_avisos_pode() da migration 20261111100000 e
--   recriar boletos_avisos_config_upd com using/with check em boletos_avisos_pode();
--   drop function public.boletos_avisos_pode_gerir();

-- 1) Quem GERE (altera): só os 3 fixos
create or replace function public.boletos_avisos_pode_gerir()
returns boolean language sql stable security definer set search_path = public as $$
  select (select public.vp_usuario_ativo())
     and public.boletos_avisos_email_permitido((select public.vp_email()));
$$;
revoke all on function public.boletos_avisos_pode_gerir() from public, anon;
grant execute on function public.boletos_avisos_pode_gerir() to authenticated, service_role;

-- 2) Quem LÊ: os 3 fixos OU perfil ativo com a alçada boletos-avisos/ver (sem bypass de Administrador)
create or replace function public.boletos_avisos_pode()
returns boolean language sql stable security definer set search_path = public as $$
  select (select public.vp_usuario_ativo())
     and (
       public.boletos_avisos_email_permitido((select public.vp_email()))
       or exists (
         select 1 from public.alcadas_capacidade a
         join public.perfis p on p.id = a.perfil_id
         where lower(p.email) = (select public.vp_email())
           and p.ativo
           and a.modulo = 'boletos-avisos'
           and a.capacidade = 'ver'
       )
     );
$$;
revoke all on function public.boletos_avisos_pode() from public, anon;
grant execute on function public.boletos_avisos_pode() to authenticated, service_role;

-- 3) Ligar/desligar envio automático e modo teste: só quem gere (antes usava boletos_avisos_pode())
drop policy if exists boletos_avisos_config_upd on public.boletos_avisos_config;
create policy boletos_avisos_config_upd on public.boletos_avisos_config for update to authenticated
  using ((select public.boletos_avisos_pode_gerir())) with check ((select public.boletos_avisos_pode_gerir()));
