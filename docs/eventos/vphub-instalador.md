# Avisos do Contrato/Pagamento de Instaladores na Central de Eventos — ponteiro

> **Este manual (15/10/2026) foi concatenado em `docs/modulos/16_servicos.md` em 01/11/2026, por decisão do Gelson, e virou ponteiro.** O texto antigo continua no histórico do Git.

- **Onde está agora:** a mecânica da fila `eventos_outbox` e da publicação na Central em `16_servicos.md` PC-2; o que aconteceu com os tipos `instalador.*` em S5.10 (achado A23); o aval do instalador e os contratos no módulo 11 (`11_parceiros_instaladores.md`).
- **Resumo (conferido em 01/11/2026):** o plano deste manual — ligar na Central os tipos `instalador.aval_pendente`, `instalador.contrato_assinado` e `instalador.recibo_assinado` — **nunca passou de "sombra"** (só envios simulados). Os avisos reais do Contrato do Instalador saem pelo gi-avisos, como alertas `ci-envio-`, `ci-assinado-` e `ci-lembrete-`. O aviso de contrato assinado vai ao Cleiton, ao Maurício e ao Felipe (decisão do Gelson de 01/11/2026: o Gustavo não recebe).
