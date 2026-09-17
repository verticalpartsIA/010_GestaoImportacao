# WhatsApp na Central de Decisões — design

## 1. Objetivo

Quando uma decisão gerencial (`decisoes_gerenciais`) nasce pendente ou é decidida,
avisar automaticamente por WhatsApp quem precisa saber:

- **Decisão nasce pendente** → avisa cada e-mail em `aprovadores_esperados`
  ("você tem uma aprovação pendente").
- **Decisão é aprovada ou reprovada** → avisa quem pediu a decisão
  ("sua decisão de X foi aprovada/reprovada").

Escopo desta spec: **só o módulo Central de Decisões** (`decisoes-store.js` +
tabela `decisoes_gerenciais`). Outros módulos que hoje inserem em `alertas`
(Proposta, Aval Financeiro, Contrato Instalador, etc.) ficam de fora — cada um
teria sua própria decisão de "quem é o dono", replicada depois desta primeira
fatia provar o padrão.

Não-objetivo: não vamos alterar a Central de Notificações (`alertas`) nem seu
modelo de destinatário (é uma decisão consciente e separada, documentada em
`notificarResultado()`).

## 2. Contexto já levantado

- `decisoes_gerenciais.aprovadores_esperados` (array de e-mails) já resolve
  "quem precisa agir" — populado por `resolverAprovadores(papel)` a partir de
  `EMAILS_FIXOS` (papéis fixos: `ceo`, `owner`, `gestor_comercial`, `rh`,
  `engenharia_lider`, `logistica_lider`) + concessões extras via
  `alcadas_capacidade`.
- `decisoes_gerenciais` **não tem** hoje nenhum campo de "quem pediu a
  decisão" — precisa ser adicionado.
- Identidade "de origem" dos colaboradores (nome/cargo/organograma) vive no
  **vpsistema** (`verticalpartsIA/001_vpsistema`, Supabase
  `ubdkoqxfwcraftesgmbw`) — fora deste repositório. O VP Gestão tem um
  espelho local dela (`colaboradores_vpsistema`, ressincronizado manualmente
  por fora do app, não em tempo real).
- **Correção de levantamento**: a primeira exploração usou contagens de
  linha desatualizadas (estimativa `reltuples` do Postgres via
  `list_tables`, não `COUNT(*)`). Conferido com `COUNT(*)` direto:
  `usuarios`=34, `perfis`=36, `colaboradores_vpsistema`=48 — as três **têm**
  dados reais, nenhuma está vazia. Em particular, `perfis` (colunas: `id`,
  `email`, `nome`, `nivel`, `departamento`, `avatar_url`, `ativo`,
  `criado_em`, `atualizado_em`) é a tabela de perfil **local e ativa** deste
  projeto — não um mirror — já consultada por `decisoes-store.js`
  (`extrasPorAlcada`, via `alcadas_capacidade.perfil_id → perfis.id`). Nenhuma
  das tabelas tem hoje campo de telefone/WhatsApp.
- Padrão de referência já em produção na VerticalParts (VPRequisições,
  documentado em `verticalpartsIA/008_BorderoDiario` →
  `integrations/whatsapp-notificacoes-fluxo-aprovacao.md`): Evolution API
  compartilhada, envio fire-and-forget que nunca bloqueia a ação principal,
  log de auditoria obrigatório desde o início, e-mail/telefone nunca
  hardcoded em texto puro no domínio de negócio.
- **Resposta da Claude VPS** (issue
  [`008_BorderoDiario#11`](https://github.com/verticalpartsIA/008_BorderoDiario/issues/11#issuecomment-5719032106)):
  - Reaproveitar a instância Evolution API **`vprequisicoes`** (não `pv360`,
    que é atendimento a cliente externo — não deve misturar com notificação
    interna de aprovação).
  - Secrets confirmados como Edge Function secrets do projeto
    `jxtqwzmpgofwctqajewt` (nunca no cliente) — mas **não** como
    `EVOLUTION_API_URL`/`EVOLUTION_APIKEY`/`EVOLUTION_INSTANCE` direto: o
    `010_GestaoImportacao` ainda não tem papel provisionado no **cofre
    central de credenciais** (schema `credentials` do Supabase `vpsistema`,
    `ubdkoqxfwcraftesgmbw`) — os slugs existentes hoje são `escamax, pv360,
    vprequisicoes, vpprd, propostas, bdomie, vpproject, livetv, vpclick,
    vpsuprimentos, vpcatraca, visitasbrindes, sharedtools, infrahostinger,
    humans, vpsistema, omieschema`; `gestaoimportacao` não está na lista.
  - Padrão de acesso: a Edge Function conecta ao Postgres do `vpsistema`
    como um papel novo **`svc_gestaoimportacao`** (a ser provisionado) e
    chama `credentials.get_secret('gestaoimportacao', '<CHAVE>')` para cada
    uma das 3 chaves — nunca expõe o valor fora dali. Isso substitui o
    `Deno.env.get('EVOLUTION_APIKEY')` direto que uma primeira leitura do
    guia de replicação sugeriria.
  - **Bloqueio real, fora do alcance desta sessão**: só o Gelson pode
    provisionar `svc_gestaoimportacao` no cofre (acesso `postgres`/PAT
    master do `vpsistema`) — ação de administração de cofre (grant de
    acesso cruzado a uma credencial já existente da instância
    `vprequisicoes`), não criação de credencial nova. Enquanto isso não
    acontece, a Edge Function é implementável e testável (o caminho "sem
    acesso ao cofre" também precisa terminar em log, nunca em exceção — ver
    Seção 8), só o envio real fica bloqueado.
  - Um único novo secret de bootstrap é necessário na Edge Function: a
    string de conexão Postgres do `vpsistema` para o papel
    `svc_gestaoimportacao` (nome de secret proposto:
    `VPSISTEMA_DB_URL`) — é o único credential-like value que este projeto
    precisa guardar; os 3 valores da Evolution API nunca tocam este
    repositório nem o painel deste projeto.

## 3. Arquitetura

```
decisoes-store.js (browser)
  criarDecisao() ──┐
  aprovar()        ├─→ void notifyWhatsappStage({...}).catch(console.warn)
  reprovar()       ┘         │
                              ▼
                 Supabase Edge Function `whatsapp-notify`
                 (Deno, roda no backend — só ela tem as secrets)
                              │
                    resolve número(s) via `perfis.whatsapp_number`
                              │
                    conecta ao Postgres do vpsistema como
                    svc_gestaoimportacao (secret VPSISTEMA_DB_URL)
                              │
                    credentials.get_secret('gestaoimportacao', '<CHAVE>')
                    × 3 (EVOLUTION_API_URL/APIKEY/INSTANCE)
                              │
                    POST {EVOLUTION_API_URL}/message/sendText/{INSTANCE}
                              │
                    grava tentativa em `whatsapp_notification_log`
```

Princípio central (herdado do padrão VPRequisições): **o WhatsApp é um efeito
colateral, nunca uma dependência**. Nenhuma falha de envio pode impedir
criar/aprovar/reprovar uma decisão. A Edge Function nunca lança exceção —
todo caminho (sucesso, erro HTTP, sem número, sem API key) termina em uma
linha de log e um retorno 200.

## 4. Schema (migrations novas)

### 4.1 `perfis.whatsapp_number` — coluna nova na tabela de perfil já ativa

```sql
alter table public.perfis
  add column if not exists whatsapp_number text;
-- Formato: DDI+DDD+número, só dígitos (ex.: 5511999999999) — mesmo formato
-- aceito pela Evolution API.
```

Por que em `perfis` e não em `colaboradores_vpsistema`: a segunda é o mirror
read-only do vpsistema, ressincronizado por fora do app — uma coluna
editável nela seria sobrescrita/perdida no próximo sync. `perfis` é a tabela
de perfil local e ativa deste projeto (36 registros reais), já consultada em
`decisoes-store.js` por e-mail (`extrasPorAlcada`) — mesma chave que
`EMAILS_FIXOS`, `aprovadores_esperados` e `decidido_por` já usam em todo o
módulo, nenhum novo conceito de ID ou tabela.

### 4.2 `decisoes_gerenciais.solicitado_por`

```sql
alter table public.decisoes_gerenciais
  add column if not exists solicitado_por text;
```

Preenchido em `criarDecisao()` com `meuEmail()` (mesma função que já captura o
usuário logado para `decidido_por`). Decisões já existentes ficam com o campo
nulo — não há como reconstruir retroativamente quem pediu.

### 4.3 `whatsapp_notification_log`

```sql
create table if not exists public.whatsapp_notification_log (
  id                uuid primary key default gen_random_uuid(),
  stage             text not null check (stage in ('decisao_pendente', 'decisao_resultado')),
  decisao_id        uuid references public.decisoes_gerenciais(id) on delete set null,
  recipient_email   text,
  recipient_number  text,
  status            text not null check (status in ('sent', 'error', 'skipped_no_apikey', 'skipped_no_number')),
  http_status       int,
  error_detail      text,
  created_at        timestamptz not null default now()
);

create index if not exists whatsapp_notification_log_decisao_id_idx
  on public.whatsapp_notification_log (decisao_id);
create index if not exists whatsapp_notification_log_created_at_idx
  on public.whatsapp_notification_log (created_at desc);

alter table public.whatsapp_notification_log enable row level security;

create policy whatsapp_notification_log_select_admin
  on public.whatsapp_notification_log for select
  to authenticated using (true); -- refinar para só nível Administrador na implementação

-- Inserção sempre via service role dentro da Edge Function (bypassa RLS).
```

## 5. Supabase Edge Function `whatsapp-notify`

Segue o mesmo padrão de `supabase/functions/vp-copiloto` (Deno, secrets do
projeto). Payload de entrada (validado, um enum central de estágios — mesmo
padrão do guia de referência):

```ts
type Stage = 'decisao_pendente' | 'decisao_resultado';

interface NotifyInput {
  stage: Stage;
  decisaoId: string;
  tipo: string;          // decisoes_gerenciais.tipo (chave de TIPO_LABEL)
  numeroCotacao?: number | null;
  recipients: string[];  // e-mails — a function resolve o número de cada um
  // decisao_resultado apenas:
  statusFinal?: 'aprovada' | 'reprovada';
  motivo?: string | null;
}
```

Antes de processar destinatários, a function busca as 3 credenciais da
Evolution API **uma vez por invocação** (não por destinatário):

0. Conecta ao Postgres do `vpsistema` com o secret `VPSISTEMA_DB_URL`
   (connection string do papel `svc_gestaoimportacao`, só leitura no schema
   `credentials`) e chama `credentials.get_secret('gestaoimportacao', k)`
   para `k` em `['EVOLUTION_API_URL', 'EVOLUTION_APIKEY',
   'EVOLUTION_INSTANCE']`. Se `VPSISTEMA_DB_URL` não estiver configurada, ou
   a conexão/chamada falhar, ou `EVOLUTION_APIKEY` vier vazia — trata como
   "sem API key" (ver passo 2) para **todos** os destinatários da chamada,
   registra o motivo em `error_detail` do primeiro log e não tenta de novo
   dentro da mesma invocação.

   > **A confirmar antes de implementar**: a assinatura exata de
   > `credentials.get_secret` (nome dos parâmetros, se é `security definer`,
   > se retorna `text` simples ou uma linha) não foi confirmada nesta sessão
   > — só a descrição funcional veio da Claude VPS. Ler a documentação real
   > em `verticalpartsIA/001_vpsistema` (ou perguntar via issue, se a
   > documentação não bastar) antes do deploy.

Comportamento por destinatário (nunca lança exceção — sempre loga e segue
para o próximo):

1. Busca `whatsapp_number` em `perfis` pelo e-mail.
   Sem registro ou campo vazio → log `skipped_no_number`, próximo destinatário.
2. Sem `EVOLUTION_APIKEY` resolvida (passo 0 falhou) → log `skipped_no_apikey`
   para todos os destinatários pendentes, retorna.
3. Monta o texto (por `stage`):
   - `decisao_pendente`: `"📋 Nova aprovação pendente: {TIPO_LABEL[tipo]}{cotação}. Acesse o VP Gestão para decidir."`
   - `decisao_resultado`: `"✅/❌ Sua decisão de {TIPO_LABEL[tipo]} foi {aprovada/reprovada}{motivo}."`
4. `POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}`,
   header `apikey: {EVOLUTION_APIKEY}`, body `{ number, text }`.
5. Loga `sent` (com `http_status`) ou `error` (com `http_status` +
   `error_detail` truncado).

## 6. Pontos de disparo em `decisoes-store.js`

Wrapper fino, sempre fire-and-forget:

```js
function notificarWhatsapp(payload) {
  const c = sb(); if (!c) return;
  c.functions.invoke('whatsapp-notify', { body: payload }).catch((e) =>
    console.warn('[DecisoesStore] notificarWhatsapp falhou', e));
}
```

- Em `criarDecisao()`, depois do insert bem-sucedido, se `aprovadores.length`:
  `notificarWhatsapp({ stage: 'decisao_pendente', decisaoId: data.id, tipo, numeroCotacao, recipients: aprovadores })`.
- Em `aprovar()`/`reprovar()`, depois do update bem-sucedido, se
  `decisao.solicitado_por`: `notificarWhatsapp({ stage: 'decisao_resultado', decisaoId: id, tipo: decisao.tipo, statusFinal, motivo, recipients: [decisao.solicitado_por] })`.

Nunca `await` — a chamada não pode atrasar nem falhar a ação principal
(criar/aprovar/reprovar), mesmo que a Edge Function esteja fora do ar.

## 7. UI — Configurações → "WhatsApp por Colaborador"

Nova seção simples dentro de `Admin → Configurações` (mesmo grupo de
"Usuários & Perfis" / "Alçadas de Propostas", ambas em `financeiro.jsx`):
lista os e-mails que aparecem em `EMAILS_FIXOS` (mais qualquer um que já
tenha `alcadas_capacidade` para `modulo='decisoes'`), buscando o registro
correspondente em `perfis` por e-mail, com um campo de texto para o número
de WhatsApp e botão salvar — `update perfis set whatsapp_number = ... where
email = ...`. Mesmo gate de alçada usado por "Alçadas de Propostas" (nível
Administrador ou capacidade equivalente).

## 8. Erros e casos de borda

- **Decisão sem `aprovadores_esperados`** (papel sem e-mail fixo nem extra
  concedido): `criarDecisao()` já hoje grava array vazio — `notificarWhatsapp`
  não é chamado (`recipients.length === 0`), sem log gerado (nada para
  tentar).
- **`solicitado_por` nulo** (decisões criadas antes desta mudança, ou criadas
  por fluxo automático sem usuário logado — ex. gates chamados a partir de
  `proposta-store.js`): pula o aviso de resultado, sem erro.
- **E-mail sem número cadastrado em `perfis.whatsapp_number`**: log
  `skipped_no_number`, decisão seguem seu fluxo normal — a UI de
  Configurações (Seção 7) é o lugar para descobrir e corrigir essa lacuna
  (mesma armadilha "cobertura incompleta de números" do guia de referência).
- **`VPSISTEMA_DB_URL` ausente, ou `svc_gestaoimportacao` ainda não
  provisionado no cofre, ou `EVOLUTION_APIKEY` vazia no cofre**: todo envio
  vira `skipped_no_apikey` — não trava nada, mas também não avisa ninguém.
  Este é o estado esperado até o Gelson provisionar o papel no cofre
  central (ver Seção 2) — só validar de verdade depois disso.
- **Evolution API fora do ar / erro HTTP**: log `error` com `http_status` e
  corpo truncado; decisão já foi criada/decidida normalmente antes disso.

## 9. Testes

- Unitário (`decisoes-store.test.js`, novo): `criarDecisao()` grava
  `solicitado_por`; `notificarWhatsapp` é chamado com o payload esperado nos
  3 fluxos (criar/aprovar/reprovar); uma falha simulada de
  `functions.invoke` não impede o retorno normal da função chamadora.
- Edge Function: teste manual (não há harness de Deno neste projeto ainda) —
  chamar com número de teste antes de ligar em produção, conferir linha em
  `whatsapp_notification_log`.
- Fim-a-fim (obrigatório antes de considerar "pronto", por causa do "envio é
  silencioso por design"): criar uma decisão de teste, aprovar, checar que
  chegou WhatsApp real e que `whatsapp_notification_log` tem as 2 linhas
  `sent`.

## 10. Passo a passo de implementação

1. Migrations: `perfis.whatsapp_number`, `decisoes_gerenciais.solicitado_por`,
   `whatsapp_notification_log`.
2. Edge Function `whatsapp-notify` (sem `VPSISTEMA_DB_URL` real ainda —
   testável com `skipped_no_apikey`, que é o caminho esperado até o
   provisionamento do cofre).
3. `decisoes-store.js`: capturar `solicitado_por` em `criarDecisao()`, três
   pontos de disparo (Seção 6). Bump do `?v=` em `index.html` se algum
   arquivo `.jsx`/`.js` referenciado por lá mudar.
4. UI de cadastro (Seção 7) em Configurações.
5. **Bloqueio externo — só o Gelson**: provisionar `svc_gestaoimportacao`
   no cofre central (`credentials` schema do `vpsistema`), com acesso de
   leitura às 3 chaves da instância `vprequisicoes` já existente. Depois
   disso, configurar `VPSISTEMA_DB_URL` como secret da Edge Function
   `whatsapp-notify` no projeto `jxtqwzmpgofwctqajewt`.
6. Popular `perfis.whatsapp_number` com os números reais (fora do código —
   via UI, um admin preenche).
7. Teste fim-a-fim real (Seção 9).
