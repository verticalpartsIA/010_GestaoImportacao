# 6 Contratos & Jurídico — documento do módulo (REAL, fonte da verdade — 31/10/2026)

> **Status: REAL (documento oficial do módulo 6), aprovado pelo Gelson em 31/10/2026**, no molde de `01_geral.md` a `05_financeiro_precos.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é onde o **contrato** nasce, vai ao cliente e é **assinado**. A assinatura digital pública (`/assinar/<token>`) é área blindada do `CLAUDE.md` e vale para vários documentos. O Aval Jurídico daqui é um dos três avais que liberam a compra na China.
>
> **Fonte da verdade:** o código e o banco, conferidos em 31/10/2026 (`origin/main` `53e05d6`). **Conferido** = lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** = veio do `CLAUDE.md`, de uma spec ou do documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui conferir (e o texto diz). Sem selo vale como Não verificado.
>
> **Escopo do módulo:** as três telas do grupo "Contratos & Jurídico" do menu (`NAV_GROUPS` em `shell.jsx`): **Contrato Venda de Equipamentos**, **Aval Jurídico** e **Contratos & Minutas**. **O Contrato Instalador não é deste módulo:** o menu o põe em "Parceiros & Instaladores" (módulo 11), embora o catálogo de alçadas o liste no grupo "Jurídico". A **Proposta** e os **Contratos Social** são do módulo 4 (4.5 e 4.6). A **assinatura digital pública** serve a vários documentos e é descrita na Parte comum (PC-3).
>
> **Arquivos do módulo que moram em outro lugar (Conferido):** `JuridicoPage`, `ModalNovoContrato` e o código morto do "redator" de contratos estão em `operacoes.jsx` (o arquivo da Engenharia e da Instalação em Campo); a página pública é `assinar-app.jsx` (+ `assinar.html`); o painel de PDF é um bundle Vite versionado (`contrato-venda-reactpdf.bundle.js`).

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **6**; telas filhas = **6.1 a 6.3**, na ordem do menu; o conteúdo comum fica na **Parte comum** (PC-), sem número de tela.
- **Tudo o que é janela, aba, gaveta ou assistente de uma tela pertence a ela.** Na 6.1 estão o Painel, o assistente de cinco passos, a janela de envio e a gaveta de auditoria; na 6.3 a janela "Novo Contrato" e o editor antigo (`contrato-editor`), que só abre dali.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
6. **Contratos & Jurídico**
   6.1 Contrato Venda de Equipamentos (Painel, assistente de 5 passos, janela de envio, gaveta de auditoria)
   &nbsp;&nbsp;&nbsp;6.1.1 O que é · 6.1.2 Rota e arquivos · 6.1.3 Perfil e acesso · 6.1.4 O que a tela mostra · 6.1.5 Botões e controles · 6.1.6 Comportamento · 6.1.7 Dados (lê/grava) · 6.1.8 Regras e armadilhas · 6.1.9 Testes · 6.1.10 Pendências e decisões · 6.1.11 Histórico
   6.2 Aval Jurídico (fila e janela de aval)
   &nbsp;&nbsp;&nbsp;6.2.1 O que é · 6.2.2 Rota e arquivos · 6.2.3 Perfil e acesso · 6.2.4 O que a tela mostra · 6.2.5 Botões e controles · 6.2.6 Comportamento · 6.2.7 Dados (lê/grava) · 6.2.8 Regras e armadilhas · 6.2.9 Testes · 6.2.10 Pendências e decisões · 6.2.11 Histórico
   6.3 Contratos & Minutas (lista, janela "Novo Contrato" e editor antigo)
   &nbsp;&nbsp;&nbsp;6.3.1 O que é · 6.3.2 Rota e arquivos · 6.3.3 Perfil e acesso · 6.3.4 O que a tela mostra · 6.3.5 Botões e controles · 6.3.6 Comportamento · 6.3.7 Dados (lê/grava) · 6.3.8 Regras e armadilhas · 6.3.9 Testes · 6.3.10 Pendências e decisões · 6.3.11 Histórico
   Parte comum de Contratos & Jurídico (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 O ciclo do contrato de venda · PC-3 A assinatura digital pública 🔒 · PC-4 O texto da minuta e a numeração · PC-5 Os avais, o Jurídico e as revisões comerciais · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos e rotinas · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
7. Suprimentos & Importação → `07_suprimentos_importacao.md` (a criar)

## Glossário (módulo Contratos & Jurídico)
Termos gerais (alçada, soft-delete, alerta, Nº da cotação, evento de fluxo) estão no glossário de `01_geral.md`; **Proposta**, **Código do equipamento** e **Líder** no de `04_comercial_pre_venda.md`; **Aval de Pagamento** e **Aval Engenharia** no de `05_financeiro_precos.md`. Não se repetem aqui.
- **Contrato de venda:** o "Contrato de Compra e Venda de Equipamentos e Prestação de Serviços de Instalação" entre a VerticalParts (VENDEDORA) e o cliente (COMPRADOR). Tabela `contratos_venda_equipamentos`.
- **Minuta:** o texto-padrão do contrato (10 cláusulas) que o Jurídico revisa; mora em `contrato-venda-engine.js` e é remontada a cada abertura.
- **VPCV-0955:** número do contrato = o mesmo inteiro da cotação com prefixo próprio. Um 2º contrato da mesma cotação (aditivo) ganha sufixo numérico (`VPCV-0955-2`).
- **Rascunho em preenchimento:** contrato salvo pelo assistente **sem** número, link nem documento (status `em_preenchimento`); fica fora das listas de contratos.
- **Rascunho (gerado):** contrato já gerado, com número e link, que ainda não foi enviado (status `rascunho`).
- **Representante:** a pessoa do COMPRADOR que assina pelo link principal do contrato.
- **Signatário adicional (sócio/jurídico):** pessoa do COMPRADOR cadastrada no painel, com link próprio (`contrato_venda_signatarios`). **Destinatário "Deve assinar":** o mesmo papel, cadastrado na janela de envio (`documento_signatarios`). As duas listas contam para fechar o contrato.
- **Aguardando outras assinaturas (`aguardando_signatarios`):** o representante já assinou e falta alguém.
- **D0:** o marco mais recente entre pagamento da entrada, assinatura do contrato e projeto aprovado; **entrega prevista** = D0 + 120 dias.
- **Desenho de Instalação (Anexo II):** o projeto que a Engenharia envia **depois** do contrato, sob três condições (6.1.8).
- **Aval Jurídico:** aprovação manual do Jurídico à venda; abre junto com o Aval Financeiro quando o cliente aprova a proposta.
- **Editor antigo / fluxo antigo:** `contrato-editor.jsx` e os contratos criados por "Novo contrato" em 6.3; **sem** token, número `VPCV` nem assinatura pública.
- **Hash da assinatura:** SHA-256 gravado na assinatura; no contrato de venda cobre o `form_state` e o nome do assinante.

---

## 6.1 Contrato Venda de Equipamentos

### 6.1.1 O que é
A tela onde o contrato de venda é **criado, enviado ao cliente para assinatura digital e acompanhado até assinar**. Tem duas abas: **Painel** (indicadores, fila de propostas assinadas sem contrato, rascunhos, lista de contratos e a gaveta de auditoria de cada um) e **Novo contrato** (assistente de cinco passos com a pré-visualização do documento). O contrato nasce, na prática, da **proposta aprovada**: o assistente herda cliente, valor, parcelas, equipamento e endereço dela. **Conferido** em `contrato-venda.jsx`, `contrato-venda-store.js`, `contrato-venda-engine.js`, `contrato-venda-preview.jsx`, `contrato-venda-signatarios-store.js`, `documento-signatarios-store.js` e no banco, 31/10/2026.

**Fora do escopo desta tela:** o Contrato Instalador e o distrato (módulo 11); a Proposta e o envio dela (4.5); os Contratos Social (4.6); o Aval Jurídico (6.2); o sinal pago e o Aval de Pagamento (5.3); o Dossiê da Obra (9); o Projeto de Instalação assinado pelo cliente (8 e 9); as páginas de assinatura (PC-3). **Não existe** distrato, aditivo com cláusula alterada nem "cláusula em vermelho" para o contrato de venda: o desenho de 22/10/2026 (`docs/revisoes/03-…`) **não foi implementado** (Conferido: nenhuma ocorrência de `clausulasAlteradas` no código).

### 6.1.2 Rota e arquivos
- Rota `contrato-venda-equipamentos`; URL `/juridico/contrato-venda-equipamentos[/painel[/<id do contrato>] | /novo[/prop-<id da proposta> | /rasc-<id do rascunho>]]`. A aba (`useRouteTab`), a gaveta aberta (`useRotaItem`) e a origem do assistente vão na URL; F5 e link direto reabrem o mesmo ponto. Item "Contrato Venda de Equipamentos" (ícone de documento), primeiro do grupo. **Conferido** (`docs/MAPA_DE_ROTAS.md`, `app.jsx`, `contrato-venda.jsx`).
- Arquivos: `src/contrato-venda.jsx` (`window.ContratoVendaEquipamentosPage`, 1.746 linhas), `src/contrato-venda-store.js` (`window.CVStore`), `src/contrato-venda-engine.js` (`window.CV`: texto, máscaras, D0), `src/contrato-venda-preview.jsx` (`window.CVContractPreview`), `src/contrato-venda-signatarios-store.js` (`window.CVSignatarioStore`), `src/documento-signatarios-store.js` (`window.DocumentoSignatariosStore`, genérica), `src/contrato-venda-reactpdf.bundle.js` (fonte em `pdf-bundle/contrato-venda-reactpdf.entry.js`; `npm run build:pdf:contrato`), `src/email-envio-helper.js`, `styles/contrato-venda.css` (reaproveita os blocos `.ci-*` do Contrato Instalador). **Conferido.**

### 6.1.3 Perfil e acesso
- O item **não tem `restrict`** no menu e a rota **não está em `RESTRICTED`**: qualquer perfil que veja o menu abre a tela. A alçada `contrato-venda-equipamentos` (ver/criar/editar/excluir) existe no catálogo e tem concessões no banco (13 de "ver", 4 de "criar", 4 de "editar", 2 de "excluir"), mas **a tela não chama `temCapacidade`**. **Conferido.**
- **Banco (Conferido, 31/10/2026):** `contratos_venda_equipamentos` está **fechada ao público** (fechada em 13/10/2026): só usuário ativo logado lê, grava e atualiza; apagar exige administrador **ou** a alçada `excluir`; qualquer usuário ativo apaga **só rascunho** (`em_preenchimento` ou `rascunho`). Veja o achado do **nome da alçada na política de exclusão** em 6.1.10. A leitura pelo link público é só por funções com token (PC-3).

### 6.1.4 O que a tela mostra
**Cabeçalho:** "JURÍDICO · CONTRATO VENDA DE EQUIPAMENTOS" / **CONTRATO VENDA DE EQUIPAMENTOS** / "Compra, venda e instalação para Clientes finais · assinatura digital com auditoria". Duas abas: **▦ Painel** e **+ Novo contrato**.

**Painel (aba padrão):**
- Cinco cartões-filtro: **Total**, **Rascunho**, **Enviado**, **Visualizado**, **Assinado** (cada um com a contagem; clicar filtra, clicar de novo desfaz). Recusado e expirado não entram nas contagens.
- Quadro **"Propostas assinadas aguardando contrato (N)"** (só aparece com N > 0): tabela Proposta (com o Master ID), Cliente, Valor, Assinada (tempo relativo), Ação. Traz até 50 propostas com status `aprovada` e sem contrato (o rascunho em preenchimento **não** tira a proposta da fila).
- Quadro **"Rascunhos em preenchimento (N)"** (só com N > 0): Comprador, Objeto, Valor, Criado por, Atualizado, Ações.
- Quadro **"Todos os contratos"** (ou o nome do status filtrado) com busca "Buscar nº, comprador, representante…" e tabela Contrato (comprador e número), Objeto (e representante), Valor, Status (selo), Atividade (tempo relativo da última linha do `log`), Ações. Vazio: "Nenhum contrato… Crie um novo no gerador." As colunas de cada tabela ordenam por clique (`useOrdenacao`).

**Assistente "Novo contrato"** (cinco passos, barra de passos clicável; à direita a **pré-visualização** do contrato, que muda ao digitar):
1. **Cadastro — Dados do Comprador:** seletor "Herdar de uma Proposta (Master ID)" (some se nenhuma proposta tem Master ID; lista as 50 mais recentes); aviso amarelo "Sem Proposta vinculada…" (a resposta por e-mail não vai conectada ao contrato no Inbox); bloco fixo da VENDEDORA (razão e CNPJ da VerticalParts, Guarulhos/SP, representante); campos Razão social*, CNPJ*, Telefone, Endereço (sede)*, Representante legal*, Cargo do representante*, CPF do representante*, E-mail para assinatura e o grupo **Qualificação do representante** (Nacionalidade*, Estado civil*, Profissão*, RG*, Endereço residencial*).
2. **Objeto — Equipamento e especificações:** tipo (Elevador, Escada Rolante, Esteira Rolante), Quantidade, campos do tipo (elevador: Tipo de elevador, Capacidade de carga (kg), Quantidade de paradas, "Marcar como Carga Especial"; escada e esteira: Modelo, Largura, Velocidade, Desnível/comprimento), "Descrição conforme Proposta Comercial (cláusula 1.1)". Aviso **Equipamento especial** quando a carga é ≥ 1.000 kg ou marcada.
3. **Logística — Local da obra e distância:** "Endereço completo do local de entrega/obra" e "Distância até Guarulhos/SP (km)". Aviso **obra a mais de 100 km**.
4. **Preço — Valor, sinal e parcelamento:** "Valor total do contrato"*, "Sinal / entrada (%)", "Nº de parcelas do saldo" (1, 2, 3, 4, 5, 6, 8, 10, 12) e o **Resumo do pagamento** (sinal, cada parcela herdada da proposta ou as parcelas iguais, total).
5. **Revisão — Revisão e checklist documental:** resumo (Comprador, Objeto, Local/distância, Valor total, Pontos de atenção, Dossiê da Obra) e **Anexos (opcional)**: "Anexo I — Proposta Comercial" e "NRs e ART", só informativos; texto explicando que o Anexo II (desenho) **não** é anexado aqui.
- Rodapé do assistente: **← Voltar**, **💾 Salvar rascunho**, "Passo N de 5", **Avançar →** (no último passo, **Gerar e enviar para assinatura →**). Barra da pré-visualização: **⬇ Baixar PDF**, selos "N campo(s) obrigatório(s) pendente(s)", "Equipamento Especial", "Obra a mais de 100 km" ou "Sem pontos de atenção".

**Gaveta de auditoria** (abre ao clicar numa linha ou no 👁; vai na URL): cabeçalho com número, comprador, selo de status, selo **"Respondeu por e-mail"** (quando há e-mail de entrada com o `referencia_id` do contrato) e **⬇ Baixar PDF**; seções **Linha do tempo** (Rascunho → Enviado → Visualizado → Assinado, ou Expirado/Recusado, com data, canal, IP e, na recusa, "Por <nome>" e o motivo), **Trilha de auditoria** (comprador, representante, objeto, valor, envio, canal, destinatário, validade do link, visualização e assinatura com IP e dispositivo, tipo de assinatura, hash SHA-256 e a nota "Documento assinado eletronicamente nos termos da MP 2.200-2/2001 e da Lei 14.063/2020…"), **Cronograma · D0**, **Signatários adicionais (sócios/jurídico do Comprador)**, **Destinatários adicionais — link próprio** (só aparece se houver), **Desenho — Projeto de Instalação** e **Ações**. **Conferido.**

### 6.1.5 Botões e controles
| Controle | Onde / quando | O que faz |
|---|---|---|
| **▦ Painel** / **+ Novo contrato** | cabeçalho | Troca de aba; "+ Novo contrato" limpa proposta e rascunho de origem |
| Cartões **Total / Rascunho / Enviado / Visualizado / Assinado** | Painel | Filtra a lista por status |
| **Criar contrato** | linha da fila "aguardando contrato" | Abre o assistente já com a proposta herdada (`/novo/prop-<id>`) |
| **Continuar rascunho** | idem, quando já há rascunho dessa proposta | Reabre o rascunho |
| **Continuar editando** / **🗑** | quadro de rascunhos | Reabre; a lixeira pergunta "Excluir este rascunho… Não dá pra desfazer." e apaga de verdade |
| Busca e cabeçalhos das colunas | lista | Filtra por texto e ordena |
| **👁** (Auditoria), **🔗** (Abrir assinatura), **Enviar** / **Reenviar** | linha da lista; "Enviar" para rascunho, "Reenviar" para enviado, visualizado ou expirado | Abre a gaveta, o link público em outra aba ou a janela de envio |
| **Herdar de uma Proposta (Master ID)** | passo 1 | Preenche comprador, valor, parcelas, equipamento, endereço e códigos dos equipamentos |
| Escolha do tipo, "Marcar como Carga Especial" | passo 2 | Troca os campos e liga os avisos |
| **← Voltar** / **Avançar →** / passos da barra | rodapé e topo | Navega; **Avançar** valida o passo (passos 1 e 4) |
| **💾 Salvar rascunho** | rodapé | Grava `em_preenchimento` sem validar (exige razão social **ou** proposta) |
| **Gerar e enviar para assinatura →** | passo 5 | Gera o contrato (número, link, documento) e abre a janela de envio |
| **⬇ Baixar PDF** | pré-visualização e gaveta | PDF no layout da minuta; na gaveta leva o bloco de assinaturas digitais (PC-3) |
| **Janela "Enviar para assinatura"**: botões **WhatsApp**, **E-mail**, **Link**; campos Nome do destinatário e WhatsApp/E-mail; **Copiar**; **+ Adicionar destinatário** (Nome, e-mail, "Deve assinar", ✕); **Enviar pelo WhatsApp →** / **Enviar por e-mail →** / **Registrar e copiar link**; depois **Abrir página de assinatura →** e **Concluir** | após gerar ou ao "Enviar/Reenviar" | Envia o link; o campo "Para" é sempre o representante (um token só) |
| **Salvar marcos** | gaveta › Cronograma · D0 (só se mudou) | Grava "Pagamento da entrada" e "Projeto aprovado (Engenharia)" |
| **WhatsApp**, **E-mail**, **Copiar link**, **Remover**; **+ Adicionar signatário** (Papel, Nome, E-mail, Telefone) | gaveta › Signatários adicionais | Envia o link próprio de cada sócio/jurídico, copia ou remove (pede confirmação) |
| **Reenviar e-mail**, **Copiar link** | gaveta › Destinatários adicionais | Lembrete por e-mail ou cópia do link próprio |
| **Anexar arquivo (Engenharia)** / **Substituir arquivo**, **Enviar por e-mail** / **Reenviar por e-mail** (confirma "Enviar o Desenho… agora?") | gaveta › Desenho (só com as três condições OK) | Sobe o desenho e o envia ao e-mail do comprador |
| **Abrir link de assinatura ↗**, **Enviar** / **Reenviar link**, **Excluir** (pede confirmação) | gaveta › Ações | Abre a página pública, reabre a janela de envio, apaga o rascunho |

### 6.1.6 Comportamento
**Conferido** (código).
1. **A fila "aguardando contrato" é a porta de entrada:** o contrato **não nasce sozinho** quando o cliente assina a proposta; um humano clica "Criar contrato" (PC-2).
2. **Salvar rascunho x Gerar:** o rascunho grava sem validar, com id provisório `RASC-…`, e **não** gera número, link, documento, vínculo com aval nem log de "criou o contrato". "Gerar e enviar" **promove a mesma linha** (troca o id) em vez de criar outra; se o rascunho foi apagado ou promovido por outra pessoa, insere uma nova.
3. **Dossiê da Obra:** ao chegar ao passo 5 o sistema **cria ou reaproveita** o Dossiê da cotação (por `numero_cotacao`); sem ele, "Gerar" recusa. A linha "Dossiê da Obra" do resumo mostra "Vinculando…" enquanto isso.
4. **Gerar** monta o número (`VPCV-<cotação>`; 2º contrato da mesma cotação vira `-2`, `-3`; sem proposta cai no `VPVE…` mensal), o documento (`doc`), o link de 16 caracteres e grava como `rascunho`; vincula o contrato ao Aval Financeiro e ao Aval Jurídico da proposta; registra em `vp_logs` "criou o contrato".
5. **Enviar:** WhatsApp abre o WhatsApp Web; **e-mail** tenta o envio direto (`send-email`, com `referenciaTipo 'contrato_venda'` e `referenciaId`) e **só marca "enviado" depois de a função confirmar**; se falhar, abre o `mailto:`, avisa que **nada foi enviado** e não marca. Cada envio grava `enviado`, canal, destinatário, validade de **7 dias** e o evento `CONTRATO_VENDA_ENVIADO`. Os "outros destinatários" são processados **depois** do representante, e a falha de um não desfaz o envio principal.
6. **Quem recebe link próprio:** só o marcado "Deve assinar" (linha em `documento_signatarios` com token individual); os demais recebem um e-mail de **cópia informativa**, sem link. Isto existe porque, quando todos dividiam o mesmo link, quem abrisse primeiro consumia a visualização, a assinatura ou a recusa dos outros (caso real de outubro; PC-3).
7. **Fechamento do contrato:** o contrato só fica **Assinado** quando o representante **e** todos os signatários adicionais (das duas listas) assinaram; até lá fica `aguardando_signatarios`. Sem signatário adicional, o comportamento é de uma assinatura só. A regra mora no servidor (PC-3).
8. **Expiração:** ao abrir o Painel, `sweepExpired` marca como `expirado` os contratos `enviado` ou `visualizado` com validade vencida (e avisa). O Painel **recarrega a cada 5 segundos**.
9. **Cronograma D0:** a assinatura entra sozinha; o Financeiro/Engenharia digitam a entrada e o projeto. O D0 é a **maior** das três datas; a entrega prevista é D0 + 120 dias (o contrato diz 120 a 150; o código usa o mínimo).
10. **Desenho de Instalação:** liberado só com **sinal pago** (Aval Financeiro), **contrato assinado** e **Aval Jurídico aprovado** (a gaveta consulta os dois avais). A cláusula 1.1.2 do contrato avisa o cliente de que o desenho vem depois, em até 5 dias úteis.
11. **PDF:** layout da minuta oficial (cabeçalho e rodapé em imagem, faixa preta nos títulos, assinaturas empilhadas); se já há assinaturas, o PDF traz o **bloco de assinaturas digitais** (PC-3).

### 6.1.7 Dados — o que lê e o que grava
**Lê:** `contratos_venda_equipamentos` (com `doc`, `form_state` e `audit` inteiros, a cada 5 s), `propostas` (aprovadas, e até 50 com Master ID), `avais_financeiros` e `avais_juridicos` (gate do desenho), `dossier_obra`, `contrato_venda_signatarios`, `documento_signatarios`, `emails_projeto` (selo de resposta), `MasterIdEngine`. **Grava:** `contratos_venda_equipamentos`, `dossier_obra` (cria o dossiê), `contrato_venda_signatarios` e `documento_signatarios`, `alertas` (módulo "Jurídico"), `vp_logs` (módulo "Contrato Venda"), eventos de fluxo, o bucket `engenharia` (`desenho-instalacao/<contrato>/…`) e, pelo `send-email`, `emails_projeto`.

**Banco hoje (Conferido, 31/10/2026):** `contratos_venda_equipamentos` tem **1 linha** (`VPCV-0955`, `assinado`, com proposta, link e documento, **sem** desenho de instalação); `contrato_venda_signatarios` **0**; `documento_signatarios` **24** (18 de `contrato_instalador`, 4 de `contrato_venda`, todos assinados, e 2 de `projeto_instalacao`). **Herda de:** 4.5 (proposta aprovada: cliente, valor, parcelas, itens, equipamentos), 5.3 (sinal pago), 6.2 (aval), 9 (dossiê). **Doa para:** a cadeia de etapas (`CONTRATO_ENVIADO`, `AGUARDA_ASSINATURA`, `AGUARDA_BOLETO`, 1), o Aval Financeiro (sinal depois da assinatura, 5.3), o Dossiê/Checklist/Status da Obra (9), o Dashboard e as Notificações (1), o D0 de prazos, a Linha do Tempo da cotação.

### 6.1.8 Regras e armadilhas
- **O número do contrato é o da cotação** (`VPCV-0955`), e o documento exibido mostra esse mesmo número (`Nº do Contrato: VPCV-0955`; Anexo I = `VPPR-0955`). Trocar o prefixo mexeria em `numero_documento`, e-mail e `parseNumeroCotacao` (PC-4).
- **Valores herdados da proposta nunca são sobrescritos por marcador do texto** da minuta: os `XXX` do modelo são só reserva (PC-4).
- **Parcelas:** o contrato lê o cronograma real da proposta (ex.: 20/15/15/10) **enquanto bater** (mesma quantidade e soma exata, ±2 centavos); se a pessoa mexer em sinal, valor ou nº de parcelas, volta às parcelas iguais. A proposta usa sinal fixo de 40%; "à vista" vira sinal 100%/0 parcelas.
- **O aval de score do Financeiro não bloqueia o contrato** (`podeEnviarContrato` devolve sempre `ok`); o Aval Financeiro real vem depois do sinal.
- **Resposta do cliente por e-mail só se liga ao contrato com `referencia_id`** (ou Message-ID); contrato sem proposta não tem Nº de cotação, e a resposta com assunto trocado fica solta no Inbox (aceito; veja a área blindada do Inbox, 1.5).
- **O selo "Respondeu por e-mail" olha só `referencia_id`**, nunca o Nº da cotação: o mesmo número é compartilhado por RFQ, proposta e contratos do mesmo negócio e um palpite acenderia o selo errado.
- **Rascunho em preenchimento não é contrato:** toda consulta nova a `contratos_venda_equipamentos` deve tratar o status `em_preenchimento` (já tratam: Aval Jurídico, Painel, Notificações, Dashboard, checklist e instalação).
- **Ao criar status novo nessa tabela, atualize o CHECK do banco** (já faltaram `aguardando_signatarios` e `em_preenchimento` uma vez).
- **Equipamento especial (≥ 1.000 kg) e obra a mais de 100 km:** a minuta padrão não cobre; a tela só avisa e manda tratar como anexo ou aditivo (PC-4).
- **Anexos do passo 5 não bloqueiam** o envio (decisão de 01/10/2026).
- **Link vale 7 dias**; depois o contrato expira e é preciso "Reenviar".

### 6.1.9 Testes
**Conferido** (31/10/2026): `contrato-venda-engine.test.js` (7: escape de HTML no nome, endereço, cargo, e-mail e descrição; texto normal intacto; `descEq` sem escape; parcelas herdadas da proposta; endereço completo e CPF), `contrato-venda-store.test.js` (1: `VPCV-0955-2`), `assinar-publico-f1.test.js` (7: desenho do projeto e assinaturas do PDF por RPC com queda para o caminho antigo) e `project-gates.test.js` (8, gate antigo). **Rodei `npm test`: 931 passaram, 0 falharam.** **E2E:** só a fumaça de rotas (a rota entra sozinha); `/assinar/<token>` está na lista de páginas públicas. **Não rodei o e2e** (roda no CI). **Não há teste de componente** do assistente, do painel, da janela de envio nem da gaveta; **não há teste** de `createDraft`, `salvarRascunho`, `markSigned` com signatários, `enviarDesenhoInstalacao` nem do PDF.

**Cenários de aceitação**
1. *Dado* um nome com `<script>` no comprador, *quando* se monta o contrato, *então* o texto sai escapado (`contrato-venda-engine`).
2. *Dado* uma proposta com sinal de 40% e parcelas 20/15/15/10, *quando* se monta o contrato, *então* o cronograma herdado aparece; se a soma não fecha, caem as parcelas iguais (`contrato-venda-engine`).
3. *Dado* o contrato `VPCV-0955` já existente, *quando* se gera outro da mesma cotação, *então* o número é `VPCV-0955-2` (`contrato-venda-store`).
4. *Dado* um token e uma RPC que falha, *quando* o PDF pede as assinaturas, *então* cai na leitura antiga por ID (`assinar-publico-f1`).
5. *Sem teste (cenário de aceitação a automatizar):* *dado* um contrato com um sócio pendente, *quando* o representante assina, *então* o status é `aguardando_signatarios`.

### 6.1.10 Pendências e decisões
**Achados, sem correção** (descritos como o código se comporta).
1. **A tela não confere alçada nem papel** (6.1.3): qualquer pessoa que abre a tela gera, envia, apaga rascunho e anexa o desenho. **Decisão do Gelson** (a regra de acesso a este módulo).
2. **A política de exclusão do banco olha outro nome de alçada.** `vp_int_del` pergunta por `vp_tem_capacidade('contratos_venda_equipamentos','excluir')` (plural, sublinhado), mas o catálogo e as concessões usam `contrato-venda-equipamentos` (hífen); **não há concessão** com o nome do banco. Efeito: só o administrador exclui contrato que não seja rascunho; as 2 concessões de "excluir" não valem. **Conferido** (política e `alcadas_capacidade`).
3. **`updateFormState` (botão "Salvar marcos") regrava o contrato mesmo depois de assinado:** reconstrói `doc` e `form_state`, **sem filtro de status** e sem conferir o erro do banco. O hash da assinatura cobre o `form_state` antigo (e só ele e o nome), e a linha final do documento ("Guarulhos, <data>") usa a data do momento da montagem. **Conferido** no código; é o achado E2E-020 da auditoria forense (Herdado).
4. **A data do documento muda a cada abertura:** "Guarulhos, <hoje>" vem de `new Date()` na montagem; reabrir um contrato antigo mostra a data de hoje. **Conferido.**
5. **`public_cv_assinar` aceita contrato em `rascunho`** (o link existe desde "Gerar", antes de enviar) e o signatário adicional recebe o `audit` do representante. **Conferido** na função (E2E-050, Herdado).
6. **`enviarDesenhoInstalacao` e `uploadDesenhoInstalacao` não repetem o gate** (sinal, assinatura, Aval Jurídico): a trava está só na gaveta. O `update` do histórico de envios não confere erro. **Conferido.**
7. **O Painel relê tudo a cada 5 s:** `select *` inclui `doc`, `form_state` e `audit` de cada contrato e não tem limite (o PostgREST corta em 1.000 em silêncio). Hoje há 1 linha. **Achado.**
8. **A fila "aguardando contrato" não filtra a vigência da proposta** (traz toda proposta `aprovada`, até 50), ao contrário do Aval Jurídico (só `vigente` ou `pendente_aditivo`). Com revisões, uma revisão antiga pode aparecer. **Conferido**; **Não verificado** com dado real (só há 3 propostas aprovadas).
9. **`garantirDossier` ainda cria o dossiê com `client_name` e `building_name` e sem `proposta_id`, `cliente_id` nem `lead_id`** quando não existe dossiê da cotação (o caminho normal reaproveita o que a assinatura da proposta criou). **Conferido** (E2E-032, Herdado).
10. **O "Novo contrato" da tela 6.3 cria registros que esta tela não lista** (sem `token`); ver 6.3.6.
11. **Com aditivo (`-2`), o checklist e o status da obra** usam `maybeSingle` por `proposta_id` e dariam erro com dois contratos assinados (E2E-033, Herdado; hoje há 1 contrato).
12. **Texto da minuta:** erros de digitação reproduzidos de propósito (PC-4) e a cláusula 3.5.2 ainda cita "DIFAL de ICMS" enquanto a proposta já não mostra DIFAL. **Decisão do Jurídico.**
13. **A tabela está no Realtime e nenhuma tela escuta** (Conferido; grep em `src/`). O Painel usa o laço de 5 s.
14. **Sem Copiloto atualizado:** o texto embutido da rota diz que "criar o rascunho exige que o Financeiro já tenha dado aval" e que o contrato assinado é condição do gate de compra; **as duas frases estão defasadas** (6.1.8; PC-10).

### 6.1.11 Histórico
(Herdado do `CLAUDE.md`, não reconferido data a data.) O número passou a herdar o da cotação em 27/08/2026; o desenho de instalação enviado à parte e o PDF no layout da minuta, em 29/09; o "Salvar rascunho", em 30/09; o texto foi alinhado às minutas de 30/09 e 01/10; a lista de destinatários com link próprio, em 01/10 (depois do caso AKAI); a assinatura passou a ser feita por funções do servidor e o bloco de assinaturas digitais entrou no PDF em 05/10; a tabela foi fechada ao público em 13/10/2026.

---

## 6.2 Aval Jurídico

### 6.2.1 O que é
A **fila do Jurídico**: toda proposta **aprovada pelo cliente** (vigente ou pendente de aditivo) com o seu registro de aval, mais os contratos assinados **sem proposta** (caminho antigo). O Jurídico **dá o aval** ou **reprova**, com observação. O aval, somado ao **Aval de Pagamento** do Financeiro e ao **Projeto de Instalação assinado**, libera a **compra na China** (PC-5); também é uma das três condições do envio do desenho de instalação (6.1.6). **Conferido** em `aval-juridico.jsx`, `aval-juridico-store.js` e no banco, 31/10/2026.

**Fora do escopo desta tela:** o Aval de Pagamento e o sinal (5.3); a assinatura do projeto (8 e 9); o botão "Decidir comprar" (4.3); o texto e a revisão do contrato (6.1); a análise jurídica em si, que acontece fora do sistema.

### 6.2.2 Rota e arquivos
- Rota `aval-juridico`; URL `/juridico/aval-juridico[/<chave da linha>/<aprovar|reprovar>]` (a janela aberta e a linha vão na URL; `useRotaId` + `useRotaItem`). Item "Aval Jurídico" (ícone de balança). **Conferido.**
- Arquivos: `src/aval-juridico.jsx` (`window.AvalJuridicoPage`), `src/aval-juridico-store.js` (`window.AvalJuridicoStore`), `src/aval-engenharia.jsx` (`AvaisDaCotacao`, o painel dos três avais). **Conferido.**

### 6.2.3 Perfil e acesso
- A rota está em `RESTRICTED` de `app.jsx` como `["juridico","admin"]`, mas o **seletor de perfil não tem a opção "juridico"**: `ROLE_MAP` (`shell.jsx`) só tem comercial, engenharia, financeiro e admin. Na prática **só quem está na visão Administrador abre a tela** (e o menu mostra o item a todos, porque ele não tem `restrict`). O perfil é uma escolha do navegador (`vpprd.role`, padrão `admin`), não identidade (`01_geral.md` PC-6). **Conferido** (`app.jsx`, `shell.jsx`; é o achado 3 de `docs/superpowers/specs/2026-10-31-revisao-B-…`, Herdado).
- **A tela não chama `temCapacidade`** e `darAval` não confere alçada nem papel; a alçada `aval-juridico` tem concessões no banco (ver 5, criar 3, editar 4, excluir 2) e **não é conferida**. **Conferido.**
- **Banco (Conferido):** `avais_juridicos` tem RLS ligada e **quatro políticas abertas ao público** (`aj_leitura`, `aj_insert`, `aj_update`, `aj_delete`, todas `true`); **não** está no Realtime. Faz parte do plano da #571 (PC-6).

### 6.2.4 O que a tela mostra
Cabeçalho "Jurídico · Aval de Contratos" / **Aval Jurídico** / subtítulo "Toda proposta aprovada pelo cliente entra aqui, junto com o Aval Financeiro. O Aval Jurídico + o Aval de Pagamento do Financeiro liberam a compra na China — e, com sinal pago e contrato assinado, o envio do Desenho de Instalação."; três KPIs (**Aguardando aval**, **Aprovados**, **Reprovados**); cartão **Fila do Jurídico** ("N vendas aprovadas pelo cliente"): cada linha mostra "Cotação Nº X · <número do documento>", o cliente, o valor, o contrato ("Contrato VPCV-… · assinado" ou "Contrato de Venda ainda não gerado"), o painel dos três avais da cotação, o selo (Aguardando aval, Aprovado, Reprovado) e, se pendente, os botões. Fila vazia: "Nenhuma proposta aprovada aguardando o Jurídico ainda." **Conferido.**

### 6.2.5 Botões e controles
| Controle | Quando aparece | O que faz |
|---|---|---|
| **Dar aval** | status "Aguardando aval" | Abre **Dar aval jurídico** (Observações, opcional; "Ressalvas, condições especiais…") → **Confirmar aval** |
| **Reprovar** | idem | Abre **Reprovar (Jurídico)** (Observações com o motivo) → **Confirmar reprovação** |
| **Cancelar** | nas duas janelas | Fecha a janela (limpa a URL) |

### 6.2.6 Comportamento
**Conferido.**
1. **Abrir a fila cria o registro de aval** de toda proposta aprovada que ainda não tem (`garantirRegistroProposta`); na prática o gatilho do banco já o criou na aprovação (PC-5). Para contratos assinados sem proposta, `garantirRegistro` cria o registro pelo contrato.
2. **Se a proposta já tem contrato e o aval ainda não aponta para ele,** a fila vincula (`vincularContrato`). O aval também é achado pelo contrato **ou** pela proposta de origem dele.
3. **Valem os avais da revisão vigente:** a fila só traz propostas `aprovada` com vigência `vigente` ou `pendente_aditivo`; `getByNumeroCotacao` prefere o aval da proposta vigente (PC-5).
4. **Dar aval / reprovar** grava `status`, o objeto `aval` (decisão, observações, quem, quando), registra em `vp_logs` (módulo "Aval Jurídico") e emite o evento `AVAL_JURIDICO_APROVADO` ou `AVAL_JURIDICO_REPROVADO`. O aprovado fecha a etapa `AVAL_JURIDICO` da cotação; o toast diz que, com o Aval de Pagamento, a compra fica liberada.
5. **Quando os dois avais (Financeiro e Jurídico) ficam OK,** o banco grava a notificação "Avais Financeiro e Jurídico OK" (diz o que ainda falta: projeto, CEO) (PC-5, PC-7).

### 6.2.7 Dados — o que lê e o que grava
**Lê:** `propostas` (aprovadas), `contratos_venda_equipamentos` (sem os rascunhos em preenchimento), o painel dos três avais (`AvalEngenhariaStore`, `AvalFinanceiroStore`). **Grava:** `avais_juridicos` (**4 linhas hoje: 2 aprovadas e 2 pendentes; 3 com `proposta_id`, 2 com `contrato_venda_id`, nenhuma herdada nem reaberta**), `vp_logs` e eventos de fluxo. **Herda de:** 4.5 (proposta aprovada), 6.1 (contrato). **Doa para:** o botão "Decidir comprar" (4.3) e o gate da P.I. (7) por `podeIniciarCompra`; o envio do desenho (6.1); a cadeia de etapas e as notificações (1). **Colunas (Conferido):** `id`, `contrato_venda_id`, `numero_cotacao`, `cliente_nome`, `numero_documento`, `status`, `aval` (jsonb), `criado_em`, `atualizado_em`, `proposta_id`, `herdado_de_proposta_id`, `motivo_reabertura`.

### 6.2.8 Regras e armadilhas
- **O aval é por proposta, não por contrato:** nasce quando o cliente aprova a proposta, **antes** do contrato existir (decisão de 29/09/2026; antes só nascia do contrato assinado). O contrato é ligado depois.
- **Reprovar não trava nada além do selo:** a etapa `AVAL_JURIDICO` continua aberta e o gate da compra continua dizendo "falta o aval". Não há botão para voltar de "reprovado" a "pendente".
- **`darAval` não confere o status atual** e só a tela esconde os botões depois da decisão; chamar o store de novo reescreve o aval.
- **Contrato avulso (sem proposta) só entra na fila se estiver `assinado`** em minúsculo; o 'Assinado' do editor antigo não conta (6.3).
- **A fila grava ao ler** (`Promise.all` de `garantirRegistroProposta`): o índice único por proposta evita duplicata, mas uma corrida entre o gatilho e a tela poderia lançar erro e esvaziar a lista. **Não testado.** Risco baixo.

### 6.2.9 Testes
**Conferido:** não há arquivo de teste do `AvalJuridicoStore`. O gate que **lê** o Aval Jurídico é coberto por `aval-financeiro-store.test.js` (11 testes: a compra só liberada com os três avais, o CEO só com margem baixa, o aval da proposta vigente, a fila só com vigentes); `e2e/prazos.spec.js` usa `avais_juridicos` simulado e `e2e/dashboard.spec.js` usa a alçada `aval-juridico.ver`. **Rodei `npm test`: 931 passaram.** Sem teste de componente.

**Cenários de aceitação**
1. *Dado* o Aval de Pagamento dado e o Aval Jurídico **pendente**, *quando* se consulta o gate da compra, *então* ele bloqueia e cita o Jurídico (`aval-financeiro-store`).
2. *Dado* o Aval Jurídico aprovado, o de Pagamento e o projeto assinados e margem de 25,9%, *então* a compra está liberada e o CEO não aparece (`aval-financeiro-store`).
3. *Dado* uma cotação com revisão A vigente, *quando* se lista a fila, *então* só aparece a vigente (`aval-financeiro-store`, usa o mesmo conceito).
4. *Sem teste:* *dado* um aval pendente, *quando* se clica em "Dar aval", *então* o status vira `aprovado`, o evento sai e a etapa fecha.

### 6.2.10 Pendências e decisões
1. **Ninguém com perfil Jurídico consegue abrir a tela** (6.2.3): a restrição usa um perfil que o seletor não oferece. **Decisão do Gelson** (criar a visão, trocar para alçada ou abrir a mais perfis). **Achado, sem correção.**
2. **Nem a tela nem `darAval` conferem alçada** (6.2.3). **Decisão do Gelson.**
3. **Reprovação sem consequência** (6.2.8): confirmar com o Jurídico se "reprovar" deveria travar a compra e o contrato. **Achado.**
4. **O aval pode ser reescrito** pelo store (6.2.8) e `avais_juridicos` aceita `UPDATE` e `DELETE` do público (política aberta). **Achado**, parte da #571.
5. **`herdado_de_proposta_id` e `motivo_reabertura` existem e nada os grava** (0 linhas, nenhuma referência no código); a herança do aval entre revisões (desenho em `docs/revisoes/02-…`) está só no papel. **Achado.**
6. **Sem Copiloto e sem ajuda "?"** para esta rota (PC-10); o tutorial existe, de 09/10/2026.
7. **O texto do subtítulo** diz que "com sinal pago e contrato assinado" libera o desenho; está certo, mas omite o terceiro requisito do gate da compra (o projeto assinado). **Achado de texto.**

### 6.2.11 Histórico
O aval nasceu do contrato assinado; em 29/09/2026 passou a abrir junto com o Aval Financeiro, na aprovação da proposta, e a fazer parte do gate da compra; o painel dos três avais (com o Aval Engenharia) entrou em 08/10/2026; o aval da revisão vigente, em 22/10/2026.

---

## 6.3 Contratos & Minutas

### 6.3.1 O que é
A **tela-índice do Jurídico**: lista todos os contratos da tabela `contratos_venda_equipamentos` (inclusive os do fluxo novo), com quatro indicadores, um botão "Novo contrato" e um atalho para o **editor antigo**. É a tela **mais antiga e mais confusa** do módulo: duas gerações de contrato convivem nela. O contrato do **fluxo novo** (com link de assinatura) abre na tela 6.1; o do **fluxo antigo** (criado aqui) abre no **editor antigo**, que não envia nada de verdade. **Conferido** em `operacoes.jsx` (`JuridicoPage`, `ModalNovoContrato`) e `contrato-editor.jsx`, 31/10/2026.

**Fora do escopo desta tela:** gerar, enviar e acompanhar o contrato de venda de verdade (6.1); o aval (6.2); o Contrato Instalador (11); a "Importar minuta" e o "Contrato do Montador", que **não existem** (botão desabilitado e cartão "EM BREVE").

### 6.3.2 Rota e arquivos
- Rota `juridico`; URL `/juridico/juridico`. O **editor antigo** abre pela rota `contrato-editor`, URL `/juridico/contrato-editor/<id>` (o id vai na URL e o registro é buscado no banco; se não achar, volta para `juridico`). Item "Contratos & Minutas" (ícone de balança), último do grupo. **Conferido** (`docs/MAPA_DE_ROTAS.md`, `app.jsx`).
- Arquivos: `src/operacoes.jsx` (`JuridicoPage`, `ModalNovoContrato`, e **código morto** do "redator": `ContractRedactor`, `ContractGenericPage`, `ContractPage9/10/14`, `DetectedRow`), `src/contrato-editor.jsx` (`ContratoEditorPage`, `gerarContratoPDF`). A mesma `JuridicoPage` aparece na versão de impressão (`print-app.jsx`). **Conferido.**

### 6.3.3 Perfil e acesso
Sem `restrict` no menu e fora de `RESTRICTED`: qualquer perfil abre a lista e o editor. **Nenhuma das duas telas chama `temCapacidade`.** A alçada `juridico` (ver 4, criar 3, editar 4, excluir 3) existe no banco e **não é conferida**. O Copiloto e a ajuda "?" descrevem a rota (PC-10). **Conferido.**

### 6.3.4 O que a tela mostra
**Lista (`JuridicoPage`):** "Contrato · Jurídico" / **Contratos & Minutas** / "Minuta contratual, preenchimento, redação de páginas confidenciais e envio para assinatura digital."; quatro KPIs (**Contratos no ar** = total; **Em assinatura** = `enviado`, `visualizado`, `aguardando_signatarios` ou "Em assinatura digital"; **Assinados** = `assinado` ou "Assinado"; **Em redação** = `rascunho` ou "Em redação"); cartão **Contratos em andamento** (com um botão de filtro **sem função**) com um cartão por contrato (cliente ou id, id e data, selo de status, valor e **Editar**); cartão **Acesso Rápido** com o banner preto **"Abrir Editor de Contrato"** ("2 tipos · Cliente · Montador · Preview ao vivo"), o cartão **Contrato do Cliente** (conta os contratos do tipo cliente) e o cartão **Contrato do Montador** apagado com a etiqueta **EM BREVE**. A lista lê toda a tabela (menos os rascunhos em preenchimento), ordenada por data de emissão.

**Janela "Novo Contrato":** Tipo de contrato (`cliente` ou `montador`), Cliente / Empresa *, Proposta de referência, Advogado responsável, Valor (R$), Data de emissão, Status inicial (Em redação, Aguardando assinatura, Em assinatura digital, Assinado); botões **Cancelar** e **Criar e Abrir Editor**.

**Editor antigo (`contrato-editor`):** barra de topo (**Voltar para Contratos**, "Última edição: Ns atrás", "● Salvamento ativo"), título com o id e o cliente, botões **Salvar**, **Gerar PDF**, **Enviar p/ assinatura**; duas abas de tipo (**Contrato do Cliente** ativa e **Contrato do Montador** "EM BREVE" desabilitada); menu lateral com a barra de **Preenchimento** (%) e cinco seções — **Dados do Contrato** (Nº do Contrato*, Data de emissão, Proposta de referência com busca em `cotacoes`, Advogado responsável), **Comprador** (Razão Social*, CNPJ*, Logradouro*, Número, Bairro, Cidade, UF, CEP, Nome do Responsável*, Nacionalidade, Estado Civil, Profissão, RG, CPF*), **Objeto do Contrato** (Quantidade*, Proposta Comercial ref., Descrição do Equipamento*, endereço de entrega), **Preço e Pagamento** (Valor Total (R$)*, Valor por extenso*, tabela de parcelas com descrição, % e valor, **Adicionar parcela**) e **Assinatura das Partes** (Cidade, Data, Testemunha 1 e 2 com nome e CPF); rodapé com **Voltar**, **Gerar PDF**, **Salvar rascunho** e **Enviar p/ Cliente**; à direita o painel **Preview do Contrato** (resumo em miniatura) e, se o status é "Em assinatura digital", o aviso "Aguardando assinatura do cliente" e o botão **Marcar como assinado**. **Conferido.**

### 6.3.5 Botões e controles
| Controle | Onde / quando | O que faz |
|---|---|---|
| **Importar minuta** | topo, **desabilitado** | Tooltip "Em desenvolvimento — upload de minuta ainda não persiste o arquivo" |
| **Novo contrato** (topo e no Acesso Rápido) e o banner **Abrir Editor de Contrato** | topo e Acesso Rápido | Abrem a janela "Novo Contrato" |
| Cartão do contrato / **Editar** | lista | Contrato com `token` → vai para a tela 6.1 (aba Painel); sem `token` → abre o editor antigo |
| Botão de funil (**filtro**) | cabeçalho do cartão | **Sem função** (sem `onClick`) |
| Cartão **Contrato do Cliente** | Acesso Rápido | Abre a janela "Novo Contrato" |
| Cartão **Contrato do Montador** | Acesso Rápido | Desabilitado ("EM BREVE") |
| **Criar e Abrir Editor** | janela | Grava o contrato (id `CTR-<4 dígitos>/<ano>`) e abre o editor antigo |
| **Salvar** / **Salvar rascunho** | editor | Grava os dados (recusa se o contrato tem `token`) |
| **Gerar PDF** | editor | Abre uma janela de impressão com o HTML do contrato ("Salvar como PDF") |
| **Enviar p/ assinatura** / **Enviar p/ Cliente** | editor | **Só grava o status** "Em assinatura digital" (exige comprador, CNPJ, modelo e valor) e mostra "Enviado para assinatura!"; **não envia nada** |
| **Marcar como assinado** | painel do editor, status "Em assinatura digital" | Grava o status "Assinado" e mostra "Marcado como assinado — Compra desbloqueada!" |
| **Voltar** / **Voltar para Contratos** | editor | Volta para a lista |
| Seções da barra lateral, **Adicionar parcela**, lixeira de parcela | editor | Navega e edita as parcelas (% × valor total recalcula o valor) |

### 6.3.6 Comportamento
**Conferido.**
1. **Duas gerações:** o contrato com `token` (fluxo novo) vai sempre para 6.1; o editor antigo **recusa** gravar nele ("Este contrato é do fluxo novo e não pode ser alterado por este editor antigo"), porque rebaixaria ou marcaria "Assinado" sem as travas, sem evento e sem D0 (auditoria de 11/10).
2. **Contrato criado aqui não tem `token`,** número `VPCV` nem página pública: **não aparece** no Painel de 6.1 (que exige `token`) nem na fila do Aval Jurídico (que só traz avulsos `assinado` em minúsculo).
3. **O editor herda da "proposta de referência"** a razão social, o responsável, o modelo e o valor — mas lê a tabela antiga `cotacoes` (não a `propostas`).
4. **"Enviar" e "Marcar como assinado" só mudam o texto do status** (`Em assinatura digital`, `Assinado`); nenhum e-mail, link, evento de fluxo, D0 nem gate da compra é acionado por eles. O gate real da compra é `podeIniciarCompra` (três avais) e não lê esse status; a trava antiga do projeto (`project-gates.js`) compara com `assinado` em minúsculo.
5. **KPIs:** contam os dois vocabulários de status (corrigido em 12/10/2026).

### 6.3.7 Dados — o que lê e o que grava
**Lê:** `contratos_venda_equipamentos` (`select *`, sem limite), `cotacoes` e `leads` (herança do editor antigo). **Grava:** a mesma tabela (insert na janela "Novo Contrato" com `client`, `project_id`, `lawyer`, `value`, `status`, `issued_date`, `pages` 16, `days_pending` 0, `tipo_contrato`, `dados`; update no editor). **Herda de:** o formulário da própria janela (a "proposta de referência" é só texto). **Doa para:** ninguém (nenhum gate lê o status do editor antigo). A tabela tem **1 linha hoje, do fluxo novo**; **nenhum contrato do fluxo antigo existe** (Conferido).

### 6.3.8 Regras e armadilhas
- **Não use o editor antigo para contrato real:** a tela 6.1 é o caminho. O toast "Compra desbloqueada!" **não corresponde** a nenhum gate.
- **`value` é a coluna legada;** a tela nova usa `valor_total_num`. O editor antigo grava `value`.
- **O id `CTR-<últimos 4 dígitos de Date.now()>/<ano>` repete** a cada ~10 s e pode colidir.
- **Duas colunas de status no mesmo banco:** `Em redação`, `Aguardando assinatura`, `Em assinatura digital`, `Assinado` (antigo) e `rascunho`, `enviado`, `assinado`… (novo). A lista, o Dashboard e o Copiloto já conhecem a diferença.

### 6.3.9 Testes
**Conferido:** **nenhum teste** de `JuridicoPage`, `ModalNovoContrato` nem do editor antigo. A rota `juridico` e `contrato-editor` entram na fumaça de rotas do e2e. **Não rodei o e2e.**

**Cenários de aceitação (sem teste)**
1. *Dado* um contrato com `token`, *quando* se clica nele na lista, *então* abre a tela 6.1 e o editor antigo não é usado.
2. *Dado* um contrato com `token`, *quando* se tenta salvar no editor antigo, *então* a gravação é recusada com a mensagem.
3. *Dado* a janela "Novo Contrato" com o Cliente em branco, *quando* se clica em "Criar e Abrir Editor", *então* aparece "Cliente é obrigatório."

### 6.3.10 Pendências e decisões
1. **Decidir o futuro da tela:** aposentar o editor antigo e o "Novo contrato" daqui, mantendo só a lista que leva a 6.1? Hoje existe um caminho "paralelo" que parece funcionar e não faz nada. **Decisão do Gelson.**
2. **Código morto em `operacoes.jsx`:** `ContractRedactor` (seletor de 24 páginas, "Versão Pública", "Páginas Confidenciais Detectadas", "Auditoria") e as páginas 9/10/14 trazem **valores e fornecedor fictícios** e **não são renderizados** por nenhuma rota. **Achado.** Não apagar sem decisão (Art. 50).
3. **Botões sem função:** o funil do cartão e o "Importar minuta" (desabilitado de propósito). **Achado.**
4. **Enviar e Marcar como assinado enganam** (6.3.6 item 4). **Achado, sem correção.**
5. **Id `CTR-…` pode colidir** (6.3.8). **Achado.**
6. **A tela lê a tabela inteira sem limite** (`select *`, inclui `doc` e `form_state`). Hoje 1 linha. **Achado.**
7. **Nenhuma conferência de alçada** nas duas telas (6.3.3). **Decisão do Gelson.**
8. **O tutorial de Contratos & Minutas descreve o botão Editar e o editor antigo** como caminho normal (README de 10/10/2026, Conferido o título e o índice); precisa refletir a decisão do item 1 (PC-10).

### 6.3.11 Histórico
A lista e o editor vieram do protótipo do Jurídico (redator de páginas confidenciais); o editor antigo foi bloqueado para contrato do fluxo novo em 11/10/2026; os KPIs passaram a contar os dois vocabulários em 12/10/2026.

---

## PC-1 Mapa de ligações
- **Herda de:** Comercial | Pré-venda (4.5: a proposta aprovada, cliente, valor, parcelas, equipamentos e códigos; 4.1: o Nº da cotação) e Financeiro & Preços (5.3: o sinal pago e o Aval de Pagamento).
- **Doa para:** Financeiro (5.3: o contrato assinado abre a etapa "Aguardando pagamento do Boleto"), Obras & Instalação (9: Dossiê, Checklist, Status da Obra e a Linha do Tempo leem o contrato assinado), Suprimentos & Importação (7: o gate da compra e o da P.I. leem o Aval Jurídico), Geral (1: etapas, notificações, Dashboard, Central de Decisões).
- **Avais** (tela 6.2) e **contrato** (6.1) são independentes: o aval nasce na aprovação da proposta; o contrato só quando alguém o cria.
- **Assinatura digital** serve a: Proposta (4.5), Contrato de Venda e signatários (6.1), Projeto de Instalação (8 e 9) e Contrato Instalador/Distrato (11). Mora uma vez aqui (PC-3).

## PC-2 O ciclo do contrato de venda
**Conferido** (código e banco).
1. O cliente **aprova a proposta** em `/assinar/<token>` → o banco cria os avais Financeiro e Jurídico e a notificação (PC-5); a cascata (etapas, decisão do CEO, dossiê, lead→cliente) roda pela fila `fluxo_pendentes` (PC-7).
2. O contrato **não nasce sozinho:** a proposta assinada aparece na fila do Painel; alguém clica "Criar contrato" (sem aval de score travando) → assistente (herda tudo) → "Gerar e enviar".
3. **Enviado:** link de 7 dias; evento `CONTRATO_VENDA_ENVIADO` fecha "Contrato enviado ao Cliente" (SLA 24 h) e abre "Aguardando assinatura do Contrato" (SLA 5 dias).
4. **Assinado** (representante + todos os signatários): evento `CONTRATO_VENDA_ASSINADO` fecha a etapa e abre "Aguardando pagamento do Boleto" (SLA 3 dias) e o Dossiê; D0 recalculado.
5. **Depois do sinal pago e do aval:** a Engenharia anexa e envia o **Desenho de Instalação**.
6. **Recusado ou expirado:** a recusa grava quem e por quê; expirado volta a "Reenviar".
7. **Compra na China:** não depende do contrato assinado, e sim dos três avais (PC-5).

## PC-3 A assinatura digital pública 🔒
**Área blindada** (seção "🔒 Assinatura digital" e "REGRA TRAVADA — PDF assinado" do `CLAUDE.md`): quem for "mexer, melhorar, simplificar ou remover" **para antes**, informa o que existe e pede confirmação. Esta seção descreve; a lei continua lá. **Conferido** em `assinar-app.jsx`, nas stores e no banco, 31/10/2026.
- **Página:** `/assinar/<token>` (servida por `server.js` como `assinar.html`; o token é lido no navegador). A página descobre de que documento é o token: contrato do instalador, **contrato de venda**, signatário de sócio/jurídico, "deve assinar" (contrato de venda, contrato do instalador, projeto de instalação, distrato) ou proposta.
- **Passos para o cliente:** ler o documento por inteiro; (proposta: escolher a modalidade); caixa "Declaro que li, compreendi e concordo…"; **assinatura** em duas abas, **Desenhar** ou **Digitar nome** (a segunda é a padrão, em letra de mão Caveat); **Confirmar e assinar**. Ações secundárias: **Recusar assinatura** (nome obrigatório, motivo opcional), **⬇ Baixar contrato (PDF)** e, depois de assinar, **Baixar cópia assinada (PDF)**.
- **Quem assina de verdade:** o **servidor**. A leitura e as ações do contrato de venda passam por funções do banco (`public_cv_obter/_visualizado/_assinar/_recusar/_assinaturas`) e as de signatário por `public_cvs_obter/_visualizado/_assinar/_recusar`; todas recebem **só o token**, só tocam aquele registro, carimbam hora e IP no servidor e aceitam só chaves conhecidas na auditoria. O interruptor de emergência é `localStorage.vp_public_rpc = 'off'` (volta ao caminho antigo, que só funciona com a tabela aberta). **Conferido:** as funções `public_cv*` são executáveis pelo público e os auxiliares `_cv_*` só pelo servidor.
- **Regra de fechamento no servidor:** `_cv_pendentes` conta os signatários que faltam; o contrato vira `assinado` só quando zera; senão `aguardando_signatarios`. Aviso e log gravam na mesma transação; os **eventos de fluxo e o recálculo do D0 rodam pela fila** `fluxo_pendentes`, executada por um usuário interno com o sistema aberto (atraso de segundos a horas, `01_geral.md` PC-9).
- **Um link por pessoa:** representante (token do contrato), sócios/jurídico (`contrato_venda_signatarios`) e "deve assinar" (`documento_signatarios`). Nunca se cole vários e-mails num campo "Para" que divida o mesmo link (caso AKAI, 01/10/2026: o primeiro a abrir "consumiu" a visualização; a IP que "recusou" era de uma nuvem da Microsoft, provável verificador automático de e-mail).
- **PDF assinado (regra travada):** o PDF do contrato assinado lista **todas** as assinaturas, em ordem, com papel, nome, data e hora de Brasília, dispositivo, **IP** e hash; testemunhas ficam em branco; o nome vai em letra de mão (Caveat) ou, se desenhada, a imagem da rubrica. A lista vem da função com o token ou, se falhar, das tabelas por ID. Vale para Proposta, Contrato de Venda, Contrato do Instalador e Projeto de Instalação.
- **Hash:** no contrato de venda o SHA-256 cobre o `form_state` e o nome; não cobre o `doc` (**Conferido**). O do Contrato Instalador cobre também o `doc` e o instante (Herdado, módulo 11). **Achado** (6.1.10).
- **Validade do link:** 7 dias a partir do envio; a função recusa assinar depois da validade ("Este contrato expirou.").
- **Já testado** em `assinar-publico-f1.test.js` (só o desenho e as assinaturas do PDF); **não há teste de ponta a ponta** da tela `/assinar`.

## PC-4 O texto da minuta e a numeração
**Conferido** em `contrato-venda-engine.js`.
- **Estrutura:** preâmbulo + 10 cláusulas — 1 Objeto, 2 Entrega e instalação, 3 Preço e condições de pagamento, 4 Obrigações da VENDEDORA, 5 Obrigações do COMPRADOR, 6 Garantias, 7 Penalidades, 8 Encerramento, 9 Caso fortuito e força maior, 10 Disposições finais — mais o bloco de assinaturas e testemunhas. O texto reproduz a **minuta do Jurídico** (versão de 01/10/2026) e **não** se resume nem se "melhora" sem o Jurídico.
- **Remontado a cada abertura** (também em `/assinar`): contratos antigos mostram o texto novo e a **data de hoje** (6.1.10 item 4).
- **Cláusulas condicionais:** equipamento especial (≥ 1.000 kg) e obra a mais de 100 km só geram **aviso na tela**; a minuta padrão não as cobre.
- **Dados fixos da VENDEDORA:** razão, CNPJ, representante, banco e contatos (cláusula 10.1) estão no código. **Chave PIX = o CNPJ** (nunca um valor digitado à parte). A minuta do Jurídico trazia o CNPJ com dois dígitos trocados e o sistema mantém o correto (decisão do Gelson).
- **Erros de digitação da minuta reproduzidos de propósito** ("Anexos I e II", "realizadas. exceto quando", "Se parte infratora", "Guarulhos, capital do estado de São Paulo"): corrigir só com decisão do Jurídico.
- **Cláusula 3.1.1** (por equipamento) só aparece quando a proposta tem mais de um equipamento e é só informativa; o valor é um só.
- **Códigos dos equipamentos** (`VPEL-EL0955-1`, `-2`) vêm dos ativos da proposta e entram na cláusula 1.1.
- **Numeração:** o cabeçalho mostra `Nº do Contrato: VPCV-0955` (aditivo `VPCV-0955-2`; rascunho `VPCV-XXXX`; legado cru) e o Anexo I `VPPR-0955`. Prefixos: VPCT = cotação, VPPR proposta, VPCV contrato de venda, VPNI contrato do instalador. A coluna `numero_documento` é única.
- **E-mails da VerticalParts são filtrados** do bloco "Dados do COMPRADOR" (só na exibição; o campo guarda tudo).
- **Contatos e telefones** que estão no texto da minuta **não são repetidos neste documento** (Art. 28).

## PC-5 Os avais, o Jurídico e as revisões comerciais
- **Os três avais da compra** (a regra mora em 5, PC-3; aqui o lado do Jurídico): **Aval de Pagamento** (Financeiro), **Aval Jurídico** (esta tela) e **Projeto de Instalação assinado** (Aval Engenharia); o CEO só entra com margem abaixo de 15% ou desconhecida. Quem decide o gate é `AvalFinanceiroStore.podeIniciarCompra`. **Herdado** de 5.3; **Conferido** que o gate lê `avais_juridicos.status = 'aprovado'`.
- **Como o aval nasce:** o gatilho `fn_avais_abrir_na_proposta` (quando a proposta vira `aprovada`) cria os avais Financeiro e Jurídico e a notificação "Avais Financeiro e Jurídico iniciados"; `fn_avais_notificar_ok` grava a segunda notificação quando os dois estão OK (e diz o que falta). Ambos são funções do servidor, não executáveis pelo público.
- **Revisões comerciais** (desenho de 22/10/2026 em `docs/revisoes/`): a **Etapa 1 do banco está aplicada** (vigência da proposta, tokens, solicitações); no módulo do Jurídico só o **aval da proposta vigente** foi implementado. **Não implementados:** herdar ou reabrir os avais por diferença entre revisões, as **cláusulas alteradas em vermelho** do contrato e a letra de revisão do contrato antes de assinar (`VPCV-0955-A`). **Contrato assinado + revisão aprovada** vira `pendente_aditivo`: o trigger `trg_contratos_venda_vigencia` reaplica a vigência da cotação quando o contrato é assinado ou muda de status; a fila do Jurídico mostra as propostas `pendente_aditivo`. O aditivo é um **novo contrato** (`VPCV-0955-2`). **Conferido** (função do gatilho e código); o restante, **Herdado**.

## PC-6 Identidade, alçadas e segurança
Regra geral em `01_geral.md` PC-6 e na Constituição (Art. 25). **Trava na tela é organização, não segurança.** O que é específico daqui (Conferido, 31/10/2026):
- **Perfil e alçada não são conferidos** nas três telas (6.1.3, 6.2.3, 6.3.3). A restrição do Aval Jurídico usa um perfil que o seletor não oferece.
- **Estado das tabelas:**
  - `contratos_venda_equipamentos`: **fechada ao público** (RLS ligada; `vp_int_sel/ins/upd` para usuário ativo; exclusão por administrador ou alçada com nome divergente; rascunhos apagáveis por qualquer ativo). Está no Realtime sem ouvinte.
  - `avais_juridicos`, `contrato_venda_signatarios`, `documento_signatarios`: RLS ligada e **quatro políticas `true` para o público** em cada (ler, inserir, atualizar, apagar). Em `documento_signatarios` (24 linhas) e `contrato_venda_signatarios` isso expõe os **tokens** de assinatura a quem tem a chave pública; o risco está descrito em `AUDITORIA_FORENSE_E2E_SCORE.md` (Herdado). Fechar depende da #571 (`docs/seguranca/matriz-acesso-rls.md`, Herdado).
- **Funções do banco:** as públicas `public_cv*` e `public_cvs*` são intencionais; os auxiliares `_cv_*` e os gatilhos `fn_avais_*` só o servidor executa.
- **Bucket `engenharia`:** o desenho de instalação fica em URL pública (qualquer pessoa com o link abre). Não há assinatura de URL.
- **Segredo:** nada de chave, telefone ou e-mail pessoal neste documento (Art. 28). Os contatos fixos da minuta ficam só no código.

## PC-7 Gatilhos e rotinas
**Conferido.**
- **Etapas da cotação (motor do módulo 1):** `CONTRATO_ENVIADO` ("Contrato enviado ao Cliente", SLA 24 h; nasce quando o cliente aprova a proposta, fecha em `CONTRATO_VENDA_ENVIADO`), `AGUARDA_ASSINATURA` (SLA 5 dias; fecha em `CONTRATO_VENDA_ASSINADO`), `AGUARDA_BOLETO` (SLA 3 dias; manual, no Aval Financeiro), `AVAL_JURIDICO` (manual; nasce na aprovação da proposta e fecha em `AVAL_JURIDICO_APROVADO`), e `COMPRA_LIBERADA` (exige os três eventos de aval).
- **Eventos emitidos por este módulo:** `CONTRATO_VENDA_ENVIADO`, `CONTRATO_VENDA_REPRESENTANTE_ASSINOU`, `CONTRATO_VENDA_SIGNATARIO_ASSINOU`, `CONTRATO_VENDA_SIGNATARIO_RECUSOU`, `CONTRATO_VENDA_ASSINADO`, `AVAL_JURIDICO_APROVADO`, `AVAL_JURIDICO_REPROVADO`, `DESENHO_INSTALACAO_ANEXADO`, `DESENHO_INSTALACAO_ENVIADO`. Os de assinatura saem pela fila `fluxo_pendentes` (PC-3).
- **Gatilhos do banco:** `trg_contratos_venda_vigencia` (aplica a vigência da cotação ao assinar), `vp_valores_guarda` (guarda de valores, `01_geral.md` PC-6), `trg_avais_juridicos_ok` (notifica quando os avais ficam OK), `fn_avais_abrir_na_proposta`. **Nenhum cron cita** contratos ou avais.
- **Notificações:** cada mudança de status do contrato grava em `alertas` (módulo "Jurídico", sem destinatário) e `vp_logs` (módulo "Contrato Venda"). Hoje há 68 alertas do módulo "Jurídico" e 15 registros em `vp_logs` dos módulos "Contrato Venda", "Aval Jurídico" e "Contratos Social" (Conferido, contagem do banco).
- **No navegador:** `sweepExpired` ao abrir o Painel; o Painel relê a cada 5 s.

## PC-8 Tabelas
| Tabela | Uso | Estado em 31/10/2026 (Conferido) |
|---|---|---|
| `contratos_venda_equipamentos` | os contratos (e os do editor antigo); tem `doc`, `form_state`, `audit`, `log`, `recipient`, `desenho_instalacao` | 1 linha; RLS fechada ao público; no Realtime |
| `avais_juridicos` | o aval por proposta ou contrato | 4 linhas; 4 políticas abertas |
| `contrato_venda_signatarios` | sócios/jurídico do comprador | 0 linhas; abertas |
| `documento_signatarios` | signatários genéricos (contrato de venda, instalador, projeto de instalação) | 24 linhas; abertas |
| `propostas` | a proposta de origem | módulo 4 |
| `dossier_obra` | o dossiê que o contrato cria ou reaproveita | módulo 9 |
| `alertas`, `vp_logs`, `eventos_fluxo`, `fluxo_pendentes` | avisos, auditoria, eventos e fila da cascata | módulo 1 |
| `emails_projeto` | e-mails enviados e respostas (selo "Respondeu por e-mail") | módulo 1 (Inbox, 🔒) |
| `cotacoes` | herança do editor antigo (tabela antiga) | **Não verificado** o conteúdo |

## PC-9 Navegação, cache e testes
A regra geral (hooks, `setSubsel` + `setRoute`, estado na URL, cache `?v=`, jsx-loader) está em `01_geral.md` PC-9. O específico daqui:
- **Estado na URL:** aba, gaveta aberta e origem do assistente (6.1.2); janela e linha do Aval Jurídico (6.2.2); contrato do editor antigo (6.3.2).
- **`assinar.html` também carrega** `contrato-venda-engine.js`, `contrato-venda-store.js`, `contrato-venda-signatarios-store.js`, `contrato-venda-preview.jsx`, o bundle de PDF e `styles/contrato-venda.css` (mas **não** `contrato-venda.jsx`); `formulario-cliente.html` não carrega nenhum deles. Mexer num desses arquivos exige subir o `?v=` em `index.html` **e** em `assinar.html` (o CI barra). O bundle de PDF tem fonte própria (`npm run build:pdf:contrato`) e o `.bundle.js` é versionado. **Conferido.**
- **Testes** (31/10/2026): 7 + 1 + 7 + 8 testes citados nas telas e 11 do gate; **suíte inteira: 931 passam, 0 falham** (Conferido, `npm test`). `node scripts/check-cache-bust.js origin/main` rodado e sem pendências. **E2E não rodado** (roda no CI); não há e2e específico deste módulo.

## PC-10 Menu "?" e tutoriais
Conferido em `shell.jsx` (`HELP_TOPICS`, `TUTORIAIS`), `vp-copiloto/index.ts`, `vp_copiloto_docs` e `TreinamentoVP/`, 31/10/2026.
- **Ajuda "?"** existe só para `juridico` ("Contratos e minutas. O contrato de venda nasce da proposta aprovada; contrato do instalador exige homologação."). **Não existe** para `contrato-venda-equipamentos` nem `aval-juridico`.
- **Copiloto VP:** o texto embutido tem `juridico` e `contrato-venda-equipamentos`, mas o de contrato de venda diz que "criar o rascunho exige que o Financeiro já tenha dado aval" e que o contrato assinado é condição do gate de compra — **as duas frases estão defasadas** (6.1.10 item 14). Não há texto para `aval-juridico`. A tabela `vp_copiloto_docs` só tem o "mapa do ecossistema" (que cita o Aval Jurídico); ajustar o Copiloto desta tela = linha nova em `vp_copiloto_docs` (sem redeploy) ou editar o `ROUTE_DOCS`.
- **Tutoriais** em `TreinamentoVP/contratos-juridico/` (módulo, `contrato-venda-equipamentos`, `aval-juridico`, `contratos-minutas`): de **09 e 10/10/2026**. O código mudou depois (a lista de destinatários e as assinaturas no PDF; o `contrato-venda.jsx` foi alterado em 23/10 e o `aval-juridico-store.js` em 23/10). A pasta está **fora do Git** (de outra sessão): não mexi. O de Contratos & Minutas descreve o editor antigo (6.3.10 item 8). **Tutorial não se edita à mão:** pedir à sessão de tutoriais para regenerar (Art. 46).
- **Cache do navegador:** ver `04_comercial_pre_venda.md` PC-10.

## PC-11 Documentos soltos e destino do que foi concatenado
Busca feita em `CLAUDE.md`, raiz, `docs/`, `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/seguranca/`, `docs/revisoes/`, `handoffs/` e `TreinamentoVP/` (Art. 50). Nada foi apagado.

| Origem | Destino | Situação |
|---|---|---|
| Seções do `CLAUDE.md` **só deste módulo**: "Contrato de Venda de Equipamentos — investigação do nascimento…" (28/09), "Contrato sem Proposta — vínculo de e-mail…" (29/09), "Contrato de Venda — layout idêntico à minuta…" (29/09), "Contrato de Venda — 'Criar contrato' a partir da Proposta 955…" (29/09), "Contrato de Venda — botão 'Salvar rascunho'…" (30/09), "Contrato de Venda — texto alinhado à minuta de 30 SET" (30/09), "Contrato de Venda — minuta de 01/10 + numeração…" (01/10), "REGRA TRAVADA — PDF do Contrato de Venda assinado…" (05/10) | **Concatenadas** aqui (6.1 e PC-2 a PC-4) | **retiradas do `CLAUDE.md` em 31/10/2026, a pedido do Gelson** (as sete que eram só do módulo; a de "REGRA TRAVADA" fica, é lei); continuam no histórico do Git |
| **🔒 Área blindada "Assinatura digital"** e a **regra travada do PDF** do `CLAUDE.md` | **Continuam no `CLAUDE.md`** (são lei); aqui se descrevem em PC-3 | ganharam nota "detalhe → Contratos & Jurídico" |
| Seções **mistas** com trecho deste módulo: "Contrato de Venda/Instalador — envio real por e-mail" (29/09; o trecho do Instalador é do 11), "Avais — 2ª rodada" e "Avais Financeiro e Jurídico" (já migradas para o 5; o trecho do Jurídico está em PC-5), "Aval Engenharia", "Auditoria de amarrações" (itens 5 e 17), "Segurança real (#571)", "Realtime", "Compras…" | **Ficam** no `CLAUDE.md` com nota; o trecho do módulo 6 está aqui | mistas: não se apagam |
| Seções do **Contrato Instalador** (auditoria, Nº, cláusulas do advogado, Baixar contrato, Distrato, anular assinatura) | **Módulo 11** | não copiadas |
| `docs/revisoes/00` a `03` | PC-5 e `04` PC-4 | Desenho das revisões comerciais; só a Etapa 1 do banco foi aplicada. Ficam onde estão. **Decisão do Gelson** (já em aberto no módulo 4) |
| `docs/seguranca/cascata-assinatura.md` | PC-3 | Descreve a cascata da assinatura da **proposta**; a do contrato segue o mesmo desenho (fila). Apontado, não copiado |
| `docs/seguranca/matriz-acesso-rls.md` e `docs/superpowers/plans/2026-10-02-autenticacao-e-rls-571.md` | PC-6 e 14 | Apontados, não copiados |
| `docs/superpowers/plans/2026-10-13-desfoque-de-valores-hub.md` | PC-6 | Plano do desfoque de valores (o contrato guarda `valor_total_num`); apontado. **Não verificado** o quanto foi executado |
| `docs/superpowers/specs/2026-10-31-revisao-B-bugs-e-defasagens-de-codigo.md` (**fora do Git**, de outra sessão; não mexi) | 6.2.3 | O achado do perfil "juridico" fora do `ROLE_MAP` foi **reconferido** aqui; o do KPI "Contratos abertos" já foi corrigido (Dashboard, Fase 0) |
| `AUDITORIA_FORENSE_E2E_SCORE.md` (raiz) | 6.1.10 | Achados E2E-020, 032, 033 e 050 reconferidos no código; os demais ficam como histórico |
| `docs/superpowers/specs/2026-10-23-ocultar-equipamento-proposta.md` | 6.1.6 | O contrato não herda equipamento ocultado na proposta; apontado |
| `docs/superpowers/specs/2026-10-30-art-por-obra.md` | 9 | Cita o link do contrato de venda; é do módulo 9 |
| `.claude/skills/tutorial-vp-gestao/references/herancas.md` e `modulos.md` | PC-10 | Referência da sessão de tutoriais; só apontada |
| `TreinamentoVP/contratos-juridico/*` | PC-10 | Tutoriais de outra sessão (fora do Git); só apontados |
| `README.md`, `docs/PROJETO_INCRIVEL.md`, `docs/COMO_ADICIONAR_CARDS.md`, `docs/VISTORIAS_*.md` | — | Citam o contrato de passagem; sem trecho que valha concatenar |
| **Parecem obsoletos — decisão do Gelson** | — | O **editor antigo** (`contrato-editor.jsx`), a janela "Novo Contrato" e o **redator** de páginas (`ContractRedactor` e as `ContractPage*`, código morto com dados fictícios) em `operacoes.jsx` (6.3.10); `project-gates.js` (gate antigo, compara `assinado`) |

## PC-12 Benefícios trocados com os outros módulos
- **Recebido de Geral (`01_geral.md`):** a regra de numeração e o molde; a cadeia de etapas, a fila `fluxo_pendentes` e as Notificações (PC-3, PC-7).
- **Recebido de CRM, Cadastros e Comercial | Pré-venda:** a proposta aprovada e seus dados (4.5), o Nº da cotação como chave de tudo (4.1), a leitura paginada de 1.000 em 1.000 (Cadastros): aplica-se ao Painel de 6.1.
- **Recebido de Financeiro & Preços (`05_financeiro_precos.md`):** a regra dos três avais e do CEO (PC-3 de lá), o padrão "botão que parece ação e só muda status" e a ideia de dizer o que o botão realmente faz.
- **Doado** (acrescentado na mesma sessão aos outros documentos, no tema certo, texto completo aqui):
  - **A todos: perfil que o seletor não oferece.** Uma rota em `RESTRICTED` com um perfil que não existe no `ROLE_MAP` só abre para o administrador (6.2.3). Vale conferir outras rotas restritas.
  - **A todos: nome de alçada diferente entre o catálogo, a tela e a política do banco.** A política de exclusão de contratos pergunta por um módulo com outro nome; as concessões não valem (6.1.10 item 2). Vale conferir `vp_tem_capacidade('…')` das demais políticas.
  - **A Comercial | Pré-venda (4.5) e a todos: a data de um documento remontado.** "Guarulhos, <hoje>" e o ano do número saem do relógio na hora de montar; reabrir um documento antigo mostra a data de hoje (6.1.10 item 4).
  - **A Geral (PC-9): a função que regrava depois do fechamento.** `updateFormState` atualiza `doc` e `form_state` sem olhar o status; vale conferir outras `update` sem filtro de estado.
- **Pedidos de mudança de código** que estes benefícios sugerem ficam como pendência; nenhuma linha de código foi alterada.
