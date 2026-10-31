-- Aval Engenharia = assinatura do Projeto de Instalação pelo cliente, POR COTAÇÃO (08/10/2026).
-- Terceiro aval da compra na China (junto com Aval de Pagamento e Aval Jurídico). Quando o ÚLTIMO Projeto de Instalação
-- da cotação fica assinado, o banco enfileira o evento PROJETO_INSTALACAO_ASSINADO (fila fluxo_pendentes — o navegador
-- de um usuário interno o executa e o motor de Gatilhos fecha a etapa / libera a compra, como nos outros avais).
-- Roda na mesma transação da assinatura; falha aqui NUNCA impede a assinatura de ser gravada.
create or replace function public.projeto_instalacao_enfileirar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  d record; v_num integer; v_faltam integer; -- numero_cotacao de projetos_elevador_desenhos é INTEGER
begin
  if new.documento_tipo is distinct from 'projeto_instalacao' then return new; end if;
  if new.status is distinct from 'assinado' or new.status is not distinct from old.status then return new; end if;
  begin
    select id, referencia, cliente_nome, numero_cotacao into d
      from public.projetos_elevador_desenhos where id::text = new.documento_id;
    if not found or d.numero_cotacao is null then return new; end if;
    v_num := d.numero_cotacao;

    -- só dispara quando TODOS os Projetos de Instalação (não excluídos) da cotação já têm assinatura
    select count(*) into v_faltam
      from public.projetos_elevador_desenhos p
     where p.excluido_em is null and p.numero_cotacao = d.numero_cotacao
       and coalesce(p.tipo_documento, 'projeto_instalacao') = 'projeto_instalacao'
       and not exists (select 1 from public.documento_signatarios s
                        where s.documento_tipo = 'projeto_instalacao' and s.documento_id = p.id::text and s.status = 'assinado');
    if v_faltam > 0 then return new; end if;

    insert into public.fluxo_pendentes (tipo, numero_cotacao, payload)
    values ('projeto_instalacao_assinado', v_num, jsonb_build_object(
      'desenho_id', d.id::text, 'label', d.referencia, 'numero_cotacao', v_num,
      'signerName', coalesce(nullif(new.audit ->> 'signerName', ''), new.nome)));
  exception when others then
    raise warning '[projeto_instalacao_enfileirar] falhou: %', sqlerrm;
  end;
  return new;
end $$;

revoke all on function public.projeto_instalacao_enfileirar() from public, anon, authenticated;

create unique index if not exists fluxo_pendentes_projeto_assinado_uq
  on public.fluxo_pendentes ((payload ->> 'desenho_id')) where tipo = 'projeto_instalacao_assinado';

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_projeto_instalacao_enfileirar') then
    create trigger trg_projeto_instalacao_enfileirar
      after update of status on public.documento_signatarios
      for each row execute function public.projeto_instalacao_enfileirar();
  end if;
end $$;
