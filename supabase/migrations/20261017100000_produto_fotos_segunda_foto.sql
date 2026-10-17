-- Segunda foto por produto (curadoria do banco de imagens, 17/10/2026). Aplicada em produção via MCP.
alter table public.produto_fotos add column if not exists url2 text, add column if not exists path2 text;
alter table public.iv_cotacao_itens add column if not exists foto_url2 text;

create or replace function public.public_ivc_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c iv_cotacao_convites%rowtype; l iv_cotacao_lotes%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into c from iv_cotacao_convites where token = p_token;
  if not found or c.status = 'rascunho' then return null; end if;
  select * into l from iv_cotacao_lotes where id = c.lote_id;
  if not found or l.status = 'rascunho' then return null; end if;
  return jsonb_build_object(
    'convite', jsonb_build_object('id', c.id, 'fornecedor_nome', c.fornecedor_nome, 'idioma', c.idioma, 'moeda', c.moeda,
                                  'status', c.status, 'rodada', c.rodada, 'respondido_em', c.respondido_em),
    'lote', jsonb_build_object('numero', l.numero, 'status', l.status, 'encerrado', l.status <> 'em_cotacao'),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade,
                         'quantidade', i.quantidade_pedida, 'obs_vp', i.obs_vp, 'foto_url', i.foto_url, 'foto_url2', i.foto_url2) order by i.ordem, i.codigo)
                         from iv_cotacao_itens i where i.lote_id = l.id), '[]'::jsonb),
    'respostas', coalesce((select jsonb_agg(jsonb_build_object('item_id', r.item_id, 'faixas', r.faixas, 'lead_time_dias', r.lead_time_dias,
                         'moq', r.moq, 'obs', r.obs, 'foto_fornecedor', r.foto_fornecedor, 'rodada', r.rodada))
                         from iv_cotacao_respostas r where r.convite_id = c.id), '[]'::jsonb));
end $$;
