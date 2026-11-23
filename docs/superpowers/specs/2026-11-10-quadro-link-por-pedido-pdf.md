# Link do formulário do Quadro por pedido de venda + PDF das respostas

> **Status:** aprovada pelo Gelson (10/11/2026) e implementada no código local (migration ainda NÃO aplicada; nada commitado). Lugar definitivo depois de aprovado: `docs/modulos/14_quadros_comando.md` (Art. 38). Selo: **Não verificado** onde não está escrito "Conferido".

## 1. Specify

**Objetivo (palavras do Gelson):** enviar o link ao cliente; quando ele responde, o conteúdo vira um **PDF anexado ao número do pedido de venda**; as respostas ficam visíveis **dentro do HUB**; o PDF pode ser **baixado** e anexado **à mão** no Omie.

**Requisitos**
- FR01. No pedido de venda do Omie (`pcp_pedidos`) o usuário gera um **link único** do formulário público do Quadro de Comando, amarrado ao pedido.
- FR02. O cliente abre o link sem login e preenche o **formulário público existente** (7 passos). Ao enviar, as respostas ficam gravadas **no pedido**; **não cria Lead**.
- FR03. No hub, a tela do pedido mostra o estado do link (aguardando / respondido, data) e as **respostas legíveis**.
- FR04. Botão **Baixar PDF** gera o PDF das respostas, com o nº do pedido do Omie e o cliente.
- FR05. Aviso na Central de Notificações quando o cliente responde.
- FR06. O usuário pode **corrigir** uma resposta no hub; o PDF reflete a correção.
- FR07. Link pode ser cancelado e substituído por outro.

**Regras**
- R1. **Omie 100% manual:** nenhuma escrita no Omie (Art. 30). Só leitura do pedido que já está em `pcp_pedidos`.
- R2. Um pedido do Omie pode ter mais de um registro (`codigo_pedido`); o link guarda o `codigo_pedido` **e** o `numero_pedido`.
- R3. Tabela nova nasce **fechada** (Art. 26): o cliente fala só por RPC com o token; o hub lê por usuário ativo com alçada.

**Fora do escopo**
- Integração automática com o Omie (fase futura, já prevista no módulo 14).
- Religar o card "Quadro de Comando" do hub Formulários (continua ilhado).
- Mudar o link público sem token e a função `capturar-lead-quadro-comando` (que ainda cria Lead; decisão pendente do módulo 14).
- BOM, lista de corte e cruzamento com estoque (são do formulário interno).

**Cenários de aceitação**
- Dado um pedido 30570, Quando gero o link e o cliente envia, Então o pedido mostra "Respondido" com as respostas e nenhum Lead novo existe.
- Dado um link já respondido, Quando o cliente reabre, Então vê "já recebido" e não reenvia (a menos que eu cancele e gere outro).
- Dado um token inválido ou cancelado, Então a página mostra erro sem vazar dados.
- Dado respostas gravadas, Quando clico em Baixar PDF, Então baixa um PDF com o nº do pedido e todos os campos respondidos.

## 2. Clarify (respondido em 10/11/2026)
1. Formulário: o **público existente**. 2. Origem: **pedido de venda do Omie**. 3. Depois da resposta: **gerar PDF e anexar ao pedido**. 4. Omie: **manual**.

## 3. Plan
- **Banco (migration, exige "Confirmo" — Art. 14/31):** tabela `qc_pedido_formularios` (id, `token` único, `codigo_pedido`, `numero_pedido`, `status` aguardando|respondido|cancelado, `respostas` jsonb, `respondido_em`, `corrigido_por/em`, `criado_por/em`). RLS fechada. RPCs `SECURITY DEFINER`: `public_qcf_obter(token)` e `public_qcf_responder(token, respostas)` (anon, só o próprio token, valida tamanho e status; uma resposta por link); `qc_formulario_gerar(codigo_pedido)`, `qc_formulario_cancelar(id)` e `qc_formulario_corrigir(id, respostas)` (só `authenticated` ativo com alçada). Gatilho grava o aviso em `alertas` quando vira "respondido" (padrão de `trg_pcp_pedido_avisar_separacao`: só insere, falha engolida). Revogar EXECUTE dos helpers internos (lição do Distrato).
- **Página pública:** `formulario-quadro-comando-publico.jsx` ganha o **modo token** (`?t=<token>`): lê o pedido pela RPC, mostra "Pedido Omie N", e no envio chama `public_qcf_responder` em vez da Edge Function. **Sem token, nada muda** (compatibilidade). O catálogo de portas/máquina continua pela Edge Function existente (`acao: 'catalogo'`), que **não é alterada**.
- **Hub:** botão **Link do cliente** + estado + **Ver respostas** + **Baixar PDF** + **Corrigir**, na tela do pedido. Lugar proposto: 14.1 Pedidos com Quadro (**a confirmar**, ver Analyze).
- **PDF:** novo bundle `pdf-bundle/qc-respostas-reactpdf.entry.js` (`npm run build:pdf:qc`, entra no `build`; bundle versionado), gerado **na hora** a partir de `respostas` (sempre reflete a correção). Lógica de mapeamento rótulo→valor em arquivo puro `qc-respostas-calc.js` (Art. 20) com teste.
- **Documentos (Art. 52):** `14_quadros_comando.md` (14.1 e PC-3/PC-8), `04_comercial_pre_venda.md` (nota do formulário público), `npm run rag`, ajuda do "?" pelo fluxo de tutoriais. Cache-busting `?v=` nos arquivos tocados.

## 4. Tasks
- T001 Teste + `qc-respostas-calc.js` (mapeia respostas do formulário para linhas legíveis).
- T002 Migration + testes SQL em transação desfeita (token inválido, cancelado, reenvio, anon sem acesso à tabela). **Aguarda "Confirmo".**
- T003 Modo token na página pública.
- T004 Bundle do PDF + botão Baixar.
- T005 Tela no hub (gerar/copiar link, estado, respostas, corrigir, cancelar).
- T006 Aviso ao responder.
- T007 e2e: página pública com token inválido; `npm test`, `check-cache-bust`, lint, build, rag.
- T008 Documentos do módulo.

## 5. Analyze — pontos que preciso que o Gelson decida antes de implementar
1. **Onde fica o botão?** Em **14.1 Pedidos com Quadro** (módulo do quadro, minha recomendação) ou em **PCP › Pedidos para Produzir**.
2. **Quem pode gerar o link e corrigir resposta?** Proposta: nova ação `quadros-comando.link_cliente` na alçada (Administrador passa sempre); Gelson concede a quem quiser.
3. **PDF na hora ou guardado?** Recomendo **na hora** (sempre atual). Guardado no Storage daria um arquivo fixo "anexado" ao pedido, mas ficaria desatualizado se alguém corrigir a resposta.
4. **Link sem token:** continua criando Lead (decisão pendente do módulo 14). Esta spec não mexe nele.
5. **Risco:** o formulário público é de levantamento técnico (campos do Quadro). Ele **não substitui** a lista de itens do pedido do Omie; o PDF mostra o que o cliente respondeu, não o pedido.
