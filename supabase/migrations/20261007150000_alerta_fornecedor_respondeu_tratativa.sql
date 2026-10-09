-- Central de Notificações · alerta de FORNECEDOR RESPONDEU (tratativa/cotação) — 07/10/2026 (pedido do usuário).
-- Antes: a resposta por e-mail do fornecedor virava um alerta GLOBAL ("Fornecedor respondeu a tratativa…") que abria o Inbox.
-- Agora, quando o e-mail de ENTRADA está ligado a uma cotação a fornecedor (referencia_tipo 'tratativa_cotacao' ou 'cotacao_fornecedor'
-- com referencia_id), o aviso vai INDIVIDUAL para o vendedor (dono do e-mail = quem escreveu; senão o dono do formulário da cotação)
-- e abre direto a aba Tratativas daquela cotação (/comercial/cotacao-fornecedor-detail/<id>/tratativas), onde a resposta aparece na
-- linha do tempo. Sem dono conhecido, continua global (como antes). Os demais tipos (proposta, contratos, avulso) NÃO mudam.
-- Mesma regra de segurança do trigger original: só INSERT novo, no máx. 1 alerta por e-mail (id inbox-<id>), mensagem de até 7 dias,
-- e QUALQUER falha é engolida — o alerta nunca pode impedir um e-mail de ser gravado. send-email/read-inbox/vínculo/soft-delete intocados.
create or replace function public.alertas_inbox_resposta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tipo text;
  v_cot  text;
  v_quem text;
  v_dest text;
  v_rota text := '/geral/inbox';
  v_sub  text;
begin
  begin
    if new.direcao is distinct from 'entrada' then return new; end if;
    if new.excluido_em is not null then return new; end if;
    if new.numero_cotacao is null and new.referencia_id is null then return new; end if;            -- só e-mail vinculado
    if new.data_mensagem is not null and new.data_mensagem < now() - interval '7 days' then return new; end if;   -- importação de histórico não vira alerta

    v_cot  := case when new.numero_cotacao is not null then ' Nº ' || new.numero_cotacao else '' end;
    v_quem := coalesce(nullif(trim(new.de_nome), ''), new.de_email, 'remetente');
    v_sub  := left(v_quem || ' · ' || coalesce(new.assunto, '(sem assunto)') || ' · abra o Inbox e responda.', 480);
    v_tipo := case new.referencia_tipo
      when 'cotacao_fornecedor' then 'Fornecedor respondeu a cotação' || v_cot
      when 'tratativa_cotacao'  then 'Fornecedor respondeu a tratativa da cotação' || v_cot
      when 'proposta'           then 'Cliente respondeu a proposta' || v_cot
      when 'contrato_venda'     then 'Cliente respondeu o contrato de venda' || v_cot
      when 'contrato_instalador' then 'Instalador respondeu o contrato' || v_cot
      else 'Resposta por e-mail' || case when v_cot <> '' then ' — cotação' || v_cot else '' end
    end;

    -- Resposta de fornecedor ligada a uma cotação a fornecedor: aviso individual para o vendedor, direto na Tratativa.
    if new.referencia_tipo in ('tratativa_cotacao', 'cotacao_fornecedor') and new.referencia_id is not null then
      v_dest := nullif(lower(trim(new.dono_email)), '');
      if v_dest is null then
        select nullif(lower(trim(f.created_by)), '') into v_dest
          from public.cotacoes_elevador_fornecedor c
          join public.formularios_elevador f on f.id = c.formulario_elevador_id
         where c.id::text = new.referencia_id::text;
      end if;
      v_rota := '/comercial/cotacao-fornecedor-detail/' || new.referencia_id::text || '/tratativas';
      v_sub  := left(v_quem || ' · ' || coalesce(new.assunto, '(sem assunto)') || ' · veja a resposta na aba Tratativas da cotação.', 480);
    end if;

    insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values ('inbox-' || new.id::text, 'warning', v_tipo, v_sub, 'Inbox', false, v_dest, v_rota)
    on conflict (id) do nothing;
  exception when others then
    null;   -- nunca bloquear a gravação do e-mail por causa do alerta
  end;
  return new;
end $$;
