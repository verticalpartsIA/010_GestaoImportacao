-- ART por obra: Gustavo (modelo + boleto) -> Juliana (paga) -> Gustavo (definitiva) -> Felipe (envia à obra).
create table if not exists public.obra_art (
  codigo_obra text primary key,
  cliente_nome text,
  dossier_id text,
  numero_cotacao integer,
  contrato_instalador_id uuid,
  status text not null default 'aguardando_modelo'
    check (status in ('aguardando_modelo','modelo_anexado','paga','definitiva_anexada','enviada')),
  modelo jsonb,       -- {url, nome, em, por}
  boleto jsonb,
  definitiva jsonb,
  pago_em timestamptz, pago_por text,
  enviada_em timestamptz, enviada_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.obra_art enable row level security;
revoke all on public.obra_art from anon, authenticated;
grant select, update on public.obra_art to authenticated;
grant all on public.obra_art to service_role;

drop policy if exists obra_art_sel on public.obra_art;
create policy obra_art_sel on public.obra_art for select to authenticated
  using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('art', 'ver')));
drop policy if exists obra_art_upd on public.obra_art;
create policy obra_art_upd on public.obra_art for update to authenticated
  using ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('art', 'editar')))
  with check ((select public.vp_usuario_ativo()) and (select public.vp_tem_capacidade('art', 'editar')));

-- Pagamento só por quem tem 'confirmar_pagamento' (vale mesmo se alguém chamar o banco direto).
create or replace function public.obra_art_guarda() returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  if new.pago_em is distinct from old.pago_em or new.status is distinct from old.status and new.status = 'paga' then
    if not (select public.vp_tem_capacidade('art', 'confirmar_pagamento')) then
      raise exception 'Só quem tem a permissão "confirmar pagamento da ART" pode marcar como paga.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_obra_art_guarda on public.obra_art;
create trigger trg_obra_art_guarda before update on public.obra_art for each row execute function public.obra_art_guarda();

-- Primeira assinatura de um Contrato do Instalador da obra: cria a linha e avisa o Gustavo (uma vez por obra).
create or replace function public.obra_art_nasce() returns trigger language plpgsql security definer set search_path = public as $$
declare d text; v_cod text; v_cli text; v_cot integer; v_ins int;
begin
  if new.status is distinct from 'assinado' or old.status is not distinct from 'assinado' then return new; end if;
  foreach d in array coalesce(new.dossier_ids, '{}'::text[]) loop
    select coalesce(codigo_obra, id), client_name, numero_cotacao into v_cod, v_cli, v_cot from dossier_obra where id = d;
    if v_cod is null then continue; end if;
    insert into obra_art (codigo_obra, cliente_nome, dossier_id, numero_cotacao, contrato_instalador_id)
    values (v_cod, v_cli, d, v_cot, new.id) on conflict (codigo_obra) do nothing;
    get diagnostics v_ins = row_count;
    if v_ins > 0 then
      insert into alertas (id, level, title, sub, module, rota, resolved, destinatario_email)
      values ('art-nova-' || v_cod, 'info',
        'ART da obra ' || v_cod || ' — ' || coalesce(v_cli, 'cliente') || ': contrato do instalador assinado',
        'O contrato do instalador foi assinado. Veja o contrato de venda em /juridico/contrato-venda-equipamentos e, se for emitir a ART, anexe o modelo e o boleto em /engenharia/art (obra ' || v_cod || ').',
        'Engenharia', '/engenharia/art', false, 'gustavo@escamax.com.br')
      on conflict (id) do nothing;
    end if;
  end loop;
  return new;
exception when others then
  return new;  -- o aviso nunca pode impedir a assinatura
end $$;
revoke all on function public.obra_art_nasce() from public, anon, authenticated;
drop trigger if exists trg_obra_art_nasce on public.contratos_instalador;
create trigger trg_obra_art_nasce after update of status on public.contratos_instalador
  for each row execute function public.obra_art_nasce();

-- Permissões iniciais: Gustavo e Felipe veem/editam; Juliana vê e confirma o pagamento.
insert into public.alcadas_capacidade (perfil_id, modulo, capacidade, concedido_por)
select p.id, 'art', c, 'sistema (30/10/2026 — fluxo da ART por obra)'
  from public.perfis p
 cross join unnest(case lower(p.email)
   when 'gustavo@escamax.com.br' then array['ver','editar']
   when 'felipe.barros@verticalparts.com.br' then array['ver','editar']
   when 'juliana@verticalparts.com.br' then array['ver','editar','confirmar_pagamento']
   else array[]::text[] end) c
 where p.ativo
on conflict (perfil_id, modulo, capacidade) do nothing;
