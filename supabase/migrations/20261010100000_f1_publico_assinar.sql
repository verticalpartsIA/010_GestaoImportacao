-- Segurança real (#571) · F1 — página pública /assinar sem leitura direta de tabela (10/10/2026).
-- ADITIVA: só cria/atualiza funções; nenhuma tabela, política ou dado muda. O caminho antigo (leitura direta pelo navegador)
-- continua funcionando enquanto as tabelas estiverem abertas — o front cai nele se estas RPCs não existirem ou falharem.
--
-- O que a página /assinar ainda lia direto (com as RPCs public_proposta_*/public_cv_*/public_cvs_*/public_ci_* já no ar):
--   1. `projetos_elevador_desenhos` — o PDF do Projeto de Instalação (kind 'projeto')       → public_projeto_desenho_obter
--   2. `contrato_venda_signatarios` + `documento_signatarios` por ID do contrato — o bloco
--      de assinaturas digitais do PDF do Contrato de Venda ("Baixar PDF")                    → public_cv_assinaturas
-- Além disso, public_cvs_obter passa a devolver o contrato-pai SEM as colunas que a página não usa e que não pertencem a
-- quem está assinando (o token e o histórico do representante, os destinatários do envio). O formato da resposta é o mesmo.
--
-- Todas: SECURITY DEFINER, search_path fixo, recebem o TOKEN do documento (mínimo 8 caracteres), só tocam o documento
-- daquele token e devolvem só os campos que a página usa. Nenhuma grava nada.

-- ---------- auxiliar (nunca chamável de fora) ----------
-- Só os campos de auditoria que o PDF mostra no bloco de assinaturas (nada de UA completo, histórico ou e-mail).
create or replace function public._pa_audit_assinatura(a jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(coalesce(a, '{}'::jsonb)) as t(k, v)
   where k in ('signerName','signedAt','signDevice','signIp','hash','signatureType','signatureData')
$$;
revoke execute on function public._pa_audit_assinatura(jsonb) from public, anon, authenticated;

-- ---------- RPCs públicas ----------

-- Projeto de Instalação: o token é o do signatário (documento_signatarios, tipo 'projeto_instalacao').
-- Devolve só as colunas que assinar-app.jsx usa para mostrar/baixar o PDF. Token inválido ou de outro tipo → null.
create or replace function public.public_projeto_desenho_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s documento_signatarios%rowtype; d projetos_elevador_desenhos%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into s from documento_signatarios where token = p_token;
  if not found or s.documento_tipo <> 'projeto_instalacao' then return null; end if;
  select * into d from projetos_elevador_desenhos where id::text = s.documento_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', d.id, 'referencia', d.referencia, 'cliente_nome', d.cliente_nome, 'numero_cotacao', d.numero_cotacao,
    'equipamentos', d.equipamentos, 'arquivo_nome', d.arquivo_nome, 'arquivo_url', d.arquivo_url, 'tipo_documento', d.tipo_documento);
end $$;

-- Contrato de Venda: assinaturas já feitas pelos signatários adicionais (sócio/jurídico) e pelos "deve assinar", para o
-- bloco de assinaturas digitais do PDF. Aceita o token do representante (contrato), de um signatário adicional ou de um
-- "deve assinar" do mesmo contrato. Só devolve quem JÁ assinou, sem token/e-mail/telefone/histórico de ninguém.
-- Formato: { ok: true, extras: [...], genericos: [...] } (cada item: papel, nome, status, signed_at, audit) ou null.
create or replace function public.public_cv_assinaturas(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid text;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select id into cid from contratos_venda_equipamentos where token = p_token;
  if cid is null then select contrato_venda_id into cid from contrato_venda_signatarios where token = p_token; end if;
  if cid is null then select documento_id into cid from documento_signatarios where token = p_token and documento_tipo = 'contrato_venda'; end if;
  if cid is null then return null; end if;
  return jsonb_build_object('ok', true,
    'extras', coalesce((select jsonb_agg(jsonb_build_object('papel', s.papel, 'nome', s.nome, 'status', s.status, 'signed_at', s.signed_at,
                                                            'audit', public._pa_audit_assinatura(s.audit)) order by s.ordem, s.signed_at)
                          from contrato_venda_signatarios s where s.contrato_venda_id = cid and s.status = 'assinado'), '[]'::jsonb),
    'genericos', coalesce((select jsonb_agg(jsonb_build_object('papel', s.papel, 'nome', s.nome, 'status', s.status, 'signed_at', s.signed_at,
                                                               'audit', public._pa_audit_assinatura(s.audit)) order by s.ordem, s.signed_at)
                             from documento_signatarios s where s.documento_tipo = 'contrato_venda' and s.documento_id = cid and s.status = 'assinado'), '[]'::jsonb));
end $$;

-- public_cvs_obter (Task 11b, já no ar): mesma assinatura e mesmo formato de resposta; o contrato-pai vem sem `token`,
-- `log` e `recipient` (a página não usa nenhum deles: o token/destinatário mostrados são os do próprio signatário).
create or replace function public.public_cvs_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s1 contrato_venda_signatarios%rowtype; s2 documento_signatarios%rowtype; c contratos_venda_equipamentos%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into s1 from contrato_venda_signatarios where token = p_token;
  if found then
    select * into c from contratos_venda_equipamentos where id = s1.contrato_venda_id;
    return jsonb_build_object('origem', 'cvs', 'sig', to_jsonb(s1),
      'contrato', case when c.id is null then null else to_jsonb(c) - 'token' - 'log' - 'recipient' end);
  end if;
  select * into s2 from documento_signatarios where token = p_token;
  if found then
    if s2.documento_tipo = 'contrato_venda' then select * into c from contratos_venda_equipamentos where id = s2.documento_id; end if;
    return jsonb_build_object('origem', 'doc', 'sig', to_jsonb(s2),
      'contrato', case when c.id is null then null else to_jsonb(c) - 'token' - 'log' - 'recipient' end);
  end if;
  return null;
end $$;

revoke execute on function public.public_projeto_desenho_obter(text), public.public_cv_assinaturas(text), public.public_cvs_obter(text) from public;
grant execute on function public.public_projeto_desenho_obter(text), public.public_cv_assinaturas(text), public.public_cvs_obter(text) to anon, authenticated;
