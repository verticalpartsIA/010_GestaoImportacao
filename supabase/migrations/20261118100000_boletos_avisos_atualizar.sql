-- Boletos Avisos › nova alçada "atualizar" (18/11/2026, pedido do Gelson, opção A).
-- Quem recebe a caixa "Atualiza os boletos do Omie" em Administração › Alçadas passa a clicar em "Atualizar do Omie"
-- (só LÊ do Omie). Enviar aviso, simular, envio automático e modo teste continuam só com os 3 fixos
-- (boletos_avisos_pode_gerir). Quem tem "atualizar" também enxerga a tela (vale como "ver").

-- 1) Para a Edge Function (chamada com a chave de serviço): este e-mail pode atualizar?
create or replace function public.boletos_avisos_email_pode_atualizar(p_email text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.boletos_avisos_email_permitido(p_email)
      or exists (
        select 1 from public.alcadas_capacidade a
        join public.perfis p on p.id = a.perfil_id
        where lower(p.email) = lower(coalesce(p_email, ''))
          and p.ativo
          and a.modulo = 'boletos-avisos'
          and a.capacidade = 'atualizar'
      );
$$;
revoke all on function public.boletos_avisos_email_pode_atualizar(text) from public, anon, authenticated;
grant execute on function public.boletos_avisos_email_pode_atualizar(text) to service_role;

-- 2) Para a tela: o usuário logado pode clicar em "Atualizar do Omie"?
create or replace function public.boletos_avisos_pode_atualizar()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.vp_usuario_ativo())
     and public.boletos_avisos_email_pode_atualizar((select public.vp_email()));
$$;
revoke all on function public.boletos_avisos_pode_atualizar() from public, anon;
grant execute on function public.boletos_avisos_pode_atualizar() to authenticated;

-- 3) Quem tem "atualizar" também vê a tela (a RLS das tabelas usa esta função).
create or replace function public.boletos_avisos_pode()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.vp_usuario_ativo())
     and (
       public.boletos_avisos_email_permitido((select public.vp_email()))
       or exists (
         select 1 from public.alcadas_capacidade a
         join public.perfis p on p.id = a.perfil_id
         where lower(p.email) = (select public.vp_email())
           and p.ativo
           and a.modulo = 'boletos-avisos'
           and a.capacidade in ('ver', 'atualizar')
       )
     );
$$;
