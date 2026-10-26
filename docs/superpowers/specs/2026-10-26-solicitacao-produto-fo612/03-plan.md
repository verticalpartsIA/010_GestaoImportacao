# 03 — Plan

1. **Banco** (aditivo): `solicitacoes_produto.tipo_cadastro` (`pecas`|`insumo`) e `dados_cadastro` jsonb — migration `20261026110000`.
2. **Store** (`solicitacoes-produto-store.js` v10): listas do FO-612 (unidades, famílias de peças/insumo, estoque mínimo…), `criar()` grava `tipo_cadastro` e `dados_cadastro` (descarta vazios, campos só-peças no insumo, WhatsApp sem a caixa de cliente marcada).
3. **Tela** (`solicitacoes-produto.jsx` v14): `NovaView` com tipo de cadastro, seções, 3 fotos (guardadas em `anexos` com `slot`), WhatsApp do cliente; `DetalheView` mostra os campos novos; "Link do produto" → "Site de referência".
4. **Copiloto:** linha `rota:solicitacoes-produto` em `vp_copiloto_docs` (migration `20261026120000`, só dado) + espelho em `ROUTE_DOCS` do `index.ts` do repo (fallback; **sem redeploy**).

## Rodada 2
- Store v11: `listarPrefixosCodigo()` (prefixos `VP*` ativos em `importacao_varejo_produtos` + `pcp_produtos`, ≥2 produtos; os 4 com geração primeiro). `criar()` grava `categoria_sku` ou null (coluna já era nula).
- Tela v15: campo "Código (opcional)", sem validação obrigatória; aviso quando o prefixo não tem geração automática; listagem/detalhe dizem "Código".
- Copiloto: migration `20261026130000` + espelho no `index.ts`.
- **Não feito (depende de decisão):** gerar código para prefixos além de VPEL/VPER/VPB/VPMP (exige mexer em `proximo-codigo-produto` no projeto bd_Omie ou em `publicar_ficha_omie`, que escreve no Omie).
