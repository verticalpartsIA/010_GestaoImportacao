-- Central de Notificações · alerta de FORMULÁRIO DEVOLVIDO pelo cliente (07/10/2026).
-- No link público (/formulario-cliente/<token>) o cliente agora "Devolve para a VerticalParts" (grava status 'enviado').
-- Este trigger avisa o VENDEDOR dono da cotação (formularios_elevador.created_by) para conferir o que o cliente preencheu.
-- Só dispara quando o formulário é do link do cliente (canal 'self_service') e a mudança de status foi para 'enviado'
-- (não dispara para "Enviar direto para Precificação", que é interno e marca envio_direto_precificacao_em).
-- Falha do alerta é engolida: nunca pode impedir a devolução do cliente de ser gravada.
-- Sem dono gravado (created_by nulo) vira aviso global. Id inclui o instante: devolver de novo depois de reaberto avisa de novo.
create or replace function public.alertas_formulario_devolvido() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cot text;
  v_cli text;
begin
  begin
    if new.status is distinct from 'enviado' or old.status is not distinct from 'enviado' then return new; end if;
    if new.canal is distinct from 'self_service' then return new; end if;
    if new.envio_direto_precificacao_em is not null then return new; end if;

    v_cot := case when new.numero_cotacao is not null then ' Nº ' || new.numero_cotacao else '' end;
    select coalesce(nullif(trim(c.razao_social), ''), nullif(trim(new.predio_empreendimento), ''), 'cliente')
      into v_cli
      from (select 1) x left join public.clientes c on c.id = new.cliente_id;

    insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values ('form-devolvido-' || new.id::text || '-' || floor(extract(epoch from clock_timestamp()))::bigint::text,
            'warning',
            'Cliente devolveu o formulário da cotação' || v_cot,
            left(coalesce(v_cli, 'cliente') || ' preencheu e devolveu o formulário · confira os dados antes de seguir com a cotação.', 480),
            'Comercial', false,
            nullif(lower(trim(new.created_by)), ''),
            '/comercial/formulario-elevador/' || new.id)
    on conflict (id) do nothing;
  exception when others then
    null;   -- nunca bloquear a devolução do cliente por causa do alerta
  end;
  return new;
end $$;

drop trigger if exists trg_alertas_formulario_devolvido on public.formularios_elevador;
create trigger trg_alertas_formulario_devolvido after update of status on public.formularios_elevador
  for each row execute function public.alertas_formulario_devolvido();
