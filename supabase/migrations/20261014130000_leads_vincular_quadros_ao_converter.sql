-- Lead convertido deixa de ser lead e vira cliente: os pedidos de Quadro de Comando que nasceram dele
-- (quadros_comando.lead_id) passam a apontar para o cliente do lead.
--
-- Fica no banco (e não só no front) porque o lead ganha cliente por vários caminhos: Kanban, edição do lead,
-- salvar com CNPJ e a assinatura da Proposta (proposta-store.js, que grava o cliente direto sem passar pelo
-- cadastro de clientes). O gatilho cobre todos, em qualquer ordem em que status e cliente_id sejam gravados.
--
-- Regras: só quando o lead está "Convertido" e já tem cliente; só preenche pedido SEM cliente (nunca troca
-- um vínculo existente); falha nunca impede a atualização do lead.
create or replace function public.leads_vincular_quadros() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Convertido' and new.cliente_id is not null then
    update public.quadros_comando
       set cliente_id = new.cliente_id
     where lead_id = new.id and cliente_id is null;
  end if;
  return new;
exception when others then
  return new;
end $$;

revoke all on function public.leads_vincular_quadros() from public, anon, authenticated;

drop trigger if exists trg_leads_vincular_quadros on public.leads;
create trigger trg_leads_vincular_quadros
  after update of status, cliente_id on public.leads
  for each row
  when (new.status = 'Convertido' and new.cliente_id is not null)
  execute function public.leads_vincular_quadros();
