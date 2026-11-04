# 10 Entrega & Documentação — documento do módulo (REAL, fonte da verdade — 01/11/2026)

> **Status: REAL (documento oficial do módulo 10), aprovado pelo Gelson em 01/11/2026**, no molde de `01_geral.md` a `09_obras_instalacao.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é o **fim da obra** — onde os papéis da entrega (ART, Data Book, Termo de Entrega) são reunidos, o cliente assina o aceite e começa a garantia. Duas coisas pedem atenção: (1) as telas de entrega quase **não são usadas** hoje (0 de 68 Dossiês têm Handover; 0 Termos digitais; 0 documentos no Repositório), a entrega real acontece fora do site; (2) o **Termo de Entrega** é uma página pública de assinatura cujo evento de fluxo (`TERMO_ASSINADO`) **não é emitido** pelo caminho que está ativo (10.2.8).
>
> **Fonte da verdade:** o código e o banco, conferidos em 01/11/2026 (`origin/main` `f092d2f`). **Conferido** = lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** = veio do `CLAUDE.md`, de uma auditoria ou do documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui confirmar. Sem selo vale como Não verificado (Art. 6).
>
> **Escopo do módulo:** as **quatro** telas do grupo "Entrega & Documentação" do menu (`NAV_GROUPS` em `shell.jsx`): **Central de Documentos**, **Data Book & Termo**, **Entrega Final** e **Repositório Documentos**. Pertencem a elas, sem item de menu: a página pública **Termo de Entrega** (`/termo-entrega/<token>`) e o **painel do Termo** que mora dentro do Dossiê da Obra (`TermoEntregaPanel` em `dossier-obra.jsx`, 9.1) — a regra de ambos é **deste** módulo. **Não** são deste módulo: o **Cronograma de Pagamento da Instalação** (mora em `entrega.jsx`, mas é do 11); a **ART** (9.6); a aba **Documentos** do Dossiê, onde se anexa o arquivo (9.1); **Projeto de Elevadores › Desenhos** (8.1); **Contratos Social** (4.6).
>
> **Onde moram arquivos que não têm nome óbvio (Conferido):** "Data Book & Termo" é `DataBookPage` **dentro de `entrega.jsx`** (arquivo que também guarda `CronogramaPage`, do 11) — não existe `databook.jsx`; "Entrega Final" é `handover-manutencao.jsx` (rota `handover`); "Repositório Documentos" é `repositorio-documentos.jsx`.

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **10**; telas filhas = **10.1 a 10.4**, na ordem do menu; o conteúdo comum fica na **Parte comum**, sem número de tela.
- **Tudo o que é janela, aba, gaveta ou assistente de uma tela pertence a ela.** No 10.3 estão os modais de registrar handover e de editar o checklist; no 10.4 os de enviar e de excluir. O **Termo de Entrega** (painel no Dossiê + página pública) está no 10.2.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
10. **Entrega & Documentação**
   10.1 Central de Documentos · 10.2 Data Book & Termo (inclui o Termo de Entrega: painel no Dossiê e página pública de assinatura) · 10.3 Entrega Final (Handover) · 10.4 Repositório Documentos
   &nbsp;&nbsp;&nbsp;Cada tela tem os temas: x.1 O que é · x.2 Rota e arquivos · x.3 Perfil e acesso · x.4 O que a tela mostra · x.5 Botões e controles · x.6 Comportamento · x.7 Dados (lê/grava) · x.8 Regras e armadilhas · x.9 Testes · x.10 Pendências e decisões · x.11 Histórico
   Parte comum de Entrega & Documentação (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 A entrega de ponta a ponta · PC-3 Rotas, página pública e arquivos · PC-4 Onde guardar cada documento (as quatro "casas") · PC-5 Garantia e pós-venda (Escamax) · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos, eventos, crons e funções · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
11. Parceiros & Instaladores → `11_parceiros_instaladores.md` (REAL)

## Glossário (módulo Entrega & Documentação)
Termos gerais (alçada, soft-delete, evento de fluxo, Nº da cotação) estão em `01_geral.md`; **Dossiê da Obra**, **codigo_obra** e **ART** em `09_obras_instalacao.md`. Não se repetem aqui.
- **Obra (na Central de Documentos):** o **agrupamento dos Dossiês pelo nome do cliente** (`client_name`). Não é o `codigo_obra` do 9 (10.1.8).
- **Tipos de documento da obra:** os 10 tipos do checklist do Dossiê — ART, Termo de Vistoria, DataBook e Termo de Entrega (obrigatórios) e Alvará, Contrato Instalador, NRs, ASO, PCMSO/PGR, Cronograma (opcionais).
- **Data Book (DataBook):** o "ebook técnico" da obra — documentação final, manuais e certificados. É **um arquivo anexado** ao Dossiê (tipo "DataBook (Ebook técnico)"); a tela "Data Book & Termo" só **aponta** para lá.
- **Termo de Entrega:** declaração de que o equipamento foi entregue, testado e aceito. Assinado em página pública por link. Gera um PDF que entra nos documentos do Dossiê.
- **Modo self-service / presencial:** no self-service só o **cliente** assina pelo link; no presencial **cliente e supervisor** assinam juntos no mesmo aparelho.
- **Handover (Entrega Final):** o registro de que o equipamento foi entregue ao cliente — data, meses de garantia, contato de suporte, checklist de entrega e observações. Fica em `dossier_obra.handover` (jsonb).
- **Escamax:** empresa de **manutenção preventiva** (pós-venda). "Transferir para a Escamax" é **só um sinalizador** no registro do Handover (PC-5).
- **Repositório Documentos:** guarda de arquivos **soltos**, sem vínculo com obra, cliente ou cotação.

---

## 10.1 Central de Documentos

### 10.1.1 O que é
Uma **biblioteca por obra**, de **leitura**: escolhe-se a obra na estante à esquerda e a tela mostra, de uma vez, os **documentos da obra** (os 10 tipos do Dossiê, com status) e a **documentação do montador** (empresa instaladora, colaboradores e documentos de RH). A única coisa que ela grava é o botão "Marcar documentação do instalador como enviada". **Conferido** em `central-documentos.jsx` (239 linhas) e `central-documentos-store.js` (144), 01/11/2026.

**Fora do escopo:** anexar arquivo (é na aba Documentos do Dossiê, 9.1); cadastrar documento do montador (Homologação de Instaladores, grupo RH Operacional); arquivo solto sem obra (10.4); desenho para enviar ao cliente (8.1); vistoria por equipamento e envio ao cliente com rastreabilidade (previstos pela própria tela como "fase 2", **não existem**).

### 10.1.2 Rota e arquivos
Rota `central-documentos`; URL `/engenharia/central-documentos[/<nome do cliente>]` — **o 2º segmento da URL é o nome do cliente** (a rota está em `SYNC_PASSTHROUGH_ROUTES` de `app.jsx`, que passa o texto da URL direto para a tela). Arquivos: `central-documentos.jsx` (`window.CentralDocumentosPage`), `central-documentos-store.js` (`window.CentralDocumentos`). **Conferido.**

### 10.1.3 Perfil e acesso
A tela **não confere `ver`**. Só lê a alçada **`central-documentos.editar`** (via `PropostaStore.temCapacidade`), para habilitar o botão "Marcar … como enviada"; Administrador passa. **Nenhuma pessoa tem essa alçada concedida** (0 linhas em `alcadas_capacidade` para o módulo `central-documentos`, 01/11/2026): hoje **só Administrador** marca. **Conferido.**

### 10.1.4 O que a tela mostra
"ENTREGA & DOCUMENTAÇÃO" / **Central de Documentos**, com a explicação das três "casas" de documento (PC-4). Duas colunas:
- **Estante (300 px):** busca ("Buscar obra (cliente)…") e uma linha por cliente com "N equipamento(s)"; "Nenhuma obra encontrada." se vazio.
- **Obra escolhida:** nome do cliente e os prédios dos equipamentos; seção **Documentos da Obra** (uma linha por tipo, com selo **Disponível / Pendente / —**, os nomes dos arquivos e o link "⬇ Ver" do primeiro); seção **Documentação do Montador** (🏢 empresa → colaborador → documentos, com vencimento e o mesmo selo; "🔧 Montando agora" ou "✅ Instalação concluída").
- Sem obra escolhida: "Selecione uma obra à esquerda pra ver o checklist de documentos." No rodapé, um aviso de que a aba "Equipamentos" e o envio ao cliente **ainda não foram implementados**.

### 10.1.5 Botões e controles
**Busca** de obra; clique na estante escolhe a obra; **📎 Anexar ou atualizar no Dossiê da Obra →** e **Vincular no Dossiê da Obra →** (abrem o Dossiê do **primeiro** equipamento do cliente, por `setSubsel` + `setRoute`); **📎 Anexar ou atualizar em Homologação de Instaladores →** (rota `rh-homologacao`); **📤 Marcar documentação do instalador como enviada** (desabilitado sem a alçada; depois vira "✓ Documentação enviada por X em data/hora"). **Conferido.**

### 10.1.6 Comportamento
Carrega a lista de obras ao abrir e a documentação ao escolher; **não recarrega sozinha** (sem polling nem Realtime). Documento do tipo **com ao menos um arquivo = Disponível**; sem arquivo e obrigatório = **Pendente**; sem arquivo e opcional = "—". Documento do montador: `VALIDO` = Disponível, `VENCIDO` = Pendente, `N/A` = "—". "Montando agora" = algum equipamento em `status_master = Instalação`; "Instalação concluída" = **todos** em Entregue ou Manutenção preventiva. "Marcar como enviada" grava `doc_instalador_enviado_em/por` em **cada** Dossiê do cliente, um de cada vez, e registra em `vp_logs` (módulo "Instalação"). **Conferido.**

### 10.1.7 Dados
**Lê:** `dossier_obra` (68 linhas, **42 nomes de cliente distintos**), `dossier_documentos` (76 linhas em 41 Dossiês: ART 41, DataBook 19, PCMSO/PGR 6, Termo de Entrega 6, ASO 4 — todos `anexado`), `parceiros_instaladores` (31), `parceiros_colaboradores` (63), `parceiros_documentos_colaborador` (520: VÁLIDO 312, N/A 159, VENCIDO 49), `parceiros_doc_catalogo` (87). **Grava:** só `dossier_obra.doc_instalador_enviado_em/por` (**0 de 68** preenchidos). **Conferido** por `count(*)`, 01/11/2026.

### 10.1.8 Regras e armadilhas
- **"Obra" aqui é o nome do cliente, não o `codigo_obra` do 9.** O mesmo cliente com duas obras vira uma só; o mesmo cliente escrito de dois jeitos vira duas; o nome do cliente vai na URL. O 9 já tem um identificador gravado para a obra (68 Dossiês → 41 códigos, 9 PC-4), mas a Central **não o usa** (42 nomes × 41 códigos). **Achado, sem correção.** **Conferido.**
- **Leitura que falha vira "vazio" sem aviso:** `listarObras` e `_documentosDaObra` fazem `const { data } = await …` sem olhar `error`; se a consulta falha, a estante mostra "Nenhuma obra encontrada." (Art. 9). **Achado, sem correção.** **Conferido.**
- **"Marcar como enviada" sem tratamento de erro:** o clique percorre os Dossiês com `await` e **sem `try/catch`**; se um falha, não há aviso. **Achado, sem correção.** **Conferido.**
- **"Disponível" é qualquer arquivo do tipo:** a tela não confere validade, versão nem quem anexou; o link "Ver" é o do mais recente, os outros só aparecem pelo nome. **Conferido.**
- **Catálogo de tipos duplicado de propósito** (comentário no código): `TIPOS_DOC_OBRA` existe no store da Central e em `dossier-obra.jsx`; mudar um sem o outro desalinha a Central e o checklist do Dossiê. **Conferido.**
- **Muitas consultas pequenas:** a documentação do montador faz uma consulta **por colaborador** (63 colaboradores no cadastro). Hoje roda; cresce com o cadastro. **Conferido.**
- **A tela promete o que não existe:** o rodapé fala da aba "Equipamentos" e do envio com rastreabilidade ("próxima fase"); nada disso foi construído. **Conferido.**

### 10.1.9 Testes
Nenhum teste de unidade dedicado; a rota entra no **teste de fumaça** (`KNOWN_ROUTES`, abre sem erro de JS) — **não rodei** o e2e. **Cenários (sem teste):** *Dado* um cliente com ART e DataBook anexados no Dossiê, *quando* escolho a obra, *então* os dois aparecem "Disponível" com link. *Dado* um cliente sem Termo de Entrega, *então* o tipo aparece "Pendente".

### 10.1.10 Pendências e decisões
**Decisão do Gelson:** (a) a Central deve agrupar por **cliente** ou pelo **`codigo_obra`**; (b) quem recebe a alçada `central-documentos.editar`; (c) construir a "fase 2" (envio ao cliente com registro) ou retirar o texto de rodapé. Tratar o erro de leitura e o clique sem `try/catch` (achados acima). Sem "?" nem tutorial (PC-10).

### 10.1.11 Histórico
Nasceu como "Fase 1: leitura agregada por obra", sem tabela de log e sem pipeline de envio (comentários do código). Recebeu depois o botão de documentação do instalador e o texto que orienta entre os repositórios de documentos. **Herdado.**

---

## 10.2 Data Book & Termo

### 10.2.1 O que é
Duas coisas sob o mesmo nome de menu: (1) a tela **Data Book & Termo de Conclusão**, que **não guarda dado nenhum** — só explica que o Data Book é anexado na aba Documentos do Dossiê e leva à lista de obras; (2) o **Termo de Entrega**, que é de fato a parte viva: o painel que gera o link (dentro do Dossiê) e a **página pública** onde o cliente (e o supervisor, no modo presencial) assina com o dedo ou o mouse. **Conferido** em `entrega.jsx` (360 linhas), `termo-entrega-store.js` (272), `termo-entrega-app.jsx` (216), `termo-entrega.html` e `TermoEntregaPanel` (`dossier-obra.jsx`).

**Fora do escopo:** anexar o Data Book (aba Documentos, 9.1); o status "Entregue" do Dossiê (9.1); a garantia e o Handover (10.3); o Cronograma de Pagamento (11, mesmo arquivo `entrega.jsx`).

### 10.2.2 Rota e arquivos
- Tela: rota `databook`; URL `/engenharia/databook`; `DataBookPage` em `entrega.jsx` (exposta em `window` junto com `CronogramaPage`).
- Painel do Termo: dentro da aba Documentos do Dossiê (`/engenharia/dossier-obra/<id>/…`), `TermoEntregaPanel` em `dossier-obra.jsx`.
- Página pública: `/termo-entrega/<token>` (`server.js` entrega `termo-entrega.html`; o token é lido do caminho). Arquivos `termo-entrega-store.js` (`window.TermoEntregaStore`, `?v=3`) e `termo-entrega-app.jsx` (`?v=1`), que usa jsPDF por CDN. **Conferido.**

### 10.2.3 Perfil e acesso
A tela `databook` **não lê alçada** (o módulo existe no catálogo: ver 8, criar 7, editar 7, excluir 2 pessoas). O painel do Termo está dentro do Dossiê e **não confere alçada** para gerar link. A página pública não pede login: **o token é a credencial**. **Conferido.**

### 10.2.4 O que a tela mostra
- **Data Book & Termo:** "ENTREGA & DOCUMENTAÇÃO · ENCERRAMENTO" / **Data Book & Termo de Conclusão**; um quadro de texto (anexe o Data Book na aba Documentos do Dossiê, tipo "DataBook (Ebook técnico)") e dois botões.
- **Painel do Termo (no Dossiê):** título "Termo de Entrega — assinatura digital"; seletor de modo; quando há link, o endereço para copiar; "Aguardando assinatura (cliente + supervisor / do cliente) — gerado em …" e "Cliente já assinou" quando for o caso; concluído mostra "✓ Assinado em … · Cliente: … · Supervisor: …".
- **Página pública:** cabeçalho azul "Termo de Entrega" com a obra e o cliente; texto fixo "Declaro que o(s) equipamento(s) desta obra foi(ram) entregue(s), testado(s) e aceito(s) nas condições apresentadas, encerrando a etapa de instalação."; nome completo; quadro de assinatura (canvas) com "Limpar"; botão **Confirmar assinatura**; aviso de que registra data/hora, IP e dispositivo "conforme a MP 2.200-2/2001 e a Lei 14.063/2020". Depois de assinado: "✅ Termo de Entrega assinado". Link errado: "Link não encontrado".

### 10.2.5 Botões e controles
**Abrir obras** / **Ir para a lista de obras** (vão para `status-obras`); no painel: seletor **Self-service / Presencial**, **Gerar link / Gerar novo link**, **Copiar**. Na página pública: o quadro de assinatura, **Limpar**, **Confirmar assinatura**.

### 10.2.6 Comportamento
1. **Gerar link** (`gerarLink`) reaproveita o `termo_entrega_token` se já existe (senão cria um de 16 caracteres), grava `termo_entrega` = `{modo, status: pendente, assinaturas: {}, gerado_em, gerado_por}` e emite o evento `TERMO_PREPARADO`; o painel registra "Link do Termo de Entrega gerado" em `vp_logs`.
2. **Assinar** (página pública): pede nome e desenho; o navegador mede IP (serviço externo `api.ipify.org`, 3 s), dispositivo e um hash e chama a RPC **`public_termo_assinar`**. O servidor confere papel (cliente/supervisor), nome, tamanho da imagem (≤ 600 000 caracteres) e que aquele papel ainda não assinou; decide sozinho se está **completo** (self-service = cliente; presencial = cliente **e** supervisor) e carimba a hora. No modo presencial, depois da assinatura do cliente a página passa ao passo do supervisor.
3. **Ao completar**, o navegador de quem assinou gera o **PDF** (jsPDF: obra, cliente, dossiê, declaração e as assinaturas com nome, hora, IP, dispositivo e hash) e o envia ao bucket `engenharia` (`dossier-documentos/<dossiê>/DOC-xxxxxx.pdf`), insere uma linha em `dossier_documentos` (tipo "Termo de Entrega", `metadata.origem = termo-entrega-assinatura-digital`) e chama **`public_termo_registrar_pdf`**, que grava o id do documento (ou o erro `pdf_erro`) no termo. Por isso o checklist do Dossiê marca "Termo de Entrega" ✓ sozinho.
4. Se a RPC falha (rede, migração ausente), a store **cai no caminho antigo** (lê e grava direto em `dossier_obra`); `localStorage.vp_public_rpc = 'off'` força o caminho antigo. **Conferido.**

### 10.2.7 Dados
**Lê/grava:** `dossier_obra.termo_entrega_token` e `termo_entrega` (jsonb) — **0 Dossiês** com token ou termo em 01/11/2026; `dossier_documentos` (6 documentos "Termo de Entrega", **todos anexados à mão**, nenhum pela assinatura digital); bucket público `engenharia`. RPCs `public_termo_obter` / `public_termo_assinar` / `public_termo_registrar_pdf` (`SECURITY DEFINER`, executáveis por `anon`) e a função de apoio `_po_termo_resumo`, que **esconde da página a imagem da assinatura, o IP e o hash** (só devolve modo, status e quem já assinou). **Conferido** (migração `20261010120000`, `pg_proc`, consulta).

### 10.2.8 Regras e armadilhas
- **`TERMO_ASSINADO` não é emitido pelo caminho ativo (achado, sem correção).** A página pública só carrega a store e o app (não carrega `eventos-fluxo-store.js`); o único `EventosFluxo.registrar('TERMO_ASSINADO')` está no **caminho antigo** (fallback), e ali `window.EventosFluxo` também não existe nessa página. A RPC `public_termo_assinar` **não grava evento nem coloca nada na fila** `fluxo_pendentes` (que é como Proposta e Contratos fazem, 1.4). Resultado: o nó "Termo de Entrega assinado" do motor de Gatilhos nunca fecha por aqui. Como nenhum termo digital foi gerado ainda (0), **não houve efeito real até agora.** **Conferido** (código, migração e página).
- **"Gerar novo link" zera assinaturas parciais:** `gerarLink` reescreve `termo_entrega` com `assinaturas: {}` sem olhar o status; se o cliente já assinou no presencial e alguém gera de novo, a assinatura some. A tela só esconde o botão depois de **concluído**; a store não confere. **Achado, sem correção.** **Conferido** no código (e **Herdado** da auditoria forense, E2E-034).
- **O supervisor não tem identificação própria:** quem abrir o link depois que o cliente assinou (modo presencial) cai no passo "supervisor" e pode assinar como tal. A credencial é só o token. **Conferido** no código (`setPasso`).
- **O PDF é gerado no navegador de quem assina** e inserido em `dossier_documentos` pela página pública (política de inserção aberta); o servidor só confere que o documento é do tipo e do Dossiê certos. É uma limitação de arquitetura (Art. 25), não um bug. **Conferido.**
- **O texto do Termo é fixo no código** (tela e PDF), igual para todas as obras. Mudar a redação exige alteração de código. **Conferido.**
- **Ordem do fluxo não é imposta:** gerar o Termo não exige DataBook nem ART anexados; o motor só **encadeia** os avisos (PC-7). **Conferido.**
- **A tela "Data Book & Termo" não tem dado nem alçada lida**: é um aviso com dois botões. O catálogo de alçadas tem o módulo `databook` com concessões que não valem para nada. **Conferido.**

### 10.2.9 Testes
`src/f1-publico-obra.test.js` cobre a store do Termo com banco simulado (5 casos: ler por RPC; assinatura parcial sem PDF; assinatura que completa tenta o PDF e registra o resultado; erro de negócio vira mensagem; RPC inexistente cai no caminho antigo). A página pública `/termo-entrega/e2e-token` está na lista `PAGINAS_PUBLICAS` do teste de fumaça (raiz `#te-root`). **Não rodei** o e2e; **não testei com assinatura real.** **Cenários:** *Dado* um Termo self-service, *quando* o cliente assina, *então* o termo fica "concluído", nasce o PDF em Documentos e o checklist do Dossiê marca ✓ (coberto em parte pelo teste). *Dado* o mesmo caso, *então* o evento `TERMO_ASSINADO` deveria aparecer em `eventos_fluxo` (**sem teste e hoje não acontece**).

### 10.2.10 Pendências e decisões
**Decisão do Gelson:** (a) emitir `TERMO_ASSINADO` também pelo caminho da RPC, pela fila `fluxo_pendentes` como a Proposta; (b) impedir que "Gerar novo link" apague assinatura já feita; (c) como identificar o supervisor; (d) redação final do Termo (jurídico). Sem "?" nem tutorial (PC-10).

### 10.2.11 Histórico
A tela antiga lia a tabela legada `projetos` e duplicava o que o Dossiê já fazia; virou aviso e redirecionamento. O Termo digital (link, assinatura, PDF) foi construído depois, junto do Handover. Em 10/10/2026 a página pública passou a falar com o banco por RPC (segurança real, #571). **Herdado.**

---

## 10.3 Entrega Final (Handover)

### 10.3.1 O que é
O registro da **entrega do equipamento ao cliente** e o início do **pós-venda**: data de entrega, meses de **garantia**, contato de suporte, **checklist de entrega** (8 itens) e observações; e a **transferência para a Escamax** (manutenção preventiva). Cada Dossiê tem no máximo um Handover, guardado na coluna `dossier_obra.handover`. **Conferido** em `handover-manutencao.jsx` (384 linhas) e `handover-manutencao.js` (133).

**Fora do escopo:** o Termo de Entrega (10.2); o status "Entregue / Manutenção preventiva" do Dossiê, que é manual (9.1); a manutenção preventiva em si — **não existe no site**, o "pós-venda" é só o sinalizador (PC-5).

### 10.3.2 Rota e arquivos
Rota `handover`; URL `/engenharia/handover[/<id do Dossiê>]` — **o projeto aberto vai na URL** (`useRotaId`): F5, link direto e Voltar reabrem o certo. Arquivos `handover-manutencao.jsx` (`window.HandoverManutencaoPage`) e `handover-manutencao.js` (`window.HandoverManutencao`). O **Dossiê** (9.1) tem o cartão `CardHandover`, que **só lê** o estado ("Aguardando handover / Handover registrado / Transferido para a Escamax", garantia até …) e leva até esta tela. **Conferido.**

### 10.3.3 Perfil e acesso
A tela **não lê alçada** nenhuma: quem enxerga a tela registra, edita o checklist e transfere. O módulo `handover` existe no catálogo (ver 8, criar 7, editar 7, excluir 2 pessoas), sem efeito. **Conferido.**

### 10.3.4 O que a tela mostra
"ENTREGA & DOCUMENTAÇÃO · PÓS-VENDA" / **Entrega Final**. Quatro KPIs: **Projetos entregues** (com handover), **Em garantia** (handover não transferido e dentro da garantia), **Transferidos** (para a Escamax), **Total de projetos** (todos os Dossiês). À esquerda a lista de **Projetos** (cartões com obra, `id · cliente` e o ícone ⏳ aguardando / 🔄 registrado / ✅ transferido). À direita, o projeto escolhido: sem handover, o aviso amarelo "Nenhum handover registrado"; com handover, a **Data de Entrega**, a **Garantia** em meses, a faixa da Escamax, o **Checklist de Entrega** (porcentagem e barra), o **Período de Garantia** (fim, dias restantes, contato e e-mail) e as observações.

### 10.3.5 Botões e controles
**Registrar Handover** (no cabeçalho e no aviso amarelo) abre o modal com: Nome do cliente*, Período de garantia (meses, padrão 12), Contato de suporte, E-mail de suporte, Observações. **Transferir Agora** (pede `confirm`). **Editar / Ocultar Checklist** abre o modal com os 8 itens, cada um com a categoria (técnico, documentação, legal, operacional, comercial). Itens: equipamento testado; documentação e manuais entregues; **Data Book assinado pelo cliente**; certificados e ART entregues; treinamento realizado; suporte 24/7 informado; garantia explicada; assinatura no Termo de Entrega. **Conferido.**

### 10.3.6 Comportamento
- Lê **todos** os Dossiês (`select *`, mais recentes primeiro) e mostra os que têm handover nos KPIs.
- **Registrar** grava um objeto **novo** em `dossier_obra.handover` (entrega = agora; fim da garantia = agora + meses × 30 dias; `escamax_transferido = false`) e emite o evento `HANDOVER_CONCLUIDO`.
- **Transferir** marca `escamax_transferido = true` com a data e emite `POS_VENDA_ATIVADO`.
- **Checklist:** o modal salva direto na coluna; o item "Data Book assinado" **só pode ser marcado se existe um DataBook anexado ao Dossiê** (se a consulta falhar, libera). Não emite evento nem log.
- A tela **não chama `VPLog`**: nenhuma das três ações aparece no log de atividades. **Conferido** no código.

### 10.3.7 Dados
**Lê:** `dossier_obra` (68), `dossier_documentos` (para o DataBook). **Grava:** `dossier_obra.handover` (jsonb; **0 de 68** preenchidos, 01/11/2026) e os eventos `HANDOVER_CONCLUIDO` / `POS_VENDA_ATIVADO` (**0 em `eventos_fluxo`**). **Conferido.**

### 10.3.8 Regras e armadilhas
- **Ninguém usa a tela hoje:** 0 handovers para 68 Dossiês, enquanto **11** obras já estão em DataBook (4), Entregue (3) ou Manutenção preventiva (4). A entrega acontece fora da tela. **Conferido.**
- **Registrar de novo apaga o que já existe:** o botão do cabeçalho continua visível com um handover registrado, e `registrarHandover` grava um objeto inteiro novo — zera checklist, transferência e garantia. **Achado, sem correção.** **Conferido** no código.
- **O botão do cabeçalho não faz nada sem projeto escolhido:** o modal só aparece com um projeto selecionado, e não há aviso. **Achado.** **Conferido.**
- **Contato de suporte vem preenchido com texto de exemplo** (`+55 11 xxxx-xxxx`) e é gravado assim se ninguém trocar; o e-mail padrão é o do suporte da empresa. **Achado.** **Conferido.**
- **Garantia = meses × 30 dias** (12 meses = 360 dias, não um ano de calendário). **Conferido.**
- **Transferir não exige nada:** nem checklist completo, nem Termo assinado, nem DataBook; só o `confirm`. Não há como desfazer pela tela. **Achado.** **Conferido.**
- **O nome do cliente é digitado à mão** (obrigatório) mesmo existindo `client_name` no Dossiê. **Conferido.**
- **Aviso do evento vai para o departamento errado:** `HANDOVER_CONCLUIDO` é Engenharia no banco, mas `POS_VENDA_ATIVADO` cai em "Comercial" (PC-7). **Conferido.**
- A lista carrega tudo de uma vez: hoje 68 linhas, e o PostgREST corta em 1 000. **Conferido.**

### 10.3.9 Testes
A parte pura (`getProgressoChecklist`, `tempoRestanteGarantia`, `estaEmGarantia`) **não tem teste**; a rota entra no teste de fumaça (**não rodei**). **Cenários (sem teste):** *Dado* um Dossiê sem handover, *quando* registro com 12 meses, *então* nasce a garantia com fim em 360 dias e o evento `HANDOVER_CONCLUIDO`. *Dado* um handover com 4 de 8 itens marcados, *então* o checklist mostra 50%. *Dado* um Dossiê sem DataBook anexado, *então* "Data Book assinado" não pode ser marcado.

### 10.3.10 Pendências e decisões
**Decisão do Gelson:** (a) o Handover deve exigir Termo assinado e/ou DataBook? (b) "Registrar" deve recusar quando já existe um handover? (c) o que a "transferência para a Escamax" deve fazer de fato (hoje só marca); (d) contar a garantia em meses de calendário; (e) quem pode registrar/transferir (alçada). Sem "?" nem tutorial (PC-10).

### 10.3.11 Histórico
Antes lia a tabela legada `projetos` (desconectada); passou a usar `dossier_obra` e a coluna `handover` (jsonb), no mesmo padrão da coluna `vistoria`. A URL por projeto veio da varredura de URLs de 09/10/2026 (`01_geral.md` PC-9). **Herdado.**

---

## 10.4 Repositório Documentos

### 10.4.1 O que é
Um **repositório simples de arquivos soltos**: a Engenharia sobe **qualquer documento** que ache necessário guardar, sem ligar a obra, cliente ou cotação, e depois abre ou exclui. É uma tela **nova e independente** das outras três do grupo. **Conferido** em `repositorio-documentos.jsx` (186 linhas) e `repositorio-documentos-store.js` (78).

**Fora do escopo:** documento de uma obra (Central, 10.1, e a aba Documentos do Dossiê, 9.1); projeto/desenho para enviar ao cliente (8.1, Projeto de Elevadores › Desenhos); contrato social do cliente (4.6).

### 10.4.2 Rota e arquivos
Rota `repositorio-documentos`; URL `/engenharia/repositorio-documentos`. Arquivos `repositorio-documentos.jsx` (`window.RepositorioDocumentosPage`) e `repositorio-documentos-store.js` (`window.RepositorioDocumentosStore`). Arquivo no bucket `engenharia`, caminho `repositorio-documentos/{hora}_{id8}_{nome}` (nome com caracteres fora de `[\w.-]` trocados por `_`). Migração `20261028180000_repositorio_documentos.sql`. **Conferido.**

### 10.4.3 Perfil e acesso
Alçada `repositorio-documentos` (ver, criar, editar, excluir; **1 pessoa** tem cada uma, 01/11/2026). A tela lê `criar` e `excluir` (esconde os botões; **enquanto a consulta não responde os botões aparecem**). O **banco confere de novo**: a tabela é **fechada** (só `authenticated`, usuário ativo e a alçada: `ver` para ler, `criar` para inserir, `excluir` para o soft-delete). Quem não tem `ver` não consegue listar e vê o aviso "Não foi possível carregar os documentos". No catálogo de alçadas o módulo aparece no grupo **Engenharia**, não em "Entrega & Documentação" (o mapa de grupos do menu o inclui nos dois). **Conferido.**

### 10.4.4 O que a tela mostra
"ENTREGA & DOCUMENTAÇÃO" / **Repositório Documentos**, com a orientação das três outras "casas" (PC-4). Busca ("Buscar por título, descrição ou arquivo…") e tabela **Documento** (título e descrição) · **Arquivo** · **Tamanho** · **Enviado por** · **Data**. Sem registros: "Nenhum documento salvo ainda. Clique em 'Enviar documento'."; com busca sem resultado: "Nenhum resultado para a busca."

### 10.4.5 Botões e controles
**Atualizar**; **+ Enviar documento** (modal: arquivo*, máx. 25 MB, qualquer tipo; título opcional — usa o nome do arquivo; descrição opcional); **Abrir** (link do arquivo); **🗑** (modal "Excluir documento?" → "Sim, excluir"). **Conferido.**

### 10.4.6 Comportamento
Lista até **1 000** registros não excluídos, do mais novo ao mais velho. A busca ignora acento e maiúscula e olha título, descrição, nome do arquivo e quem enviou. Enviar: sobe o arquivo, grava a linha e registra "Salvou documento" em `vp_logs`; **se a gravação falha, o arquivo é removido do Storage** (sem órfão). Excluir: **soft-delete** (`excluido_em`/`excluido_por`), exige que a linha realmente mude (0 linhas = erro) e registra "Excluiu documento". **Conferido.**

### 10.4.7 Dados
`repositorio_documentos` (**0 linhas** em 01/11/2026; colunas `titulo`, `descricao`, `arquivo_nome`, `arquivo_path`, `arquivo_url`, `tamanho_bytes`, `enviado_por_email/nome`, `criado_em`, `excluido_em/por`); bucket `engenharia` (público); `vp_logs`. **Conferido.**

### 10.4.8 Regras e armadilhas
- **A URL é pública:** o bucket `engenharia` é público e o link do arquivo abre sem login. **Excluir só tira da lista**: o arquivo fica no Storage e quem já tem o link continua abrindo (a tela diz que o arquivo fica "guardado para recuperação pelo suporte"). **Conferido.**
- **Sem vínculo, sem categoria e sem versão:** nada liga o arquivo a obra, cliente ou cotação, e não há tipo; subir de novo cria outra linha. É o desenho pedido (tela de arquivos soltos). **Conferido.**
- **As quatro "casas" não se falam:** o mesmo papel (por exemplo, um manual) pode estar aqui, na Central e no Dossiê sem que uma tela saiba da outra (PC-4). **Conferido.**
- **Caminho do topo diz "Engenharia":** o `BREADCRUMB_MAP` põe a tela no módulo "Engenharia", enquanto o menu a lista em "Entrega & Documentação". **Achado.** **Conferido** (`shell.jsx`).
- **Lição registrada (Herdado):** em 28/10/2026 as três telas antigas do grupo foram **fundidas por engano** em uma só e depois **desfeitas** a pedido do Gelson; as três são telas diferentes e independentes. **Não consolide Central, Data Book & Termo e Entrega Final sem pedido explícito e sem perguntar o propósito.**

### 10.4.9 Testes
Nenhum teste de unidade; a rota entra no teste de fumaça (**não rodei**). **Cenário (sem teste):** *Dado* um PDF de 2 MB, *quando* envio com título, *então* aparece na lista com tamanho "2.0 MB" e "Enviado por" o meu nome; *quando* excluo, *então* some da lista e o arquivo continua no Storage.

### 10.4.10 Pendências e decisões
**Decisão do Gelson:** se o Repositório deve ganhar categoria ou vínculo opcional a obra; ajustar o caminho do topo e o grupo no catálogo de alçadas; sem "?" nem tutorial (PC-10).

### 10.4.11 Histórico
Criado em 28/10/2026 como 4ª tela do grupo, depois da correção de uma fusão indevida das três anteriores. Mesmo padrão de Contratos Social (4.6): arquivo no bucket, metadados em tabela, exclusão suave. **Herdado.**

---

## Parte comum de Entrega & Documentação

### PC-1 Mapa de ligações
- **Entra:** Dossiê da Obra (9.1) → a lista de documentos que a Central lê e o painel do Termo; Contrato Instalador e Homologação de Instaladores (grupo RH Operacional) → documentos do montador na Central; Cadastros de empresas instaladoras → `parceiros_*`; ART (9.6) e DataBook anexados → eventos `ART_EMITIDA` / `DATABOOK_MONTADO`.
- **Sai:** Termo assinado → documento no Dossiê (checklist ✓); Handover → evento `HANDOVER_CONCLUIDO` e `POS_VENDA_ATIVADO` → motor de Gatilhos (1.4); o Dossiê mostra o cartão do Handover.

### PC-2 A entrega de ponta a ponta
Instalação concluída → **ART** (9.6) → **DataBook** (anexo no Dossiê) → **Termo de Entrega** (gerar link → cliente assina → PDF nos documentos) → **Handover** (registrar, checklist, garantia) → **Transferir para a Escamax** (pós-venda). O status do Dossiê (DataBook → Entregue → Manutenção preventiva) é **manual** (9.1). O motor de Gatilhos encadeia os seis eventos nessa ordem (PC-7), mas **o sistema não impõe a ordem**: dá para registrar Handover sem Termo, ou gerar Termo sem DataBook. Na prática, hoje a sequência acontece **fora do site** e as telas pouco são usadas (10.3.8). **Herdado** (CLAUDE.md), conferido no código.

### PC-3 Rotas, página pública e arquivos
- **Quatro rotas com item de menu**, todas sob `/engenharia/…` (o prefixo vem do grupo "Entrega & Documentação" em `router.js`): `central-documentos`, `databook`, `handover`, `repositorio-documentos`. **Conferido** (`docs/MAPA_DE_ROTAS.md`).
- **Página pública sem item de menu:** `/termo-entrega/<token>` (`termo-entrega.html`), na lista `PAGINAS_PUBLICAS` do teste de fumaça. **Conferido.**
- **Arquivo misto:** `entrega.jsx` guarda `DataBookPage` (10.2) e `CronogramaPage` (11).

### PC-4 Onde guardar cada documento (as quatro "casas")
| Casa | Para quê | Tela |
|---|---|---|
| **Aba Documentos do Dossiê** | Anexar o arquivo **de uma obra** (ART, DataBook, Termos, Alvará…) | 9.1 |
| **Central de Documentos** | **Ver** tudo de uma obra (e a documentação do montador); anexar leva ao Dossiê | 10.1 |
| **Repositório Documentos** | Arquivo **solto**, sem obra | 10.4 |
| **Projeto de Elevadores › Desenhos** | Projeto/desenho **para enviar ao cliente** (com assinatura do Projeto de Instalação) | 8.1 |
Quem anexa o arquivo de uma obra faz **sempre** no Dossiê; a Central e o Data Book só apontam para lá. **Conferido** nos textos das telas.

### PC-5 Garantia e pós-venda (Escamax)
- A garantia é um **prazo registrado** (meses × 30 dias) no Handover; **não há aviso de fim de garantia** nem tela de chamados. **Conferido.**
- "Pós-venda" no site é o evento `POS_VENDA_ATIVADO` e o sinalizador `escamax_transferido`. A Escamax aparece, no restante do sistema, na ART por obra (9.6, onde o Gustavo é da Escamax) e como tipo de recebedor de comissão (5.5). **Não há integração** com um sistema da Escamax: **Conferido** (nenhuma chamada externa no código do Handover).
- Se a manutenção preventiva um dia ganhar tela ou sistema próprio, o Handover é o ponto de partida. **Decisão do Gelson** (10.3.10).

### PC-6 Identidade, alçadas e segurança
- **Estado real das políticas (Conferido em `pg_policies`, 01/11/2026):** `dossier_documentos` — **ler, inserir e atualizar abertos ao público** (sem DELETE): quem tem a chave pública pode trocar o tipo ou o endereço do arquivo de um documento. `dossier_obra` — idem (9 PC-6). `repositorio_documentos` — **fechada**: só `authenticated`, usuário ativo e alçada. Bucket `engenharia` — **público**. RPCs `public_termo_*` — `SECURITY DEFINER`, executáveis por `anon` (a página pública não tem login). Políticas de `parceiros_*`: **Não verificado** (são do 11).
- **Alçadas:** as telas leem só `central-documentos.editar` (**ninguém** a tem, só Administrador) e `repositorio-documentos.criar/excluir`. Não são lidos: `ver` de nenhuma das quatro, `databook.*`, `handover.*` (esses dois têm concessões que não valem para nada). O e-mail do usuário vem do navegador (Art. 25): trava na tela é organização, não segurança.
- A segurança do Termo é o **token** do link e a RPC, que decide quem assinou e se está completo.

### PC-7 Gatilhos, eventos, crons e funções
- **Banco (Conferido em `pg_trigger`):** **nenhum gatilho** em `dossier_documentos` nem em `repositorio_documentos`. **Nenhum cron** toca estas telas.
- **Eventos** (nós do motor `gatilhos-engine.js`, todos de fechamento automático e encadeados): `ART_EMITIDA` → `DATABOOK_MONTADO` → `TERMO_PREPARADO` → `TERMO_ASSINADO` → `HANDOVER_CONCLUIDO` → `POS_VENDA_ATIVADO`. Quem emite: anexar ART/DataBook (`dossier-store.js`), gerar o link (`TERMO_PREPARADO`), Registrar e Transferir (10.3); **`TERMO_ASSINADO` não é emitido** pelo caminho da RPC (10.2.8). **0 eventos** desses seis em `eventos_fluxo` em 01/11/2026, apesar de 41 ART e 19 DataBook anexados (anexos anteriores ao evento ou carga legada — **Não verificado** o motivo).
- **Avisos ao departamento errado (Conferido):** a função `_evt_modulo_etapa` (avisos do hub) lista a chave **`DATA_BOOK_MONTADO`**, que **não existe** no motor (a chave é `DATABOOK_MONTADO`); por isso `DATABOOK_MONTADO` e também **`POS_VENDA_ATIVADO`** caem no ramo "Comercial". `HANDOVER_CONCLUIDO`, `ART_EMITIDA` e `TERMO_*` vão para "Engenharia". **Achado, sem correção.**
- **Funções:** `public_termo_obter`, `public_termo_assinar`, `public_termo_registrar_pdf`, `_po_termo_resumo`. Nenhuma Edge Function é deste módulo.

### PC-8 Tabelas
`dossier_obra` (68; colunas `handover`, `termo_entrega_token`, `termo_entrega`, `doc_instalador_enviado_em/por`), `dossier_documentos` (76), `repositorio_documentos` (0), `parceiros_instaladores` (31), `parceiros_colaboradores` (63), `parceiros_documentos_colaborador` (520), `parceiros_doc_catalogo` (87), `eventos_fluxo` (eventos do fluxo). Contagens **Conferidas** por `count(*)` em 01/11/2026. **Realtime:** nenhum nestas telas.

### PC-9 Navegação, cache e testes
Regras de URL, `?v=` e testes: `01_geral.md` PC-9. Específico: a Central guarda a obra escolhida na URL (nome do cliente, passthrough); a Entrega Final guarda o projeto aberto na URL (`useRotaId`); **nenhuma das quatro tem abas**; o Data Book e o Repositório não guardam nada na URL. `node scripts/check-cache-bust.js origin/main`: **ok** em 01/11/2026. `npm test`: **931 passaram, 0 falharam**. e2e: **não rodei**. **Não testei nada com clique real no navegador.** Testes que tocam o módulo: só os 5 do Termo (10.2.9).

### PC-10 Menu "?" e tutoriais
**Nenhuma** das quatro telas tem texto no "?" (`HELP_TOPICS`) nem tutorial (não há pasta de Entrega & Documentação em `TreinamentoVP/`). O Copiloto tem texto embutido para `central-documentos`, `databook` e `handover` em `vp-copiloto/index.ts` (e **não** tem para `repositorio-documentos`); a tabela `vp_copiloto_docs` não tem linha de nenhuma das quatro. O texto do Copiloto sobre a Central cita "Vistoria", que **não existe** na tela. **Conferido.** Tutorial não se edita à mão: pedir à sessão de tutoriais.

### PC-11 Documentos soltos e destino do que foi concatenado
| Arquivo / seção | O que é | Destino |
|---|---|---|
| `CLAUDE.md` — "Entrega & Documentação — 'Repositório Documentos' é tela NOVA, independente das outras 3" | 10.4 e a lição de não consolidar | **Concatenado em 10.4 e PC-4** |
| `CLAUDE.md` — "Cronograma de Pagamento da Instalação — reposicionado no menu" | Menu do 11 (o código mora em `entrega.jsx`) | **Apontado** ao 11 |
| `CLAUDE.md` — "Varredura de URLs" | Mista | Trecho de Entrega Final/Central em 10.1.2 e 10.3.2; o resto em `01_geral.md` PC-9 |
| `CLAUDE.md` — "Engenharia › Projeto de Elevadores — aba Desenhos" | Desenhos para o cliente | **Apontado** ao 8.1 (PC-4 compara) |
| `CLAUDE.md` — "Comercial \| Pré-venda › Contratos Social" | Repositório de PDF por cliente | **Apontado** ao 4.6 (padrão que o 10.4 copia) |
| `AUDITORIA_FORENSE_E2E_SCORE.md` (raiz) | Auditoria de 11/10/2026 | Achados que tocam este módulo (E2E-019, E2E-027, E2E-034) **incorporados com selo** em 10.2.8 e PC-7; o arquivo fica onde está |
| `README.md` | Visão de produto (fase "A entrega", glossário de Handover) | **Histórico**; não mexido |
| `docs/MAPA_DE_ROTAS.md` | Gerado | Fonte das URLs (Conferido) |
| `docs/seguranca/matriz-acesso-rls.md` | Matriz de RLS | Do módulo 15; PC-6 traz o estado destas tabelas |
Nenhum arquivo foi apagado. Nada neste módulo parece obsoleto a ponto de pedir decisão de remoção. Não existe spec em `docs/superpowers/specs/` específica deste módulo.

### PC-12 Benefícios trocados com os outros módulos

- **Recebido de Quadros de Comando (04/11/2026, texto em `14_quadros_comando.md` PC-12, Art. 49):** (a) o Omie repete a linha do item com **quantidade 0** — somar por código e ignorar o zero antes de contar linhas ou unidades; (b) **metro e peça nunca se somam** — total por unidade de medida; (c) a caixa de uma tabela longa deve ter a **altura da janela**, para a barra de rolagem lateral ficar à vista; (d) função de banco nova se testa **numa transação que se desfaz**, incluindo um usuário ativo **sem** a alçada (a recusa por "sem sessão" não prova a trava de alçada); (e) a **observação do item** do pedido do Omie (`pcp_pedido_itens.obs_item`) guarda o que a proposta mostra dentro do item. **Conferido** (04/11/2026).
- **Recebido:** o selo de verificação e "achado, sem correção" (de todos); a conferência de **política aberta** e de **alçada declarada e nunca lida** (de 8 e 9); "rótulo do menu ≠ nome do arquivo" (de 7, 8 e 9: aqui `DataBookPage` mora em `entrega.jsx`); a regra de **teste de paridade** (do 9) para a lista de chaves de evento (abaixo).
- **Doado** (texto completo aqui; os outros apontam): (1) **página pública passada para RPC precisa levar junto os efeitos que rodavam no navegador** — o Termo foi migrado sem a fila `fluxo_pendentes` e perdeu o evento `TERMO_ASSINADO` (10.2.8); a Proposta e os Contratos fizeram certo (1.4); (2) **lista de chaves de evento copiada no SQL deve ser conferida contra o motor** — `DATA_BOOK_MONTADO` × `DATABOOK_MONTADO` manda aviso ao departamento errado (PC-7); vale um teste que compare as duas listas; (3) **conferir o uso real antes de documentar "como funciona"** — 0 handovers, 0 termos digitais e 0 documentos no repositório mostram um fluxo digital que ninguém usa; (4) **botão que "cria" não deve poder ser disparado de novo sobre um registro que já existe** — Registrar Handover regrava tudo (10.3.8); (5) **ação de topo de tela sem seleção deve avisar**, não calar (10.3.8); (6) **texto de exemplo gravado como dado** (contato `+55 11 xxxx-xxxx`) — campo com exemplo deve usar *placeholder*, não valor inicial. Registrado nos documentos 1 a 9.
- **Recebido de Parceiros & Instaladores (01/11/2026, texto em `11_parceiros_instaladores.md` PC-12):** a Central de Documentos (10.1) lê `parceiros_documentos_colaborador.status` para dizer "Disponível/Pendente" do montador, e esse status é gravado no salvamento e **nunca recalculado** (8 documentos `VALIDO` com vencimento passado em 01/11/2026, 11.2.8); o que a Central mostra herda o atraso. O cronograma de pagamento (11.5) mora em `entrega.jsx` junto com o Data Book. **Conferido**, 01/11/2026.
- **Recebido de Logística Interna (01/11/2026, texto em `12_logistica_interna.md` PC-12):** a Expedição guarda o canhoto em **bucket privado** com URL assinada de 1 h (12.2.7); padrão a considerar para documento sensível do 10. **Conferido** no código, 01/11/2026.
- **Recebido de Fabricação (01/11/2026, texto em `13_fabricacao.md` PC-12):** nada específico de Entrega & Documentação; vale o bloco do `01_geral.md`.
- **Recebido de Administração (01/11/2026, texto em `15_administracao.md` PC-12):** a lista de buckets em Configurações (6) está desatualizada frente aos 11 reais; `expedicao-comprovantes` e `parceiros-instaladores-anexos` não aparecem. **Conferido.**
- **Recebido de Serviços (01/11/2026, texto em `16_servicos.md` PC-2):** todo alerta com destinatário também vira WhatsApp pelo gi-avisos; para chegar certo, título curto com o essencial na frente, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos. O Copiloto em uso é o da VPS e **não lê** `vp_copiloto_docs`: o "ajuste por UPDATE sem redeploy" citado neste documento só valia para a Edge Function antiga `vp-copiloto`, removida em 01/11/2026 (`16_servicos.md` S3.5, divergência D1). **Conferido.**
