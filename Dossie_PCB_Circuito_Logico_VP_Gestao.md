# Dossiê PCB — Circuito Lógico da Plataforma VP Gestão

## Objetivo

Este documento descreve a plataforma VP Gestão como uma placa de circuito impresso, uma PCB operacional, para orientar o Claude Code a localizar problemas de conexão, trilhas rompidas, curtos-circuitos, gates fracos, eventos sem disparo e etapas que avançam sem validação.

A metáfora é técnica, mas a intenção é prática: transformar o fluxo comercial, financeiro, importação, engenharia, obra, instalação e entrega em um circuito auditável por Número de Cotação.

O foco não é criar uma tela bonita. O foco é garantir que cada ação humana ou sistêmica gere um sinal, que cada sinal avance ou bloqueie a etapa correta, e que nenhuma cotação avance por atalho.

---

## 1. Visão da placa

A plataforma pode ser entendida como uma PCB com os seguintes elementos:

```text
PCB                     = VP Gestão inteiro
Trilha principal        = numero_cotacao
Barramento de sinais    = eventos_fluxo
CI controlador          = GatilhosEngine
Memória                 = Supabase
Tabela de estado        = gatilhos
Painel de LEDs          = Cadeia de Gatilhos por Cotação
Sensores                = formulários, respostas, assinaturas, pagamentos, uploads e checklists
Relés                   = gates de aprovação
Fusíveis                = bloqueios que impedem avanço indevido
Conectores externos     = cliente, fornecedor, instalador, agente de carga, transportadora
Osciloscópio            = dashboard, logs, notificações e linha do tempo
Curto-circuito          = etapa avançando sem gate
Trilha rompida          = evento catalogado, mas não disparado
Mal contato             = dado existe em uma tela, mas não chega à próxima
Falso verde             = etapa aparece concluída sem evidência suficiente
```

---

## 2. A trilha principal da placa

A trilha principal é:

```text
numero_cotacao
```

Ela deve nascer no formulário técnico-comercial e acompanhar todo o ciclo:

```text
Formulário
→ Cotação a Fornecedor
→ Resposta do Fornecedor
→ Precificação
→ Proposta Comercial
→ Resposta do Cliente
→ Contrato de Venda
→ Aval Financeiro
→ Sinal / Pagamento
→ Compra no Fornecedor
→ P.I.
→ RFQ / Frete
→ IMS / Recursos
→ Embarque
→ Engenharia / Projeto
→ Dossiê da Obra
→ Vistorias
→ Instalador
→ Instalação
→ ART
→ Testes
→ Data Book
→ Termo de Entrega
→ Handover
→ Pós-venda
```

Regra de engenharia de software:

```text
Sem numero_cotacao não existe rastreabilidade de ponta a ponta.
```

Se qualquer módulo operar sem `numero_cotacao`, ele vira uma ilha. A ilha pode até funcionar localmente, mas fica fora do circuito principal.

---

## 3. Chip controlador central

O CI controlador é:

```text
GatilhosEngine
```

Responsabilidades esperadas:

1. Receber eventos da operação.
2. Fechar o nó atual da cadeia.
3. Criar o próximo nó.
4. Respeitar predecessores.
5. Aplicar SLA quando existir.
6. Permitir navegação para a rota correta.
7. Marcar etapas sem fechamento automático como não rastreadas.
8. Evitar que o painel mostre conclusão sem evento real.

Fluxo lógico:

```text
EventosFluxo.registrar(evento, numeroCotacao, alvoId, detalhe)
        ↓
GatilhosEngine.onEvento(...)
        ↓
fecha nó anterior
        ↓
nasce próximo nó
        ↓
grava em gatilhos
        ↓
Financeiro/Cadeia de Gatilhos por Cotação exibe estado
```

---

## 4. Barramento de sinais

O barramento é:

```text
eventos_fluxo
```

Ele não deve ser confundido com log de auditoria. O log responde: “quem fez o quê?”.

O `eventos_fluxo` responde:

```text
O que aconteceu nesta cotação, em qual ordem, e qual próximo nó isso dispara?
```

Regra:

```text
Todo botão humano relevante precisa disparar EventosFluxo.registrar().
```

Se uma pessoa executa uma ação importante e essa ação não registra evento, a placa tem um sensor desconectado.

---

## 5. Tabela de estado dos LEDs

A tabela de estado é:

```text
gatilhos
```

Cada linha automática de `gatilhos` deve representar um nó da cadeia por cotação.

Campos mínimos esperados por nó:

```text
id
numero_cotacao
evento_key
trigger_name
predecessor_id
alvo_id
tipo_relacionamento
origem
conclusao_tipo
nascido_em
prazo_em
due_date
days_left
status
concluido_em
motivo_fechamento
```

Interpretação:

```text
nascido_em     = quando a corrente chegou neste componente
prazo_em       = até quando o componente pode ficar energizado sem alerta
concluido_em   = quando a corrente passou para a próxima trilha
status         = condição elétrica atual
alvo_id        = componente físico/tela/registro onde a ação deve ocorrer
```

---

## 6. Painel de LEDs

A tela:

```text
/adm-financeiro/financeiro
```

funciona como painel de LEDs da placa.

Ela deve exibir:

```text
Cadeia de Gatilhos por Cotação
```

Regra visual:

```text
Cada Número de Cotação = uma linha ou uma árvore de circuito
Cada nó = um LED / etapa
Verde = concluído com evento real
Amarelo = aguardando ação, resposta ou prazo
Vermelho = bloqueado, rompido, atrasado ou sem condição de avanço
Cinza/opaco = etapa futura ainda não energizada
Sem rastreio automático = nó visível, mas sem fechamento real no código
```

---

## 7. Circuito lógico booleano

A placa deve usar lógica booleana para decisões.

### 7.1 Portas básicas

```text
AND   = todas as condições precisam ser verdadeiras
OR    = qualquer condição válida pode liberar
NOT   = ausência de condição bloqueia
XOR   = uma e somente uma opção pode ser verdadeira
NAND  = se faltar qualquer item obrigatório, bloqueia
NOR   = nada aconteceu, então alerta
XNOR  = conferência de igualdade entre duas fontes
```

---

## 8. Fórmulas booleanas principais

### 8.1 Cliente respondeu proposta

O cliente tem três poderes iniciais:

```text
CLIENTE_RESPONDEU = ACEITOU XOR PEDIU_REVISAO XOR RECUSOU
```

Interpretação:

```text
ACEITOU        → liga motores da cadeia principal
PEDIU_REVISAO  → abre subcircuito de análise interna
RECUSOU        → mata proposta e tarefas futuras daquele ciclo
```

Importante: o cliente é o único ator externo com estes três poderes no momento da proposta.

---

### 8.2 Revisão solicitada pelo cliente

Quando o cliente pede revisão, não se deve voltar automaticamente para proposta revisada.

A VerticalParts precisa decidir se a revisão é aceitável.

```text
REVISAO_ACEITAVEL =
  dentro_da_norma
  AND tecnicamente_viavel
  AND comercialmente_viavel
  AND juridicamente_segura
  AND margem_minima_ok
```

Se a revisão for aceitável:

```text
VERTICALPARTS_ACEITA_REVISAO = true
→ proposta revisada
→ reenviar cliente
→ cliente responde revisão
```

Se a revisão não for aceitável:

```text
VERTICALPARTS_RECUSA_REVISAO = true
→ recusa interna justificada
→ encerra ou propõe alternativa segura
```

Exemplos de revisão que podem ser recusadas internamente:

```text
cliente pede solução fora de norma
cliente pede retirar item obrigatório de segurança
cliente pede configuração tecnicamente inviável
cliente pede acabamento incompatível com o equipamento
cliente pede prazo impossível
cliente pede preço abaixo da margem mínima
cliente pede condição jurídica ou financeira insegura
```

---

### 8.3 Cliente respondeu revisão

Depois de uma proposta revisada:

```text
CLIENTE_RESPONDE_REVISAO = ACEITA_REVISAO XOR RECUSA_REVISAO XOR PEDE_NOVA_REVISAO
```

Regra anti-loop:

```text
Se PEDE_NOVA_REVISAO muitas vezes, exigir decisão gerencial.
```

Sugestão:

```text
max_revisoes_sem_aprovacao = 3
```

Depois disso, criar decisão:

```text
DECISAO_GERENCIAL_REVISAO
```

---

### 8.4 Compra liberada

A compra só pode ser liberada quando todas as condições forem verdadeiras:

```text
COMPRA_LIBERADA =
  contrato_assinado
  AND sinal_pago
  AND aval_pagamento_confirmado
  AND projeto_finalizado
  AND ceo_aprovou
  AND owner_aprovou
```

Se qualquer item for falso:

```text
COMPRA_BLOQUEADA = true
```

A mensagem deve sempre apontar o primeiro item faltante.

---

### 8.5 Obra pronta para instalação

```text
OBRA_PRONTA =
  contrato_assinado
  AND sinal_pago
  AND projeto_aprovado
  AND vistorias_obrigatorias_ok
  AND instalador_vinculado
  AND rh_liberou_montador_para_obra
  AND contrato_instalador_assinado
  AND equipamento_recebido
  AND recursos_obra_ok
```

Recursos de obra são condicionais:

```text
RECURSOS_OBRA_OK =
  NOT andaime_munck_necessario
  OR andaime_munck_providenciado
```

---

### 8.6 Entrega concluída

```text
ENTREGA_CONCLUIDA =
  instalacao_concluida
  AND art_emitida
  AND testes_aprovados
  AND databook_montado
  AND databook_enviado
  AND cliente_aprovou_databook
  AND termo_assinado
  AND handover_concluido
```

Se o equipamento funciona, mas não tem Data Book, Termo e Handover:

```text
ENTREGA_CONCLUIDA = false
```

Equipamento funcionando não encerra contrato sozinho.

---

## 9. Componentes da PCB

### 9.1 Fonte de energia — Lead / Cliente / Equipamento

```text
Componente: Entrada de sinal
Módulos: leads, cadastro-clientes, formulario-elevador
Função: iniciar a corrente comercial
Saída esperada: numero_cotacao + dados técnicos mínimos
```

Falhas possíveis:

```text
Lead sem cliente
Cliente duplicado
Formulário sem dados obrigatórios
Número de cotação não gerado
Número de cotação não propagado
```

Correção esperada:

```text
Nenhum formulário técnico-comercial pode avançar sem numero_cotacao.
```

---

### 9.2 Sensor técnico — Formulário

```text
Componente: Sensor de especificação
Evento nasce: FORMULARIO_PREENCHIDO
Fecha com: COTACAO_ENVIADA_FORNECEDOR
```

Ações humanas:

```text
Vendedor coleta dados
Cliente pode preencher via link
Vendedor revisa dados
```

Possibilidades:

```text
SIM     = formulário completo
NÃO     = dados técnicos insuficientes
ATRASO  = cliente/vendedor não concluiu
```

---

### 9.3 Conector externo — Fornecedor

```text
Componente: Conector externo fornecedor
Evento nasce: COTACAO_ENVIADA_FORNECEDOR
Fecha com: FORNECEDOR_RESPONDEU
SLA: 48h
```

Ações humanas:

```text
Enviar cotação ao fornecedor
Fornecedor responder
Revisar resposta do fornecedor
```

Possibilidades:

```text
SIM     = fornecedor respondeu de forma válida
NÃO     = fornecedor recusou ou respondeu inviável
ATRASO  = fornecedor não respondeu no prazo
```

Falhas possíveis:

```text
link enviado, mas sem evento COTACAO_ENVIADA_FORNECEDOR
fornecedor responde, mas sem evento FORNECEDOR_RESPONDEU
resposta incompleta considerada verde
```

Correção esperada:

```text
Toda resposta do fornecedor deve gravar evento e atualizar o nó.
```

---

### 9.4 Regulador de tensão — Precificação

```text
Componente: Conversor custo → preço de venda
Evento nasce: FORNECEDOR_RESPONDEU
Fecha com: PROPOSTA_ELABORADA
SLA: 5h
```

Ações humanas:

```text
Financeiro calcula preço
Comercial valida margem
Diretoria aprova exceções
```

Possibilidades:

```text
SIM     = preço aprovado
NÃO     = preço inviável, margem insuficiente ou custo errado
ATRASO  = precificação não respondida
```

Porta booleana:

```text
PRECO_APROVADO = custo_fornecedor_ok AND impostos_ok AND margem_ok AND condicao_comercial_ok
```

---

### 9.5 Driver de saída comercial — Proposta

```text
Componente: Driver comercial
Evento nasce: PROPOSTA_ELABORADA
Fecha com: PROPOSTA_ENVIADA
Tipo: manual
```

Ações humanas:

```text
Preencher proposta
Revisar proposta
Enviar proposta
Cliente visualizar
Cliente responder
```

Possibilidades após envio:

```text
ACEITOU
PEDIU_REVISAO
RECUSOU
ATRASOU
```

Regra:

```text
CLIENTE_RESPONDEU = ACEITOU XOR PEDIU_REVISAO XOR RECUSOU
```

---

### 9.6 Subcircuito de revisão de proposta

Este subcircuito é obrigatório.

```text
PROPOSTA_ENVIADA
→ CLIENTE_PEDIU_REVISAO
→ CLASSIFICAR_REVISAO
→ VERTICALPARTS_ANALISA_REVISAO
```

Tipos de revisão:

```text
preço
desconto
prazo
acabamento
escopo
condição de pagamento
norma / segurança
viabilidade técnica
jurídico contratual
```

Decisão interna:

```text
VERTICALPARTS_ACEITA_REVISAO XOR VERTICALPARTS_RECUSA_REVISAO
```

Se aceita:

```text
PROPOSTA_REVISADA
→ PROPOSTA_REENVIADA
→ CLIENTE_RESPONDE_REVISAO
```

Se recusa:

```text
REVISAO_RECUSADA_INTERNAMENTE
→ justificar motivo
→ propor alternativa ou encerrar ciclo
```

Eventos sugeridos:

```text
CLIENTE_PEDIU_REVISAO_PROPOSTA
REVISAO_PROPOSTA_CLASSIFICADA
VERTICALPARTS_ACEITOU_REVISAO
VERTICALPARTS_RECUSOU_REVISAO
PROPOSTA_REVISADA
PROPOSTA_REENVIADA
CLIENTE_ACEITOU_REVISAO
CLIENTE_RECUSOU_REVISAO
CLIENTE_PEDIU_NOVA_REVISAO
```

Falha atual provável:

```text
Pedido de revisão tratado como texto/status, mas sem subcircuito completo de decisão interna.
```

Correção esperada:

```text
Criar trilha de revisão como parte formal da cadeia, sem confundir recusa do cliente com recusa interna da VerticalParts.
```

---

### 9.7 Relé jurídico — Contrato de Venda

```text
Componente: Relé jurídico
Nasce quando: cliente aceita proposta
Fecha com: CONTRATO_VENDA_ASSINADO
```

Ações humanas:

```text
Gerar contrato
Enviar contrato
Cliente assinar
Jurídico validar assinatura
```

Possibilidades:

```text
SIM     = contrato assinado e validado
NÃO     = cliente recusou ou pediu alteração
ATRASO  = contrato não assinado no prazo
```

Falha semântica a revisar:

```text
Se o nó se chama CONTRATO_ENVIADO, mas fecha com CONTRATO_VENDA_ENVIADO, então o label deve indicar ação pendente: Preparar/enviar contrato.
```

---

### 9.8 Fusível financeiro — Aval, sinal e pagamento

```text
Componente: Fusível financeiro
Responsabilidade: impedir compra sem segurança financeira
```

Ações humanas:

```text
Consultar score
Aprovar ou reprovar venda
Enviar boleto
Confirmar sinal pago
Dar Aval de Pagamento
CEO aprovar
Owner aprovar
```

Portas booleanas:

```text
AVAL_VENDA_OK = score_consultado AND financeiro_aprovou_venda
SINAL_OK = boleto_enviado AND sinal_confirmado
AVAL_PAGAMENTO_OK = financeiro_confirmou_aval_pagamento
APROVACOES_OK = ceo_aprovou AND owner_aprovou
```

Compra:

```text
COMPRA_LIBERADA = AVAL_VENDA_OK AND SINAL_OK AND AVAL_PAGAMENTO_OK AND APROVACOES_OK AND contrato_assinado AND projeto_finalizado
```

Falha crítica a evitar:

```text
botão de iniciar compra sem consultar podeIniciarCompra()
```

Correção esperada:

```text
Todo caminho de compra deve chamar o mesmo gate central.
```

---

### 9.9 Driver de potência — Compra / P.I. / Fornecedor

```text
Componente: Driver de potência da cadeia
Módulos: cotacao-fornecedor-detail, pi-importacao
```

Ações humanas:

```text
Decidir comprar
Criar P.I.
Solicitar pagamento fornecedor
Confirmar pagamento fornecedor
Acompanhar produção
Confirmar compra com fornecedor
Confirmar cargo ready
```

Possibilidades:

```text
SIM     = compra formalizada e produção em andamento
NÃO     = compra reprovada ou fornecedor não confirma
ATRASO  = pagamento, produção ou retorno fornecedor atrasado
```

Condutores frágeis:

```text
Cargo Ready sem fechamento automático
Pagamento fornecedor como dado, mas nem sempre como evento
Produção acompanhada sem ponto claro de conclusão
```

Correção esperada:

```text
Transformar mudanças importantes da P.I. em eventos do fluxo.
```

---

### 9.10 Conector logístico — RFQ / Agente / Embarque

```text
Componente: Conector logístico externo
Módulos: rfq-importacao, embarques-importacao, ims-importacao
```

Ações humanas:

```text
Enviar RFQ de frete
Receber cotações de frete
Definir agente de carga
Criar embarque
Atualizar ETD/ETA
Registrar chegada
Registrar entrega na obra
```

Falhas já conhecidas pelo desenho atual:

```text
Agente de carga definido sem campo estruturado
Embarque chegada sem evento de fechamento
Cargo Ready sem ação clara
RFQ de frete talvez não esteja separado de RFQ genérico
```

Correção esperada:

```text
Criar campos e eventos logísticos explícitos.
```

Eventos necessários:

```text
RFQ_FRETE_ENVIADO
AGENTE_CARGA_DEFINIDO
EMBARQUE_CRIADO
EMBARQUE_ATUALIZADO
EMBARQUE_CHEGOU_BRASIL
EQUIPAMENTO_ENTREGUE_OBRA
```

---

### 9.11 Processador técnico — Engenharia / Projeto / Ficha Técnica

```text
Componente: Processador técnico
Módulos: eng-projeto-elevadores, ficha-tecnica
```

Ações humanas:

```text
Criar projeto
Enviar projeto ao cliente
Receber aprovação do projeto
Finalizar revisão técnica
Criar ficha técnica
```

Porta booleana:

```text
PROJETO_OK = projeto_criado AND cliente_aprovou_projeto AND engenharia_finalizou
```

Falhas possíveis:

```text
Projeto finalizado sem aprovação do cliente
Cliente aprova fora do sistema sem evento
Ficha técnica criada sem vínculo com numero_cotacao
```

Correção esperada:

```text
Separar claramente: projeto criado, projeto enviado, cliente aprovou, engenharia finalizou.
```

---

### 9.12 Barramento de obra — Dossiê

```text
Componente: Barramento de obra
Módulo: dossier_obra
```

O Dossiê deve consolidar todos os sinais necessários para campo:

```text
cliente
contrato
sinal
projeto
vistoria
instalador
recursos
equipamento
pendências
```

Porta booleana:

```text
DOSSIE_UTIL = numero_cotacao != null
```

Se não houver `numero_cotacao`, o Dossiê fica cego.

Correção esperada:

```text
Dossiê sem numero_cotacao deve ser bloqueado ou marcado como anomalia grave.
```

---

### 9.13 Sensor de campo — Vistorias

```text
Componente: Sensor de obra civil
Módulos: vistorias, vistorias_obras
```

Ações humanas:

```text
Agendar vistoria
Realizar vistoria
Registrar pendência
Resolver pendência
Liberar obra
```

Porta booleana:

```text
VISTORIAS_OK = fase_1_ok AND fase_2_ok AND fase_3_ok
```

Possibilidades:

```text
SIM     = vistoria concluída e obra liberada
NÃO     = obra reprovada ou pendente
ATRASO  = vistoria não agendada ou não realizada
```

Correção esperada:

```text
Toda vistoria deve gravar evento de fluxo e estar ancorada em dossier_obra.
```

---

### 9.14 Relé RH / Instalador

```text
Componente: Relé de mão de obra
Módulos: rh-homologacao, contrato-instalador, instalacao-obra-store
```

Ações humanas:

```text
Homologar parceiro
Vincular parceiro à obra
RH liberar montador para aquela obra
Gerar contrato instalador
Instalador assinar contrato
```

Porta booleana:

```text
INSTALADOR_LIBERADO_PARA_OBRA = parceiro_homologado AND parceiro_vinculado AND rh_liberou_obra AND contrato_instalador_assinado
```

Observação importante:

```text
Instalador homologado em geral não é igual a instalador liberado para esta obra.
```

Correção esperada:

```text
O semáforo deve mostrar liberação específica obra/parceiro, não apenas cadastro homologado.
```

---

### 9.15 Atuador — Instalação

```text
Componente: Atuador de campo
Módulo: instalacao
```

Ações humanas:

```text
Receber equipamento
Conferir equipamento
Iniciar instalação
Atualizar avanço
Registrar pendência
Concluir instalação
```

Porta booleana:

```text
INSTALACAO_PODE_INICIAR = OBRA_PRONTA AND equipamento_recebido AND instalador_liberado
```

Possibilidades:

```text
SIM     = instalação iniciada/concluída
NÃO     = bloqueada por pendência técnica, documental ou de obra
ATRASO  = instalador, obra, equipamento ou recurso atrasado
```

Falhas possíveis:

```text
Equipamento recebido sem conferência separada
Instalação concluída sem testes
Pendência registrada sem fluxo de resolução
```

Correção esperada:

```text
Separar recebimento, conferência, início, pendência, conclusão e teste.
```

---

### 9.16 Saída validada — ART / Testes / Data Book / Termo / Handover

```text
Componente: Saída final da placa
Módulos: art, databook, handover, entrega
```

Ações humanas:

```text
Emitir ART
Realizar testes
Montar Data Book
Enviar Data Book
Cliente aprovar Data Book
Preparar Termo
Enviar Termo
Cliente assinar Termo
Concluir Handover
Ativar Pós-venda
```

Porta booleana final:

```text
PROJETO_ENCERRADO = art_emitida AND testes_aprovados AND databook_aprovado AND termo_assinado AND handover_concluido
```

Trechos frágeis a corrigir:

```text
Testes realizados sem campo/evento claro
Data Book enviado sem nó próprio
Cliente aprovou Data Book sem nó próprio
Termo enviado fora do sistema sem rastreio
Handover possivelmente ainda ligado a trilho legado
```

---

## 10. Lista de trilhas boas

Estas trilhas parecem corretamente desenhadas e devem ser preservadas:

```text
Formulário → EventosFluxo → GatilhosEngine
Cotação enviada → Aguardando fornecedor
Fornecedor respondeu → Precificação
Precificação → Proposta elaborada
Proposta enviada → Aguardando cliente
Cliente aceitou → Contrato / Projeto / Financeiro
Contrato assinado → Sinal
Sinal pago → Aval de Pagamento
Aval de Pagamento → Compra liberada
Dossiê ancorado em numero_cotacao
Checklist de obra pronta ancorado em dossier_obra
Vistoria consolidada em vistorias_obras
Parceiro vinculado à obra gerando decisão RH
```

---

## 11. Lista de mal contatos

### 11.1 SLA cliente divergente

Problema:

```text
AGUARDA_CLIENTE tem SLA de 10 dias no código, mas label pode mencionar 15 dias.
```

Correção:

```text
Padronizar SLA em código, label, comentário, tela e documentação.
```

---

### 11.2 Nome de nó indicando etapa concluída quando ainda é tarefa

Problema:

```text
CONTRATO_ENVIADO pode parecer concluído, mas fecha quando CONTRATO_VENDA_ENVIADO acontece.
```

Correção:

```text
Renomear label para: Preparar/enviar Contrato de Venda.
```

---

### 11.3 Quantidade de etapas divergente

Problema:

```text
Comentários mencionam 47 etapas em um ponto e 73 etapas em outro.
```

Correção:

```text
Separar explicitamente:
- eventos catalogados
- nós visíveis
- nós com fechamento automático
- nós manuais
- nós sem rastreio automático
```

---

### 11.4 Homologação genérica vs liberação específica

Problema:

```text
Instalador homologado não significa instalador liberado para aquela obra.
```

Correção:

```text
Semáforo deve usar liberação obra/parceiro como gate de instalação.
```

---

## 12. Lista de curtos-circuitos

### 12.1 Compra sem gate central

Risco:

```text
Algum botão ou função iniciar compra sem chamar podeIniciarCompra().
```

Correção:

```text
Auditar todos os call-sites de COMPRA_FORNECEDOR_INICIADA.
Antes de registrar o evento, exigir gate central.
```

---

### 12.2 Evento catalogado sem disparo

Risco:

```text
A cadeia mostra etapa que nunca fecha porque ninguém dispara o evento.
```

Correção:

```text
Para cada evento do catálogo, localizar call-site real.
Se não existir, marcar como evento catalogado sem disparo.
```

---

### 12.3 Ação humana sem EventosFluxo

Risco:

```text
Usuário faz ação importante, mas o circuito não percebe.
```

Correção:

```text
Toda ação humana que muda status operacional deve chamar EventosFluxo.registrar().
```

---

### 12.4 Verde falso

Risco:

```text
Etapa aparece concluída apenas porque um campo foi preenchido, mas sem validação/gate/documento.
```

Correção:

```text
Verde só pode nascer de evento real, com alvo_id e evidência mínima.
```

---

## 13. Lista de trilhas rompidas

### 13.1 Cargo Ready

Problema:

```text
CARGO_READY existe como etapa, mas precisa de ação clara para fechar.
```

Correção:

```text
Criar botão/campo Confirmar Cargo Ready.
Disparar CARGO_READY_CONFIRMADO.
```

---

### 13.2 Agente de carga definido

Problema:

```text
Agente de carga não tem campo estruturado claro.
```

Correção:

```text
Criar estrutura:
agente_carga_id
agente_carga_nome
cotacao_frete_id
data_definicao_agente
Evento: AGENTE_CARGA_DEFINIDO
```

---

### 13.3 Embarque chegada

Problema:

```text
Embarque até chegada não tem fechamento automático claro.
```

Correção:

```text
Criar eventos:
EMBARQUE_CHEGOU_BRASIL
EMBARQUE_ENTREGUE_OBRA
```

---

### 13.4 Testes finais

Problema:

```text
TESTES_REALIZADOS existe como evento, mas precisa de checklist/campo próprio.
```

Correção:

```text
Criar ação Registrar testes finais.
Campos:
data_teste
responsavel
resultado
pendencias
anexos
Evento: TESTES_REALIZADOS
```

---

### 13.5 Data Book enviado e aprovado

Problema:

```text
Data Book montado não prova que foi enviado nem aprovado pelo cliente.
```

Correção:

```text
Criar nós:
DATABOOK_ENVIADO
CLIENTE_APROVOU_DATABOOK
```

---

### 13.6 Termo enviado

Problema:

```text
Gerar link não é o mesmo que registrar envio ao cliente.
```

Correção:

```text
Criar evento:
TERMO_ENVIADO
```

---

### 13.7 Handover e pós-venda

Problema:

```text
Handover precisa estar preso ao dossier_obra e numero_cotacao, não a trilho legado.
```

Correção:

```text
Auditar se handover usa dossier_obra/numero_cotacao.
Migrar qualquer dependência final baseada apenas em projetos legados.
```

---

## 14. Matriz de eventos para Claude Code auditar

Para cada evento abaixo, Claude Code deve responder:

```text
Evento existe no catálogo? SIM/NÃO
Existe call-site real? SIM/NÃO
Qual arquivo dispara?
Qual função dispara?
Tem numero_cotacao? SIM/NÃO
Tem alvo_id? SIM/NÃO
Fecha qual nó?
Abre qual próximo nó?
Status: OK / MAL CONTATO / CURTO / ROMPIDO
```

Eventos prioritários:

```text
FORMULARIO_PREENCHIDO
COTACAO_ENVIADA_FORNECEDOR
FORNECEDOR_RESPONDEU
PROPOSTA_ELABORADA
PROPOSTA_ENVIADA
CLIENTE_RESPONDEU_PROPOSTA
CLIENTE_PEDIU_REVISAO_PROPOSTA
VERTICALPARTS_ACEITOU_REVISAO
VERTICALPARTS_RECUSOU_REVISAO
PROPOSTA_REVISADA
PROPOSTA_REENVIADA
FINANCEIRO_CONSULTOU_SCORE
FINANCEIRO_APROVOU_VENDA
FINANCEIRO_REPROVOU_VENDA
CONTRATO_VENDA_ENVIADO
CONTRATO_VENDA_ASSINADO
SINAL_PAGO
AVAL_PAGAMENTO_CONFIRMADO
FINANCEIRO_APROVOU_CEO
FINANCEIRO_APROVOU_OWNER
PROJETO_ELEVADOR_CRIADO
PROJETO_ENVIADO_CLIENTE
PROJETO_APROVADO_CLIENTE
PROJETO_ELEVADOR_FINALIZADO
FICHA_TECNICA_CRIADA
COMPRA_FORNECEDOR_INICIADA
COMPRA_FORNECEDOR_CONFIRMADA
PI_CRIADA
PAGAMENTO_FORNECEDOR_1_SOLICITADO
PAGAMENTO_FORNECEDOR_1_CONFIRMADO
CARGO_READY_CONFIRMADO
RFQ_FRETE_ENVIADO
AGENTE_CARGA_DEFINIDO
EMBARQUE_CRIADO
EMBARQUE_ATUALIZADO
EMBARQUE_CHEGOU_BRASIL
EMBARQUE_ENTREGUE_OBRA
DOSSIE_CRIADO
VISTORIA_AGENDADA
VISTORIA_REALIZADA
PENDENCIA_RESOLVIDA
INSTALADOR_VINCULADO
CONTRATO_INSTALADOR_GERADO
CONTRATO_INSTALADOR_ASSINADO
IMS_CONTRATADO
EQUIPAMENTO_RECEBIDO
EQUIPAMENTO_CONFERIDO
INSTALACAO_INICIADA
PENDENCIA_INSTALACAO_REGISTRADA
INSTALACAO_CONCLUIDA
ART_EMITIDA
TESTES_REALIZADOS
DATABOOK_MONTADO
DATABOOK_ENVIADO
CLIENTE_APROVOU_DATABOOK
TERMO_PREPARADO
TERMO_ENVIADO
TERMO_ASSINADO
HANDOVER_CONCLUIDO
POS_VENDA_ATIVADO
```

---

## 15. Tabela de portas lógicas por gate

| Gate | Fórmula | Se falso |
|---|---|---|
| Cliente respondeu | aceitou XOR pediu_revisao XOR recusou | continua aguardando cliente |
| Revisão aceitável | norma AND técnica AND comercial AND jurídico AND margem | VerticalParts recusa revisão |
| Compra liberada | contrato AND sinal AND aval_pagamento AND projeto AND CEO AND owner | bloqueia compra |
| Obra pronta | contrato AND sinal AND projeto AND vistorias AND instalador AND recursos | bloqueia instalação |
| Instalação concluída | instalação_iniciada AND sem_pendencia_bloqueante AND checklist_ok | mantém obra aberta |
| Entrega concluída | ART AND testes AND DataBook AND termo AND handover | não ativa pós-venda |

---

## 16. Critérios de aceite da correção do circuito

Claude Code só deve considerar o circuito corrigido quando:

```text
1. Todo nó da GatilhosEngine tiver evento de nascimento claro.
2. Todo nó sem fecha:null tiver call-site real para o evento de fechamento.
3. Todo nó com fecha:null estiver marcado visualmente como sem rastreio automático.
4. Todo botão humano relevante chamar EventosFluxo.registrar().
5. Nenhuma compra puder iniciar sem podeIniciarCompra().
6. Toda revisão de proposta separar recusa do cliente de recusa interna da VerticalParts.
7. Toda etapa final de entrega estiver ligada a dossier_obra e numero_cotacao.
8. Data Book montado, enviado e aprovado forem estados distintos.
9. Termo preparado, enviado e assinado forem estados distintos.
10. O semáforo nunca mostrar verde sem evento real e evidência mínima.
```

---

## 17. Plano de correção por prioridade

### Prioridade 1 — Segurança do circuito

```text
Auditar todos os caminhos de COMPRA_FORNECEDOR_INICIADA.
Garantir gate podeIniciarCompra().
Impedir compra sem contrato, sinal, aval, projeto e aprovações.
```

### Prioridade 2 — Revisão de proposta

```text
Criar subcircuito formal de revisão.
Separar:
cliente pediu revisão
VerticalParts aceitou revisão
VerticalParts recusou revisão
proposta revisada
cliente aceitou revisão
cliente recusou revisão
```

### Prioridade 3 — Eventos sem disparo

```text
Mapear eventos catalogados sem call-site.
Adicionar disparo nos botões reais.
Não inventar evento verde automático sem ação humana/sistêmica.
```

### Prioridade 4 — Logística e importação

```text
Formalizar Cargo Ready.
Estruturar agente de carga.
Fechar embarque chegada.
Separar entrega na obra.
```

### Prioridade 5 — Instalação e entrega

```text
Criar testes finais.
Separar Data Book montado/enviado/aprovado.
Separar Termo preparado/enviado/assinado.
Garantir Handover preso ao Dossiê.
```

### Prioridade 6 — Painel e semáforo

```text
Exibir por número de cotação:
status atual
quem tem a bola
próxima ação
prazo
motivo do bloqueio
link da tela correta
```

---

## 18. Prompt para Claude Code

Use este prompt diretamente no Claude Code.

```text
Você está no repositório:
https://github.com/verticalpartsIA/010_GestaoImportacao.git

Objetivo:
Auditar e corrigir o circuito lógico da plataforma VP Gestão como se fosse uma placa PCB.

Conceito:
- A PCB é o sistema inteiro.
- A trilha principal é numero_cotacao.
- O barramento de sinais é eventos_fluxo.
- O chip controlador é GatilhosEngine.
- A tabela gatilhos é o estado dos LEDs.
- A página /adm-financeiro/financeiro, bloco Cadeia de Gatilhos por Cotação, é o painel de LEDs.
- Curto-circuito é qualquer etapa que avança sem gate.
- Trilha rompida é evento catalogado sem disparo real.
- Mal contato é dado que existe em um módulo mas não chega ao próximo.
- Falso verde é etapa concluída sem evento real/evidência.

Arquivos obrigatórios para leitura:
- src/financeiro.jsx
- src/gatilhos-engine.js
- src/eventos-fluxo-store.js
- src/formulario-elevador-store.js
- src/cotacao-elevador-fornecedor-store.js
- src/precificacao-elevador-store.js
- src/proposta-store.js
- src/contrato-venda-store.js
- src/aval-financeiro-store.js
- src/pi-store.js
- src/rfq-store.js
- src/ims-store.js
- src/embarques-importacao-store.js
- src/dossier-store.js
- src/vistorias-obras.jsx
- src/instalacao-obra-store.js
- src/contrato-instalador-store.js
- src/data-book-store.js
- src/handover-manutencao.js
- src/entrega.jsx

Fase 1 — Não altere nada.
Gere um relatório técnico chamado:
reports/dossie-pcb-circuito-logico.md

O relatório deve conter:

1. Fio condutor principal
   - onde numero_cotacao nasce
   - onde é propagado
   - onde se perde
   - quais tabelas dependem dele

2. Matriz de eventos
   Para cada evento em EventosFluxo.EVENTOS:
   - existe no catálogo?
   - existe call-site real?
   - arquivo/função que dispara
   - passa numero_cotacao?
   - passa alvo_id?
   - fecha qual nó?
   - abre qual próximo nó?
   - status: OK, MAL_CONTATO, CURTO, ROMPIDO, CATALOGO_SEM_DISPARO

3. Matriz de nós da GatilhosEngine
   Para cada node em NODES:
   - key
   - label
   - predecessores
   - nasce
   - fecha
   - fechamentoTipo
   - rota
   - resolverSubsel
   - status do circuito

4. Subcircuito de revisão de proposta
   Validar se o sistema diferencia:
   - cliente recusou proposta
   - cliente pediu revisão
   - VerticalParts aceitou revisão
   - VerticalParts recusou revisão
   - proposta revisada
   - cliente aceitou revisão
   - cliente recusou revisão
   Se não existir, marcar como trilha ausente.

5. Gates booleanos obrigatórios
   Validar fórmulas:
   COMPRA_LIBERADA = contrato_assinado AND sinal_pago AND aval_pagamento_confirmado AND projeto_finalizado AND ceo_aprovou AND owner_aprovou
   OBRA_PRONTA = contrato_assinado AND sinal_pago AND projeto_aprovado AND vistorias_ok AND instalador_liberado AND contrato_instalador_assinado AND equipamento_recebido
   ENTREGA_CONCLUIDA = art_emitida AND testes_aprovados AND databook_aprovado AND termo_assinado AND handover_concluido

6. Curtos-circuitos
   Listar qualquer função/botão que permita avançar sem gate.

7. Trilhas rompidas
   Listar evento catalogado sem disparo real e node com fecha:null.

8. Mal contatos
   Listar divergência de label, SLA, rota, nome ou dado que cause interpretação errada.

9. Plano de correção
   Priorizar:
   - compra sem gate
   - revisão de proposta
   - eventos sem disparo
   - logística/importação
   - instalação/entrega
   - semáforo final por NC

Critérios:
- Não invente automação.
- Se não achar call-site, escreva: evento catalogado, disparo não encontrado.
- Se node tiver fecha:null, escreva: nó visível, sem fechamento automático.
- Se botão muda status sem EventosFluxo, escreva: ação humana sem disparo de cadeia.
- Não mexa no Supabase.
- Não crie migration nesta fase.
- Não refatore.
- Apenas gere o relatório.

Depois pare.
```

---

## 19. Fase 2 sugerida para Claude Code

Depois do relatório, executar uma correção por vez.

Nunca corrigir tudo de uma vez.

Sequência recomendada:

```text
1. Garantir gate único de compra.
2. Implementar subcircuito de revisão de proposta.
3. Corrigir labels e SLAs divergentes.
4. Adicionar call-sites faltantes para eventos já catalogados.
5. Criar eventos/campos logísticos de Cargo Ready, Agente e Chegada.
6. Fechar trilha de Data Book, Termo e Handover.
7. Ajustar painel de semáforo para mostrar quem tem a bola.
```

---

## 20. Veredito técnico

A plataforma já tem uma arquitetura de circuito:

```text
numero_cotacao → eventos_fluxo → GatilhosEngine → gatilhos → Cadeia por Cotação
```

Isso é forte.

O problema não é falta de arquitetura. O problema é continuidade elétrica incompleta.

O trecho Comercial → Proposta → Contrato → Aval → Compra está mais energizado.

O trecho Compra → Logística → Obra → Instalação → Data Book → Termo → Handover ainda possui trilhas parcialmente rompidas, sensores sem ligação e alguns nós visíveis sem fechamento automático.

A correção correta é tratar a plataforma como placa lógica:

```text
1. Todo sinal importante precisa de evento.
2. Todo evento precisa de número de cotação.
3. Todo gate precisa de fórmula booleana.
4. Todo avanço precisa respeitar o gate.
5. Todo verde precisa de evidência.
6. Toda recusa precisa indicar se veio do cliente ou da VerticalParts.
7. Todo atraso precisa mostrar quem tem a bola.
```

Com isso, a Cadeia de Gatilhos por Cotação deixa de ser apenas uma tela e vira o verdadeiro circuito de controle da VerticalParts.
