-- ============================================================
-- Cadastros Mestres — cliente/fornecedor com transação NUNCA é excluído
-- (Área Blindada do CLAUDE.md, regra do Gelson de 31/10/2026; issue #1221;
--  detalhes em docs/modulos/03_cadastros_mestres.md, seção 10)
--
-- 1. cadastro_vinculos(tipo, id): lista as transações do cadastro (fonte única,
--    usada pela tela e pela trava). Só devolve rótulo + quantidade, nunca dados.
-- 2. Gatilho BEFORE DELETE em clientes e fornecedores: com qualquer transação,
--    recusa o DELETE (vale também fora da tela: SQL, chave pública, outra tela).
-- 3. FKs que apagavam em silêncio passam a bloquear:
--    propostas/quadros_comando (SET NULL) e fornecedores_avaliacoes (CASCADE).
--
-- O que conta como transação (decisões do Gelson, 31/10/2026):
--   Cliente: lead, formulário/cotação, dossiê, contrato social, proposta, pedido de
--     quadro, desenho de projeto, pedido de venda do Omie, CADASTRO NO OMIE
--     (codigo_cliente_omie) e troca de e-mails (emails_projeto).
--   Fornecedor: convite de cotação de varejo, cotação de frete, avaliações,
--     citação pelo NOME (P.I., embarque, cotação de elevador, unidade do formulário,
--     expedição, IMS, RFQ, pedido a fornecedor) e troca de e-mails.
-- ============================================================

create or replace function public._cad_norm(t text)
returns text language sql immutable as $$
  select lower(trim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')))
$$;

-- Nome "casa" se um contém o outro (mesma regra de aproximação do RFQ:
-- "Glarie" x "GLARIE ELEVATOR CO.,LTD"). Nomes com menos de 4 letras não casam.
create or replace function public._cad_nome_casa(campo text, nome text)
returns boolean language sql immutable as $$
  select length(public._cad_norm(campo)) >= 4 and length(public._cad_norm(nome)) >= 4
     and (position(public._cad_norm(nome) in public._cad_norm(campo)) > 0
          or position(public._cad_norm(campo) in public._cad_norm(nome)) > 0)
$$;

-- E-mails do cadastro (campo pode ter vários, separados por vírgula/ponto e vírgula/espaço).
create or replace function public._cad_emails(t text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct e), '{}')
  from (select public._cad_norm(x) e
        from regexp_split_to_table(coalesce(t, ''), '[,;\s]+') x) s
  where e like '%@%'
$$;

create or replace function public.cadastro_vinculos(p_tipo text, p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r      jsonb := '[]'::jsonb;
  n      bigint;
  v_nome text; v_fant text; v_emails text[]; v_omie text;
begin
  if p_tipo = 'cliente' then
    select razao_social, nome_fantasia, _cad_emails(email), codigo_cliente_omie::text
      into v_nome, v_fant, v_emails, v_omie
      from clientes where id = p_id;
    if not found then return r; end if;

    select count(*) into n from leads where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Leads', 'qtd', n); end if;
    select count(*) into n from formularios_elevador where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Formulários/cotações', 'qtd', n); end if;
    select count(*) into n from dossier_obra where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Dossiês de obra', 'qtd', n); end if;
    select count(*) into n from contratos_sociais where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Contratos sociais', 'qtd', n); end if;
    select count(*) into n from propostas where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Propostas', 'qtd', n); end if;
    select count(*) into n from quadros_comando where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Pedidos de Quadro de Comando', 'qtd', n); end if;
    select count(*) into n from projetos_elevador_desenhos where cliente_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Desenhos do Projeto de Elevadores', 'qtd', n); end if;
    if v_omie is not null then
      r := r || jsonb_build_object('fonte', 'Cadastrado no ERP Omie', 'qtd', 1);
      select count(*) into n from pcp_pedidos where codigo_cliente::text = v_omie;
      if n > 0 then r := r || jsonb_build_object('fonte', 'Pedidos de venda do Omie', 'qtd', n); end if;
    end if;

  elsif p_tipo = 'fornecedor' then
    select razao_social, nome_fantasia, _cad_emails(email)
      into v_nome, v_fant, v_emails
      from fornecedores where id = p_id;
    if not found then return r; end if;

    select count(*) into n from iv_cotacao_convites where fornecedor_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Cotações de Varejo (convites)', 'qtd', n); end if;
    select count(*) into n from embarques_importacao e
      where exists (select 1 from jsonb_array_elements(case when jsonb_typeof(e.cotacoes_frete) = 'array' then e.cotacoes_frete else '[]'::jsonb end) x
                    where x->>'fornecedor_id' = p_id::text);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Cotações de frete (embarques)', 'qtd', n); end if;
    select count(*) into n from fornecedores_avaliacoes where fornecedor_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Avaliações', 'qtd', n); end if;
    select count(*) into n from fornecedor_avaliacoes where fornecedor_id = p_id;
    if n > 0 then r := r || jsonb_build_object('fonte', 'Avaliações NPS das cotações', 'qtd', n); end if;

    -- Citação pelo nome (razão social ou nome fantasia)
    select count(*) into n from pi_importacao
      where _cad_nome_casa(fornecedor, v_nome) or _cad_nome_casa(fornecedor, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'P.I. (pelo nome)', 'qtd', n); end if;
    select count(*) into n from embarques_importacao
      where _cad_nome_casa(agente_carga, v_nome) or _cad_nome_casa(agente_carga, v_fant)
         or _cad_nome_casa(empresa_desembaraco, v_nome) or _cad_nome_casa(empresa_desembaraco, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Embarques (agente/desembaraço, pelo nome)', 'qtd', n); end if;
    select count(*) into n from cotacoes_elevador_fornecedor
      where _cad_nome_casa(fornecedor, v_nome) or _cad_nome_casa(fornecedor, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Cotações de elevador (pelo nome)', 'qtd', n); end if;
    select count(*) into n from formularios_elevador_unidades
      where _cad_nome_casa(fornecedor, v_nome) or _cad_nome_casa(fornecedor, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Unidades do Formulário (pelo nome)', 'qtd', n); end if;
    select count(*) into n from pcp_expedicoes
      where _cad_nome_casa(transportadora, v_nome) or _cad_nome_casa(transportadora, v_fant);
    if n > 0 then r := r || jsonb_build_object('fonte', 'Expedições (transportadora, pelo nome)', 'qtd', n); end if;
    select count(*) into n from ims_importacao
      where fornecedores::text ilike '%' || p_id::text || '%'
         or (length(_cad_norm(v_nome)) >= 4 and _cad_norm(fornecedores::text) like '%' || _cad_norm(v_nome) || '%');
    if n > 0 then r := r || jsonb_build_object('fonte', 'IMS', 'qtd', n); end if;
    select count(*) into n from rfq_importacao
      where fornecedores::text ilike '%' || p_id::text || '%'
         or (length(_cad_norm(v_nome)) >= 4 and _cad_norm(fornecedores::text) like '%' || _cad_norm(v_nome) || '%');
    if n > 0 then r := r || jsonb_build_object('fonte', 'RFQ de importação', 'qtd', n); end if;
    select count(*) into n from pedidos_fornecedor
      where fornecedor::text ilike '%' || p_id::text || '%'
         or (length(_cad_norm(v_nome)) >= 4 and _cad_norm(fornecedor::text) like '%' || _cad_norm(v_nome) || '%');
    if n > 0 then r := r || jsonb_build_object('fonte', 'Pedidos a fornecedor', 'qtd', n); end if;
  else
    raise exception 'cadastro_vinculos: tipo inválido (%)', p_tipo;
  end if;

  -- Troca de e-mails (cliente e fornecedor): o e-mail do cadastro aparece como
  -- remetente, destinatário ou cópia em emails_projeto (mesmo e-mail excluído conta).
  if coalesce(array_length(v_emails, 1), 0) > 0 then
    select count(*) into n from emails_projeto ep
      where _cad_norm(ep.de_email) = any(v_emails)
         or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(ep.para) = 'array' then ep.para else '[]'::jsonb end) x where _cad_norm(x) = any(v_emails))
         or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(ep.cc) = 'array' then ep.cc else '[]'::jsonb end) x where _cad_norm(x) = any(v_emails));
    if n > 0 then r := r || jsonb_build_object('fonte', 'E-mails trocados (Inbox)', 'qtd', n); end if;
  end if;

  return r;
end;
$$;

revoke all on function public.cadastro_vinculos(text, uuid) from public;
grant execute on function public.cadastro_vinculos(text, uuid) to anon, authenticated;

-- Trava: recusa o DELETE de cadastro com transação.
create or replace function public.cadastro_bloquear_exclusao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  lista text;
begin
  v := public.cadastro_vinculos(case when tg_table_name = 'clientes' then 'cliente' else 'fornecedor' end, old.id);
  if jsonb_array_length(v) > 0 then
    select string_agg(x->>'fonte' || ' (' || (x->>'qtd') || ')', ', ') into lista from jsonb_array_elements(v) x;
    raise exception 'Cadastro com transação não pode ser excluído (Área Blindada). Vínculos: %. Inative o cadastro em vez de excluir.', lista
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

revoke all on function public.cadastro_bloquear_exclusao() from public, anon, authenticated;

drop trigger if exists trg_clientes_bloquear_exclusao on public.clientes;
create trigger trg_clientes_bloquear_exclusao
  before delete on public.clientes
  for each row execute function public.cadastro_bloquear_exclusao();

drop trigger if exists trg_fornecedores_bloquear_exclusao on public.fornecedores;
create trigger trg_fornecedores_bloquear_exclusao
  before delete on public.fornecedores
  for each row execute function public.cadastro_bloquear_exclusao();

-- FKs que apagavam em silêncio passam a bloquear.
alter table public.propostas drop constraint if exists propostas_cliente_id_fkey;
alter table public.propostas add constraint propostas_cliente_id_fkey
  foreign key (cliente_id) references public.clientes(id) on delete restrict;

alter table public.quadros_comando drop constraint if exists quadros_comando_cliente_id_fkey;
alter table public.quadros_comando add constraint quadros_comando_cliente_id_fkey
  foreign key (cliente_id) references public.clientes(id) on delete restrict;

alter table public.fornecedores_avaliacoes drop constraint if exists fornecedores_avaliacoes_fornecedor_id_fkey;
alter table public.fornecedores_avaliacoes add constraint fornecedores_avaliacoes_fornecedor_id_fkey
  foreign key (fornecedor_id) references public.fornecedores(id) on delete restrict;
