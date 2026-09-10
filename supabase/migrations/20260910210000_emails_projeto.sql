-- E-mails (entrada e saída) vinculados a um projeto (numero_cotacao),
-- 10/09 — pedido do usuário: "a Cotação 0950 é um projeto que vai longe...
-- a caixa de saída e entrada ser de um projeto pois isso pode ajudar a
-- gerar os gatilhos". Alimentada por duas Edge Functions:
--   - send-email: grava linha direcao='saida' quando o chamador passa
--     numeroCotacao (ex.: RFQ ao fornecedor em formulario-elevador.jsx).
--   - read-inbox: lê a caixa suporte@vpsistema.com via IMAP, grava linha
--     direcao='entrada' pra cada mensagem, tentando vincular por
--     Message-ID (vinculo_confianca='certo') ou por regex no assunto
--     contra numero_cotacao real (vinculo_confianca='provavel').
-- numero_cotacao null = e-mail avulso, sem projeto (fica só no Inbox
-- geral). Consumida por linha-do-tempo-store.js (seção 6, "E-mails").

create table public.emails_projeto (
  id uuid primary key default gen_random_uuid(),
  numero_cotacao integer,
  referencia_tipo text,
  referencia_id text,
  direcao text not null check (direcao in ('entrada','saida')),
  de_email text,
  de_nome text,
  para jsonb not null default '[]'::jsonb,
  assunto text,
  corpo_texto text,
  corpo_html text,
  message_id text,
  in_reply_to text,
  imap_uid text,
  vinculo_confianca text check (vinculo_confianca in ('certo','provavel') or vinculo_confianca is null),
  lido boolean not null default false,
  criado_em timestamptz not null default now(),
  data_mensagem timestamptz,
  enviado_por text
);

create unique index emails_projeto_imap_uid_uk on public.emails_projeto (imap_uid) where imap_uid is not null;
create index emails_projeto_numero_cotacao_idx on public.emails_projeto (numero_cotacao);
create index emails_projeto_message_id_idx on public.emails_projeto (message_id);

comment on table public.emails_projeto is
  'E-mails (entrada e saída) da caixa suporte@vpsistema.com, vinculados a um projeto (numero_cotacao) quando possível. vinculo_confianca: certo (bateu Message-ID/In-Reply-To de um e-mail que o próprio site enviou) ou provavel (bateu por regex no assunto contra numero_documento/numero_cotacao existente). numero_cotacao null = e-mail avulso, sem projeto.';

alter table public.emails_projeto enable row level security;
create policy emails_projeto_all_authenticated on public.emails_projeto for all to authenticated using (true) with check (true);
create policy emails_projeto_all_anon on public.emails_projeto for all to anon using (true) with check (true);
