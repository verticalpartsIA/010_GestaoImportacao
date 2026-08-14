# Matriz de Governança — Status, Bloqueios e Handoffs

> Gerada a partir do código real em produção (não é um desenho aspiracional) — cada linha referencia o gate/arquivo que efetivamente aplica a regra. Se este documento e o código divergirem no futuro, o código manda; atualize este arquivo no mesmo PR que mudar um gate.

## Departamentos e atores

| Departamento | Atores | Módulo(s) |
|---|---|---|
| Comercial | Vendedor, gestor comercial | `comercial.jsx` (Leads), `formulario-elevador.jsx`, `proposta-editor.jsx` |
| Engenharia | Engenheiro, projetista | `projeto-elevador-store.js`, `operacoes.jsx` (Projetos/Vistorias) |
| Financeiro | Precificador, aprovador de crédito | `precificacao-elevador.jsx`, `aval-financeiro.jsx` |
| Jurídico | Responsável contratual | `contrato-venda.jsx` |
| Compras/Importação | Comprador, importador | `cotacoes-fornecedor.jsx`, `logistica.jsx` |
| RH | Homologador de parceiro | `rh-homologacao.jsx` |
| Parceiro Instalador | Empresa, montadores | `contrato-instalador.jsx` |
| Cliente | Responsável da obra | Portal público (`assinar.html`) |

## Cadeia de handoffs (Nº da Cotação como chave)

Cada etapa nasce/fecha automaticamente conforme o evento anterior — ver `gatilhos-engine.js` (`NODES`), que é a fonte de verdade viva desta tabela (cada linha abaixo tem um nó correspondente lá, com SLA em horas).

| # | Etapa | Nasce quando | Fecha quando | SLA | Bloqueio antes de avançar |
|---|---|---|---|---|---|
| 1 | Formulário preenchido | Comercial cria o Formulário | Cotação enviada ao fornecedor | — | — |
| 2 | Aguardando resposta do Fornecedor | Cotação enviada | Fornecedor responde | 48h | — |
| 3 | Financeiro precificando | Fornecedor respondeu | Proposta elaborada | 5h | Precificação exige **Aprovar** explícito (`PrecificacaoElevadorStore.aprovar`) — bloqueia campo obrigatório vazio e margem abaixo da mínima configurada |
| 4 | Proposta pronta — aguardando envio | Precificação aprovada | Proposta enviada | — | Proposta só herda a precificação com `status='finalizado'` (aprovada), nunca um rascunho de cálculo (`proposta-heranca.js`) |
| 5 | Aguardando resposta do Cliente | Proposta enviada | Cliente assina/recusa | 15 dias | — |
| 6 | Contrato enviado ao Cliente | Proposta assinada | Contrato assinado | 24h | Contrato só nasce de proposta com `status='aprovada'` (`listarPropostasAguardandoContrato`) e bloqueia envio sem anexos obrigatórios (`completeAll()`) |
| 6b | Projeto de Engenharia enviado | Proposta assinada (paralelo ao 6) | Projeto finalizado | 24h | — |
| 7 | Aguardando assinatura do Contrato | Contrato enviado | Contrato assinado | 5 dias | — |
| 8 | Aguardando pagamento do sinal | Contrato assinado | Sinal pago | 3 dias | — |
| 9 | Aguardando Aval de Pagamento | Sinal pago | Aval confirmado | 4h | `AvalFinanceiroStore` — score e classificação de risco |
| 10 | Compra ao Fornecedor liberada | Aval confirmado | Compra iniciada | — | `podeIniciarCompra()` — **gate**: sem aval financeiro confirmado, botão "Decidir comprar" fica bloqueado com motivo explícito na tela |
| 11 | Negociação e Compra | Compra iniciada | Compra confirmada | 7 dias | — |
| 12 | Embarque até chegada no Brasil | Compra confirmada | (logística — fora dos eventos de fluxo hoje) | 90 dias | — |

Handoffs adicionais, fora da cadeia principal de `gatilhos-engine.js`:

| Handoff | Regra | Onde está o gate |
|---|---|---|
| Comissão | Só é gerada depois da proposta assinada; split por origem da venda com trava de alçada acima do limite configurado | `ComissionamentoStore.gerarComissoesDaProposta` (issue #68) |
| Instalação | Parceiro precisa estar homologado (NR-10/NR-35/ASO/PCMSO/PGR válidos) | `RHHomologacao.statusGeral()` — **capacidade construída, ainda não conectada como bloqueio automático de mobilização** (gap conhecido, ver issue #9) |
| DataBook/Entrega | Documentos obrigatórios da obra (ART, Termo de Vistoria, DataBook, Termo de Entrega) | Checklist visual na aba Documentos da Dossiê (`dossier-obra.jsx`, `TIPOS_DOC_OBRA`) — hoje é indicativo, não bloqueia tecnicamente o avanço de status |

## Status mestre do Dossiê da Obra

`dossier-obra.jsx` — tela "Status de Obras" mostra o funil completo, filtrável por estágio:

`Lead qualificado → Dossier criado → Análise técnica → Precificação → Proposta enviada → Contrato assinado → Importação → Homologação instalador → Instalação → DataBook → Entregue → Manutenção preventiva`

O Dossiê é auto-provisionado no Contrato de Venda (`garantirDossier()`) a partir dos dados já coletados no Formulário — não exige seleção manual cross-módulo.

## Quem aprovou o quê (auditoria)

- `eventos_fluxo` — histórico de todo nó de `gatilhos-engine.js` que nasceu/fechou, com timestamp.
- `avais_financeiros` — `aprovado_por`/`aprovada_em` no Aval Financeiro.
- `precificacoes_elevador` — `aprovado_por`/`aprovado_em` na aprovação da Precificação.
- `propostas`/`contratos_venda_equipamentos` — `signed_at`, `log`, `audit` (IP, hash, protocolo de assinatura digital).
- `comissoes` — `aprovador_necessario` quando a comissão exige aprovação de diretoria acima do limite de alçada.

## Gargalos por departamento (dashboard)

O Dashboard Admin (`supabase.js → loadDashboardData`) já sinaliza como **alerta crítico** três inconsistências entre módulos, direto ligadas a esta matriz:
- Proposta assinada sem contrato correspondente.
- Contrato com valor zerado.
- Sinal pago sem contrato de venda vinculado (indício de compra parada).

## Gaps conhecidos (não é omissão — é status real, registrado para não se perder)

- RH Homologação não trava automaticamente o início da mobilização do parceiro instalador (issue #9).
- Não existe um campo único "D0" (data-base de 120 dias de entrega) — o que existe é a cadeia de SLAs por etapa acima, mais granular mas não idêntica ao pedido original (issue #6).
- Checklist de documentos da obra é indicativo (mostra o que falta), não bloqueia tecnicamente a emissão de contrato/DataBook.

---
*Última atualização: 2026-08-14, gerada durante a sessão de triagem de issues do backlog VPPRD (issue #11).*
