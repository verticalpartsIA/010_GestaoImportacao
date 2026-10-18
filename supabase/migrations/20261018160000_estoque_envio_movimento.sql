-- Estoque — fase 4, etapa 3: envio real de ajuste de contagem CONFIRMADO ao Omie (um por vez, pela Edge Function pcp-omie-escrever,
-- ação `enviar_movimento`, chave MOV-<id do movimento>). O movimento já existe no livro-razão; ao enviar, ele só vira 'enviado'.
-- Por isso o espelho da fila (estoque_mov_de_fila) NÃO pode criar um 2º movimento para esse envio: pula chaves MOV-.
create or replace function public.estoque_mov_de_fila() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tipo text; v_qtd numeric; v_cod text;
begin
  if new.tipo = 'ajuste_estoque' and new.status = 'enviado' and new.chave not like 'MOV-%' then
    v_cod  := upper(new.payload #>> '{meta,codigo}');
    v_tipo := new.payload #>> '{meta,tipo}';
    v_qtd  := (new.payload #>> '{meta,quantidade}')::numeric;
    if v_cod is not null and v_qtd is not null and v_tipo in ('ENT', 'SAI') then
      insert into public.estoque_movimentos (codigo, quantidade, origem, enviar_omie, status_omie, referencia, chave, observacao)
      values (v_cod, case when v_tipo = 'SAI' then -v_qtd else v_qtd end, 'pcp_ajuste', true, 'enviado', new.id::text, 'fila:' || new.id,
              left(coalesce(new.payload #>> '{param,obs}', ''), 200))
      on conflict (chave) do nothing;
    end if;
  end if;
  return new;
exception when others then
  return new;
end $$;
