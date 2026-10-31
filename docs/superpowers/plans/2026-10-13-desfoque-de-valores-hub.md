# Desfoque de valores em R$ no HUB — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o HUB respeitar, de verdade, o que o Gelson escolhe em **vpsistema.com/administracao → Valores R$** (modo `nenhum`/`todos` + exceções por etiqueta `modulo.etiqueta`): quem não pode ver um valor o vê **desfocado** na tela (o registro continua visível) e, quando a decisão for "segurança real", **o banco não entrega nem aceita** esse valor — **sem derrubar nenhum fluxo de produção**.

**Architecture:** (1) Fonte da verdade continua sendo o vpsistema → `valores_acesso` no HUB (já sincronizado, ver "Fatos"). (2) Uma RPC `vp_ve_valores(tags[])` (identidade = sessão `authenticated`, via `vp_email()`) devolve `{tag: boolean}` para quem está logado. (3) No front, `src/vp-valores.js` (`VpValores`) guarda esse mapa e expõe `pode(tag)` e o componente `<Valor etiqueta="…">`, que desfoca. (4) As telas passam a usar o componente nos campos de R$. (5) Onde o valor sai de Edge Function/Omie, a função confere a identidade e omite/zera o valor. (6) Só depois, a trava do banco (F1, `vp_valores_guarda`) é ligada para todos e a chave pública (`anon`) é fechada nas tabelas de valores (F4 da #571).

**Tech Stack:** Supabase (Postgres RLS, RPC `SECURITY DEFINER`, Edge Functions Deno), supabase-js v2 (UMD, sem build), React UMD/Babel, node:test, Playwright (`e2e/`).

**Contexto:** continuação da issue #571 (autenticação real + RLS) — fases F0 (sessão) e F1 (trava de valores no banco, em piloto) já estão em produção; ver `20261010130000_f1_valores_no_banco.sql` e `docs/superpowers/plans/2026-10-02-autenticacao-e-rls-571.md`.

## Global Constraints

- **Sem etapa de build.** Todo `.js/.jsx` novo entra no `index.html` (e nas páginas públicas que usarem) **com `?v=N` incrementado a cada edição** — conferir contra `origin/main` no merge (lição do PR #529).
- **Áreas blindadas do CLAUDE.md** (Precificação — preço de containers e mão de obra, Inbox/e-mail, Central de Decisões, Proposta de Elevador): **parar, informar o usuário e pedir confirmação explícita antes de editar**. Este plano toca em `precificacao-elevador.jsx`/`-store.js` e `proposta-*` (Task 4): cada edição exige o aviso.
- **Projeto Supabase do app:** `jxtqwzmpgofwctqajewt` (vpprd). **Projeto de identidade e de decisões:** `ubdkoqxfwcraftesgmbw` (vpsistema) — fora deste repo; a tela de Administração é de lá.
- **Break-glass da API de gerenciamento do Supabase está desligado**: não contornar.
- **Deploy de Edge Function:** testar o boot numa **cópia descartável** (`<nome>-teste`, apagar depois) antes de publicar em cima da função de produção. `postgres.js`: parâmetro jsonb vai como `${JSON.stringify(x)}::text::jsonb` (com `::jsonb` direto serializa duas vezes).
- **Cada migration tem rollback documentado e testado.** O piloto de valores nasce **desligado** para todos e só liga por e-mail (`vp_valores_piloto`); desligar = remover a linha.
- **Nunca** liberar valor "para facilitar" nem trocar fail-closed por fail-open: sem sessão ou sem resposta da RPC, **desfocar**.
- **Dado de teste em produção** leva o rótulo `Claude teste notebook` + data e é removido ao fim. Nunca enviar e-mail real a terceiros nem escrever no Omie fora de teste autorizado.
- **Segredos nunca entram no git.**
- `npm test` deve continuar verde; todo componente/RPC novo entra com teste.

## Fatos verificados (13/10/2026)

| Fato | Evidência |
|---|---|
| O vpsistema envia ao HUB, por pessoa, `modo` (`todos`/`nenhum`), `liberar[]` e `esconder[]` em `valores_acesso` | Edge Function `vpsistema-sync` (v6), `valores_acesso` com 41 linhas |
| `vp_ve_valor(perfil uuid, tag text)` decide: `todos` → `not (tag ∈ esconder)`; senão `tag ∈ liberar`; sem linha → `false` | `pg_get_functiondef` |
| **Nenhuma tela do HUB lê `valores_acesso` nem chama `vp_ve_valor`** | busca no repositório inteiro: só migrations |
| A trava no banco (F1) cobre **17 tabelas** (gatilho `vp_valores_guarda`; 9 com política de leitura `vp_valores_leitura`) e **12 das 25 etiquetas** do catálogo | `vp_valores_regra` × `catalog_value_tags` |
| **Está em piloto: só o Gelson** em `vp_valores_piloto` | tabela |
| Modos de tabela: `fechada` (sem a etiqueta não lê nem grava) e `mista` (lê, só grava quem tem a etiqueta) — **em `mista` o valor continua visível** | migration F1 |
| 13 etiquetas sem regra de banco: `almoxarifado.custo_estoque`, `cadastro-produtos.preco_lista`, `compras.valores_compra`, `dashboard.faturamento_kpis`, `emissao-nf.faturamento`, `financeiro.contas_pagar`, `gi-analise-precos.precos_comparados`, `instalacao.valores_obra`, `leads.comissao_lead`, `pcp.valor_hh`, `pedidos-acompanhamento.valor_pedido`, `relatorios-pcp.receita_margem`, `vistorias.custo_vistoria` | comparação dos dois catálogos |
| Sessão real (F0) está `on` para todos (`vp_auth_piloto` com `'*'`), mas **só 14 dos 36 perfis ativos têm usuário em `auth.users`**; os outros 22 falam com o banco pela chave pública | `perfis` × `auth.users` |
| Entre os 22 sem sessão há **contas compartilhadas**: `almoxarifado@`, `expedicao@`, `producao@`, `automacao@` | lista |
| Ligar a trava para todos hoje (pelas alçadas atuais): **8 pessoas perdem leitura** (20 pares pessoa-tabela `fechada`) e **13 perdem escrita** (46 pares `mista`) | simulação em 13/10 (query na Task 11) |
| 31 dos 35 perfis com valores registrados estão em `nenhum`; só Diego, Gelson, Juliana e Regiane estão em `todos`; 12 exceções `liberar` | `valores_acesso` / `user_value_exceptions` |
| A chave pública (`anon`) ainda lê/grava as tabelas de valores (F4 da #571 não feita) | CLAUDE.md, seção #843/#571 |
| Muito valor mora em blocos jsonb (`data_json` da proposta, `resultado_v2` da precificação) | migration F1 |

## Decisões que dependem do usuário (responder antes da Fase 2)

- **D1 — Nível de garantia.** (A) **Organização na tela**: desfoca no front, rápido, contornável por quem chamar o banco direto; (B) **Segurança real**: A + trava no banco + fechar `anon` (Fases 4–5). Recomendado: entregar A primeiro, B em seguida — mas o texto da tela de Administração deve dizer a verdade enquanto só A valer.
- **D2 — Padrão de quem vê o quê.** Hoje 31 de 35 estão em `nenhum`. Antes de ligar, decidir pessoa a pessoa (ou por departamento) quem passa a `todos` ou ganha `liberar` — começando pelas 8+13 pessoas afetadas (Task 11).
- **D3 — Contas compartilhadas** (`almoxarifado@`, `expedicao@`, `producao@`, `automacao@`): valor sempre desfocado (recomendado), ou liberar por conta? E como elas obtêm sessão.
- **D4 — Como desfocar.** Recomendado: texto `R$ ••••` em fonte tabular com `filter: blur`, sem o valor real no DOM (não só CSS — senão "Inspecionar" revela). Alternativa: ocultar o campo.
- **D5 — Valor dentro de jsonb.** Recomendado: no front, mascarar na renderização; no banco (B), a tabela vira `fechada` ou o bloco passa a sair por RPC que remove os campos de R$.

## Review Focus (modos de falha que nenhuma tarefa de tela testa sozinha)

1. **Valor real no DOM / em `console`/rede**: desfoque só em CSS vaza o número. *(Task 3, Task 13)*
2. **Falha silenciosa para "tudo liberado"**: RPC fora do ar ou sem sessão não pode virar "pode ver". *(Task 2, Task 3)*
3. **PDFs, e-mails, exportações e WhatsApp** montam o valor fora da tela (propostas, contratos, fichas, relatórios): precisam do mesmo filtro ou ficam como brecha. *(Task 4, Task 6)*
4. **Cálculos que dependem do valor** (margem, markup, totais) quebram quando o campo vem mascarado — o desfoque é só de exibição; o cálculo continua com o dado real quando a função é interna/servidor. *(Task 4)*
5. **Quem trabalha no módulo mas não vê o valor** (ex.: engenharia em Precificação) não pode perder a tela inteira: só o campo. *(Task 4, Task 11)*
6. **Cache de permissão** na aba aberta: mudança na tela do vpsistema precisa valer sem reinstalar o site (TTL curto + recarregar ao focar). *(Task 3)*
7. **Perfis sem sessão** (22) leem tudo pela chave pública: o desfoque do front até funciona para eles, mas o banco não os protege. *(Fase 4)*

## Mapa: etiqueta → onde o valor aparece

> A coluna "Onde" é **hipótese a confirmar na Task 1** (busca no código + conferência na tela). A coluna "Banco" é o estado verificado em 13/10.

| Etiqueta | Banco (F1) | Onde (a confirmar) |
|---|---|---|
| `propostas.preco_proposta` | mista (`propostas`, `proposta_itens`) | `proposta-store.js`, `proposta-*.jsx`, PDF da proposta |
| `precificacao.custos_precificacao`, `precificacao.margem` | fechada (`precificacoes_elevador`) | `precificacao-elevador.jsx` / `-store.js` (**blindada**) |
| `precificacao.comissao` | fechada (`comissoes`, `regras_comissionamento`) | comissionamento (`comissionamento-store.js`) |
| `aval-financeiro.valores_aval` | fechada (`avais_financeiros`) | `aval-financeiro.jsx` |
| `cadastro-custos.custos` | fechada (3 tabelas de custos) | `cadastro-custos.jsx` |
| `contrato-instalador.pagamento_instaladores` | fechada/mista | `contrato-instalador*.jsx`, `pagamentos-instalador` |
| `contrato-venda-equipamentos.valor_contrato` | mista | `contrato-venda*.jsx` (+ PDF) |
| `cotacoes-fornecedor.preco_fornecedor` | mista | `cotacoes-fornecedor.jsx` |
| `embarques-importacao.valores_embarque`, `pi-importacao.valores_pi`, `ims-importacao.valor_previsto_ims` | mista/fechada | `embarques-importacao.jsx`, PI, `ims-store.js` |
| `emissao-nf.faturamento` | **sem regra** | `emissao-nf.jsx` (valor vem do Omie?) |
| `dashboard.faturamento_kpis` | **sem regra** | `dashboard*.jsx`, `dashboard-metrics-*.js` |
| `financeiro.contas_pagar` | **sem regra** | `financeiro.jsx` |
| `pedidos-acompanhamento.valor_pedido` | **sem regra** | `pedidos-acompanhamento.jsx` |
| `compras.valores_compra`, `almoxarifado.custo_estoque` | **sem regra** | `almoxarifado*.jsx`, compras |
| `instalacao.valores_obra`, `vistorias.custo_vistoria` | **sem regra** | `instalacao-*.jsx`, `vistorias-*.jsx` |
| `leads.comissao_lead`, `cadastro-produtos.preco_lista`, `gi-analise-precos.precos_comparados` | **sem regra** | `crm.jsx`, `cadastro-itens.jsx`, GI |
| `pcp.valor_hh`, `relatorios-pcp.receita_margem` | sem regra de tabela (HH já sai só da função `pcp-hh` para quem tem `ver_hh`) | `pcp.jsx`, `relatorios-pcp*.jsx` |

---

## FASE 0 — Decisão e inventário (nenhuma mudança em produção)

### Task 0: Decidir D1–D5 e a matriz "quem vê o quê"

**Files:**
- Create: `docs/seguranca/matriz-valores.md` (decisões + matriz pessoa × etiqueta)

- [ ] **Step 1:** Levar D1–D5 ao Gelson (uma pergunta por vez, com a recomendação).
- [ ] **Step 2:** Gerar a lista "quem perderia o quê" com a query da Task 11 (modo simulação) e discutir pessoa a pessoa; as mudanças de `modo`/`liberar` são feitas **no vpsistema** (Administração), não aqui.
- [ ] **Step 3:** Registrar as respostas no arquivo e no CLAUDE.md. **Commit.**

### Task 1: Inventário de onde cada valor aparece

**Files:**
- Create: `scripts/valores-inventario.mjs`
- Create: `docs/seguranca/inventario-valores.md` (gerado)

- [ ] **Step 1:** Script que, para cada etiqueta do mapa acima, procura no `src/` e nas Edge Functions os campos de R$ (`valor`, `preco`, `custo`, `margem`, `total`, `comissao`, `faturamento`…) e as colunas das tabelas `vp_valores_regra`, listando arquivo:linha.
- [ ] **Step 2:** Conferir cada etiqueta **na tela** (Playwright ou navegador) e marcar: tela, PDF, e-mail, exportação, WhatsApp, Edge Function/Omie.
- [ ] **Step 3:** Preencher a coluna "Onde" do mapa com o que for confirmado; separar o que vem de **tabela**, de **jsonb** e de **Omie/função**.
- [ ] **Step 4: Commit** — `docs(valores): inventário de onde cada valor em R$ aparece`.

---

## FASE 1 — Fundações (aditivas; nada muda para o usuário)

### Task 2: RPC `vp_ve_valores(tags text[])`

**Files:**
- Create: `supabase/migrations/<data>_vp_ve_valores_rpc.sql`
- Create: `supabase/tests/valores/vp_ve_valores.sql`

**Interfaces:**
- Consumes: `vp_email()`, `valores_acesso`, `perfis`, `vp_ve_valor`.
- Produces: `vp_ve_valores(p_tags text[]) → jsonb {modo, tags: {"modulo.etiqueta": boolean}}` — `SECURITY DEFINER`, `STABLE`, **executável por `authenticated` e `anon`** (anon recebe tudo `false`).

- [ ] **Step 1: Teste que falha** — chamar como `anon` e como `authenticated` com e-mail de pessoa em `nenhum`/`todos`/com `esconder`/com `liberar`; pessoa sem `perfis` e sem sessão → tudo `false`.
- [ ] **Step 2: Implementar** (perfil por `lower(email) = vp_email()`; sem linha em `valores_acesso` → `false`; reaproveitar `vp_ve_valor`).
- [ ] **Step 3: Verificar** — usar a sonda `vp_rls_probe` (#571) e os 4 casos acima; incluir o caso "faturamento escondido" da Juliana (13/10).
- [ ] **Step 4: Rollback** — `drop function public.vp_ve_valores(text[])`. **Commit.**

### Task 3: `VpValores` + componente `<Valor>`

**Files:**
- Create: `src/vp-valores.js`, `src/vp-valores.test.js`
- Modify: `index.html` (carregar depois de `vp-auth.js`/`supabase.js`, com `?v=1`)

**Interfaces:**
- `VpValores.pronto: Promise`; `VpValores.pode(tag): boolean` (síncrono depois de `pronto`; **antes ou em erro → `false`**); `VpValores.recarregar()`; `VpValores.onChange(fn)`.
- `window.Valor` (React): `<Valor etiqueta="propostas.preco_proposta">{texto}</Valor>` — quando não pode, renderiza `R$ ••••` **sem o valor real nos filhos** (não renderiza `children`).
- `VpValores.fmtOculto(tag, valor, fmt)` para uso em strings (PDF/e-mail/CSV).

- [ ] **Step 1: Testes (node:test)** — fail-closed (RPC falha, sem sessão, tag desconhecida → oculto); mapa muda → `onChange` dispara; o valor real **não** aparece na saída quando oculto.
- [ ] **Step 2: Implementar** — busca a RPC da Task 2 com a lista fixa de tags conhecidas; **TTL de 5 min** e recarrega quando a aba volta ao foco (Review Focus #6); logs só de contagem, nunca do valor.
- [ ] **Step 3: Smoke Playwright** — `e2e/valores.spec.js`: usuário em `nenhum` vê `R$ ••••`, em `todos` vê o número; DOM não contém o valor real quando oculto (`page.content()`).
- [ ] **Step 4: Commit.**

---

## FASE 2 — Telas (uma onda por grupo de etiquetas; cada onda é um PR)

> Regra comum a toda onda: (a) achar **todas** as saídas do valor (tela, PDF, e-mail, exportação, WhatsApp) com o inventário da Task 1; (b) trocar a exibição por `<Valor>`/`fmtOculto`; (c) **não** alterar cálculo; (d) teste com usuário `nenhum` e `todos`; (e) rollback = reverter o PR (o piloto continua desligado).

### Task 4: Proposta e Precificação (`propostas.preco_proposta`, `precificacao.*`)

**Files (a confirmar na Task 1):** `src/proposta-store.js`, `src/proposta-*.jsx`, PDF da proposta, `src/precificacao-elevador.jsx` / `-store.js`, `src/comissionamento-store.js`.

- [ ] **Step 1:** **Avisar o Gelson e pedir confirmação** (áreas blindadas: Precificação, Mão de obra, Proposta de Elevador).
- [ ] **Step 2:** Mascarar preço/itens/desconto da proposta e custos/margem/comissão da precificação; manter o cálculo com o dado real (Review Focus #4).
- [ ] **Step 3:** PDF/e-mail da proposta: quem não vê o preço **não gera** o PDF com valores (botão mostra o motivo), ou gera versão sem preço — decidir na D1/D2.
- [ ] **Step 4:** Testes + smoke; conferir com a Juliana (vê) e com um usuário `nenhum` (não vê). **Commit/PR.**

### Task 5: Dashboard, Financeiro e Emissão de NF (`dashboard.faturamento_kpis`, `financeiro.contas_pagar`, `emissao-nf.faturamento`)

**Files:** `src/dashboard*.jsx`, `src/dashboard-metrics-*.js`, `src/financeiro.jsx`, `src/emissao-nf.jsx`.

- [ ] **Step 1:** Mapear de onde vem o número (tabela, Omie, função).
- [ ] **Step 2:** Mascarar KPIs/linhas; para gráficos, esconder o eixo de R$ e deixar só a forma, ou o card inteiro (D4).
- [ ] **Step 3:** O que vier de Edge Function/Omie vai para a Task 8.
- [ ] **Step 4:** Testes + smoke. **Commit/PR.**

### Task 6: Importação e custos (`embarques-importacao.*`, `pi-importacao.*`, `ims-importacao.*`, `cotacoes-fornecedor.*`, `cadastro-custos.*`, `aval-financeiro.*`, `gi-analise-precos.*`)

- [ ] **Step 1–4:** mesmo molde da Task 4. Atenção ao Review Focus #3 (exportações e PDFs de embarque/PI).

### Task 7: Operação e demais etiquetas (`pedidos-acompanhamento`, `compras`, `almoxarifado`, `instalacao`, `vistorias`, `leads`, `cadastro-produtos`, `pcp`, `relatorios-pcp`)

- [ ] **Step 1–4:** mesmo molde. `pcp.valor_hh`: já é protegido por `pcp.ver_hh` na função `pcp-hh`; apenas alinhar com a etiqueta (uma só fonte de verdade).

---

## FASE 3 — Valores que saem de Edge Function / Omie

### Task 8: Funções que montam R$ no servidor

**Files:** Edge Functions identificadas na Task 1 (dashboard/NF/Omie), `supabase/functions/*`.

**Interfaces:** a função recebe o JWT da sessão (`verify_jwt: true`), resolve o e-mail, chama `vp_ve_valores` (ou `vp_ve_valor`) e **omite/zera** os campos de R$ quando não pode.

- [ ] **Step 1:** Listar as funções que devolvem R$ ao navegador; **avisar o Gelson** se tocar em área blindada.
- [ ] **Step 2:** **Levar a sessão até a função.** Hoje `VpAuth.fetchDados` (`src/vp-auth.js`) só troca o `Authorization` em `/rest/v1/`; `sb.functions.invoke` segue com a chave pública. Só ligar `verify_jwt: true` faria a função enxergar **anônimo** e, em fail-closed, esconder valores até de quem pode. Anexar `VpAuth.getAccessToken()` (cliente de funções compartilhado ou cada chamador afetado) **antes** de publicar a checagem.
- [ ] **Step 3:** Implementar a checagem na função; fail-closed; não logar valores. Testar **as duas identidades** (quem pode ver e quem não pode) e o caso sem sessão.
- [ ] **Step 4:** Testar em cópia descartável (`<função>-teste`), depois publicar; apagar a cópia.
- [ ] **Step 5: Commit/PR.**

---

## FASE 4 — Cobertura de login (pré-requisito da garantia real)

### Task 9: Fazer os 22 perfis sem sessão entrarem

**Files:** nenhum de código obrigatório; relatório em `docs/seguranca/cobertura-login.md`.

- [ ] **Step 1:** Query de acompanhamento (perfis ativos × `auth.users`) rodando toda semana; meta: 36/36 (ou perfil desativado/arquivado).
- [ ] **Step 2: Contas compartilhadas** (D3): definir como entram (login individual por pessoa em vez da conta, ou sessão da conta com valor sempre desfocado).
- [ ] **Step 3:** Avisar as pessoas (WhatsApp, quando for liberado) e conferir quem ainda usa a chave pública (`VpAuth.status().recuos`).
- [ ] **Step 4:** Registrar no CLAUDE.md.

---

## FASE 5 — Ligar a trava e fechar a porta (só com D1 = B)

### Task 10: Cobrir as 13 etiquetas restantes no banco

- [ ] **Step 1:** Para cada etiqueta "sem regra" cujo valor mora em **tabela**, inserir a regra em `vp_valores_regra` (`fechada` ou `mista`) e o gatilho `vp_valores_guarda`; as que vêm de função ficam cobertas pela Task 8.
- [ ] **Step 2:** **Regra `fechada` nova também precisa da política de leitura.** O laço de `20261010130000_f1_valores_no_banco.sql` só criou `vp_valores_leitura` (RESTRICTIVE, `to authenticated`, `using (vp_pode_valores('<tabela>'))`) uma vez, para as 17 regras da época. Para cada tabela `fechada` nova a migration cria essa política explicitamente (e o rollback a remove). Só inserir em `vp_valores_regra` + gatilho **não** restringe a leitura.
- [ ] **Step 3:** Migration com rollback; testar com a sonda de RLS (autenticado sem a etiqueta lê 0 linhas; com a etiqueta lê). **Commit/PR.**

### Task 11: Simular, ligar por etapas, e reverter se preciso

**Interfaces:** a simulação é a query abaixo (rodar sempre antes de ligar); liga-se por e-mail em `vp_valores_piloto`, depois por grupo, por fim `'*'`.

```sql
-- quem perderia leitura (fechada) ou escrita (mista) se o piloto valesse para todos
with t as (select r.tabela, r.modo, e as tag, split_part(e,'.',1) as modulo
           from vp_valores_regra r, unnest(r.etiquetas) e),
pt as (
  select p.id, p.email, r.tabela, r.modo,
         bool_or(public.vp_ve_valor(p.id, t.tag)) as ve,
         bool_or(exists (select 1 from alcadas_capacidade a where a.perfil_id = p.id and a.modulo = t.modulo)) as trabalha
  from perfis p join vp_valores_regra r on true join t on t.tabela = r.tabela
  where p.ativo group by p.id, p.email, r.tabela, r.modo)
select email, modo, count(*) filter (where not ve and trabalha) as tabelas_afetadas
from pt group by email, modo having count(*) filter (where not ve and trabalha) > 0 order by 2, 3 desc;
```

- [ ] **Step 1:** Rodar a simulação; resolver cada pessoa na Administração do vpsistema (D2). Meta: nenhuma pessoa perde acesso que precisa.
- [ ] **Step 2:** Ligar para 2–3 pessoas (`insert into vp_valores_piloto(email, motivo) values (…)`), observar 1–2 dias (`VpAuth.status().recuos`, erros com hint `vp_valores`).
- [ ] **Step 3:** Ligar por departamento; por fim `'*'`.
- [ ] **Step 4: Rollback** — `delete from vp_valores_piloto where email = …` (vale no próximo carregamento, sem publicar o site).

### Task 12: Fechar a chave pública nas tabelas de valores (F4 da #571)

- [ ] **Step 1:** Depender da Task 9 (todos com sessão) e da Fase 3 da #571 (caminhos públicos fora das tabelas).
- [ ] **Step 2:** **O conjunto de tabelas sai de `vp_valores_regra` DEPOIS da Task 10** (não fixar em 17): `select tabela, modo from vp_valores_regra`. Tabela fora do conjunto fica acessível pela chave pública, e `vp_valores_guarda` não age sobre `anon`.
- [ ] **Step 3:** Tabelas **`fechada`**: `vp_fechar_tabela(<tabela>, 'interno', '<ticket>')` mantém a `vp_valores_leitura` restritiva por cima. Uma onda por vez, com `vp_policy_backup` e rollback testado.
- [ ] **Step 4:** Tabelas **`mista`** (propostas, contratos, embarques, PI, IMS…): **não bastam** `vp_fechar_tabela('interno')` — ele cria `vp_int_sel` para todo usuário ativo e a regra `mista` não restringe leitura, então o R$ real continua saindo pelo REST para quem a etiqueta nega. Escolher por tabela: (a) tornar `fechada` (some a leitura de quem não pode; a tela mostra o registro sem o bloco) ou (b) leitura só por RPC/view que **remove os campos de R$** (inclusive dentro de jsonb) para quem não pode, e negar o SELECT direto. Sem isso, a inspeção da Task 13 falha.
- [ ] **Step 5:** Sonda: `anon` não lê/grava nenhuma tabela do conjunto; autenticado sem a etiqueta não recebe R$ real em **nenhuma** delas (fechada: 0 linhas; mista: campos removidos).

### Task 13: Verificação final e documentação

- [ ] **Step 1:** Regressão: `npm test` + e2e + roteiro manual com 3 perfis (`todos`, `nenhum`, `liberar`).
- [ ] **Step 2:** Inspeção anti-vazamento: com usuário `nenhum`, procurar o valor real em DOM, rede (aba Network), PDFs, e-mails e exportações.
- [ ] **Step 3:** Atualizar o CLAUDE.md (seção Valores) e o texto da tela de Administração do vpsistema ("o desfoque vale para: …" listando o que de fato é aplicado).
- [ ] **Step 4: Commit/PR.**

---

## Dependências e tamanho (estimativas — a revisar após a Task 1)

| Bloco | Depende de | Tamanho relativo |
|---|---|---|
| Fase 0 (decisões + inventário) | — | pequeno (mas bloqueia tudo) |
| Fase 1 (RPC + `VpValores`) | Fase 0 | pequeno |
| Fase 2 (telas, 4 ondas) | Fase 1 | **grande** — é o miolo; cada onda é independente |
| Fase 3 (Edge Functions/Omie) | Fase 1 | médio |
| Fase 4 (login dos 22) | — (pode começar já) | pequeno em código, **depende de pessoas** |
| Fase 5 (ligar + fechar `anon`) | Fases 2–4 | médio/grande (F4 é o maior risco) |

**Ordem recomendada:** Fase 0 → Fase 4 em paralelo → Fase 1 → Fase 2 (Propostas/Precificação primeiro; Dashboard/NF logo depois) → Fase 3 → Fase 5.
**Entrega parcial útil:** Fases 0–2 já entregam o **desfoque na tela** (D1 = A). Fase 5 é o que transforma em segurança real (D1 = B).

## Fora do escopo

- Tags do `vprequisicoes` (`etapas.*`): são de outro satélite, não do HUB.
- Alterar **como** o vpsistema decide quem vê o quê (a Administração continua sendo a fonte).
- Aviso por WhatsApp aos colaboradores (adiado por decisão do Gelson em 13/10/2026).

## Auto-revisão

- Cada etiqueta do catálogo (25) aparece no mapa e numa tarefa de tela, de função ou de banco.
- Toda tarefa que mexe em área blindada tem o passo de aviso ao usuário.
- Toda migration tem rollback; o piloto nasce desligado e reverte sem publicar o site.
- Falha em qualquer ponto = **desfocar**, nunca liberar.
