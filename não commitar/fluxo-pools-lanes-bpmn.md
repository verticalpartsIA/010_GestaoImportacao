# Fluxo VerticalParts em Pools & Lanes (BPMN) — script para infográfico

> **O que é este documento:** o roteiro em texto de tudo que acontece desde a entrada do
> lead até a manutenção preventiva do equipamento já instalado, organizado no vocabulário
> de BPMN (Pool = organização/fronteira responsável; Lane = papel/função dentro dela;
> Tarefa = ação de alguém; Gateway = decisão que abre caminhos diferentes; Mensagem =
> handoff cruzando a fronteira de uma Pool). **Não é o diagrama** — é a matéria-prima pra
> desenhar um depois (Miro, Bizagi, draw.io, ou o infográfico que for). Cada passo está
> rastreado até o código real que o sustenta (arquivo, evento, tabela), pra quem desenhar
> não precisar inventar nada — só meia dúzia de nomes de swimlane secundárias (Despachante,
> Transporte Marítimo/Terrestre) foram inferidos da tabela `embarques_importacao` porque
> ainda não emitem evento nomeado; todo o resto é literal do sistema.

---

## 1. Pools e Lanes

Uma **Pool** é uma organização — alguém de fora dela só enxerga o que chega/sai por
mensagem, nunca a tarefa interna. Dentro da VerticalParts, cada **Lane** é um papel —
pode ter mais de uma pessoa (ex.: Gestor Comercial = Regiane *ou* Guilherme), mas o rótulo
do papel é sempre o mesmo, então o diagrama fica estável mesmo trocando quem está atuando.

| Pool | Lanes | Natureza |
|---|---|---|
| **Cliente** | Cliente | Externa |
| **VerticalParts** | Vendedor · Gestor Comercial · CEO · Financeiro · Jurídico · Engenharia · RH · Importação · Logística | Interna |
| **Fornecedor do Equipamento** | Fornecedor (fabricante — Glarie e afins) | Externa |
| **Cadeia Logística Internacional** | Despachante · Transporte Marítimo · Transporte Terrestre | Externa/parceiros |
| **Instalador** | Instalador (parceiro terceirizado, homologado por RH) | Externa |
| **Empresa de Manutenção** | Empresa de Manutenção (parceiro terceirizado, pós-venda) | Externa |

Rastro no código: `src/eventos-fluxo-store.js` (`EVENTOS[...].papel`), `src/linha-do-tempo-store.js`
(`PAPEL_TIPO_DECISAO`, `PAPEL_STATUS_DOSSIER`), `src/decisoes-store.js` (papéis exigidos por
cada gate: `gestor_comercial`, `ceo`, `rh`, `logistica_lider`).

---

## 2. As duas fases do processo

O sistema rastreia o processo em **dois mecanismos diferentes**, que juntos formam a
linha do tempo completa — vale desenhar como duas macro-faixas horizontais (ou dois
diagramas encadeados) porque a "fonte da verdade" muda de uma pra outra:

- **Fase A — Funil Comercial** (Lead → Contrato assinado): rastreado evento a evento em
  `eventos_fluxo`, catálogo fechado em `EVENTOS` (`src/eventos-fluxo-store.js`). Cada
  evento já nasce com o papel certo (`ator_papel`), amarrado ao **Nº da Cotação** — o
  "ator principal" que nasce no Formulário e nunca muda.
- **Fase B — Execução da Obra** (Dossiê da Obra → Manutenção preventiva): rastreada por
  transição de status em `dossier_obra.status_master` (12 estágios fixos, `STATUS_FLOW`
  em `src/dossier-store.js`), com histórico em `dossier_history`. O Dossiê nasce quando o
  Lead vira obra confirmada e é o "ator principal" dessa fase — ele referencia o mesmo
  Nº da Cotação, então as duas fases se costuram por essa chave.

---

## 3. Fluxo sequencial completo

Numeração contínua. `[Pool / Lane]` no início de cada linha. `◇` = Gateway (decisão).
`✉` = mensagem cruzando fronteira de Pool. `↺` = loop de volta a um passo anterior.

### Fase A — Funil Comercial

1. **[Cliente / Cliente]** Manifesta interesse (site, indicação, WhatsApp) → gera Lead.
2. **[VerticalParts / Vendedor]** Qualifica o Lead no Pipeline (`comercial.jsx`).
3. **[VerticalParts / Vendedor]** Preenche o **Formulário de Equipamento** — elevador,
   escada rolante e/ou esteira rolante, podem ser vários tipos na mesma cotação
   (`src/formulario-elevador.jsx`). **Aqui nasce o Nº da Cotação** (sequência do banco,
   nunca editável) e o Master ID de cada unidade (`VPEL-EL####-N`, `VPER-ER####-N`,
   `VPES-ES####-N`).
   *Evento: `FORMULARIO_PREENCHIDO`.*
4. ✉ **[VerticalParts / Vendedor] → [Fornecedor]** Envia a cotação técnica ao fornecedor
   (RFQ agrupado por fornecedor + tipo de formulário).
   *Evento: `COTACAO_ENVIADA_FORNECEDOR`.*
5. ✉ **[Fornecedor / Fornecedor] → [VerticalParts]** Responde com preço e especificação
   técnica; pode haver divergências marcadas pra revisão.
   *Evento: `FORNECEDOR_RESPONDEU`.*
6. **[VerticalParts / Financeiro]** Elabora a proposta comercial (markup, câmbio, frete,
   taxas de importação — `precificacao-elevador.jsx`).
   *Evento: `PROPOSTA_ELABORADA`.*
7. ◇ **[VerticalParts / Gestor Comercial]** Aprova o envio da proposta? (Regiane ou
   Guilherme). Reprovou → ↺ volta pro Vendedor/Financeiro ajustar.
   *Decisão: `envio_proposta_gestor`.*
8. ◇ **[VerticalParts / CEO]** Aprova o envio da proposta? (Diego — só é liberado depois
   do Gestor Comercial aprovar; é uma dependência em cadeia, não paralela). Reprovou → ↺.
   *Decisão: `envio_proposta_ceo`, `dependeDe` a decisão do passo 7.*
9. ✉ **[VerticalParts / Vendedor] → [Cliente]** Envia a proposta ao cliente.
   *Evento: `PROPOSTA_ENVIADA`.*
10. ◇ **[Cliente / Cliente]** Aprova a proposta? Reprovou → ↺ volta pro Vendedor
    renegociar (loop pro passo 6 ou 9, conforme o motivo).
    *Evento: `CLIENTE_RESPONDEU_PROPOSTA` (`resposta: aprovada | reprovada`).*

    **A partir daqui, dois ramos nascem em paralelo assim que o cliente aprova:**

11. ◇ **[VerticalParts / CEO]** Aprova a compra do equipamento? — disparado
    **imediatamente** após a aprovação do cliente, bem antes da assinatura do contrato ou
    do sinal (pedido explícito do dono do processo: elevador/escada são caros, só o frete
    marítimo já passa de R$ 7 mil). Fica **pendente** até os gatilhos do passo 15
    liberarem o *start* de fato. Reprovou → ↺ processo interrompido, decisão fica
    registrada.
    *Decisão: `compra_equipamento_ceo`.*
12. **[VerticalParts / Financeiro]** Consulta o score de crédito do cliente.
    *Evento: `FINANCEIRO_CONSULTOU_SCORE`.*
13. ◇ **[VerticalParts / Financeiro]** Dá aval pra vender? Reprovou → ↺ processo
    interrompido.
    *Eventos: `FINANCEIRO_APROVOU_VENDA` / `FINANCEIRO_REPROVOU_VENDA`.*
14. ✉ **[VerticalParts / Jurídico] → [Cliente]** Envia o contrato de venda.
    *Evento: `CONTRATO_VENDA_ENVIADO`.*
15. **[Cliente / Cliente]** Assina o contrato **e** paga o sinal (boleto). Duas ações do
    mesmo ator, registradas em separado.
    *Eventos: `CONTRATO_VENDA_ASSINADO`, `SINAL_PAGO`.*
16. **[VerticalParts / Financeiro]** Confirma o aval de pagamento do sinal.
    *Evento: `AVAL_PAGAMENTO_CONFIRMADO`.*
17. ◇ **Gateway de sincronização (AND)** — nó automático `COMPRA_LIBERADA`
    (`gatilhos-engine.js`): só abre depois que **Contrato assinado + Sinal pago + Aval de
    Pagamento confirmado** (passos 15+16) tiverem os três acontecido. Some com a
    aprovação do CEO do passo 11 pra formar o gate real de início de compra
    (`verificarGateCompra`, `src/decisoes-store.js`).
18. ✉ **[VerticalParts / Importação] → [Fornecedor]** Inicia a compra do equipamento no
    fornecedor (abre a 1ª P.I. — Pedido de Importação).
    *Evento: `COMPRA_FORNECEDOR_INICIADA`.*
19. ✉ **[Fornecedor / Fornecedor] → [VerticalParts]** Confirma a compra.
    *Evento: `COMPRA_FORNECEDOR_CONFIRMADA`.*
20. **[VerticalParts / Engenharia]** Finaliza o projeto técnico do equipamento (memorial,
    desenho técnico).
    *Evento: `PROJETO_ELEVADOR_FINALIZADO`.*

### Fase B — Execução da Obra (Dossiê)

*(nasce a partir do fechamento comercial acima; status controlado por
`dossier_obra.status_master`, histórico em `dossier_history`)*

21. **[VerticalParts / Vendedor]** Lead qualificado vira obra confirmada.
    *Status: `Lead qualificado` → `Dossier criado`.*
22. **[VerticalParts / Engenharia]** Faz a análise técnica da obra + vistorias em campo
    (fases da vistoria concluídas registradas à parte).
    *Status: `Análise técnica`.*
23. **[VerticalParts / Financeiro]** Precifica os custos finais de execução.
    *Status: `Precificação`.*
24. **[VerticalParts / Vendedor]** (marco do Dossiê, referente à mesma proposta já
    percorrida na Fase A — o status aqui é sobre a obra, não reabre a negociação).
    *Status: `Proposta enviada` → `Contrato assinado`.*
25. **[VerticalParts / Importação]** Acompanha a importação em si — abertura da P.I.,
    pagamentos ao fornecedor (1º e 2º), embarque.
    *Status: `Importação`.* Detalhado no bloco logístico abaixo.
26. ◇ **[VerticalParts / CEO]** Aprova a contratação de mão de obra (o parceiro
    instalador)? Reprovou → ↺.
    *Decisão: `contratacao_mao_obra_ceo`.*
27. ◇ **[VerticalParts / RH]** Aprova este montador específico entrar **nesta obra**?
    (Karla — mesmo que o parceiro já esteja homologado em geral, a entrada é aprovada
    obra a obra). Reprovou → ↺.
    *Status: `Homologação instalador`. Decisão: `montador_entra_obra_rh`.*

    **Bloco logístico (roda em paralelo à homologação do instalador, mesma Fase B):**

28. ✉ **[Cadeia Logística / Transporte Marítimo]** Navio sai do porto de origem.
29. ✉ **[Cadeia Logística / Transporte Marítimo]** Navio chega no porto de Santos.
30. **[Cadeia Logística / Despachante]** Registra a DUIMP.
31. **[Cadeia Logística / Despachante]** Faz a conferência aduaneira.
32. ✉ **[Cadeia Logística / Transporte Terrestre] → [Cliente]** Entrega o equipamento no
    endereço da obra.
    *(Passos 28–32 sem evento nomeado ainda — lidos direto de `embarques_importacao`:
    `etd_atual/original`, `eta_santos`, `data_registro_di`, `conferencia_data`,
    `data_entrega`.)*
33. **[Cliente / Cliente]** Recebe o equipamento na obra (confirmação de recebimento,
    com nº de pessoas presentes).
    *Campo: `dossier_obra.equipamento_entregue_em`.*

34. **[Instalador / Instalador]** Executa o **Cronograma de Instalação** — checklist de
    etapas por semana (28 itens padrão para elevador, camaleão por tipo de equipamento),
    cada item concluído registra quem e quando.
    *Status: `Instalação`. Tabela: `instalacao_checklist_itens`.*
35. **[VerticalParts / Engenharia]** Monta o Data Book da obra (documentação final).
    *Status: `DataBook`.*
36. **[Cliente / Cliente]** Obra formalmente entregue.
    *Status: `Entregue`.*
37. **[Empresa de Manutenção / Empresa de Manutenção]** Executa a manutenção preventiva
    — etapa recorrente, fecha o ciclo e reabre periodicamente (não é um fim linear).
    *Status: `Manutenção preventiva`.*

---

## 4. Ramo lateral — Compra de Varejo (Logística)

Não faz parte da linha principal acima (não é venda de equipamento, é insumo/peça pro
almoxarifado) — mas usa o mesmo mecanismo de gate, então vale uma raia lateral separada
se o infográfico quiser mostrar o padrão se repetindo em escala menor:

- **[VerticalParts / Logística]** Abre um pedido de compra de varejo.
- ◇ **[VerticalParts / Logística — Chefe]** Aprova? (Danilo). Reprovou → ↺.
  *Decisão: `compra_varejo_logistica`, papel `logistica_lider`.*

---

## 5. Loops e exceções (pontos de retorno no diagrama)

Todo ◇ acima que tem "Reprovou → ↺" é um ponto onde o BPMN deveria desenhar uma seta de
volta, não um fim de raia:

- Gestor Comercial ou CEO reprovam envio de proposta → volta pro Vendedor/Financeiro.
- Cliente reprova a proposta → volta pro Vendedor renegociar.
- Financeiro reprova a venda (score) → processo interrompido (fim real, não loop).
- CEO reprova a compra do equipamento → processo interrompido.
- CEO reprova a contratação de mão de obra → volta pra buscar outro parceiro.
- RH reprova o montador entrar na obra → volta pra buscar outro montador pra essa obra
  específica (o parceiro pode continuar homologado em geral).

---

## 7. Cruzamento com o sidebar real (cabeçalho = módulo, linha = submódulo)

Ideia: em vez de (ou além de) Pool/Lane abstratos, usar como cabeçalho do infográfico os
**9 módulos do menu lateral, na ordem em que já aparecem lá** (`NAV_GROUPS` em
`src/shell.jsx` — o comentário no topo do arquivo já diz que a ordem segue o workflow:
"pré-venda → contrato/importação/suprimentos → engenharia → RH → logística → admin"), e
como linhas os submódulos de cada um. Isso é ótimo pra validar o fluxo porque força cada
passo a apontar pra uma tela que **existe de verdade** — se um passo não encontra endereço
em nenhuma célula, ou dois passos que deveriam ser telas diferentes caem na mesma célula,
o desenho está mentindo sobre o sistema real.

### 7.1 A grade (cabeçalho + linhas), direto do código

| # | Módulo (coluna) | Submódulos (linhas, ordem do menu) |
|---|---|---|
| 1 | **Geral** | Dashboard · Notificações · Central de Decisões · Gatilhos & Prazo |
| 2 | **Comercial** | Leads · Formulários · Cotações a Fornecedor · Propostas |
| 3 | **ADM/Financeiro** | Precificação · Aval Financeiro |
| 4 | **Cadastros** *(transversal, sem passo próprio no fluxo)* | Clientes · Fornecedores · Produtos |
| 5 | **Jurídico \| Importação \| Suprimentos** | Jurídico · Contrato Venda de Equipamentos · Importação → *Painel · P.I. · RFQ · IMS · Embarques · Análise de Preços* · Compras Nacional · Pedidos |
| 6 | **Engenharia** | Engenharia · Projeto de Elevadores · Projeto de Equipamento · Projetos ER/Es · Ficha Técnica · Contrato Instalador · Vistorias de Obras · Instalação em Campo · Status de Obras · Linha do Tempo da Cotação · ART · Cronograma · Data Book & Termo · Entrega Final |
| 7 | **Recursos Humanos** | Homologação de Parceiros Instaladores |
| 8 | **Logística** | Almoxarifado · Expedição *(planejado, sem tela ainda)* · Logística *(planejado, sem tela ainda)* |
| 9 | **Portal Admin** *(transversal, sem passo próprio no fluxo)* | Logs de Atividade · Configurações do Sistema |

Cadastros e Portal Admin não recebem nenhum passo do fluxo — são suporte transversal, não
etapas sequenciais. Se sobrar algum passo caindo nessas colunas no desenho final, é sinal
de que o passo foi mal endereçado.

### 7.2 Cada passo do fluxo, com endereço real (Módulo › Submódulo)

Mesma numeração da seção 3. Onde o evento/decisão tem call-site único no código, o
endereço é literal; onde não tem tela própria ainda, está marcado explicitamente — não
inventei uma célula só pra preencher a tabela.

| Nº | Passo | Lane (BPMN) | Módulo | Submódulo |
|---|---|---|---|---|
| 1 | Cliente manifesta interesse | Cliente | — | **fora do sistema** (canal externo, ainda sem módulo) |
| 2 | Vendedor qualifica o Lead | Vendedor | Comercial | Leads |
| 3 | Preenche o Formulário de Equipamento | Vendedor | Comercial | Formulários |
| 4 | Envia cotação técnica ao fornecedor | Vendedor | Comercial | Cotações a Fornecedor |
| 5 | Fornecedor responde | Fornecedor | Comercial | Cotações a Fornecedor *(ator externo, tela interna)* |
| 6 | Elabora a proposta comercial | Financeiro | Comercial | Propostas → **Editor de Proposta** *(rota `proposta-editor`, sem item próprio no menu — só se chega por drill-down; ver nota 7.3)* |
| 7 | ◇ Gestor Comercial aprova envio | Gestor Comercial | Geral | Central de Decisões |
| 8 | ◇ CEO aprova envio | CEO | Geral | Central de Decisões |
| 9 | Envia a proposta ao cliente | Vendedor | Comercial | Propostas |
| 10 | ◇ Cliente aprova a proposta | Cliente | Comercial | Propostas *(resposta registrada aqui; cliente responde por link público, fora do sidebar)* |
| 11 | ◇ CEO aprova a compra do equipamento | CEO | Geral | Central de Decisões |
| 12 | Consulta o score do cliente | Financeiro | ADM/Financeiro | Aval Financeiro |
| 13 | ◇ Financeiro aprova a venda | Financeiro | ADM/Financeiro | Aval Financeiro |
| 14 | Envia o contrato de venda | Jurídico | Jurídico \| Importação \| Suprimentos | Contrato Venda de Equipamentos |
| 15 | Cliente assina o contrato + paga o sinal | Cliente | Jurídico \| Importação \| Suprimentos **e** ADM/Financeiro | Contrato Venda de Equipamentos (assinatura) · Aval Financeiro (pagamento do sinal) |
| 16 | Confirma o aval de pagamento | Financeiro | ADM/Financeiro | Aval Financeiro |
| 17 | ◇ Gateway AND — `COMPRA_LIBERADA` | *(automático)* | Geral | Gatilhos & Prazo |
| 18 | Inicia a compra no fornecedor | Importação | Comercial | Cotações a Fornecedor *(não é em Importação — ver nota 7.3)* |
| 19 | Fornecedor confirma a compra | Fornecedor | Comercial | Cotações a Fornecedor |
| 20 | Finaliza o projeto técnico | Engenharia | Engenharia | Projeto de Elevadores |
| 21 | Lead vira Dossiê (obra confirmada) | Vendedor | Comercial | Leads *(o Dossiê nasce aqui, não em Engenharia — ver nota 7.3)* |
| 22 | Análise técnica + vistorias | Engenharia | Engenharia | Vistorias de Obras · Status de Obras |
| 23 | Precificação dos custos de execução | Financeiro | ADM/Financeiro | Precificação |
| 24 | Marco de status "Proposta enviada" / "Contrato assinado" da obra | Vendedor / Cliente | Engenharia | Status de Obras *(reaproveita o nome dos passos 9–15, mas é status do Dossiê, não reabre a negociação)* |
| 25 | Importação: P.I., pagamentos, embarque | Importação | Jurídico \| Importação \| Suprimentos | P.I. · Embarques |
| 26 | ◇ CEO aprova contratação de mão de obra | CEO | Geral | Central de Decisões *(disparado a partir de Engenharia → Contrato Instalador)* |
| 27 | ◇ RH aprova o montador nesta obra | RH | Geral **e** Recursos Humanos | Central de Decisões *(decisão)* · Homologação de Parceiros Instaladores *(cadastro do parceiro)* |
| 28–29 | Navio sai da origem / chega em Santos | Transporte Marítimo | Jurídico \| Importação \| Suprimentos | Embarques |
| 30–31 | Registra DUIMP / conferência aduaneira | Despachante | Jurídico \| Importação \| Suprimentos | Embarques |
| 32 | Entrega no endereço da obra | Transporte Terrestre | Jurídico \| Importação \| Suprimentos | Embarques |
| 33 | Cliente recebe o equipamento na obra | Cliente | Engenharia | Status de Obras |
| 34 | Instalador executa o Cronograma de Instalação | Instalador | Engenharia | **Instalação em Campo** *(confirmado ao vivo — "checklist de obra, laudo final e termo de aceite"; ver duplicação em 7.4)* |
| 35 | Monta o Data Book | Engenharia | Engenharia | Data Book & Termo |
| 36 | Obra entregue | Cliente | Engenharia | Entrega Final |
| 37 | Manutenção preventiva | Empresa de Manutenção | Engenharia | **Entrega Final** *(confirmado ao vivo — a tela já se chama "Handover & Manutenção" e cita "transição para Escamax (sistema de manutenção preventiva)"; corrige o que eu tinha escrito antes — ver 7.4)* |
| *lateral* | Compra de varejo (Logística) | Logística | Logística | Almoxarifado *(confirmado ao vivo — a tela já se chama "Pedidos de Compra (Varejo)")* |

### 7.3 O que esse cruzamento revelou (vale desenhar destacado)

Fazer esse endereçamento módulo-a-módulo achou coisas que a versão só-Pool/Lane escondia:

- **Todo gateway de aprovação (CEO, Gestor Comercial, RH, Financeiro) mora fisicamente em
  um único lugar — Geral › Central de Decisões** — não importa qual "lane" decide. Isso é
  ótimo pra desenhar: um infográfico por módulo mostraria a mesma célula recebendo seta de
  quase toda coluna, o que é uma pista visual forte de "aqui é onde tudo converge".
- **Compra do equipamento (passos 18–19) fica em Comercial › Cotações a Fornecedor, não em
  Importação** — mesmo o papel/lane sendo "Importação"/"Fornecedor". Se o infográfico for
  organizado por módulo, esse passo cai na coluna 2, não na coluna 5 — contra-intuitivo,
  mas é onde o código de fato registra o evento (`cotacao-elevador-fornecedor-store.js`).
- **O Dossiê da Obra nasce em Comercial › Leads**, não em Engenharia — a "Fase B" só passa
  o bastão pra Engenharia a partir da Análise Técnica (passo 22) em diante.
- **"Editor de Proposta" (passo 6) não tem item de menu próprio** — só se chega via
  drill-down a partir de Precificação/Propostas. Se o infográfico exigir uma célula por
  item de sidebar, esse passo não tem endereço fixo — vale marcar como exceção, não forçar
  numa coluna.
- **Passos 28–32 (5 eventos do bloco marítimo/aduaneiro) colapsam numa única tela —
  Embarques.** Se o infográfico for por submódulo (uma linha por linha da tabela 7.1), os
  5 BPMN steps viram uma linha só com múltiplos marcos internos — é a mesma tela, o
  BPMN é que é mais granular que a UI.
- ~~Manutenção preventiva (passo 37) não tem módulo nenhum ainda~~ — **errado, corrigido
  na varredura ao vivo da seção 7.4**: existe, é a tela Entrega Final.

## 7.4 Varredura ao vivo — cada rota clicada de verdade (15/08)

Depois de escrever as seções 7.1–7.3 só lendo código, cliquei em **todos os 43 itens do
menu lateral**, um por um, no ambiente real (`localhost:64042`, Supabase de produção),
conferindo breadcrumb + conteúdo carregado de cada tela. Todas as 43 rotas abriram sem
erro. O que valeu a pena registrar — coisas que só apareceram testando de verdade, não
lendo `shell.jsx`:

**Duas correções ao que eu tinha escrito antes (7.2/7.3):**

- **Manutenção preventiva (passo 37) TEM módulo, sim** — é a tela **Entrega Final**
  (breadcrumb `INSTALAÇÃO & ENTREGA · PÓS-VENDA`), cujo próprio subtítulo diz "Entrega
  final, garantia e transição para **Escamax (sistema de manutenção preventiva)**". Eu
  tinha lido só o `STATUS_FLOW` do Dossiê e concluído errado que não havia tela — havia,
  só não tem nome óbvio ("manutenção" não aparece no rótulo do menu, só no texto de
  dentro). O que é real, sim: a manutenção em si roda **fora do VP Gestão**, num sistema
  chamado Escamax — aqui só se registra a transição/handover pra lá.
- **"Cronograma" (item de menu, grupo Engenharia) não é o checklist de instalação** —
  confirmado ao vivo: é **"Cronograma de Pagamento da Instalação"**, sobre liberar
  pagamento da mão de obra em 4 fases por marco físico. O checklist de instalação de
  verdade (que eu tinha suposto morar numa aba dentro de Status de Obras) é outra tela:
  **Instalação em Campo** ("checklist de obra, laudo final e termo de aceite").

**Achados novos, que nenhuma leitura de código tinha revelado:**

- **O sidebar mente sobre a própria organização interna.** Cinco itens do grupo
  "Engenharia" no menu (**ART, Cronograma, Data Book & Termo, Entrega Final, Instalação em
  Campo**) carregam, na tela, o breadcrumb `INSTALAÇÃO & ENTREGA` — um agrupamento que
  **não existe em lugar nenhum do menu lateral**. O app trata essas 5 telas como uma fase
  separada ("pós-obra"/"encerramento"); o menu as empilha dentro de Engenharia como se
  fossem a mesma coisa que Projeto de Elevadores ou Ficha Técnica.
- **"Contrato Instalador"** (menu: grupo Engenharia) é breadcrumbed **`JURÍDICO`** na
  tela — é o mesmo motor de assinatura digital do Contrato de Venda (grupo Jurídico), só
  reaproveitado pra outro tipo de contrato. Faz sentido pelo código, mas no menu ele
  aparece longe do Jurídico, do lado de Ficha Técnica.
- **"Importação" (item de topo) e "Compras Nacional"** — ambos no grupo de menu "Jurídico
  \| Importação \| Suprimentos" — carregam breadcrumb **`LOGÍSTICA`** na tela, não
  "Jurídico"/"Importação". E pior: **"Importação" (item de topo) e "Embarques" (sub-item
  indentado dentro de "Gestão Importação") são duas telas totalmente diferentes**, apesar
  do nome parecido — "Importação" é um painel de rastreamento marítimo por AIS
  ("Embarques em trânsito + rastreamento marítimo"), "Embarques" é o gerenciador de
  processos de importação item a item (é essa a tela dos passos 28–32 do fluxo, com
  breadcrumb `JURÍDICO · IMPORTAÇÃO · GESTÃO IMPORTAÇÃO`, correto). Quem for desenhar
  precisa usar o nome completo "Embarques (Gestão Importação)" pra não confundir com o
  painel AIS.
- **Duplicação de "checklist de instalação" — investigada a fundo (15/08, mesmo dia):**
  são dois sistemas de dados **sem nenhuma relação entre si**, não uma coisa só vista de
  dois ângulos:
  - **`projetos`** (tabela por trás de "Instalação em Campo", `operacoes.jsx`) **não tem
    coluna `numero_cotacao` nem `dossier_id`** — é estruturalmente impossível ligar um
    registro dela a uma cotação ou a um Dossiê. O vínculo com parceiro instalador nem é
    uma FK: o código faz `p.responsavel?.includes(pc.nome)` (comparação de substring no
    nome), com o comentário `// Simula alocações` no próprio arquivo. O botão "Agendar
    instalação" da mesma tela nem cria linha em `projetos`/`equipes` — só insere uma
    tarefa genérica na tabela `tarefas`, também sem `numero_cotacao`.
  - **`dossier_obra`** (por trás da aba Cronograma de Instalação) tem `numero_cotacao` e
    `parceiro_instalador_id` como FK de verdade — é o mesmo "eixo" que Formulário →
    Cotação → Proposta → Dossiê usam a cotação inteira.
  - Contagem de linhas: `projetos` = 1, `equipes` = 3, `equipe_checklist` = **0** (nunca
    usada de fato), `parceiros_instaladores` = **0** (vazia) — "Instalação em Campo" está
    com dado de fixture/seed, não uso real. `instalacao_checklist_itens` tinha 28 linhas
    de teste desta sessão no dossiê `DOS-MST37FRN` — **já removidas**.
  - Registrado como issue **#271** (aberta, não fechada — é diagnóstico, decisão de
    migrar ou aposentar a tela fica pra uma sessão futura).
  - **Conclusão**: não são a mesma feature duplicada — são duas features diferentes que
    tentam resolver "acompanhar a instalação", construídas em momentos diferentes, uma
    presa ao eixo real do sistema (Nº da Cotação) e outra solta dele. Pra desenhar o passo
    34, o infográfico não pode fingir que "Instalação em Campo" e "Cronograma de
    Instalação" são a mesma caixa — são duas, e hoje só uma delas (Cronograma de
    Instalação, dentro do Dossiê) está de fato conectada ao resto do fluxo.
- **Confirmado ao vivo**: "Editor de Proposta" (passo 6) realmente não tem item de menu —
  cliquei numa linha da lista de Propostas e a rota abriu (`Editor de Proposta · VP
  Gestão`, breadcrumb "Propostas / VPEL-EL0911"), confirmando que é drill-down mesmo.
- **Confirmado ao vivo**: "Central de Decisões" hoje mostra "Nenhuma decisão pendente pra
  você no momento" — bate com a leitura de código (é onde os gateways de CEO/Gestor/RH
  convergem), só não há nenhuma pendência real agora pra ver o texto populado.
- **Achado incidental, sem relação com o fluxo**: a varredura encontrou um cliente de
  teste órfão no banco (`QA Teste Codigo Equipamento 15-08`, sem formulário vinculado —
  sobra de um teste anterior desta mesma sessão que não foi limpo). Removido direto via
  SQL depois de confirmar que não tinha nada vinculado.

---

## 8. Convenção de nomes pra quem for desenhar

- **Pool** = caixa grande com o nome da organização, sem tarefa dentro dela — só as Lanes.
- **Lane** = faixa horizontal (ou vertical) dentro da Pool, um papel por faixa.
- **Tarefa** = retângulo de cantos arredondados, verbo no infinitivo ("Preencher
  Formulário", não "Formulário preenchido").
- **Gateway** = losango; usar `+` (AND, todos os caminhos abrem) só no passo 17 (é o único
  ponto de sincronização de múltiplas condições); todo o resto é `X` (XOR — um caminho ou
  outro, aprovado/reprovado).
- **Mensagem** = seta tracejada cruzando a borda de duas Pools (é onde a fronteira
  organizacional realmente importa — só ali um envelope faz sentido).
- Numeração dos passos = ordem cronológica típica, não trilha obrigatória: Fase B corre em
  paralelo em vários pontos (ex.: passos 25–32 acontecem enquanto 26–27 também correm).
