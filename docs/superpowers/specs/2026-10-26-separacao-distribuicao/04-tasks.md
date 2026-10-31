# 04 · TASKS — atividades (26/10/2026)

Ordem de execução. Cada tarefa fecha com sua verificação.

| # | Tarefa | Arquivo | Verificação |
|---|---|---|---|
| T1 | Teste do helper `localizacaoDoItem` (falha primeiro) | `src/fabricacao-oficina-calc.test.js` | teste vermelho |
| T2 | Implementar `localizacaoDoItem` | `src/fabricacao-oficina-calc.js` | teste verde |
| T3 | Escrever a migration (tabela + 2 funções) — **sem aplicar** | `supabase/migrations/20261026100000_separacao_destinos.sql` | leitura + revisão |
| T4 | Store: `enviarDestino`, `listarDestinos` | `src/fabricacao-oficina-store.js` | sintaxe Babel |
| T5 | Separação: 4 botões + linha "Onde está" | `src/separacao.jsx` | sintaxe Babel |
| T6 | Corte: 2 botões, destino enviado, manter concluídas não encaminhadas | `src/fabricacao-oficina.jsx` | sintaxe Babel |
| T7 | Expedição: itens "Pronto p/ expedir" no detalhe e selo na lista | `src/expedicao.jsx` | sintaxe Babel |
| T8 | Subir `?v=` dos arquivos editados | `index.html` | `node scripts/check-cache-bust.js origin/main` |
| T9 | `npm test` completo | — | suíte verde |
| T10 | Atualizar `CLAUDE.md` (nota "Quadro não é destino da Separação" foi superada) | `CLAUDE.md` | leitura |
| T11 | Pedir o **"Confirmo"** para aplicar a migration; aplicar; testar em transação desfeita | Supabase | resultados das consultas |

## Fora desta lista (não fazer sem novo pedido)
Botão Expedição na tela de Corrimão; classificação automática por tipo; mudar o intervalo de 30 min; commit/PR.
