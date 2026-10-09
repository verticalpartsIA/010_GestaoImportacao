-- Segurança real (#571) · Fase 1 / Task 3 — funções de autorização + backup e gerador REVERSÍVEL de políticas (04/10/2026).
-- ADITIVA: só cria funções e a tabela de backup. Nenhuma tabela é fechada aqui e nenhuma política muda.
-- Identidade = e-mail do JWT (`auth.jwt()->>'email'`), venha o JWT do vpsistema (Third-Party Auth) ou de outro caminho.
-- Permissão = o que o app já usa no navegador: perfis.nivel (Administrador > Gestor > Colaborador) + alcadas_capacidade.
-- Endurecimento em relação ao plano: EXECUTE só para quem precisa (anon NÃO executa nada daqui; vp_email_ativo(text) só service_role,
-- para não virar "oráculo" de e-mails cadastrados).

create or replace function public.vp_email() returns text language sql stable as
$$ select lower(coalesce(auth.jwt()->>'email','')) $$;

create or replace function public.vp_email_ativo(p_email text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.perfis p where lower(p.email) = lower(p_email) and p.ativo) $$;

create or replace function public.vp_perfil() returns public.perfis language sql stable security definer set search_path = public as
$$ select p.* from public.perfis p where lower(p.email) = public.vp_email() and p.ativo limit 1 $$;

create or replace function public.vp_usuario_ativo() returns boolean language sql stable security definer set search_path = public as
$$ select public.vp_email_ativo(public.vp_email()) $$;

create or replace function public.vp_eh_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select nivel = 'Administrador' from public.perfis where lower(email) = public.vp_email() and ativo limit 1), false) $$;

create or replace function public.vp_nivel_ge(p_minimo text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select (case nivel when 'Administrador' then 3 when 'Gestor' then 2 else 1 end)
                         >= (case p_minimo when 'Administrador' then 3 when 'Gestor' then 2 else 1 end)
                    from public.perfis where lower(email) = public.vp_email() and ativo limit 1), false) $$;

create or replace function public.vp_tem_capacidade(p_modulo text, p_cap text) returns boolean language sql stable security definer set search_path = public as
$$ select public.vp_eh_admin() or exists (
     select 1 from public.alcadas_capacidade a join public.perfis p on p.id = a.perfil_id
     where lower(p.email) = public.vp_email() and p.ativo and a.modulo = p_modulo and a.capacidade = p_cap) $$;

-- quem pode executar (anon nunca)
revoke execute on function public.vp_email(), public.vp_email_ativo(text), public.vp_perfil(), public.vp_usuario_ativo(), public.vp_eh_admin(),
  public.vp_nivel_ge(text), public.vp_tem_capacidade(text, text) from public, anon;
grant execute on function public.vp_email(), public.vp_perfil(), public.vp_usuario_ativo(), public.vp_eh_admin(),
  public.vp_nivel_ge(text), public.vp_tem_capacidade(text, text) to authenticated, service_role;
-- o default do Supabase concede EXECUTE a authenticated explicitamente (revoke de public/anon não basta)
revoke execute on function public.vp_email_ativo(text) from authenticated;
grant execute on function public.vp_email_ativo(text) to service_role;

-- backup exato das políticas abertas, para reverter qualquer onda
create table if not exists public.vp_policy_backup (
  id bigserial primary key, tabela text not null, polname text not null, cmd text not null,
  roles text[] not null, qual text, with_check text, onda text, salvo_em timestamptz not null default now());
alter table public.vp_policy_backup enable row level security;
revoke all on public.vp_policy_backup from anon, authenticated;

-- fecha uma tabela: guarda as políticas abertas a anon/public, remove-as e cria as da classe
--   interno          : qualquer usuário ATIVO lê/escreve; exclusão só Administrador ou capacidade 'excluir' do módulo (= nome da tabela)
--   leitura_interna  : usuário ativo só lê (escrita só por função de servidor/service_role)
--   sensivel         : leitura Gestor+, escrita Administrador
create or replace function public.vp_fechar_tabela(p_tabela text, p_classe text, p_onda text default null) returns text
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  if p_classe not in ('interno','leitura_interna','sensivel') then raise exception 'classe inválida: %', p_classe; end if;
  for r in select * from pg_policies where schemaname='public' and tablename=p_tabela and roles::text ~ '(anon|public)' loop
    insert into public.vp_policy_backup(tabela, polname, cmd, roles, qual, with_check, onda)
      values (p_tabela, r.policyname, r.cmd, r.roles::text[], r.qual, r.with_check, p_onda);
    execute format('drop policy %I on public.%I', r.policyname, p_tabela); v_n := v_n + 1;
  end loop;
  execute format('revoke all on public.%I from anon', p_tabela);
  execute format('grant select, insert, update, delete on public.%I to authenticated', p_tabela);
  execute format('alter table public.%I enable row level security', p_tabela);
  if p_classe = 'interno' then
    execute format('create policy vp_int_sel on public.%I for select to authenticated using ((select public.vp_usuario_ativo()))', p_tabela);
    execute format('create policy vp_int_ins on public.%I for insert to authenticated with check ((select public.vp_usuario_ativo()))', p_tabela);
    execute format('create policy vp_int_upd on public.%I for update to authenticated using ((select public.vp_usuario_ativo())) with check ((select public.vp_usuario_ativo()))', p_tabela);
    execute format('create policy vp_int_del on public.%I for delete to authenticated using ((select public.vp_eh_admin()) or (select public.vp_tem_capacidade(%L, ''excluir'')))', p_tabela, p_tabela);
  elsif p_classe = 'leitura_interna' then
    execute format('create policy vp_ro_sel on public.%I for select to authenticated using ((select public.vp_usuario_ativo()))', p_tabela);
  else
    execute format('create policy vp_sen_sel on public.%I for select to authenticated using ((select public.vp_nivel_ge(''Gestor'')))', p_tabela);
    execute format('create policy vp_sen_wr on public.%I for all to authenticated using ((select public.vp_eh_admin())) with check ((select public.vp_eh_admin()))', p_tabela);
  end if;
  return format('%s: %s política(s) aberta(s) removida(s), classe %s', p_tabela, v_n, p_classe);
end $$;

-- desfaz: remove as políticas vp_* e recria EXATAMENTE as que estavam no último backup da tabela
create or replace function public.vp_reabrir_tabela(p_tabela text) returns text
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_ultima timestamptz;
begin
  select max(salvo_em) into v_ultima from public.vp_policy_backup where tabela = p_tabela;
  if v_ultima is null then raise exception 'sem backup para %', p_tabela; end if;
  for r in select policyname from pg_policies where schemaname='public' and tablename=p_tabela and policyname in ('vp_int_sel','vp_int_ins','vp_int_upd','vp_int_del','vp_ro_sel','vp_sen_sel','vp_sen_wr') loop
    execute format('drop policy %I on public.%I', r.policyname, p_tabela);
  end loop;
  for r in select * from public.vp_policy_backup where tabela = p_tabela and salvo_em = v_ultima loop
    execute format('create policy %I on public.%I for %s to %s%s%s', r.polname, p_tabela, r.cmd,
      array_to_string(r.roles, ','), coalesce(' using (' || r.qual || ')', ''), coalesce(' with check (' || r.with_check || ')', ''));
    v_n := v_n + 1;
  end loop;
  execute format('grant select, insert, update, delete on public.%I to anon', p_tabela);
  return format('%s: %s política(s) restaurada(s)', p_tabela, v_n);
end $$;

revoke execute on function public.vp_fechar_tabela(text,text,text), public.vp_reabrir_tabela(text) from public, anon, authenticated;
grant  execute on function public.vp_fechar_tabela(text,text,text), public.vp_reabrir_tabela(text) to service_role;
