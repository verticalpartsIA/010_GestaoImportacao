# 04 · TASKS (cada uma = 1 commit/PR, só quando o Gelson pedir)

- T1 Migration (CONFIRMO): colunas de convite/lote/resposta, tabelas de descrição e avaliação, RPC do portal.
- T2 Quantidade: selo "padrão" + trava de envio + unidade no portal (+ teste).
- T3 Convite nunca apagado: `removerConvite` → soft; aba "Anteriores"; botão Substituir.
- T4 Dólar duplo no mapa e na P.I.
- T5 Portal: texto das faixas em 3 idiomas, validação decrescente, alerta no mapa (+ teste do cálculo).
- T6 Aprovar → P.I. rascunho por vencedor + pedido de Proforma em 3 idiomas; tirar a Requisição Omie desse caminho (+ teste de idempotência).
- T7 RFQ Importação com abas Comparar e P.I.; redirect da rota antiga.
- T8 Descrição por produto + `descricao-ia.js` chamando o Copiloto da VPS pelo navegador (sem Edge Function).
- T9 Lote grande: busca, cabeçalho fixo, salvar por item, Excel, paginação.
- T10 NPS: modal, tabela, gráficos (cotação e Cadastro de Fornecedores), nota ao convidar.
- T11 CLAUDE.md + aviso de tutoriais desatualizados (P.I., RFQ, Cotações).

## Status (25/10/2026) — IMPLEMENT concluído
- T1 migration (aplicada) · T2 quantidade a definir · T3 remover/substituir/histórico — PR #1096 (+ migration `20261025130000` aplicada).
- T4 dólar duplo · T5 aviso de preço fora de ordem · T6 aprovar → P.I. rascunho + Proforma — PR #1097.
- T7 RFQ Importação com abas · T8 descrição EN/中文 com IA da VPS · T9 lote grande · T10 NPS · T11 CLAUDE.md — PR #1098.
- Ajuste da IA (ficha colada, internet, resposta sem texto) — PR #1099.
- Pendências e decisões abertas: ver a seção "Cotações de Varejo → RFQ Importação → P.I." do CLAUDE.md. Nada disto foi testado com clique real em produção.
