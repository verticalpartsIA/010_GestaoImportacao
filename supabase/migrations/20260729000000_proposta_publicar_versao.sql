-- "Publicar" a Proposta = congelar a versão oficial.
--
-- Problema que isto resolve: a página pública de assinatura renderiza
-- propostas.data_json AO VIVO, e o hash da assinatura é calculado sobre o
-- data_json no instante em que o cliente assina. Como o vendedor pode
-- editar a proposta depois de enviada, o cliente podia assinar um
-- documento diferente do que leu — sem nenhum registro de qual conteúdo
-- ele viu.
--
-- A partir daqui: publicar congela um snapshot imutável; a página de
-- assinatura passa a mostrar (e o hash a cobrir) essa versão congelada.
-- Editar depois de publicado não altera o que o cliente recebeu — gera uma
-- nova versão, que só vale quando publicada de novo.
alter table public.propostas
  add column if not exists versao_publicada jsonb,
  add column if not exists publicado_em timestamptz,
  add column if not exists publicado_por text;

create index if not exists propostas_publicado_em_idx on public.propostas (publicado_em);

comment on column public.propostas.versao_publicada is
  'Snapshot imutável do data_json no momento da publicação — é o que o cliente lê e assina.';
comment on column public.propostas.version is
  'Incrementa a cada republicação; a versão vigente é a que está em versao_publicada.';
