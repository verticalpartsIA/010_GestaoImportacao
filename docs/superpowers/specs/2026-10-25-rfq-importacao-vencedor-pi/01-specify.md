# 01 · SPECIFY — Cotações de Varejo: da cotação ao vencedor e à P.I.

## Problema
1. O lote de cotação (Cotações de Varejo) e as tratativas (RFQ Importação) vivem em telas separadas; o comprador não sabe onde fecha o negócio.
2. Aprovar o vencedor cria Requisição de Compra no Omie; **ninguém pede a P.I.** (digitada à mão em P.I. Importação, sem ligação com o lote).
3. Quantidade enviada ao fornecedor sai **1** quando o item não tem sugestão (`importacao-varejo.jsx:613`), sem aviso.
4. Descrição para o fornecedor é só o texto PT do Omie; falta aplicação/equipamento/tensão/potência e tradução EN/中文.
5. Faixas de quantidade do portal confundem; resposta com preço absurdo (3,70 → 37) passa sem aviso.
6. Lote grande (centenas de itens) sem filtro, sem Excel, sem salvamento por item.
7. Remover fornecedor apaga o convite (`removerConvite` = DELETE) — histórico se perde. Não há "substituir".
8. Só um dólar por lote; falta o do dia da resposta. Não há avaliação (NPS) de fornecedor.

## Requisitos
- R1. **RFQ Importação é a casa única do lote**: abas Fornecedores/tratativas · Comparar e escolher vencedor · P.I.
- R2. **Aprovar vencedor → P.I. rascunho por fornecedor vencedor** (itens, qtd, preço, moeda, dólar) + mensagem na tratativa pedindo a Proforma (PT/EN/中文). **Sem Requisição de Compra no Omie** neste fluxo (decisão do Gelson, 25/10).
- R3. Quantidade: itens com quantidade padrão ficam destacados e o envio exige confirmar; portal mostra qtd + unidade.
- R4. Descrição técnica por produto (aplicação, equipamento, tensão, potência, medidas, material, observação, fotos) em PT/EN/中文, com sugestão da IA da VPS; guardada por produto e reaproveitada.
- R5. Portal: explicação clara das faixas (3 idiomas); aviso ao fornecedor se preço de qtd maior > preço de qtd menor; alerta ao comprador no mapa.
- R6. Lotes grandes: busca/filtro, cabeçalho fixo, salvar por item, exportar/importar Excel, paginação no mapa.
- R7. Incluir, remover e **substituir** fornecedor a qualquer momento; removido/substituído continua visível (marcado), com respostas, histórico de preços e tratativas.
- R8. Dólar do dia da cotação (lote) **e** do dia da resposta (por resposta), ambos visíveis no mapa.
- R9. **NPS por fornecedor, 0–5**: geral + respostas, prazos, preço, envio, SLAs; comentário; mini-gráfico na cotação e no Cadastro de Fornecedores; nota visível ao convidar.
- R10. Tudo em PT-BR, EN e 中文 (portal, e-mail, mensagem da P.I.).

## Fora de escopo
Requisição de Compra Omie (fica só no botão antigo "Comprar direto"); upload de arquivo pelo fornecedor no portal; mexer em `send-email`/`read-inbox`.
