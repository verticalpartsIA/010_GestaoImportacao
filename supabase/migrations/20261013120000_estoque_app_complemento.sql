-- VP Estoque (app 013_Estoque) · lado do HUB, parte 1: complemento do que JÁ está no banco.
-- Base (já aplicada em produção, migration 'estoque_eventos_e_sessoes', 13/10 04:41, de outra sessão): estoque_sessoes (lista_esperada jsonb
-- [{codigo,saldo}]), estoque_eventos (insert-only, escrita só por service_role) e a view estoque_catalogo_v. Este arquivo NÃO recria nada disso:
-- só acrescenta colunas, a tabela de decisões da revisão e a função única de entrada de eventos.
--
-- Modelo de escrita: o app NUNCA grava direto. A Edge Function (a escrever) valida o login do vpsistema, descobre o e-mail e chama
-- estoque_registrar_eventos(p_email, p_eventos) com a chave de serviço. TODA regra de negócio mora nessa função SQL (testável, uma só verdade).
-- Alçadas (módulo 'estoque', conferidas por e-mail): contar, receber, saida, abrir_sessao, revisar, aprovar. Administrador passa em tudo.
-- (Falta incluir o módulo 'estoque' no catálogo de alçadas do front, colaboradores-admin-store.js, para concedê-las pela tela.)

-- ---------------------------------------------------------------------------------------------
-- Colunas novas (aditivas)
-- ---------------------------------------------------------------------------------------------
alter table public.estoque_sessoes
  add column if not exists tolerancia numeric check (tolerancia is null or tolerancia >= 0),   -- diferença aceita sem recontagem (nula = qualquer diferença pode ser recontada)
  add column if not exists recontagem_obrigatoria boolean not null default false,
  add column if not exists total_itens integer not null default 0,
  add column if not exists fechado_por text;

create or replace function public.estoque_sessoes_total() returns trigger language plpgsql as $$
begin
  new.total_itens := case when jsonb_typeof(new.lista_esperada) = 'array' then jsonb_array_length(new.lista_esperada) else 0 end;
  return new;
end $$;
drop trigger if exists trg_estoque_sessoes_total on public.estoque_sessoes;
create trigger trg_estoque_sessoes_total before insert or update of lista_esperada on public.estoque_sessoes
  for each row execute function public.estoque_sessoes_total();
update public.estoque_sessoes set lista_esperada = lista_esperada;   -- dispara o gatilho nas sessões existentes

alter table public.estoque_eventos
  add column if not exists rodada integer not null default 1 check (rodada between 1 and 5),   -- 1 = contagem; 2+ = recontagem (por OUTRA pessoa)
  add column if not exists aparelho text,                                                       -- limite de aparelhos por sessão
  add column if not exists finalidade text,                                                     -- saída: ordem_producao | obra | consumo_interno
  add column if not exists revisado_por text,
  add column if not exists revisado_em timestamptz,
  add column if not exists motivo_rejeicao text;
create index if not exists estoque_eventos_status_idx on public.estoque_eventos (status, tipo, recebido_em desc);
create index if not exists estoque_eventos_usuario_idx on public.estoque_eventos (usuario, recebido_em desc);

-- Decisões da revisão por item da sessão (o item em si vive na lista_esperada congelada)
create table if not exists public.estoque_sessao_decisoes (
  sessao_id uuid not null references public.estoque_sessoes(id) on delete cascade,
  codigo text not null,                                -- MAIÚSCULAS
  rodada_atual integer not null default 1,
  recontar boolean not null default false,
  decisao text check (decisao is null or decisao in ('aceito', 'justificado', 'zero', 'manual')),
  quantidade_final numeric check (quantidade_final is null or quantidade_final >= 0),
  justificativa text,
  decidido_por text,
  decidido_em timestamptz,
  aprovado_em timestamptz,                             -- quando o resultado foi gravado em importacao_varejo_contagem
  aprovado_por text,
  primary key (sessao_id, codigo)
);
alter table public.estoque_sessao_decisoes enable row level security;
revoke all on public.estoque_sessao_decisoes from anon, authenticated;
grant select on public.estoque_sessao_decisoes to authenticated;
grant all on public.estoque_sessao_decisoes to service_role;
drop policy if exists estoque_dec_sel on public.estoque_sessao_decisoes;
create policy estoque_dec_sel on public.estoque_sessao_decisoes for select to authenticated
  using ((select public.vp_tem_capacidade('estoque', 'revisar')));

-- Evento é imutável: update/delete só por service_role ou pelas funções do hub (que ligam vp.estoque_hub)
create or replace function public.estoque_eventos_imutavel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or coalesce(current_setting('vp.estoque_hub', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'estoque: evento não pode ser alterado nem apagado (use um evento de correção)';
end $$;
drop trigger if exists trg_estoque_eventos_imutavel on public.estoque_eventos;
create trigger trg_estoque_eventos_imutavel before update or delete on public.estoque_eventos
  for each row execute function public.estoque_eventos_imutavel();

-- ---------------------------------------------------------------------------------------------
-- Alçada por e-mail (a função de entrada roda com chave de serviço, sem JWT do usuário)
-- ---------------------------------------------------------------------------------------------
create or replace function public.estoque_cap_email(p_email text, p_cap text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis p
    where lower(p.email) = lower(btrim(coalesce(p_email, ''))) and p.ativo
      and (p.nivel = 'Administrador' or exists (
            select 1 from public.alcadas_capacidade a
            where a.perfil_id = p.id and a.modulo = 'estoque' and a.capacidade = p_cap))) $$;
revoke execute on function public.estoque_cap_email(text, text) from public, anon, authenticated;
grant execute on function public.estoque_cap_email(text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- ENTRADA ÚNICA de eventos do app. Aceita um LOTE (a caixa de saída do aparelho), idempotente por id.
-- Devolve, por evento: {id, ok, duplicado?, erro?}. Um evento com erro não derruba os outros.
-- ---------------------------------------------------------------------------------------------
create or replace function public.estoque_registrar_eventos(p_email text, p_eventos jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e jsonb; v_email text := lower(btrim(coalesce(p_email, ''))); v_out jsonb := '[]'::jsonb;
  v_id uuid; v_tipo text; v_cod text; v_qtd numeric; v_sess uuid; v_rod integer; v_cap text;
  v_ses public.estoque_sessoes%rowtype; v_n integer; v_apar text; v_fin text; v_ref text; v_obs text;
begin
  if v_email = '' then raise exception 'estoque: e-mail do usuário não informado'; end if;
  if jsonb_typeof(p_eventos) <> 'array' then raise exception 'estoque: esperado uma lista de eventos'; end if;
  if jsonb_array_length(p_eventos) > 500 then raise exception 'estoque: lote grande demais (máx. 500 eventos)'; end if;

  for e in select * from jsonb_array_elements(p_eventos) loop
    begin
      v_id := (e->>'id')::uuid;
      if v_id is null then raise exception 'estoque: evento sem id'; end if;
      if exists (select 1 from public.estoque_eventos x where x.id = v_id) then
        v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'ok', true, 'duplicado', true));
        continue;
      end if;

      v_tipo := e->>'tipo';
      v_cod := upper(btrim(coalesce(e->>'codigo', '')));
      v_qtd := (e->>'quantidade')::numeric;
      v_sess := nullif(e->>'sessao_id', '')::uuid;
      v_rod := coalesce((e->>'rodada')::integer, 1);
      v_apar := nullif(btrim(coalesce(e->>'aparelho', '')), '');
      v_fin := nullif(btrim(coalesce(e->>'finalidade', '')), '');
      v_ref := nullif(btrim(coalesce(e->>'referencia', '')), '');
      v_obs := nullif(btrim(coalesce(e->>'observacao', '')), '');

      if v_tipo not in ('recebimento', 'contagem', 'saida', 'inventario') then raise exception 'estoque: tipo inválido'; end if;
      if v_cod = '' then raise exception 'estoque: código vazio'; end if;
      if v_qtd is null then raise exception 'estoque: quantidade ausente'; end if;
      if v_rod < 1 or v_rod > 5 then raise exception 'estoque: rodada inválida'; end if;

      v_cap := case v_tipo when 'contagem' then 'contar' when 'inventario' then 'contar'
                           when 'recebimento' then 'receber' else 'saida' end;
      if not public.estoque_cap_email(v_email, v_cap) then
        raise exception 'estoque: % não tem alçada "%" (ou está inativo)', v_email, v_cap;
      end if;

      if v_tipo in ('contagem', 'inventario') and v_sess is null then raise exception 'estoque: % exige sessão aberta', v_tipo; end if;
      if v_tipo in ('recebimento', 'saida') and v_sess is not null then raise exception 'estoque: % não usa sessão', v_tipo; end if;
      if v_tipo = 'saida' and v_fin is null then raise exception 'estoque: saída exige finalidade (ordem_producao, obra ou consumo_interno)'; end if;
      if v_tipo = 'recebimento' and v_ref is null and v_obs is null then
        raise exception 'estoque: recebimento exige o pedido (referência) ou, se fora do pedido, uma observação';
      end if;

      if v_sess is not null then
        select * into v_ses from public.estoque_sessoes where id = v_sess;
        if not found then raise exception 'estoque: sessão inexistente'; end if;
        if v_ses.estado <> 'aberta' then raise exception 'estoque: a sessão não está aberta'; end if;
        if v_ses.tipo <> v_tipo then raise exception 'estoque: sessão de % não aceita %', v_ses.tipo, v_tipo; end if;
        if v_apar is not null and not exists (select 1 from public.estoque_eventos x where x.sessao_id = v_sess and x.aparelho = v_apar) then
          select count(distinct x.aparelho) into v_n from public.estoque_eventos x where x.sessao_id = v_sess and x.aparelho is not null;
          if v_n >= v_ses.limite_aparelhos then raise exception 'estoque: a sessão já tem % aparelhos (limite)', v_ses.limite_aparelhos; end if;
        end if;
        if not exists (select 1 from jsonb_array_elements(v_ses.lista_esperada) x where upper(btrim(x->>'codigo')) = v_cod) then
          raise exception 'estoque: o código % não está na lista desta sessão', v_cod;
        end if;
        if v_rod > 1 and exists (select 1 from public.estoque_eventos x where x.sessao_id = v_sess and x.codigo = v_cod
                                   and x.rodada < v_rod and lower(x.usuario) = v_email) then
          raise exception 'estoque: a recontagem do % precisa ser feita por outra pessoa', v_cod;
        end if;
      end if;

      insert into public.estoque_eventos (id, tipo, codigo, quantidade, endereco, sessao_id, rodada, referencia, finalidade, aparelho,
                                          usuario, lido_em, recebido_em, status, observacao, foto_url, divergencia)
        values (v_id, v_tipo, v_cod, v_qtd, nullif(btrim(coalesce(e->>'endereco', '')), ''), v_sess, v_rod, v_ref, v_fin, v_apar,
                v_email, coalesce((e->>'lido_em')::timestamptz, now()), now(), 'pendente', v_obs,
                nullif(e->>'foto_url', ''), coalesce((e->>'divergencia')::boolean, false));
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'ok', true));
    exception when others then
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', e->>'id', 'ok', false, 'erro', sqlerrm));
    end;
  end loop;
  return v_out;
end $$;
revoke execute on function public.estoque_registrar_eventos(text, jsonb) from public, anon, authenticated;
grant execute on function public.estoque_registrar_eventos(text, jsonb) to service_role;

-- Defesa em profundidade: o app nunca escreve direto; as tabelas só são lidas com a chave pública (RLS decide)
revoke insert, update, delete, truncate, references, trigger on public.estoque_eventos, public.estoque_sessoes from anon, authenticated;
revoke all on public.estoque_eventos from anon;     -- eventos não têm política de leitura para anon: sem grant também

notify pgrst, 'reload schema';
