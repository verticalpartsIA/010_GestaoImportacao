-- Importação Varejo — o que está POR CHEGAR, por produto (16/10/2026, pedido do usuário).
--
-- Cruza P.I. (pi_importacao.itens) com o embarque (embarques_importacao.status_etapa) e com as
-- notas de entrada de importação já sincronizadas (importacao_varejo_nf_import):
--   quantidade da P.I. − notas já recebidas do produto (consumidas das P.I. mais antigas primeiro)
--   = quantidade ainda por chegar daquela P.I.
-- Estágio pelo status do embarque (preenchido à mão, por isso a NOTA é a verdade sobre "chegou"):
--   Embarque / Desembaraço / Entrega   → a_caminho
--   Concluído (e ainda sem nota)       → chegou_sem_nota   (chegou, falta lançar a nota no Omie)
--   Pagamento / sem embarque           → comprado_pi       (P.I. aberta, ainda não embarcou)
--
-- P.I. sem data_abertura usa created_at - 30 dias (achado: sem isso a nota da Deysse de 06/10 não cobria a P.I.).
-- Limite: a nota é casada por PRODUTO (não por P.I.); uma importação de reposição sem P.I.
-- pode "cobrir" uma P.I. aberta do mesmo produto. A tela mostra o detalhe para conferir.

create or replace view public.importacao_varejo_a_caminho
with (security_invoker = true) as
with itens as (
  select p.id as pi_id, p.numero_pi, p.fornecedor, p.embarque_id,
         coalesce(p.data_abertura, p.created_at::date - 30) as data_abertura,
         upper(trim(i->>'codigo_produto')) as cod,
         coalesce(nullif(i->>'quantidade','')::numeric, 0) as qtd
  from public.pi_importacao p
  cross join lateral jsonb_array_elements(coalesce(p.itens, '[]'::jsonb)) i
  where coalesce(p.status,'') not ilike 'cancel%'
    and trim(coalesce(i->>'codigo_produto','')) <> ''
), acum as (
  select *, sum(qtd) over (partition by cod order by data_abertura, numero_pi, pi_id rows unbounded preceding) as cum,
         min(data_abertura) over (partition by cod) as primeira
  from itens
), pend as (
  select a.*, e.nome_embarque, e.status_etapa, e.eta_santos, e.data_entrega,
         a.qtd - least(a.qtd, greatest(0,
           coalesce((select sum(n.qtd) from public.importacao_varejo_nf_import n
                     where upper(n.codigo) = a.cod and n.data_emissao >= a.primeira), 0) - (a.cum - a.qtd))) as pendente
  from acum a left join public.embarques_importacao e on e.id = a.embarque_id
), est as (
  select *,
    case when status_etapa in ('Embarque','Desembaraço','Entrega') then 'a_caminho'
         when status_etapa = 'Concluído' then 'chegou_sem_nota'
         else 'comprado_pi' end as estagio
  from pend where pendente > 0
)
select cod as codigo,
       coalesce(sum(pendente) filter (where estagio = 'a_caminho'), 0) as a_caminho,
       coalesce(sum(pendente) filter (where estagio = 'chegou_sem_nota'), 0) as chegou_sem_nota,
       coalesce(sum(pendente) filter (where estagio = 'comprado_pi'), 0) as comprado_pi,
       jsonb_agg(jsonb_build_object(
         'pi', numero_pi, 'fornecedor', fornecedor, 'embarque', nome_embarque, 'status_embarque', status_etapa,
         'eta', eta_santos, 'entrega', data_entrega, 'quantidade', pendente, 'estagio', estagio)
         order by data_abertura, numero_pi) as detalhes
from est group by cod;

grant select on public.importacao_varejo_a_caminho to anon, authenticated;
