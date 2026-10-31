-- Espelho de colaboradores (colaboradores_vpsistema) passa a ser atualizado pelo envio do vpsistema (13/10/2026).
-- Já aplicada em produção (projeto jxtqwzmpgofwctqajewt).
--
-- Antes: carga única de 14/08/2026, sem rotina; pessoas novas ficavam fora da tela de Administração
-- (Franklin, Geovanna, Joice, Luiz e Maximira) e departamento/nível/cargo/líder/gestor ficavam de agosto.
--
-- vpsistema_ensure_perfil (chamada pela edge function vpsistema-sync quando o corpo traz p_perfil):
--  • se o corpo traz os campos de colaborador (chave 'lider'), faz upsert no espelho;
--  • cria o perfil quando falta, como antes (nivel SEMPRE 'Colaborador'), exceto para pessoa inativa.
-- Retrocompatível: corpo sem 'lider' se comporta como antes.

-- Cópia de segurança do espelho de antes (reverter: truncate colaboradores_vpsistema + insert from a cópia).
create table if not exists public.colaboradores_vpsistema_bak_20261013 as select * from public.colaboradores_vpsistema;
alter table public.colaboradores_vpsistema_bak_20261013 enable row level security;

create or replace function public.vpsistema_ensure_perfil(p jsonb)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  pid uuid;
  v_id uuid;
begin
  if p is null or coalesce(p->>'email', '') = '' or coalesce(p->>'id', '') = '' then
    return null;
  end if;
  v_id := (p->>'id')::uuid;

  if p ? 'lider' then
    insert into public.colaboradores_vpsistema
      (id, nome, email, departamento, is_department_lead, manager_id, is_active, avatar_url, nivel, cargo, unidade, sincronizado_em)
    values
      (v_id, p->>'nome', lower(p->>'email'), p->>'departamento', coalesce((p->>'lider')::boolean, false),
       nullif(p->>'gestor_id', '')::uuid, coalesce((p->>'ativo')::boolean, true), p->>'avatar',
       p->>'nivel_vpsistema', p->>'cargo', p->>'unidade', now())
    on conflict (id) do update set
      nome = excluded.nome, email = excluded.email, departamento = excluded.departamento,
      is_department_lead = excluded.is_department_lead, manager_id = excluded.manager_id,
      is_active = excluded.is_active, avatar_url = excluded.avatar_url, nivel = excluded.nivel,
      cargo = excluded.cargo, unidade = excluded.unidade, sincronizado_em = now();
  end if;

  select id into pid from public.perfis where lower(email) = lower(p->>'email') limit 1;
  if pid is not null then return pid; end if;
  if not coalesce((p->>'ativo')::boolean, true) then return null; end if;

  -- nivel do perfil é sempre Colaborador: o poder no HUB vem das alçadas, não do nível.
  insert into public.perfis (id, email, nome, nivel, departamento, ativo, whatsapp_number)
  values (v_id, lower(p->>'email'), p->>'nome', 'Colaborador',
          p->>'departamento', coalesce((p->>'ativo')::boolean, true), p->>'whatsapp')
  on conflict do nothing;

  select id into pid from public.perfis where lower(email) = lower(p->>'email') limit 1;
  return pid;
end;
$$;
revoke all on function public.vpsistema_ensure_perfil(jsonb) from public, anon, authenticated;
