-- Central de Decisões · "Solicitar novamente" não reavisava o aprovador (achado em teste real, 03/10/2026).
-- O aviso `dec_nova_<id>_<email>` é resolvido ao decidir/cancelar; ao reabrir a MESMA linha, o insert com
-- `on conflict do nothing` mantinha o aviso antigo resolvido. Agora o conflito reativa o aviso (e renova a data).
create or replace function public.decisoes_alertar_aprovadores() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text; v_titulo text; v_alvo text;
begin
  begin
    if new.status <> 'pendente' then
      if tg_op = 'UPDATE' and old.status = 'pendente' then
        update public.alertas set resolved = true
         where starts_with(id, 'dec_nova_' || new.id::text) and not resolved;
      end if;
      return new;
    end if;
    if tg_op = 'UPDATE' and old.status = 'pendente' then return new; end if;   -- já estava pendente
    v_titulo := case new.tipo
      when 'envio_proposta_gestor' then 'Envio de proposta — aprovação do Gestor Comercial'
      when 'envio_proposta_ceo' then 'Envio de proposta — aprovação do CEO'
      when 'contratacao_mao_obra_ceo' then 'Contratação de mão de obra — aprovação do CEO'
      when 'montador_entra_obra_rh' then 'Montador entra na obra — aprovação da Engenharia'
      when 'compra_equipamento_ceo' then 'Compra do equipamento — aprovação do CEO'
      when 'compra_varejo_logistica' then 'Compra de varejo — aprovação da Logística'
      when 'desconto_proposta' then 'Desconto em proposta'
      when 'pagamento_instalador_parcela' then 'Pagamento a instalador — aprovação do Gestor Comercial'
      else new.tipo end;
    v_alvo := coalesce(new.contexto->>'cliente', new.contexto->>'titulo', new.contexto->>'item', new.contexto->>'obra',
                       case when new.numero_cotacao is not null then 'Cotação Nº ' || new.numero_cotacao end, '');
    foreach v_email in array coalesce(new.aprovadores_esperados, '{}') loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values ('dec_nova_' || new.id::text || '_' || lower(v_email), 'warning', 'Decisão aguardando você',
              left(v_titulo || case when v_alvo <> '' then ' · ' || v_alvo else '' end, 480),
              'Central de Decisões', false, lower(v_email), '/geral/decisoes')
      on conflict (id) do update set resolved = false, created_at = now(), sub = excluded.sub;   -- reabertura reativa o aviso
    end loop;
  exception when others then
    null;   -- o aviso nunca pode impedir a decisão de ser gravada
  end;
  return new;
end $$;
