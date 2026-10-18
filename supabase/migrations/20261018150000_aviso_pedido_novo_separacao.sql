-- Estoque — fase 5 (item 1): AVISO IMEDIATO quando uma venda nova entra para separar (pedido do Omie em etapa 20).
-- Hoje o hub lê a etapa 20 a cada 30 min (cron sync-pcp-pedidos-etapa20), mas ninguém era chamado na hora: o primeiro aviso só saía
-- depois de 1 dia útil sem OP (alerta de prazo do PCP). Este gatilho só INSERE em `alertas` — não chama o Omie, não mexe em estoque,
-- separação nem OP. Avisa os líderes de Almoxarifado/Logística (sem líder cadastrado, vira alerta global); clique abre a fila.
-- Dispara quando o pedido NASCE na etapa 20 ou MUDA para a etapa 20 (ex.: proposta etapa 00 que virou pedido). Pedido cancelado não avisa.
-- Um aviso por pedido (id `pcp-pedido-novo-<codigo_pedido>` + pessoa): reler o mesmo pedido nunca repete. Falha engolida de propósito:
-- o aviso jamais pode impedir o sync de gravar o pedido. Vale também para pedidos `so_separacao` (a fila de separação os atende).

create or replace function public.pcp_pedido_avisar_separacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_em text; v_criados int := 0; v_lideres text[]; v_id text; v_titulo text; v_sub text;
begin
  if new.etapa = '20' and coalesce(new.cancelado, false) = false
     and (tg_op = 'INSERT' or old.etapa is distinct from new.etapa) then
    v_id := 'pcp-pedido-novo-' || new.codigo_pedido;
    v_titulo := 'Pedido ' || coalesce(new.numero_pedido, new.codigo_pedido::text) || ' entrou para separar';
    v_sub := left(coalesce(nullif(new.cliente_fantasia, ''), new.cliente_nome, 'cliente não informado')
                  || case when new.data_previsao is not null then ' · previsão ' || to_char(new.data_previsao, 'DD/MM') else '' end, 480);
    select array_agg(distinct lower(trim(email))) into v_lideres from public.colaboradores_vpsistema
     where is_department_lead and is_active and departamento ilike any (array['%Almoxarifado%', '%Log_stica%']) and email like '%@%';
    foreach v_em in array coalesce(v_lideres, array[]::text[]) loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values (v_id || '-' || left(md5(v_em), 6), 'info', v_titulo, v_sub, 'Almoxarifado', false, v_em, '/logistica/separacao')
      on conflict (id) do nothing;
      v_criados := v_criados + 1;
    end loop;
    if v_criados = 0 then
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values (v_id, 'info', v_titulo, v_sub, 'Almoxarifado', false, '/logistica/separacao')
      on conflict (id) do nothing;
    end if;
  end if;
  return new;
exception when others then
  return new;
end $$;
revoke all on function public.pcp_pedido_avisar_separacao() from public, anon, authenticated;

drop trigger if exists trg_pcp_pedido_avisar_separacao on public.pcp_pedidos;
create trigger trg_pcp_pedido_avisar_separacao
  after insert or update of etapa on public.pcp_pedidos
  for each row execute function public.pcp_pedido_avisar_separacao();
