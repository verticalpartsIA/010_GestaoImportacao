# 02 — Clarify

| Pergunta | Resposta |
|---|---|
| Copiar o layout do HTML? | Não — só os campos. |
| Quais campos são obrigatórios? | Só os 3 que já eram. Site de referência e Part Number são opcionais (confirmado pelo Gelson em 26/10). |
| Os dois "Part Number" do HTML (Modelo/Part Number e Part Number)? | Mantidos os dois, ambos opcionais. |
| Detalhe da solicitação mostra os campos novos? | Sim (Gelson concordou). |
| Copiloto? | Atualizar. O texto das telas mora em `vp_copiloto_docs` (id `rota:solicitacoes-produto`), sem redeploy. |
| Onde guardar os campos novos? | Coluna `tipo_cadastro` + jsonb `dados_cadastro` (aditivo). Site de referência reaproveita `link_produto`. |

## Rodada 2 (26/10) — "Categoria (SKU)" vira "Código"
- Não é obrigatório: o pedido pode ser de item de importação que ainda não existe no Omie (insumo, peça nova).
- Lista suspensa = só o **prefixo** dos VP ativos (VPER, VPEL, VPIN, VPMP…); começa em "Ainda não sei". "SKU" é substituído por "Código".
- O número é gerado na **publicação** (próximo livre no Omie, ex.: último VPER 999 → VPER-1000). O formato do sistema usa hífen (`VPER-1000`).
- **Achado:** a publicação (`publicar_ficha_omie` → function `proximo-codigo-produto`, projeto bd_Omie) JÁ gera o próximo código, mas só aceita VPEL, VPER, VPB, VPMP. Teste real de leitura: VPER → VPER-1747 (hoje o último é 1746). VPIN/VPCON etc. dão "Prefixo inválido".
