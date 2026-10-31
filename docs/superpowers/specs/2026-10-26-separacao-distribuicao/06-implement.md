# 06 · IMPLEMENT — programar, testar e validar (26/10/2026)

## Feito (código local, nada commitado nem publicado)
| Tarefa | Resultado |
|---|---|
| T1-T2 helper `localizacaoDoItem` | teste escrito antes; `fabricacao-oficina-calc.test.js` 6/6 |
| T3 migration | `supabase/migrations/20261026100000_separacao_destinos.sql` escrita, **NÃO aplicada** |
| T4 store | `enviarDestino`, `listarDestinos` em `fabricacao-oficina-store.js` |
| T5 Separação | 4 botões (Quadro de Comando, Corrimão, Corte, Expedição) + linha "Onde está" — `separacao.jsx` |
| T6 Corte | OP concluída: "Enviar para Expedição" / "Enviar para Quadro de Comando"; fica visível até encaminhar — `fabricacao-oficina.jsx` |
| T7 Expedição | selo "N item(ns) pronto(s) p/ expedir" na lista e "pronto p/ expedir" por item — `expedicao.jsx` |
| T8 cache-bust | `index.html` (calc v2, store v3, fabricacao-oficina.jsx v3, expedicao.jsx v9, separacao.jsx v9) e `fabricacao-oficina.html` (calc v2, store v3) |
| T10 CLAUDE.md | nota nova na seção Fabricação Corrimão + Corte |

## Validação feita
- `npm test`: **814/814** verdes.
- `node scripts/check-cache-bust.js origin/main`: ok.
- Páginas Separação, Corte e Expedição **compilam no navegador local** (`SeparacaoPage`, `FabricacaoCortePage`, `ExpedicaoPage` e as funções novas existem; sem erro de JSX). Os 401 do console são do Supabase sem login e já existiam.

## Não validado (por quê)
- **Clique real nos botões e as telas com dados**: o login local (`dev@localhost`) não tem as alçadas nem acesso às tabelas fechadas.
- **A migration**: ainda não existe no banco, então os botões novos dão erro até ela ser aplicada.

## T11 — migration aplicada em produção (26/10/2026, com o "Confirmo" do Gelson)
`20261026100000_separacao_destinos.sql` aplicada (1 tabela fechada com RLS + 2 funções; nenhuma tabela existente alterada).
**Teste em transação desfeita (tudo passou, nada ficou no banco):**
- item sem "Na operação" → recusado;
- Separação → Expedição: ok; repetir → recusa "já foi enviado (quem, quando)";
- Quadro de Comando de item que não é quadro (VPB-097) → só marca o destino;
- Quadro de Comando de item que é quadro (VPEL-709b) → recusa enquanto já existe pedido de quadro do PCP (sem duplicar); com o existente removido, cria 1 pedido de quadro; repetir → recusa;
- Corte: OP aberta → recusa "conclua o corte"; OP concluída → Corte → Expedição ok;
- usuário sem sessão ativa → recusa.
Depois do teste: sequências `quadros_comando_numero_seq` (1093) e `pcp_ordem_seq` (22) devolvidas ao valor anterior; conferido 0 linhas em `separacao_destinos`, 0 quadros novos, 0 OPs e 0 pendências de teste.
**Falta:** publicar o front (commit/PR só sob pedido) e um clique real com login que tenha a alçada `separacao.enviar_fabricacao`.

## Sugestões fora do escopo
- Botão "Enviar para Expedição" na tela **Corrimão** (hoje só dá para marcar pela Separação).
- Decidir o destino dos docs de 21/10 (issue #1027).
