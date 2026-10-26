# 02 — Clarify

| Pergunta | Resposta |
|---|---|
| Copiar o layout do HTML? | Não — só os campos. |
| Quais campos são obrigatórios? | Só os 3 que já eram. Site de referência e Part Number são opcionais (confirmado pelo Gelson em 26/10). |
| Os dois "Part Number" do HTML (Modelo/Part Number e Part Number)? | Mantidos os dois, ambos opcionais. |
| Detalhe da solicitação mostra os campos novos? | Sim (Gelson concordou). |
| Copiloto? | Atualizar. O texto das telas mora em `vp_copiloto_docs` (id `rota:solicitacoes-produto`), sem redeploy. |
| Onde guardar os campos novos? | Coluna `tipo_cadastro` + jsonb `dados_cadastro` (aditivo). Site de referência reaproveita `link_produto`. |
