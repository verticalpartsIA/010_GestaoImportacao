-- Inbox · triagem silenciosa por regras, no formato "JEV" (04/10/2026, autorizada pelo usuário; só regras, sem API de IA).
-- Cada e-mail de ENTRADA ganha uma decisão estruturada: assunto (escolha), departamento (escolha), urgência (nota 0–10),
-- exige_resposta e reclamação (sim/não), cada uma com probabilidade e confiança — mesmo desenho do JEV.
-- ADITIVO: colunas novas + tabela de regras + 2 gatilhos. NÃO altera send-email, read-inbox, vínculo/matching nem soft-delete.
-- Falha de classificação é engolida (nunca impede o e-mail de ser gravado).
-- A "confiança" é calculada pelas regras (força da evidência × folga sobre a 2ª opção): NÃO é calibrada como a de um modelo.

alter table public.emails_projeto
  add column if not exists ia_decisao jsonb,
  add column if not exists ia_assunto text,
  add column if not exists ia_departamento text,
  add column if not exists ia_prioridade text,
  add column if not exists ia_confianca numeric(4,2),
  add column if not exists ia_classificado_em timestamptz;

create table if not exists public.inbox_regras (
  id serial primary key,
  pergunta text not null check (pergunta in ('assunto', 'reclamacao', 'exige_resposta', 'urgente')),
  opcao text,                                   -- só para pergunta = 'assunto'
  campo text not null check (campo in ('assunto', 'corpo', 'remetente', 'qualquer')),
  padrao text not null,                         -- regex POSIX, sem acento, minúsculas
  peso numeric not null,
  ativo boolean not null default true,
  obs text
);
alter table public.inbox_regras enable row level security;   -- sem policy: só o banco (funções definer) lê; edição por migration

truncate public.inbox_regras restart identity;
insert into public.inbox_regras (pergunta, opcao, campo, padrao, peso) values
  ('assunto','resposta_fornecedor','qualquer','cotacao|rfq|quotation|proforma|cotizacion',2),
  ('assunto','resposta_fornecedor','corpo','unit price|fob|ex.?works|incoterm|moq|lead ?time|price list|\mpi\M',2),
  ('assunto','resposta_fornecedor','qualquer','preco|price|invoice',1),
  ('assunto','resposta_cliente','qualquer','proposta|orcamento|aprovad|aceit|de acordo',2),
  ('assunto','resposta_cliente','corpo','desconto|negocia|condicao de pagamento|prazo de entrega',1),
  ('assunto','contrato_assinatura','qualquer','contrato|assinatura|assinad|minuta|clausula|aditivo|procuracao|docusign|d4sign',2),
  ('assunto','financeiro_pagamento','qualquer','boleto|pagamento|comprovante|deposito|transferencia|vencimento|fatura|duplicata|cobranca|\mpix\M',2),
  ('assunto','avaria_pos_venda','qualquer','avaria|danificad|quebrad|defeito|vazamento|travad|nao funciona|parou de',3),
  ('assunto','avaria_pos_venda','qualquer','garantia|assistencia|manutencao|reclama|insatisf',2),
  ('assunto','pedido_novo','qualquer','gostaria de (um |uma )?(orcamento|cotacao|proposta)|solicit\w* (um |uma )?(orcamento|cotacao|proposta)|preciso de (um |uma )?(orcamento|cotacao|elevador)|tenho interesse|interesse em',3),
  ('assunto','obra_instalacao','qualquer','obra|instalac|montagem|montador|vistoria|cronograma|canteiro|dossie|\mart\M',2),
  ('assunto','fiscal_nf','qualquer','nota fiscal|nf-?e|danfe|\mxml\M|nfs-?e|icms|recibo',3),
  ('assunto','automatico_spam','remetente','no-?reply|noreply|do-?not-?reply|mailer-daemon|postmaster|newsletter|marketing@|news@|notificacao@|naoresponda|nao-responda',4),
  ('assunto','automatico_spam','assunto','unsubscribe|descadastr|webinar|newsletter|promocao|oferta exclusiva|delivery status|undeliverable|failure notice|out of office|resposta automatica|fora do escritorio',4),
  ('reclamacao',null,'qualquer','avaria|danificad|quebrad|defeito|vazamento',2),
  ('reclamacao',null,'qualquer','reclama|insatisf|inaceitavel|absurdo|decepcion|pessim',2),
  ('reclamacao',null,'qualquer','atrasad|atraso|problema|nao funciona|devolu|estorno',1),
  ('exige_resposta',null,'qualquer','\?',2),
  ('exige_resposta',null,'qualquer','favor|poderia|podem|gostaria|solicit|aguardo|aguardamos|retorno|confirm|por gentileza|necessit|preciso',2),
  ('exige_resposta',null,'remetente','no-?reply|noreply|do-?not-?reply|mailer-daemon|naoresponda',-6),
  ('urgente',null,'qualquer','urgente|urgencia|imediat|asap|critico|parado|parada',2),
  ('urgente',null,'qualquer','prazo (vencid|estourad)|hoje|ainda hoje|ate amanha',1);

create or replace function public.inbox_semacento(t text) returns text language sql immutable as $$
  select translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
$$;

-- Devolve a decisão no formato JEV. Pura (só lê inbox_regras).
create or replace function public.inbox_classificar(p_assunto text, p_corpo text, p_de_email text, p_numero_cotacao int, p_referencia_tipo text, p_vinculo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  a text := public.inbox_semacento(p_assunto);
  c text := left(public.inbox_semacento(p_corpo), 6000);
  r text := public.inbox_semacento(p_de_email);
  s jsonb := '{}'::jsonb; x record; alvo text;
  opcoes text[] := array['resposta_fornecedor','resposta_cliente','contrato_assinatura','financeiro_pagamento','avaria_pos_venda','pedido_novo','obra_instalacao','fiscal_nf','automatico_spam','outro'];
  o text; tot numeric := 0; top_o text := 'outro'; top_v numeric := -1; v numeric; probs jsonb := '{}'::jsonb;
  evid numeric; conf numeric; dep text; auto boolean;
  rec_s numeric := 0; rec_p numeric; rec_c numeric; ex_s numeric := 0; ex_p numeric; ex_c numeric; urg numeric := 0; base int; prio text;
begin
  foreach o in array opcoes loop s := s || jsonb_build_object(o, 0); end loop;
  for x in select * from public.inbox_regras where ativo loop
    alvo := case x.campo when 'assunto' then a when 'corpo' then c when 'remetente' then r else a || ' ' || c end;
    if alvo ~ x.padrao then
      if x.pergunta = 'assunto' then s := jsonb_set(s, array[x.opcao], to_jsonb((s->>x.opcao)::numeric + x.peso));
      elsif x.pergunta = 'reclamacao' then rec_s := rec_s + x.peso;
      elsif x.pergunta = 'exige_resposta' then ex_s := ex_s + x.peso;
      elsif x.pergunta = 'urgente' then urg := urg + x.peso;
      end if;
    end if;
  end loop;
  -- contexto do documento de origem pesa mais que palavra solta
  if p_referencia_tipo in ('cotacao_fornecedor', 'tratativa_cotacao') then s := jsonb_set(s, '{resposta_fornecedor}', to_jsonb((s->>'resposta_fornecedor')::numeric + 5)); end if;
  if p_referencia_tipo = 'proposta' then s := jsonb_set(s, '{resposta_cliente}', to_jsonb((s->>'resposta_cliente')::numeric + 5)); end if;
  if p_referencia_tipo in ('contrato_venda', 'contrato_instalador') then s := jsonb_set(s, '{contrato_assinatura}', to_jsonb((s->>'contrato_assinatura')::numeric + 5)); end if;
  if p_numero_cotacao is not null then s := jsonb_set(s, '{pedido_novo}', '0'); end if;
  s := jsonb_set(s, '{outro}', to_jsonb((s->>'outro')::numeric + 1));          -- prior: sem evidência = "outro"
  foreach o in array opcoes loop tot := tot + (s->>o)::numeric; end loop;
  foreach o in array opcoes loop
    v := (s->>o)::numeric;
    probs := probs || jsonb_build_object(o, round(v / tot, 2));
    if v > top_v then top_v := v; top_o := o; end if;
  end loop;
  evid := least(1, (tot - 1 - (s->>'outro')::numeric + 1) / 4.0);
  conf := least(0.99, round((top_v / tot) * (0.5 + 0.5 * greatest(0, evid)), 2));
  auto := top_o = 'automatico_spam';
  dep := case top_o when 'resposta_fornecedor' then 'importacao' when 'resposta_cliente' then 'comercial' when 'contrato_assinatura' then 'juridico'
    when 'financeiro_pagamento' then 'financeiro' when 'avaria_pos_venda' then 'pos_venda' when 'pedido_novo' then 'comercial'
    when 'obra_instalacao' then 'engenharia' when 'fiscal_nf' then 'financeiro' else 'geral' end;

  rec_s := greatest(0, rec_s); rec_p := round(rec_s / (rec_s + 2), 2);
  rec_c := round(greatest(rec_p, 1 - rec_p) * (0.6 + 0.4 * least(1, rec_s / 4.0)), 2);
  ex_s := case when auto then 0 else greatest(0, ex_s) end; ex_p := round(ex_s / (ex_s + 2), 2);
  ex_c := round(greatest(ex_p, 1 - ex_p) * (0.6 + 0.4 * least(1, ex_s / 4.0)), 2);

  base := case top_o when 'avaria_pos_venda' then 7 when 'financeiro_pagamento' then 5 when 'contrato_assinatura' then 5 when 'resposta_cliente' then 5
    when 'pedido_novo' then 5 when 'resposta_fornecedor' then 4 when 'obra_instalacao' then 4 when 'fiscal_nf' then 3 when 'automatico_spam' then 0 else 2 end;
  urg := base + least(urg, 3) + case when rec_p >= 0.5 then 2 else 0 end + case when p_vinculo = 'certo' then 1 else 0 end + case when ex_p >= 0.5 then 1 else 0 end;
  urg := case when auto then least(urg, 1) else least(10, greatest(0, urg)) end;
  prio := case when rec_p >= 0.5 and not auto then 'alta' when urg >= 7 then 'alta' when urg >= 4 then 'media' else 'baixa' end;

  return jsonb_build_object(
    'assunto', jsonb_build_object('opcao', top_o, 'probabilidades', probs, 'confianca', conf),
    'departamento', jsonb_build_object('opcao', dep, 'confianca', conf),
    'urgencia', jsonb_build_object('valor', urg),
    'exige_resposta', jsonb_build_object('resposta', ex_p >= 0.5, 'probabilidade', ex_p, 'confianca', ex_c),
    'reclamacao', jsonb_build_object('resposta', rec_p >= 0.5 and not auto, 'probabilidade', rec_p, 'confianca', rec_c),
    'resumo', jsonb_build_object('assunto', top_o, 'departamento', dep, 'prioridade', prio, 'confianca', conf),
    'origem', 'regras-v1');
end $$;
revoke all on function public.inbox_classificar(text, text, text, int, text, text) from public, anon, authenticated;

-- 1) Classifica todo e-mail de ENTRADA ao ser gravado (BEFORE INSERT). O upsert do cron não reclassifica linhas existentes
--    (o UPDATE do conflito só altera as colunas que ele envia).
create or replace function public.emails_projeto_classificar() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  begin
    if new.direcao = 'entrada' then
      d := public.inbox_classificar(new.assunto, coalesce(new.corpo_texto, regexp_replace(coalesce(new.corpo_html, ''), '<[^>]+>', ' ', 'g')),
                                    new.de_email, new.numero_cotacao, new.referencia_tipo, new.vinculo_confianca);
      new.ia_decisao := d;
      new.ia_assunto := d->'resumo'->>'assunto';
      new.ia_departamento := d->'resumo'->>'departamento';
      new.ia_prioridade := d->'resumo'->>'prioridade';
      new.ia_confianca := (d->'resumo'->>'confianca')::numeric;
      new.ia_classificado_em := now();
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_emails_projeto_classificar on public.emails_projeto;
create trigger trg_emails_projeto_classificar before insert on public.emails_projeto
  for each row execute function public.emails_projeto_classificar();

-- 2) Alerta só do que importa e NÃO tem cotação (e-mail vinculado já é avisado por trg_alertas_inbox_resposta):
--    prioridade alta ou reclamação. Um alerta por e-mail (id determinístico), falha engolida.
create or replace function public.alertas_inbox_triagem() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ass text;
begin
  begin
    if new.direcao is distinct from 'entrada' or new.excluido_em is not null or new.ia_decisao is null then return new; end if;
    if new.numero_cotacao is not null or new.referencia_id is not null then return new; end if;
    if new.data_mensagem is not null and new.data_mensagem < now() - interval '7 days' then return new; end if;
    if new.ia_prioridade = 'alta' or coalesce((new.ia_decisao->'reclamacao'->>'resposta')::boolean, false) then
      v_ass := case new.ia_assunto when 'avaria_pos_venda' then 'Avaria / pós-venda' when 'financeiro_pagamento' then 'Financeiro' when 'contrato_assinatura' then 'Contrato'
        when 'pedido_novo' then 'Pedido novo' when 'resposta_cliente' then 'Cliente' when 'resposta_fornecedor' then 'Fornecedor' when 'obra_instalacao' then 'Obra'
        when 'fiscal_nf' then 'Fiscal' else 'E-mail' end;
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values ('inboxia-' || new.id::text, 'warning', 'Inbox · ' || v_ass || ' · prioridade ' || coalesce(new.ia_prioridade, 'alta'),
              left(coalesce(nullif(trim(new.de_nome), ''), new.de_email, 'remetente') || ' · ' || coalesce(new.assunto, '(sem assunto)') || ' · sem cotação vinculada.', 480),
              'Inbox', false, '/geral/inbox')
      on conflict (id) do nothing;
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists trg_alertas_inbox_triagem on public.emails_projeto;
create trigger trg_alertas_inbox_triagem after insert on public.emails_projeto
  for each row execute function public.alertas_inbox_triagem();

-- Carga inicial: classifica o que já está gravado (UPDATE não dispara alerta: o gatilho acima é só de INSERT).
update public.emails_projeto e set
  ia_decisao = d.j, ia_assunto = d.j->'resumo'->>'assunto', ia_departamento = d.j->'resumo'->>'departamento',
  ia_prioridade = d.j->'resumo'->>'prioridade', ia_confianca = (d.j->'resumo'->>'confianca')::numeric, ia_classificado_em = now()
from (select id, public.inbox_classificar(assunto, coalesce(corpo_texto, regexp_replace(coalesce(corpo_html, ''), '<[^>]+>', ' ', 'g')),
                                           de_email, numero_cotacao, referencia_tipo, vinculo_confianca) j
        from public.emails_projeto where direcao = 'entrada' and ia_decisao is null) d
where e.id = d.id;
