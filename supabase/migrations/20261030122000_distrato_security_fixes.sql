-- Distrato do Contrato do Instalador — correções de segurança achadas pelo Codex
-- no review do PR (30/10/2026), antes do merge. Migration anterior
-- (20261030120000) já tinha sido aplicada em produção com "CONFIRMO" do
-- usuário; este arquivo corrige 3 achados reais sem mudar o desenho da
-- funcionalidade. Precisa de um novo "CONFIRMO" antes de ser aplicado.
--
-- 1) (P1) Os helpers internos `_di_*` não tinham `revoke execute` — por
--    padrão o Postgres concede EXECUTE a PUBLIC na criação de qualquer
--    função, então `_di_finalizar(id)` (que não confere nenhuma assinatura
--    nem o status do distrato) podia ser chamado direto via RPC por
--    qualquer um com a chave anon, usando só o `id` devolvido por
--    `public_di_obter` — distratando o contrato e apagando as parcelas
--    pendentes sem NENHUMA assinatura. Mesmo padrão já usado pros helpers
--    `_cv_*`/`_ci_*` (ver 20261005110000/20261016180000): revoke explícito
--    de public/anon/authenticated nos 7 helpers internos.
-- 2) (P1) `public_di_fila`/`public_ci_fila` devolviam o TOKEN de assinatura
--    (credencial de uso único, sem outra autenticação) de QUALQUER membro
--    da fila, inclusive de quem ainda não assinou — um detentor de
--    qualquer link da cadeia podia colher o token de Diego/Juliana/Maurício
--    e assinar no lugar deles antes que a pessoa real abrisse o link dela.
--    Corrigido: só devolve o token de quem JÁ assinou (`status = 'assinado'`)
--    — reassinar com um token já assinado é recusado por
--    public_cvs_assinar/public_di_assinar (`status_assinado`), então não é
--    mais explorável; a UI (CI_FilaSlot) já só mostra o Token nesse caso.
-- 3) (P2) `listar_distratos_do_contrato` não conferia sessão/alçada — todo
--    usuário autenticado podia listar o distrato (doc + token) de QUALQUER
--    contrato só com o id. Agora exige vp_usuario_ativo() +
--    vp_tem_capacidade('contrato-instalador','ver') (mesma alçada de leitura
--    do módulo), devolvendo lista vazia sem elas — mesma convenção das
--    demais funções deste recurso.
-- 4) (P2) Testemunha (Diego/Juliana/Maurício) recusar deixava o distrato
--    preso: `_di_apos_recusa` só mandava o aviso, sem nunca marcar
--    `status = 'recusado'` nem fechar a fila — `gerar_distrato_instalador`
--    bloqueia (`ja_existe`) qualquer novo distrato enquanto o anterior não
--    estiver recusado/expirado, então o processo ficava travado pra sempre
--    (a Contratada já tinha assinado, ninguém mais consegue assinar nem
--    recusar de novo). Agora a recusa de um membro da fila fecha o
--    distrato inteiro (`status = 'recusado'`, com quem recusou/motivo) e
--    expira os demais membros ainda pendentes — libera um novo Distrato.

-- ---------- 4) fecha o distrato quando um membro da fila recusa ----------
create or replace function public._di_apos_recusa(s documento_signatarios, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype;
begin
  select * into d from contratos_instalador_distratos where id = s.documento_id::uuid for update;
  if not found then return; end if;
  if d.status not in ('recusado', 'expirado') then
    update contratos_instalador_distratos set status = 'recusado', atualizado_em = now(),
           audit = coalesce(audit, '{}'::jsonb) || jsonb_build_object('refusedAt', now(), 'refusedBy', s.nome, 'refusedReason', p_motivo),
           log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'recusado', 'at', now(), 'meta', jsonb_build_object('nome', s.nome, 'papel', s.papel, 'motivo', p_motivo)))
     where id = d.id returning * into d;
  end if;
  update documento_signatarios set status = 'expirado', atualizado_em = now()
   where documento_tipo = 'distrato_instalador' and documento_id = s.documento_id and id <> s.id and status in ('pendente', 'enviado', 'visualizado');
  perform public._di_aviso('recusada', d, s, s.nome, 'hub.aviso:distrato:' || s.id || ':recusada', p_motivo);
end $$;

-- ---------- 3) exige sessão + alçada 'ver' pra listar ----------
create or replace function public.listar_distratos_do_contrato(p_contrato_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then return '[]'::jsonb; end if;
  if not public.vp_tem_capacidade('contrato-instalador', 'ver') then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(d) order by d.criado_em desc)
                     from contratos_instalador_distratos d where d.contrato_id = p_contrato_id), '[]'::jsonb);
end $$;

-- ---------- 2) token só depois de assinado (não é mais credencial viva exposta) ----------
create or replace function public.public_di_fila(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare did text;
begin
  if coalesce(length(p_token), 0) < 8 then return '[]'::jsonb; end if;
  select id::text into did from contratos_instalador_distratos where token = p_token;
  if did is null then select documento_id into did from documento_signatarios where token = p_token and documento_tipo = 'distrato_instalador'; end if;
  if did is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('ordem', ordem, 'papel', papel, 'nome', nome, 'status', status, 'liberada', liberada_em is not null, 'signed_at', signed_at,
            'token', case when status = 'assinado' then token else null end,
            'audit', jsonb_strip_nulls(jsonb_build_object('signerName', audit->>'signerName', 'signedAt', audit->>'signedAt', 'signDevice', audit->>'signDevice',
              'signIp', audit->>'signIp', 'hash', audit->>'hash', 'signatureType', audit->>'signatureType',
              'signatureData', case when (audit->>'signatureData') like 'data:image/%' then audit->>'signatureData' else null end))) order by ordem)
     from documento_signatarios where documento_tipo = 'distrato_instalador' and documento_id = did and status <> 'expirado'), '[]'::jsonb);
end $$;
revoke execute on function public.public_di_fila(text) from public, anon;
grant execute on function public.public_di_fila(text) to anon, authenticated, service_role;

create or replace function public.public_ci_fila(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cid text;
begin
  if coalesce(length(p_token), 0) < 8 then return '[]'::jsonb; end if;
  select id::text into cid from contratos_instalador where token = p_token;
  if cid is null then select documento_id into cid from documento_signatarios where token = p_token and documento_tipo = 'contrato_instalador'; end if;
  if cid is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('ordem', ordem, 'papel', papel, 'nome', nome, 'status', status, 'liberada', liberada_em is not null, 'signed_at', signed_at,
            'token', case when status = 'assinado' then token else null end,
            'audit', jsonb_strip_nulls(jsonb_build_object('signerName', audit->>'signerName', 'signedAt', audit->>'signedAt', 'signDevice', audit->>'signDevice',
              'signIp', audit->>'signIp', 'hash', audit->>'hash', 'signatureType', audit->>'signatureType',
              'signatureData', case when (audit->>'signatureData') like 'data:image/%' then audit->>'signatureData' else null end))) order by ordem)
     from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = cid and status <> 'expirado'), '[]'::jsonb);
end $$;
revoke execute on function public.public_ci_fila(text) from public, anon;
grant execute on function public.public_ci_fila(text) to anon, authenticated, service_role;

-- ---------- 1) nenhum helper interno chamável direto por anon/authenticated ----------
revoke execute on function
    public._di_aviso(text, contratos_instalador_distratos, documento_signatarios, text, text, text),
    public._di_fila_criar(uuid),
    public._di_liberar_proxima(uuid, text),
    public._di_finalizar(uuid),
    public._di_verificar_completo(uuid, text),
    public._di_apos_assinatura(documento_signatarios),
    public._di_apos_recusa(documento_signatarios, text)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
