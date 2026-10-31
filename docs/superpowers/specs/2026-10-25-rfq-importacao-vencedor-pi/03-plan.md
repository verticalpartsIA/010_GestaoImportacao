# 03 · PLAN

## Telas
- `rfq.jsx`/`rfq-varejo.jsx`: o detalhe do lote ganha abas **Fornecedores e tratativas** (atual) · **Comparar e escolher** (o mapa de `cotacoes-varejo.jsx` vira componente reutilizável) · **P.I.**. A rota `/logistica/cotacoes-varejo/<lote>` redireciona para `/gestao-importacao/rfq-importacao/<lote>/comparar`. Cotações de Varejo continua como criação do lote (rascunho).
- Aprovar: `CotacoesVarejoStore.aprovarLote` deixa de chamar `enviarRequisicaoOmie`; passa a `PIStore.criarRascunhoDeLote(lote, vencedores)` (1 P.I. por convite vencedor; `producao: { rascunho_auto: true, origem_lote, convite_id }`, `numero_cotacao` nulo — varejo não é equipamento) e `RFQVarejoStore.enviar` com o pedido de Proforma (3 idiomas). Idempotente por `producao.convite_id`. Reaproveita o padrão de `criarRascunhoAutomatico` (`pi-store.js`).
- Rascunho do lote: coluna "Qtd." com selo "padrão" nos itens sem sugestão; "Enviar" bloqueado até confirmar. Portal: Qtd + unidade.
- Descrição: modal "Descrição para o fornecedor" por item (campos estruturados + "Sugerir com IA" + revisão), texto final PT/EN/中文 salvo por produto.
- Portal (`cotacao-varejo-portal.jsx`): texto das faixas reescrito; validação de preço decrescente; lote grande = busca, cabeçalho fixo, salvar por item, Excel (modelo + importar resposta).
- Fornecedores: **Remover** vira "marcar removido"; novo **Substituir** (removido + novo convite com `substitui_convite_id`).
- NPS: modal ao encerrar; mini-gráfico (barras por critério, linha por lote) em `RFQVarejoDetalhe` e em Cadastros › Fornecedores.

## Banco (migration nova — exige CONFIRMO)
- `iv_cotacao_convites`: + `removido_em`, `removido_por`, `removido_motivo`, `substitui_convite_id`. `removerConvite` passa a UPDATE (hoje DELETE).
- `iv_cotacao_lotes`: + `cambio_cotacao_em`, `cambio_fonte`. `iv_cotacao_respostas`: + `cambio_resposta` (PTAX do dia, gravado em `public_ivc_responder`).
- `produto_descricoes_exportacao` (codigo PK, aplicacao, equipamento, tensao, potencia, medidas, material, observacao, texto_pt/en/zh, gerado_por_ia, atualizado_por/em). Fechada.
- `fornecedor_avaliacoes` (id, fornecedor_id/nome, lote_id, convite_id, nota_geral, nota_respostas, nota_prazos, nota_preco, nota_envio, nota_sla — check 0–5 —, comentario, por, em). Sem update/delete (nova avaliação = nova linha). Fechada; view de média por fornecedor.
- `public_ivc_responder`: grava `cambio_resposta` e devolve aviso de faixa não decrescente (não bloqueia).

## IA (VPS) — sem Edge Function
`src/descricao-ia.js` chama `https://copiloto.vpsistema.com/perguntar` direto do navegador (mesmo padrão de `vpcCall` em `vp-copiloto.jsx`, token do `VpAuth`), com uma pergunta que pede JSON {texto_pt, texto_en, texto_zh, perguntas[]} dentro de `reply`; o JSON é lido com tolerância e SEMPRE revisado/editado pelo comprador antes de salvar. Trata limite (20/h), erro e ausência de login como "digite à mão". Opcional, a combinar com a sessão da VPS: documento em `conhecimento/` com o contrato dessa pergunta e a análise de respostas de fornecedores chineses (degrau 1). O prompt abaixo serve de base para esse documento:

> Preciso de um endpoint HTTPS (POST /descricao-produto) na VPS que receba JSON {codigo, descricao_pt, aplicacao, equipamento, tensao, potencia, medidas, material, observacao} e responda JSON {texto_pt, texto_en, texto_zh, perguntas:[...]}. Papel: engenheiro de compras de peças de elevador/escada rolante. Gere uma descrição técnica clara para um fornecedor chinês cotar com precisão (função, onde se aplica, tensão/potência, medidas, material, tolerâncias a confirmar), em PT-BR, inglês técnico e chinês simplificado, sem inventar dados que não vieram — o que faltar vira pergunta em `perguntas`. Autenticação por header x-api-key (me devolva o valor para guardar como secret) e CORS só para a Edge Function. Responda em até 15 s.
