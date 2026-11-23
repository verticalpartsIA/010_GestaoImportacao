-- Quadros de Comando · Formulários Respondidos: ID_TAG e PV_Omie (10/11/2026, pedido do Gelson; "Confirmo a migration" dado no chat).
-- Cada resposta do link público ganha um ID_TAG (ID-QC0001, ID-QC0002…). O vendedor digita a tag em "Observações do pedido" no Omie;
-- quando o pedido chega em pcp_pedidos, o banco acha a tag e preenche pv_omie com o número do pedido. Também dá para ligar à mão.
-- Regras (Gelson): vale o pedido MAIS ANTIGO que não esteja cancelado; pedido cancelado continua ligado, marcado pv_cancelado (não conta como
-- vendido); se outro pedido não cancelado traz a mesma tag, ele assume. A ligação manual vale sobre a automática. Nada é escrito no Omie.
-- Spec: docs/modulos/14_quadros_comando.md (14.6).

alter table public.quadros_comando
  add column if not exists id_tag text,
  add column if not exists pv_omie text,
  add column if not exists pv_origem text check (pv_origem in ('auto', 'manual')),
  add column if not exists pv_cancelado boolean not null default false,
  add column if not exists pv_multiplos boolean not null default false,
  add column if not exists pv_ligado_por text,
  add column if not exists pv_ligado_em timestamptz;

create unique index if not exists quadros_comando_id_tag_uidx on public.quadros_comando (id_tag) where id_tag is not null;

create sequence if not exists public.qc_id_tag_seq;
revoke all on sequence public.qc_id_tag_seq from public, anon, authenticated;

create or replace function public.qc_id_tag_texto(n bigint) returns text
language sql immutable as $$ select 'ID-QC' || case when n < 10000 then lpad(n::text, 4, '0') else n::text end $$;

-- Carga inicial: as respostas públicas que já existem, na ordem em que chegaram (antes de ligar a trava abaixo).
do $$
declare r record;
begin
  for r in select id from public.quadros_comando
           where origem_envio = 'formulario_publico' and excluido_em is null and id_tag is null
           order by created_at, id
  loop
    update public.quadros_comando set id_tag = public.qc_id_tag_texto(nextval('public.qc_id_tag_seq')) where id = r.id;
  end loop;
end $$;

-- Trava: id_tag e pv_* só mudam pelas funções abaixo (que ligam qc.pv_ok). A tabela ainda é aberta à chave pública (Art. 25), então
-- a trava impede que um UPDATE/INSERT direto invente tag ou pedido; o valor enviado é descartado em silêncio.
create or replace function public.qc_pv_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean := coalesce(current_setting('qc.pv_ok', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not ok then
      new.pv_omie := null; new.pv_origem := null; new.pv_cancelado := false; new.pv_multiplos := false; new.pv_ligado_por := null; new.pv_ligado_em := null;
    end if;
    new.id_tag := case when new.origem_envio = 'formulario_publico'
                       then public.qc_id_tag_texto(nextval('public.qc_id_tag_seq')) else null end;
  elsif not ok then
    new.id_tag := old.id_tag; new.pv_omie := old.pv_omie; new.pv_origem := old.pv_origem; new.pv_cancelado := old.pv_cancelado;
    new.pv_multiplos := old.pv_multiplos; new.pv_ligado_por := old.pv_ligado_por; new.pv_ligado_em := old.pv_ligado_em;
  end if;
  return new;
end $$;
drop trigger if exists trg_qc_pv_guarda on public.quadros_comando;
create trigger trg_qc_pv_guarda before insert or update on public.quadros_comando
  for each row execute function public.qc_pv_guarda();
revoke all on function public.qc_pv_guarda() from public, anon, authenticated;

-- Recalcula o pedido ligado de cada tag da lista. Ligação manual não é tocada (só atualiza o aviso de cancelado).
create or replace function public.qc_pv_recalcular(p_tags text[]) returns void
language plpgsql security definer set search_path = public as $$
declare t record; v_pat text; v_num text; v_canc boolean; v_mult boolean;
begin
  perform set_config('qc.pv_ok', 'on', true);
  for t in select id, id_tag, pv_origem, pv_omie from public.quadros_comando where id_tag = any (p_tags) loop
    if t.pv_origem = 'manual' then
      update public.quadros_comando
         set pv_cancelado = coalesce((select bool_and(coalesce(p.cancelado, false)) from public.pcp_pedidos p where p.numero_pedido = t.pv_omie), false)
       where id = t.id;
      continue;
    end if;
    v_pat := 'ID\s*-\s*QC\s*' || regexp_replace(t.id_tag, '\D', '', 'g') || '(?!\d)';
    select c.numero_pedido, c.canc, (select count(*) from (
             select 1 from public.pcp_pedidos p2 where p2.observacao ~* v_pat group by p2.numero_pedido
             having not bool_and(coalesce(p2.cancelado, false))) z) > 1
      into v_num, v_canc, v_mult
      from (select p.numero_pedido, bool_and(coalesce(p.cancelado, false)) as canc, min(p.data_pedido) as dp
              from public.pcp_pedidos p where p.observacao ~* v_pat group by p.numero_pedido) c
     order by c.canc, c.dp, c.numero_pedido limit 1;
    if v_num is null then
      update public.quadros_comando set pv_omie = null, pv_origem = null, pv_cancelado = false, pv_multiplos = false,
             pv_ligado_por = null, pv_ligado_em = null where id = t.id and pv_omie is not null;
    else
      update public.quadros_comando set pv_omie = v_num, pv_origem = 'auto', pv_cancelado = v_canc, pv_multiplos = coalesce(v_mult, false),
             pv_ligado_por = null, pv_ligado_em = now()
       where id = t.id and (pv_omie is distinct from v_num or pv_cancelado is distinct from v_canc or pv_multiplos is distinct from coalesce(v_mult, false));
    end if;
  end loop;
end $$;
revoke all on function public.qc_pv_recalcular(text[]) from public, anon, authenticated;

-- Gatilho em pcp_pedidos: quando a observação ou o cancelamento muda, recalcula as tags citadas (antes e depois) e atualiza o aviso de
-- cancelado das ligações manuais deste número. Falha aqui NUNCA impede a leitura dos pedidos (aviso e segue).
create or replace function public.qc_pv_apos_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare tags text[] := '{}'; m text[];
begin
  begin
    for m in select regexp_matches(coalesce(new.observacao, ''), 'ID\s*-\s*QC\s*(\d{4,})', 'gi') loop
      tags := tags || public.qc_id_tag_texto(m[1]::bigint);
    end loop;
    if tg_op = 'UPDATE' then
      for m in select regexp_matches(coalesce(old.observacao, ''), 'ID\s*-\s*QC\s*(\d{4,})', 'gi') loop
        tags := tags || public.qc_id_tag_texto(m[1]::bigint);
      end loop;
    end if;
    if array_length(tags, 1) is not null then perform public.qc_pv_recalcular(tags); end if;
    perform set_config('qc.pv_ok', 'on', true);
    update public.quadros_comando q
       set pv_cancelado = coalesce((select bool_and(coalesce(p.cancelado, false)) from public.pcp_pedidos p where p.numero_pedido = q.pv_omie), false)
     where q.pv_origem = 'manual' and q.pv_omie = new.numero_pedido;
  exception when others then
    raise warning 'qc_pv_apos_pedido: %', sqlerrm;
  end;
  return null;
end $$;
revoke all on function public.qc_pv_apos_pedido() from public, anon, authenticated;
drop trigger if exists trg_qc_pv_apos_pedido on public.pcp_pedidos;
create trigger trg_qc_pv_apos_pedido after insert or update of observacao, cancelado on public.pcp_pedidos
  for each row execute function public.qc_pv_apos_pedido();

-- Ligação manual: com número liga e marca como manual; vazio desfaz e volta para a automática (se a tag estiver em algum pedido).
create or replace function public.qc_pv_ligar(p_id uuid, p_numero text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n text := regexp_replace(coalesce(p_numero, ''), '\D', '', 'g'); q record;
begin
  if not public.vp_usuario_ativo() then raise exception 'PV Omie: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-formularios-respondidos', 'editar') then raise exception 'PV Omie: sem alçada "editar" em Formulários Respondidos'; end if;
  if length(n) > 10 then raise exception 'PV Omie: número do pedido inválido'; end if;
  select id, id_tag into q from public.quadros_comando where id = p_id and origem_envio = 'formulario_publico' and excluido_em is null;
  if q.id is null then raise exception 'PV Omie: formulário não encontrado'; end if;
  perform set_config('qc.pv_ok', 'on', true);
  if n = '' then
    update public.quadros_comando set pv_omie = null, pv_origem = null, pv_cancelado = false, pv_multiplos = false, pv_ligado_por = null, pv_ligado_em = null where id = q.id;
    perform public.qc_pv_recalcular(array[q.id_tag]);
  else
    update public.quadros_comando
       set pv_omie = n, pv_origem = 'manual', pv_multiplos = false, pv_ligado_por = public.vp_email(), pv_ligado_em = now(),
           pv_cancelado = coalesce((select bool_and(coalesce(p.cancelado, false)) from public.pcp_pedidos p where p.numero_pedido = n), false)
     where id = q.id;
  end if;
  return (select jsonb_build_object('id', id, 'id_tag', id_tag, 'pv_omie', pv_omie, 'pv_origem', pv_origem, 'pv_cancelado', pv_cancelado, 'pv_multiplos', pv_multiplos)
            from public.quadros_comando where id = q.id);
end $$;
revoke all on function public.qc_pv_ligar(uuid, text) from public, anon;
grant execute on function public.qc_pv_ligar(uuid, text) to authenticated;

-- Liga o que já estiver nos pedidos que o sistema leu.
select public.qc_pv_recalcular(array(select id_tag from public.quadros_comando where id_tag is not null));
