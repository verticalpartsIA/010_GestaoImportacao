<!-- GERADO por scripts/gerar-rag.js — não edite à mão. Rode: npm run rag -->

# docs/rag — camada de curadoria do Super RAG

Esta pasta é **gerada** por `node scripts/gerar-rag.js` (`npm run rag`). O conteúdo é derivado: **nunca é fonte da verdade, nunca se edita à mão e não copia o texto** dos documentos. Cada item aponta para o arquivo e a âncora de origem. Em divergência, vale a origem.

## O que há aqui

- `mapa-de-telas.md` — módulo, tela, rota citada e âncora.
- `indice/<arquivo>.md` — uma página por fonte, com todas as seções (âncora), o selo de cada seção e **de onde veio o selo** de cada bloco.

## Fontes lidas (17)

- `docs/modulos/01_geral.md`
- `docs/modulos/02_crm.md`
- `docs/modulos/03_cadastros_mestres.md`
- `docs/modulos/04_comercial_pre_venda.md`
- `docs/modulos/05_financeiro_precos.md`
- `docs/modulos/06_contratos_juridico.md`
- `docs/modulos/07_suprimentos_importacao.md`
- `docs/modulos/08_engenharia_produto.md`
- `docs/modulos/09_obras_instalacao.md`
- `docs/modulos/10_entrega_documentacao.md`
- `docs/modulos/11_parceiros_instaladores.md`
- `docs/modulos/12_logistica_interna.md`
- `docs/modulos/13_fabricacao.md`
- `docs/modulos/14_administracao.md`
- `docs/modulos/15_servicos.md`
- `CLAUDE.md` (sem selos: não é documento de módulo)
- `README.md` (sem selos: não é documento de módulo)

## Como o selo é decidido (Art. 6)

1. **Bloco** (parágrafo, item de lista, tabela ou citação) com `Conferido`, `Herdado` ou `Não verificado` no texto: vale o selo do bloco (se houver mais de um, o mais fraco). Texto entre crases não conta.
2. Sem selo no bloco: herda o da **seção** (`Selo:` explícito, selo no título ou selo único/mais fraco dos blocos dela).
3. Sem selo na seção: herda o de uma **seção-pai**.
4. Sem selo em nenhuma: herda o do **cabeçalho** do documento ("Fonte da verdade: … conferidos em <data> (origin/main <hash>)").
5. Sem nada disso: **Não verificado**. Faltar selo nunca falha o CI.

Seções "Como esta numeração funciona", "Índice" e "Glossário" são **meta** (explicam as regras) e não entram na contagem de selos.
