-- 23/10/2026 — portal público do fornecedor (/cotacao-elevador-fornecedor/<token>)
-- passa a devolver a letra de revisão. cotacao-elevador-fornecedor.jsx já lê
-- cot.revisao desde a PR #1073 (mesma sessão); sem este campo na RPC pública,
-- o front caía de volta no número sem letra (degradação graciosa, sem erro).
-- Só acrescenta um campo ao whitelist existente — nenhum outro comportamento muda.
create or replace function public._f1pf_cef_publico(r public.cotacoes_elevador_fornecedor) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', r.id, 'numero_documento', r.numero_documento, 'formulario_elevador_id', r.formulario_elevador_id,
    'fornecedor', r.fornecedor, 'tipo_formulario', r.tipo_formulario, 'categoria_produto', r.categoria_produto,
    'status', r.status, 'dados_envio', r.dados_envio, 'respostas', public._f1pf_sem_meta(r.respostas),
    'sent_at', r.sent_at, 'viewed_at', r.viewed_at, 'responded_at', r.responded_at, 'updated_at', r.updated_at,
    'revisao', r.revisao)
$$;
