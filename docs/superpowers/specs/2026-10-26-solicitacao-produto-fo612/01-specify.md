# 01 — Specify: Solicitação de Produto com os campos do FO-612

**Constituição:** `CLAUDE.md` da raiz (regras permanentes). Migration/deploy só com "CONFIRMO"; commit/PR só quando o Gelson pedir; `?v=` sobe no mesmo commit.

## O que o sistema precisa fazer
A tela `/engenharia/solicitacoes-produto` recebe pedidos de produtos que **ainda não fornecemos**. Quanto mais o requisitante informar, melhor para a Engenharia e a Compra. Por isso a tela passa a ter os campos do formulário FO-612 (Solicitação de Cadastro de Produto), **sem copiar o layout** do HTML:
- Tipo de cadastro: *Peças e equipamentos* (revenda / uso em equipamentos) ou *Insumo, consumo, matéria-prima ou ativo* (uso interno).
- Cabeçalho (descrição comercial, referência, marca, modelo/part number, unidade, família), aplicação (função, material), dados complementares (local de compra, lead time, característica, part number, cor, aplicação), 3 fotos, validação comercial (estoque mínimo sugerido + justificativa).
- **Site de referência da peça** (opcional) e **WhatsApp do cliente** (opcional; a Engenharia pode chamar o cliente para entender a aplicação).
- Copiloto VP conhece a tela atualizada.

## Regra de obrigatoriedade
Só **Tipo de Equipamento, Categoria (SKU) e "O que você precisa?"** são obrigatórios. **Todo o resto é opcional**, inclusive site de referência e Part Number.

## Fora de escopo
NCM, dados fiscais e código do produto (preenchidos depois pelo setor responsável); envio do FO-612 em JSON; levar marca/modelo/unidade para a Ficha Técnica ao converter.
