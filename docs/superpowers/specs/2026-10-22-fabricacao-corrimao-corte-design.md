# Fabricação Corrimão + Fabricação Corte + envio direto da Separação — spec

Data: 2026-10-22 · Status: **SPECIFY + CLARIFY (aguardando respostas do Gelson)** · Nenhum código foi escrito.
Fluxo: Constitution → Specify → Clarify → Plan → Tasks → Analyze → Implement.

## 0. Constitution (regras permanentes que valem aqui)

Não existe `CONSTITUTION.md`; a constituição do projeto é o `CLAUDE.md`. As regras dele que esta entrega **não pode quebrar**:

1. Sem build step; **todo arquivo editado ganha `?v=` novo** no `index.html` (CI barra: `scripts/check-cache-bust.js`).
2. **Tabela nova nasce FECHADA** (RLS só `authenticated` + `vp_usuario_ativo()`; nada de `allow_all`). Exceção a decidir: o link público do chão de fábrica só pode falar por **RPC `SECURITY DEFINER` com token** (padrão `public_*` das Fases 3/#571), nunca por tabela aberta ao `anon`.
3. Edge Function nova: `fetch` + PostgREST, **sem `supabase-js` por import remoto**.
4. Soft-delete; nunca `.update()/.insert()` sem checar `error`; `.select()` em update para detectar 0 linhas.
5. Aba/item abertos têm **URL própria** (`useRouteTab`, `useRotaItem`); aba nova entra na lista de válidas; rodar `node scripts/gerar-mapa-rotas.js`.
6. Rota nova em `router.js` (`KNOWN_ROUTES`), `app.jsx`, `shell.jsx` (menu + breadcrumb) e **alçada no `colaboradores-admin-store.js`**.
7. Não tocar nas áreas blindadas (Inbox/e-mail, Central de Decisões, Containers, MO, assinatura) nem em `estoque_separacao_chamar` (o celular depende dela) nem nas tabelas de Atualização de Custos.
8. Migration e deploy exigem o **"CONFIRMO"** do usuário no MCP do Supabase; aplicar a migration **antes** de dizer que está pronto.
9. Tutorial de tela mexida fica desatualizado → avisar, não editar à mão.

## 1. SPECIFY — o que o sistema precisa fazer

**Problema.** Hoje o item que sai da Separação "para fabricação" vira só um texto (situação `na_operacao` + observação). Não cria OP, não aparece para quem fabrica e ninguém acompanha. Só o quadro de comando tem tela de acompanhamento (`/logistica/evolucao-fabricacao`).

**Metas.**
- **G1.** Na Separação (`/logistica/separacao`), cada item pendenciado como "na operação" pode ser **enviado para Corte ou Corrimão**; o sistema **cria a OP na hora** (decisão do Gelson, 22/10).
- **G2.** Nova tela **Fabricação Corrimão** (`/logistica/fabricacao-corrimao`), igual em espírito à Evolução da Fabricação: 1 card por OP aberta, trilha de etapas, link público para o chão de fábrica flegar, ocorrências de falta de material.
- **G3.** Nova tela **Fabricação Corte** (`/logistica/fabricacao-corte`), mesma receita (decisão do Gelson: "Corte também terá tela própria").
- **G4.** O "Gerar OPs" do PCP (Pedidos para Produzir) deixa de classificar por "tem estrutura = quadro" e passa a olhar a **família**: quadro → frente `quadro`, corrimão → `corrimao`, cabo/corte → `corte`.

**Fora de escopo (a confirmar no Clarify).** Destino "Quadro" na Separação (quadro continua nascendo por Pedidos de Quadro); requisição de compra automática; baixa no Omie; notificação a Compras.

**Fatos levantados no código/banco (22/10/2026).**
- `pcp_ordens.frente` **não tem CHECK** (só `status` e `quantidade`) → `corrimao` entra sem migration de constraint.
- Evolução do Quadro: `evolucao-fabricacao-quadro.jsx` + `fabricacao-quadro-store.js` + `fabricacao-quadro-calc.js` + `fabricacao-quadro-app.jsx` (página pública) + tabelas `fabricacao_quadro_*` (itens/links/status/ocorrências/fiação). `listarOPsAbertas` filtra `frente='quadro'`, status `aguardando`/`em_producao`.
- Corte: 5 OPs abertas (cabos VPEL-692/693/529n), todas nascidas em Gerar OPs, sem tela de acompanhamento. Etapas hoje: Separar → Corte → Qualidade.
- Corrimão: cadastro tem corrimões acabados, kits `VPKIT-*a` (6–9 componentes) e matérias-primas VPMP (lonas, borrachas, fita de aramida). Nenhum pedido na etapa 20 com corrimão hoje. O sync marca `item_pcp` pela família `*CORRIM*`.
- Separação: `separacao_hub` (RPC) já tem `pendenciar` com situação `na_operacao`; a tela é `src/separacao.jsx`.

## 2. CLARIFY — o que precisa ser esclarecido

### 2.1 Respostas já dadas
- A OP é criada na hora, ao enviar da Separação. Corte também terá tela própria.

### 2.2 Perguntas em aberto (bloqueiam o Plan)
1. **Etapas do Corrimão** (ordem e peso para o %): quais são? (o quadro tem 6 fixas.)
2. **Etapas do Corte**: hoje são Separar → Corte → Qualidade; a trilha da tela é essa ou outra? Precisa registrar medida/nº de pedaços?
3. **Unidade da OP do corrimão**: por corrimão, por emenda ou por metro? (escada = 2 corrimões.) E a quantidade da OP vem da quantidade do item do pedido?
4. **OP-mãe (conflito real).** "Gerar OPs" cria 1 OP-mãe por pedido e **some o botão** quando ela existe. Se a Separação criar a OP-mãe, o PCP não consegue mais gerar as OPs do quadro desse pedido. Opções: (a) a Separação cria só a OP-filha, **sem mãe** (`pedido_codigo` preenchido; a mãe nasce depois no Gerar OPs e adota as filhas); (b) a Separação cria a mãe e o Gerar OPs passa a **completar** a mãe existente. Qual?
5. **Quadro na Separação**: só Corte e Corrimão no botão (quadro segue por Pedidos de Quadro)? Recomendado.
6. **Quem pode enviar**: alçada `pcp.criar` (já existe) ou a de Separação (`estoque.saida`)?
7. **Anti-duplicata**: item já virou OP (por Gerar OPs ou pela Separação) → bloquear e mostrar o número da OP. Confirma?
8. **Link público e ocorrências** iguais ao do quadro (token por OP, sem login, "Relatar falta", "Chegou — resolver") para as duas telas?

## 3. PLAN / 4. TASKS / 5. ANALYZE / 6. IMPLEMENT

Preenchidos depois das respostas da seção 2.2. Esboço já visível:
- Banco (migration fechada): `fabricacao_corrimao_*` e `fabricacao_corte_*` (itens/links/status/ocorrências) + RPCs públicas por token; uma RPC `separacao_enviar_fabricacao` (ou ação nova do `separacao_hub`) que valida a alçada, checa duplicata e cria a OP.
- Front: 2 telas + 2 páginas públicas + store/calc por destino reaproveitando `FabricacaoQuadroCalc`; botão em `separacao.jsx`; classificação por família em `pcp.jsx` (`pcpPlanoDoPedido`).
- Testes: calc (progresso/pausa), classificação por família, duplicata, RLS (anon negado).
- Riscos já vistos: OP-mãe (2.2-4); corrimão com estrutura caindo em `frente='quadro'` se a classificação não mudar; dois lugares criando OP para o mesmo item.
