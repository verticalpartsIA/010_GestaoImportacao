-- Fase P (Gelson, 09/10/2026): ninguém sem login grava mais em alcadas_capacidade
-- e perfis. Quem grava agora é só o vpsistema (vpsistema_set_alcadas /
-- vpsistema_set_email, SECURITY DEFINER via edge function vpsistema-sync).
-- Leitura segue aberta até a fase F0 (login real no HUB).
-- Reverter: recriar as políticas a partir de vp_policy_backup (onda 'fase_p_20261009').

insert into public.vp_policy_backup (tabela, polname, cmd, roles, qual, with_check, onda, salvo_em)
select tablename, policyname, cmd, roles::text[], qual, with_check, 'fase_p_20261009', now()
from pg_policies where schemaname = 'public' and tablename in ('alcadas_capacidade', 'perfis');

drop policy if exists alcadas_capacidade_all_anon on public.alcadas_capacidade;
drop policy if exists perfis_all_anon on public.perfis;

create policy alcadas_capacidade_leitura on public.alcadas_capacidade
  for select to anon, authenticated using (true);
create policy perfis_leitura on public.perfis
  for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.alcadas_capacidade from anon, authenticated;
revoke insert, update, delete, truncate on public.perfis from anon, authenticated;
