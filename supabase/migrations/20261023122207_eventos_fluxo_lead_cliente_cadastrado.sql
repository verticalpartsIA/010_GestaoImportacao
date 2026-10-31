-- 23/10/2026 — eventos "Lead cadastrado" e "Cliente cadastrado" em eventos_fluxo.
-- ARQUIVO RECRIADO em 31/10/2026 (Art. 31): esta migração já estava aplicada em produção (versão
-- 20261023122207, nome "eventos_fluxo_lead_cliente_cadastrado") mas o arquivo nunca tinha entrado no
-- repositório. O SQL abaixo é a cópia exata do que está em supabase_migrations.schema_migrations; é
-- idempotente (create or replace + drop trigger if exists), então rodar de novo não muda nada.
-- Os dois gatilhos engolem qualquer erro de propósito: registrar o evento nunca impede o cadastro.

create or replace function public.trg_evfluxo_lead_cadastrado() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  begin
    if new.excluido_em is null then
      insert into eventos_fluxo(modulo, evento, alvo_label, alvo_id, ator_nome, ator_papel, detalhe)
      values ('Comercial', 'Lead cadastrado',
        concat_ws(' · ', nullif(trim(new.building),''), nullif(trim(new.contact),''), nullif(trim(new.role),'')),
        new.id,
        coalesce(nullif(trim(new.owner),''), 'Vendedor'), 'Vendedor',
        jsonb_build_object('origem', new.origin));
    end if;
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists trg_evfluxo_lead_cadastrado on public.leads;
create trigger trg_evfluxo_lead_cadastrado after insert on public.leads
for each row execute function public.trg_evfluxo_lead_cadastrado();

create or replace function public.trg_evfluxo_cliente_cadastrado() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare ator text;
begin
  begin
    select nome into ator from perfis where id = new.criado_por;
    insert into eventos_fluxo(modulo, evento, alvo_label, alvo_id, ator_nome, ator_papel)
    values ('Comercial', 'Cliente cadastrado',
      concat_ws(' · ', coalesce(nullif(trim(new.razao_social),''), nullif(trim(new.nome_fantasia),'')),
        nullif(concat_ws('/', nullif(trim(coalesce(new.endereco_cidade, new.cidade)),''), nullif(trim(coalesce(new.endereco_estado, new.estado::text)),'')),'')),
      new.id::text, coalesce(ator, 'Vendedor'), 'Vendedor');
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists trg_evfluxo_cliente_cadastrado on public.clientes;
create trigger trg_evfluxo_cliente_cadastrado after insert on public.clientes
for each row execute function public.trg_evfluxo_cliente_cadastrado();
