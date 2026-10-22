# Fabricação Corrimão + Fabricação Corte + envio direto da Separação — spec

Data: 2026-10-22 · Status: **CLARIFY respondido, PLAN/TASKS/ANALYZE prontos, aguardando OK para IMPLEMENT** · Nenhum código foi escrito.
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

### 2.2 Decisões do Gelson (22/10/2026)
1. **OP-mãe = (a):** a Separação cria só a OP-filha, **sem mãe** (com `pedido_codigo` preenchido). A mãe nasce depois no "Gerar OPs", que **adota** as filhas já existentes.
2. **Etapas do Corrimão (6, nesta ordem):** Medir · Cortar · Trabalhar as pontas · Aplicar as camadas · Vulcanizar · Dar acabamento final. Pesos iguais por padrão (editáveis no banco).
3. **Corte registra sobras:** se sobrar, informa quanto sobrou (campo na conclusão da OP).
4. **Quadro NÃO é destino na Separação** (interpretação adotada; quadro segue por Pedidos de Quadro).
5. **Unidade da OP do corrimão = por corrimão**, como o quadro é por quadro (quantidade do item = nº de OPs/unidades).
6. **Quem envia: Magda** (Magda Torres, `magda.torres@verticalparts.com.br`) + administradores, por alçada nova.
7. **Anti-duplicata:** item que já virou OP é bloqueado, mostrando o número da OP. (Concordo.)
8. **Link público e ocorrências** iguais ao quadro, para as duas telas. (Concordo.)

**Suposição minha, a conferir:** as etapas do Corte ficam como hoje (Separar → Corte → Qualidade), sem número de pedaços — só as sobras. Se a trilha for outra, é só trocar a lista de etapas.

## 3. PLAN
- **Banco (1 migration, fechada):** `fabricacao_corrimao_*` e `fabricacao_corte_*` (itens/links/status/ocorrências), `authenticated`+`vp_usuario_ativo()`; chão de fábrica só por RPC `SECURITY DEFINER` com token (`public_fabcorr_*`, `public_fabcorte_*`). Corte: coluna `sobra` (numérico, nulo) na conclusão. RPC `separacao_enviar_fabricacao(pedido, item, destino)` valida alçada nova `separacao.enviar_fabricacao`, bloqueia duplicata (devolve o nº da OP) e cria a OP-filha (`frente` `corrimao`|`corte`, `pedido_codigo`, sem `ordem_mae_id`). Não altera `estoque_separacao_chamar` nem `separacao_hub` existente (função nova).
- **Front:** `fabricacao-corrimao.jsx`/`fabricacao-corte.jsx` (+ store/calc reaproveitando `FabricacaoQuadroCalc`), páginas públicas por token, botão "Enviar para Corte/Corrimão" em `separacao.jsx` (item `na_operacao`), rotas `/logistica/fabricacao-corrimao` e `/logistica/fabricacao-corte` (router, app, shell, alçada, mapa de rotas).
- **PCP:** `pcpPlanoDoPedido` passa a classificar por **família** (quadro/corrimão/corte) e "Gerar OPs" adota filhas existentes sob a mãe.

## 4. TASKS
1. Migration + RPCs + testes SQL (anon negado, duplicata, alçada). *(precisa de CONFIRMO)*
2. calc/store por destino + testes de progresso/pausa.
3. Telas internas Corrimão e Corte + páginas públicas.
4. Botão na Separação + alçada + bloqueio de duplicata.
5. Classificação por família e adoção de filhas no Gerar OPs + testes.
6. Rotas/menu/`?v=`/mapa de rotas; CLAUDE.md; avisar tutorial da Separação desatualizado.

## 5. ANALYZE (conflitos, lacunas, riscos)
- **OP-mãe:** resolvido por 1(a); risco restante = Gerar OPs duplicar filha — cobre-se com a adoção por (pedido, item) e teste.
- **Corrimão com estrutura caindo em `quadro`:** corrigido pela classificação por família (task 5); sem ela, o bug persiste.
- **Constituição:** tabelas fechadas + RPC por token (as do quadro usam `allow_all`, padrão antigo — **não copiar**).
- **Lacuna:** não existe código de corrimão "por corrimão" quando a Escada leva 2; a quantidade do item define o nº de OPs/unidades — conferir com um pedido real.
- **Lacuna:** Magda precisa receber a alçada em Administração › Alçadas (concessão manual).
- **Não testável sem clique real:** envio da Separação e páginas públicas; validar em navegador após a migration.

## 6. IMPLEMENT
Aguardando o OK do Gelson e o **"CONFIRMO"** para aplicar a migration.
