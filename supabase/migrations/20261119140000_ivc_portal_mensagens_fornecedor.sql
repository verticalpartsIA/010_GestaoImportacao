-- Portal do fornecedor (cotação de varejo): mensagem + arquivos do fornecedor na conversa (Tratativas da RFQ Importação).
-- Só por RPC com o token do convite; a tabela continua fechada para a chave pública.
alter table public.iv_cotacao_tratativas add column if not exists origem text not null default 'interno';
alter table public.iv_cotacao_tratativas drop constraint if exists iv_cotacao_tratativas_origem_check;
alter table public.iv_cotacao_tratativas add constraint iv_cotacao_tratativas_origem_check check (origem in ('interno','fornecedor'));

-- Lista a conversa do convite do token (mensagens internas e do fornecedor).
create or replace function public.public_ivc_tratativas_listar(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c iv_cotacao_convites%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return '[]'::jsonb; end if;
  select * into c from iv_cotacao_convites where token = p_token and status <> 'rascunho';
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('autor', case when t.origem = 'fornecedor' then 'You' else 'VerticalParts' end,
            'origem', t.origem, 'mensagem', t.mensagem, 'anexos', t.anexos, 'em', t.created_at) order by t.created_at)
         from iv_cotacao_tratativas t where t.convite_id = c.id), '[]'::jsonb);
end $$;

-- Envia mensagem/arquivos. Valida no servidor: lote em cotação, texto ≤ 4000, ≤ 5 anexos, URL só do storage do projeto,
-- limite de 30 mensagens por hora por convite. Avisa o comprador que criou o lote (alerta individual).
create or replace function public.public_ivc_tratativa_enviar(p_token text, p_mensagem text, p_anexos jsonb default '[]') returns jsonb
language plpgsql security definer set search_path = public as $$
declare c iv_cotacao_convites%rowtype; l iv_cotacao_lotes%rowtype; ax jsonb := '[]'::jsonb; a jsonb; txt text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from iv_cotacao_convites where token = p_token and status <> 'rascunho';
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into l from iv_cotacao_lotes where id = c.lote_id;
  if not found or l.status = 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if l.status <> 'em_cotacao' then return jsonb_build_object('ok', false, 'erro', 'cotacao_encerrada'); end if;
  txt := nullif(btrim(left(coalesce(p_mensagem, ''), 4000)), '');
  if jsonb_typeof(coalesce(p_anexos, '[]'::jsonb)) = 'array' then
    for a in select value from jsonb_array_elements(p_anexos) limit 5 loop
      if jsonb_typeof(a) = 'object' and (a->>'url') ~ '^https://jxtqwzmpgofwctqajewt\.supabase\.co/storage/v1/object/public/engenharia/' then
        ax := ax || jsonb_build_array(jsonb_build_object('nome', left(coalesce(a->>'nome', 'file'), 120), 'url', a->>'url',
              'tipo', left(coalesce(a->>'tipo', ''), 80), 'tamanho', case when (a->>'tamanho') ~ '^[0-9]{1,9}$' then (a->>'tamanho')::bigint else null end));
      end if;
    end loop;
  end if;
  if txt is null and jsonb_array_length(ax) = 0 then return jsonb_build_object('ok', false, 'erro', 'vazio'); end if;
  if (select count(*) from iv_cotacao_tratativas where convite_id = c.id and origem = 'fornecedor' and created_at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', false, 'erro', 'limite');
  end if;
  insert into iv_cotacao_tratativas (convite_id, lote_id, lote_numero, fornecedor_nome, autor, origem, mensagem, anexos)
  values (c.id, l.id, l.numero, c.fornecedor_nome, coalesce(c.fornecedor_nome, 'Fornecedor'), 'fornecedor', txt, ax);
  begin
    insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values ('ivc-msg-' || c.id || '-' || to_char(now(), 'YYYYMMDDHH24MI'), 'info',
            'Fornecedor escreveu na cotação ' || l.numero,
            coalesce(c.fornecedor_nome, 'Fornecedor') || (case when jsonb_array_length(ax) > 0 then ' enviou mensagem/arquivos' else ' enviou uma mensagem' end),
            'Importação', false, l.criado_por,
            '/gestao-importacao/rfq-importacao/' || l.id || '/' || c.id);
  exception when others then raise warning 'ivc aviso: %', sqlerrm;
  end;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.public_ivc_tratativas_listar(text), public.public_ivc_tratativa_enviar(text, text, jsonb) from public;
grant execute on function public.public_ivc_tratativas_listar(text), public.public_ivc_tratativa_enviar(text, text, jsonb) to anon, authenticated;
