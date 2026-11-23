-- Quadros de Comando — link do formulário público por pedido de venda do Omie + respostas + PDF (10/11/2026).
-- Spec: docs/superpowers/specs/2026-11-10-quadro-link-por-pedido-pdf.md (aprovada pelo Gelson).
-- NÃO escreve no Omie (o PDF é baixado no hub e anexado à mão lá). Não cria Lead.
-- Tabela nasce FECHADA (Art. 26): anon não acessa a tabela; o cliente só fala pelas RPCs public_qcf_* com o token do link.
-- O hub lê por usuário ativo com a alçada quadros-pedidos.ver e grava SÓ pelas funções (alçada quadros-pedidos.link_cliente).
-- Rollback: drop trigger trg_qc_formulario_avisar on qc_pedido_formularios; drop function public_qcf_obter(text), public_qcf_responder(text,jsonb,jsonb),
--           qc_formulario_gerar(bigint), qc_formulario_cancelar(uuid), qc_formulario_corrigir(uuid,jsonb), qc_formulario_avisar(); drop table qc_pedido_formularios;

create table if not exists public.qc_pedido_formularios (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  codigo_pedido bigint not null,
  numero_pedido text not null,
  cliente_nome text,
  status text not null default 'aguardando' check (status in ('aguardando', 'respondido', 'cancelado')),
  respostas jsonb,            -- o que a página pública enviou (como veio)
  resumo jsonb,               -- [[rótulo, valor], …] legível; é o que a tela mostra, o hub corrige e o PDF imprime
  respondido_em timestamptz,
  corrigido_por text,
  corrigido_em timestamptz,
  cancelado_em timestamptz,
  criado_por text,
  criado_em timestamptz not null default now()
);
-- No máximo um link ativo (aguardando ou respondido) por pedido; trocar = cancelar e gerar outro.
create unique index if not exists qc_pedido_formularios_ativo_idx on public.qc_pedido_formularios (codigo_pedido) where status <> 'cancelado';
create index if not exists qc_pedido_formularios_numero_idx on public.qc_pedido_formularios (numero_pedido);

alter table public.qc_pedido_formularios enable row level security;
revoke all on public.qc_pedido_formularios from public, anon, authenticated;
grant select on public.qc_pedido_formularios to authenticated;
drop policy if exists qc_pedido_formularios_ler on public.qc_pedido_formularios;
create policy qc_pedido_formularios_ler on public.qc_pedido_formularios for select to authenticated
  using (public.vp_usuario_ativo() and public.vp_tem_capacidade('quadros-pedidos', 'ver'));

-- ---------- página pública (token) ----------
create or replace function public.public_qcf_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if coalesce(length(p_token), 0) < 16 then return null; end if;
  select numero_pedido, cliente_nome, status into r from qc_pedido_formularios where token = p_token;
  if not found then return null; end if;
  return jsonb_build_object('numero_pedido', r.numero_pedido, 'cliente_nome', r.cliente_nome, 'status', r.status);
end $$;

create or replace function public.public_qcf_responder(p_token text, p_respostas jsonb, p_resumo jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if coalesce(length(p_token), 0) < 16 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if jsonb_typeof(p_respostas) is distinct from 'object' or jsonb_typeof(p_resumo) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  end if;
  if pg_column_size(p_respostas) > 400000 or pg_column_size(p_resumo) > 100000 then
    return jsonb_build_object('ok', false, 'erro', 'dados_grandes');
  end if;
  select id, status into r from qc_pedido_formularios where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status = 'cancelado' then return jsonb_build_object('ok', false, 'erro', 'link_cancelado'); end if;
  if r.status = 'respondido' then return jsonb_build_object('ok', false, 'erro', 'ja_respondido'); end if;
  update qc_pedido_formularios set status = 'respondido', respostas = p_respostas, resumo = p_resumo, respondido_em = now() where id = r.id;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.public_qcf_obter(text) to anon, authenticated;
grant execute on function public.public_qcf_responder(text, jsonb, jsonb) to anon, authenticated;

-- ---------- hub (usuário ativo + alçada) ----------
create or replace function public.qc_formulario_gerar(p_codigo_pedido bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p record; v_id uuid; v_token text;
begin
  if not public.vp_usuario_ativo() then raise exception 'formulário QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-pedidos', 'link_cliente') then raise exception 'formulário QC: sem alçada "link_cliente"'; end if;
  select codigo_pedido, numero_pedido, cliente_nome into p from pcp_pedidos where codigo_pedido = p_codigo_pedido;
  if not found then raise exception 'formulário QC: pedido % não encontrado', p_codigo_pedido; end if;
  if exists (select 1 from qc_pedido_formularios where codigo_pedido = p_codigo_pedido and status <> 'cancelado') then
    raise exception 'formulário QC: este pedido já tem um link ativo (cancele-o para gerar outro)';
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into qc_pedido_formularios (token, codigo_pedido, numero_pedido, cliente_nome, criado_por)
  values (v_token, p.codigo_pedido, p.numero_pedido, p.cliente_nome, public.vp_email())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end $$;

create or replace function public.qc_formulario_cancelar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then raise exception 'formulário QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-pedidos', 'link_cliente') then raise exception 'formulário QC: sem alçada "link_cliente"'; end if;
  update qc_pedido_formularios set status = 'cancelado', cancelado_em = now() where id = p_id and status <> 'cancelado';
  if not found then raise exception 'formulário QC: link não encontrado ou já cancelado'; end if;
end $$;

create or replace function public.qc_formulario_corrigir(p_id uuid, p_resumo jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then raise exception 'formulário QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-pedidos', 'link_cliente') then raise exception 'formulário QC: sem alçada "link_cliente"'; end if;
  if jsonb_typeof(p_resumo) is distinct from 'array' or pg_column_size(p_resumo) > 100000 then raise exception 'formulário QC: dados inválidos'; end if;
  update qc_pedido_formularios set resumo = p_resumo, corrigido_por = public.vp_email(), corrigido_em = now()
   where id = p_id and status = 'respondido';
  if not found then raise exception 'formulário QC: só se corrige um formulário já respondido'; end if;
end $$;
revoke all on function public.qc_formulario_gerar(bigint) from public, anon;
revoke all on function public.qc_formulario_cancelar(uuid) from public, anon;
revoke all on function public.qc_formulario_corrigir(uuid, jsonb) from public, anon;
grant execute on function public.qc_formulario_gerar(bigint) to authenticated;
grant execute on function public.qc_formulario_cancelar(uuid) to authenticated;
grant execute on function public.qc_formulario_corrigir(uuid, jsonb) to authenticated;

-- ---------- aviso ao responder (só INSERE em alertas; falha engolida: nunca impede o cliente de enviar) ----------
create or replace function public.qc_formulario_avisar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_titulo text; v_sub text;
begin
  if new.status = 'respondido' and old.status is distinct from 'respondido' then
    v_titulo := 'Cliente respondeu o formulário do Quadro — pedido ' || new.numero_pedido;
    v_sub := left(coalesce(new.cliente_nome, 'cliente não informado') || ' · abra Pedidos com Quadro para ver e baixar o PDF', 480);
    insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values ('qcf-' || new.id, 'info', v_titulo, v_sub, 'Quadros de Comando', false, nullif(new.criado_por, ''), '/quadros-de-comando/quadros-pedidos')
    on conflict (id) do nothing;
  end if;
  return new;
exception when others then
  return new;
end $$;
revoke all on function public.qc_formulario_avisar() from public, anon, authenticated;
drop trigger if exists trg_qc_formulario_avisar on public.qc_pedido_formularios;
create trigger trg_qc_formulario_avisar after update of status on public.qc_pedido_formularios
  for each row execute function public.qc_formulario_avisar();

notify pgrst, 'reload schema';
