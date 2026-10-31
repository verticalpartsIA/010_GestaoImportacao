# 05 · ANALYZE — conflitos, lacunas e riscos (26/10/2026)

## Conflitos encontrados
1. **`CLAUDE.md` diz "Quadro não é destino da Separação"** (decisão de 22/10). O Gelson decidiu agora o contrário → a nota fica superada; atualizo o `CLAUDE.md` (tarefa T10).
2. **Dois caminhos criam pedido de quadro** (PCP › Pedidos para Produzir e, agora, a Separação). Risco de duplicar. **Mitigação:** a Separação usa a **mesma chave `configuracao.origem_omie`** (pedido + item + unidade) e conta o que já existe antes de criar.
3. **Corte concluído some da tela hoje** (a lista só mostra OPs abertas por padrão). Os botões de encaminhar ficariam inalcançáveis. **Mitigação:** manter visíveis as OPs de Corte concluídas ainda não encaminhadas.

4. **Há um plano anterior sobre o mesmo assunto** (21/10, issue #1027: `docs/DIAGNOSTICO_separacao_envio_producao.md` e `docs/PLANO_separacao_envio_producao.md`, não versionados, "só desenho, nada implementado"). Ele propõe destino **por tipo do item** (tabela `separacao_tipo_item`) e colunas em `estoque_separacao_pendencias`; o Gelson pediu agora **escolha manual por botões**. Este SPECIFY segue o pedido atual e **não implementa** o plano de 21/10. Decisão sobre o plano antigo fica com o Gelson (arquivar ou aproveitar a Fase 1 depois).

## Lacunas
1. **"Quadro de Comando" para um cabo de manobra não cria pedido de quadro** (o cabo é matéria da fiação, não um quadro). Por isso a função só **marca o destino** quando o código não está em `pcp_quadro_variante`. É uma regra minha, derivada do fato de o sistema não bloquear por tipo; **aviso ao Gelson no resumo final**.
2. **Corrimão pronto → Expedição:** a regra de negócio diz que o corrimão é entregue na Expedição, mas o Gelson só pediu botões no **Corte**. A tela Corrimão **não** ganha botão; a Magda pode marcar pela Separação. Fica como sugestão.
3. **OPs de Corte antigas do PCP** podem ter `item_codigo` vazio. A função aceita o código informado pela tela e confere contra o pedido/materiais da OP; se não achar, recusa com mensagem clara.
4. **Teste com clique real** não é possível aqui (o login local não tem as alçadas). Cobertura: testes unitários + SQL em transação desfeita.

## Riscos
| Risco | Efeito | Mitigação |
|---|---|---|
| Migration aplicada sem revisão | tabela/função errada em produção | só com "Confirmo"; SQL mostrado antes; teste em transação desfeita |
| Duplicar envio | OP/quadro em dobro | índice único + checagem na função |
| Quebrar a Expedição | despacho indevido | **não toca em `pcp_expedicoes`**; trava de NF intacta |
| Cache do navegador | tela antiga | subir `?v=` + `check-cache-bust` |
| Permissão aberta demais | qualquer um envia | função confere `separacao.enviar_fabricacao`; tabela fechada |

## Áreas blindadas / travas
Nenhuma tocada: não mexe em e-mail/Inbox, Atualização de Custos, Contratos, nem em `separacao_hub`/`estoque_separacao_chamar` (usados pelo celular).

## Veredito
Plano seguro e aditivo. Prossigo com T1–T10 e paro antes de aplicar a migration (T11) para pedir o "Confirmo".
