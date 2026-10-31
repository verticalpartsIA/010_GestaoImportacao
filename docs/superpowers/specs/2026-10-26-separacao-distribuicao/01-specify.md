# 01 · SPECIFY — Separação distribui cada item ao seu destino (26/10/2026)

**Pedido do Gelson:** assim que o pedido do Omie chega na **etapa 20**, ele aparece em `/logistica/separacao` e **daqui** o almoxarife distribui cada item para o lugar certo.

## Objetivo
A tela **Separação** passa a ser a porta de saída de todo item que não é "separar do estoque": o operador (hoje a **Magda**) escolhe, item a item, para onde ele vai, e o sistema registra **onde o item está parado**.

## Regra de negócio de cada tela (dita pelo Gelson)
| Tela | Função |
|---|---|
| **Fabricação Corte** (`/logistica/fabricacao-corte`) | SÓ cabos cortados: **cabo de manobra** (ex. VPB-086, 24 vias) e **cabo de aço / cabo de tração**. Depois do corte: cabo de manobra → Fabricação de **Quadros de Comando**; cabo de aço → **Expedição**. |
| **Fabricação Corrimão** (`/logistica/fabricacao-corrimao`) | O pessoal do Corrimão mede, corta, prepara as pontas, aplica as camadas, vulcaniza, dá o acabamento e **entrega na Expedição** para o cliente. |
| **Separação** (`/logistica/separacao`) | Recebe todo pedido da etapa 20 e **distribui** cada item. |

## O que o sistema precisa fazer
1. **Entrada:** pedido do Omie na etapa 20 aparece na Separação (já existe; leitura do Omie a cada 30 min — **aceito pelo Gelson**).
2. **Quatro botões por item** marcado "Na operação": **Quadro de Comando**, **Corrimão**, **Corte** e **Expedição**. A **Magda escolhe à mão** para onde enviar; o sistema **não bloqueia** por tipo de item.
3. **Dentro da Fabricação Corte**, dois botões por OP concluída: **Enviar para Expedição** (cabo de aço) e **Enviar para Quadro de Comando** (cabo de manobra).
4. **"Onde está":** cada item enviado mostra o destino atual na Separação ("Em Corte", "No Quadro", "Na Expedição"…), para saber onde ele parou.
5. **Expedição:** o item enviado aparece como "pronto para expedir"; a Expedição continua dependendo da NF emitida (regra atual, trava no banco).

## Fora de escopo
- Classificar o item automaticamente por tipo (a escolha é manual).
- Reduzir o intervalo de leitura do Omie (fica 30 min).
- Mexer na regra de NF da Expedição.
- Fabricação Corrimão e Corte (telas e OPs) — já existem e não mudam.

## Critérios de aceite
- Item "Na operação" mostra os 4 botões para quem tem a alçada `separacao.enviar_fabricacao`.
- Cada botão cria o registro certo uma única vez (sem duplicar) e grava o destino.
- Na Corte, concluir/encaminhar grava o novo destino e a Separação passa a mostrar onde o item está.
- Nada muda para pedidos sem itens "Na operação".
