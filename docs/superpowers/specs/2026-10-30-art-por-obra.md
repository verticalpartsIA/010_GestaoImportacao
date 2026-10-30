# ART por obra — fluxo Gustavo (Escamax) → Juliana → Felipe (30/10/2026)

**SPECIFY.** A ART é **uma por obra/cliente** (`dossier_obra.codigo_obra`, ex. `VPNI-OB0017`), mãe de todos os equipamentos. Fluxo (pedido do Gelson):
1. **Primeira assinatura** de um Contrato do Instalador da obra → WhatsApp ao Gustavo (`gustavo@escamax.com.br`) com o assunto e o link do contrato de venda (`/juridico/contrato-venda-equipamentos`).
2. Gustavo emite o **modelo da ART** (com nº da obra) e o **boleto** e anexa em `/engenharia/art`. → WhatsApp à Juliana (`juliana@`).
3. Juliana paga e clica **"Marcar como paga"** na linha da obra. → WhatsApp ao Gustavo.
4. Gustavo emite a **ART definitiva** e anexa no mesmo lugar. → WhatsApp ao Felipe (`felipe.barros@`).
5. Felipe envia para a obra e clica **"Marcar enviada à obra"**.

**CLARIFY (respondido):** só WhatsApp (via `alertas` → gi-avisos); sem número/PDF fora do anexo; uma ART por obra; vários contratos da mesma obra = aviso só na primeira assinatura.

**PLAN.** Tabela `obra_art` (nasce fechada; uma linha por `codigo_obra`); gatilho em `contratos_instalador` (status → `assinado`) cria a linha e avisa o Gustavo; tela `/engenharia/art` lista as obras com a etapa e os botões; alçada `art` (ver/editar) + ação nova `confirmar_pagamento` (só a Juliana; **conferida também no banco**). Contratos já assinados antes **não** geram linha nem aviso.

**Limites:** o aviso só chega ao WhatsApp se a pessoa tiver celular no cadastro do vpsistema (gi-avisos); o Gustavo da Escamax precisa de login para anexar.
