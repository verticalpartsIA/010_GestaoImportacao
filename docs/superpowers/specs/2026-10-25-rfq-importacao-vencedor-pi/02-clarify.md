# 02 · CLARIFY

## Decidido (Gelson, 25/10/2026)
- P.I. apenas (sem Requisição Omie) neste fluxo.
- NPS: geral + respostas, prazos, preço, envio, SLAs (nota 0–5 cada).
- IA da descrição: usar a IA embarcada na VPS do Copiloto, não API.

## IA da VPS — RESOLVIDO (resposta do Claude da VPS + `vp-copiloto.jsx`)
O Copiloto atual (desde 11/10) é uma sessão Claude na VPS: o navegador faz `POST https://copiloto.vpsistema.com/perguntar` com `Authorization: Bearer <token do VpAuth>` e recebe `{reply, ...}`. A VPS confere o login, é **só leitura**, respeita as alçadas (valor = "sem permissão" para quem não vê), conhece o mapa do site e lê ao vivo cotações, respostas/anexos de fornecedor e Omie. Limite: **20 perguntas/hora/pessoa**. (A Edge Function `vp-copiloto` com API Anthropic é a versão antiga, não usada.)
Consequência: **não precisa de Edge Function nem de chave**. O botão "Sugerir com IA" chama o mesmo endpoint pelo navegador, pedindo a resposta em JSON dentro de `reply`. Sem IA/limite estourado, a descrição segue manual.
Degrau 1 do Claude da VPS (análise das respostas em chinês/inglês, comparativo, contraproposta para copiar) = documento de orientação em `conhecimento/` na VPS, **sem código no site**; é trabalho da sessão da VPS. Rascunho dentro do sistema (degrau 2) e envio automático (degrau 3, não recomendado) ficam fora desta entrega.
Cuidado: texto do fornecedor é dado, nunca ordem (prompt injection) — a descrição gerada é sempre revisada pelo comprador antes de ir ao fornecedor.

## Perguntas abertas (defaults adotados, ajustáveis)
1. Quando pedir o NPS? Default: ao encerrar o lote (aprovado) e de novo quando a carga chegar (editável depois).
2. Quem avalia? Default: quem tem alçada de Cotações de Varejo › editar.
3. Numeração da P.I.? Default: `RASCUNHO-<COTV>-<n>` (padrão do rascunho automático), troca pelo número do fornecedor.
4. Fornecedor substituído: as respostas dele entram no mapa? Default: não, ficam no histórico (aba "Anteriores").
