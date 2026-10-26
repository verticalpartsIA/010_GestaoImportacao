# 02 · CLARIFY — o que foi esclarecido (26/10/2026)

## Respondido pelo Gelson
| # | Pergunta | Resposta |
|---|---|---|
| 1 | Bloquear envio por tipo de item? | **Não.** A Magda escolhe à mão; basta ter os botões. |
| 2 | Quais botões na Separação? | **Expedição, Quadro de Comando, Corrimão e Corte.** |
| 3 | Depois do corte? | Botões **dentro do Corte**: cabo de aço → Expedição; cabo de manobra → Quadro de Comando. Serve para saber **onde o item está parado**. |
| 4 | Atraso de 30 min na leitura do Omie? | **Aceito.** |
| 5 | Expedição só mostra o item ou muda o pedido? | **Confirmado** (recomendação aceita): só **registra o item como "pronto para expedir"**, sem criar/alterar a linha do pedido em `pcp_expedicoes`. |
| 6 | Onde guardar o "onde está"? | **Confirmado**: coluna nova nas pendências da Separação (migration). |

## Fatos conferidos no código/banco (não são suposição)
- `pcp_expedicoes` tem **uma linha por pedido** (`pedido_codigo` único), não por item; despachar/entregar exige NF emitida (trigger `trg_pcp_expedicao_exige_nf`).
- O envio a Corrimão/Corte já existe (`separacao_enviar_fabricacao`, alçada `separacao.enviar_fabricacao`, bloqueia duplicata).
- O envio de item a "Pedidos de Quadro" já existe no PCP (`enviarParaQuadro`, `pcp.jsx`), uma peça por unidade, sem duplicar.
- Identificação por nome/código (só como referência, não bloqueia): cabo de manobra = "Cabo de Comando Elétrico"/"Cabo Manobra Elétrico" (VPB-086, VPEL-529n); cabo de aço = "Cabo de Aço…" (VPEL-046…694); corrimão = família CORRIMÃOS, código `VP-`.

## Ainda em aberto (assumo o padrão indicado, avisando no PLAN)
- **Quem pode usar os botões novos:** assumo a **mesma alçada** `separacao.enviar_fabricacao` (sem alçada nova).
- **Quadro de Comando na Separação:** assumo o mesmo gatilho dos outros (item "Na operação").
- **Item só com envio para Expedição** não cria OP; apenas marca o destino.
