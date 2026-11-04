# 15 Administração — documento do módulo (REAL, fonte da verdade — 01/11/2026)

> **Status: REAL (documento oficial do módulo 15), aprovado pelo Gelson em 01/11/2026**, no molde de `01_geral.md` a `14_quadros_comando.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é onde se vê **quem pode o quê**, **o que cada pessoa fez** e **como o sistema fala com o mundo** (Omie, e-mail, WhatsApp, Supabase). Quatro coisas pedem atenção: (1) a segurança real (issue #571) está **só começada**: o app já manda o token da pessoa ao banco, mas **198 de 278 tabelas** ainda têm política para a chave pública (PC-4); (2) a tela "Configurações do Sistema" mistura **dado real** (Administração, Usuários) com **texto fixo no código que parece dado** (Permissões, Parâmetros, Integrações, Buckets) — um leitor pode achar que está vendo configuração viva (15.2.8); (3) o **log de atividades** (`vp_logs`) é legível e **gravável pela chave pública**; (4) há **uma função em produção sem pasta no repositório** (PC-6).
>
> **Fonte da verdade:** o código e o banco, conferidos em 01/11/2026 (`origin/main` `c0d5db5`). **Conferido** = lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** = veio do `CLAUDE.md`, de spec/plano ou do documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui confirmar. Sem selo vale como Não verificado (Art. 6).
>
> **Escopo do módulo:** as **duas** telas do grupo "Administração" do menu (`NAV_GROUPS` em `shell.jsx`, ambas `restrict: ["admin"]`): **Logs de Atividade** e **Configurações do Sistema** (seis abas). Pertencem ao módulo, sem tela própria: a **segurança real (#571)**, as **alçadas** (a grade vive no vpsistema), o **inventário de Edge Functions, crons e buckets** e as **integrações** (Omie, e-mail, WhatsApp, Supabase). **Não** são deste módulo: o **uso** das alçadas em cada tela (cada módulo declara as suas); a central de avisos (1.2); o motor de etapas (1, PC-2); os **serviços transversais** WhatsApp, gi-avisos e Copiloto VP, que têm documento próprio em `docs/modulos/16_servicos.md` (Central de Avisos), depois dos 15 módulos (ver `CLAUDE.md`).
>
> **Já documentado em outro lugar (não se repete, aponta):** identidade, modo do `vp-auth.js` e a fila de efeitos da assinatura em `01_geral.md` PC-3 e PC-6; `vp_logs` como API em `01_geral.md` PC-5; governança, departamentos e trilha de auditoria em `01_geral.md` PC-12; regras do e-mail (`send-email`, `read-inbox`) em `01_geral.md` 1.5.

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **15**; telas filhas = **15.1 e 15.2**, na ordem do menu; o conteúdo comum fica na **Parte comum**, sem número de tela.
- **Tudo o que é aba de uma tela pertence a ela.** As seis abas de Configurações estão no 15.2.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
15. **Administração**
   15.1 Logs de Atividade · 15.2 Configurações do Sistema (Administração, Usuários & Perfis, Permissões (RLS), Parâmetros, Integrações, Buckets Storage)
   &nbsp;&nbsp;&nbsp;Cada tela tem os temas: x.1 O que é · x.2 Rota e arquivos · x.3 Perfil e acesso · x.4 O que a tela mostra · x.5 Botões e controles · x.6 Comportamento · x.7 Dados (lê/grava) · x.8 Regras e armadilhas · x.9 Testes · x.10 Pendências e decisões · x.11 Histórico
   Parte comum de Administração (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 Pessoas, perfis e alçadas de ponta a ponta · PC-3 Rotas, páginas públicas e arquivos · PC-4 Segurança real (#571): onde estamos · PC-5 Quem faz o quê · PC-6 Edge Functions: inventário e regras de deploy · PC-7 Crons, buckets e integrações · PC-8 Tabelas · PC-9 Navegação, cache, CI e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
(Fim dos 15 módulos. Depois: serviços transversais em `docs/modulos/16_servicos.md` (Central de Avisos), ver `CLAUDE.md`.)

## Glossário (módulo Administração)
Termos gerais (alçada, soft-delete, evento de fluxo) estão em `01_geral.md`. Não se repetem aqui.
- **Perfil (`perfis`):** a pessoa no VP Gestão: e-mail, nome, **nível** (Administrador, Gestor, Colaborador), departamento, ativo. Fonte da identidade usada pelas funções de autorização do banco.
- **Colaborador do vpsistema (`colaboradores_vpsistema`):** cópia do cadastro de pessoas do vpsistema.com (departamento, cargo, líder), alimentada pela função `vpsistema-sync`.
- **Alçada (`alcadas_capacidade`):** par módulo + capacidade concedido a um perfil; **quem concede é o vpsistema.com/administracao**, o VP Gestão só lê.
- **Modo de autenticação (`vp-auth.js`):** `off`, `shadow` ou `on`; hoje decidido pelo banco (`vp_auth_piloto`) e, com o coringa, **todos em `on`**.
- **Coringa (`*`):** linha de `vp_auth_piloto` que liga o modo `on` para todo usuário com sessão nativa.
- **Fechar uma tabela:** trocar as políticas abertas à chave pública por políticas para usuário ativo (`vp_fechar_tabela`), com cópia das antigas em `vp_policy_backup` e caminho de volta (`vp_reabrir_tabela`).
- **Chave pública (anon):** a chave do app que vai no navegador; com política aberta, quem a tem lê e altera.
- **Break-glass:** acesso de emergência à API de gerenciamento do Supabase; está **desligado de propósito** e não se contorna.
- **`verify_jwt`:** configuração da Edge Function que exige token no cabeçalho; `false` só onde o chamador não é o navegador autenticado.

---

## 15.1 Logs de Atividade

### 15.1.1 O que é
O registro central de auditoria: **quem** fez, **o quê**, **onde** (módulo), em qual **alvo** (documento) e **quando**. Lê a tabela `vp_logs`. **Conferido** em `logs-admin.jsx` (146 linhas) e `vp-log.js` (84).

**Fora do escopo:** a trilha do fluxo operacional por cotação (`eventos_fluxo`, 1, PC-2) e a central de avisos (1.2); a cobertura de cada módulo (cada um chama `VPLog.registrar`, ver 1, PC-5).

### 15.1.2 Rota e arquivos
Rota `logs`; URL `/admin/logs`. Componente `LogsAdminPage` (`logs-admin.jsx`); gravação e leitura por `window.VPLog` (`vp-log.js`). **Conferido** (`app.jsx` liga `case "logs"`).

### 15.1.3 Perfil e acesso
Item de menu com `restrict: ["admin"]`: só o perfil Admin vê o item. **Não verificado** se digitar a URL por outro perfil bloqueia a tela; **o dado em si não tem trava no banco** (15.1.8). Não há alçada própria para esta tela.

### 15.1.4 O que a tela mostra
Tabela com ator (e setor, com cor por setor), módulo (com ícone), ação, alvo e dia/hora; filtros de módulo, busca e período (até 300 linhas por consulta). **Conferido.**

### 15.1.5 Botões e controles
Filtros e busca; "Todos" nos módulos. Sem ação de gravar, editar ou excluir. **Conferido** (leitura).

### 15.1.6 Comportamento
`VPLog.registrar` é **best-effort**: nunca quebra o fluxo; falha só vira `console.warn`; sem `acao` não grava. `listar` filtra por módulo (igualdade), período e busca (`ilike` em ator, ação e alvo, com `%`, `,`, `(`, `)` tirados da busca); falha de leitura devolve lista vazia sem aviso. **Conferido.**

### 15.1.7 Dados
**Lê:** `vp_logs` (**3.078 linhas** em 01/11/2026). **Grava** (por todos os módulos): `vp_logs` via `VPLog.registrar` (colunas `ator_nome`, `ator_setor`, `modulo`, `acao`, `alvo`, `alvo_id`, `detalhe`). **Conferido** (`count(*)` e código).

### 15.1.8 Regras e armadilhas
- **O log é legível e gravável por quem tem a chave pública (achado, sem correção):** `vp_logs` tem política de **INSERT e SELECT** para `anon` e para `authenticated`; **não há UPDATE nem DELETE** (o log não se altera pela API, **Conferido** em `pg_policies`). Efeito: qualquer um com a chave **lê toda a auditoria** e pode **inserir linhas falsas** com qualquer ator. A lista da tela só vale como prova com essa ressalva.
- **Falha de leitura vira "vazio" sem aviso** (Art. 9): `listar` e `modulos` ignoram erro. **Conferido.**
- **A busca por módulo carrega só as primeiras 1.000 linhas** para montar a lista de módulos (`select modulo ... limit 1000`): módulo que só aparece em logs antigos pode faltar no filtro. **Conferido** (leitura do código).
- **Nunca gravar dado sensível no `detalhe`** (salário, telefone, e-mail de terceiros): regra de 1, PC-5; vale aqui porque a tabela é legível pela chave pública. **Herdado.**
- **O ator é o e-mail do navegador** (não verificável, Art. 25): a trilha mostra quem a tela disse que era. **Herdado.**

### 15.1.9 Testes
`vp-log.test.js` cobre o registro. **Não existe** teste da tela de Logs nem do filtro (**Conferido**, listagem). A rota entra no teste de fumaça. Cenário: **Dado** um módulo que chama `registrar`, **quando** a pessoa abre Logs filtrando por esse módulo, **então** a linha aparece com ator, ação e hora.

### 15.1.10 Pendências e decisões
- **Achado, sem correção:** `vp_logs` legível e gravável pela chave pública (15.1.8). Fechar exige decisão: log de auditoria só gravável pelo servidor e legível pelo Administrador.
- Cobertura incompleta: Cadastros, Embarques, Vistorias e Instalação podem estar sem log (varredura nunca feita). **Herdado** (1, PC-5).
- Sem retenção definida: a tabela só cresce. **Não verificado.**

### 15.1.11 Histórico
Criada com o Registro de atividades (set/2026); cobertura ampliada em 28/09/2026. **Herdado.**

---

## 15.2 Configurações do Sistema

### 15.2.1 O que é
A tela de administração do site, com **seis abas**: **Administração** (pessoas por departamento, só leitura), **Usuários & Perfis**, **Permissões (RLS)**, **Parâmetros**, **Integrações** e **Buckets Storage**. **Conferido** em `financeiro.jsx` (`ConfiguracoesPage`, linha 1287, e componentes `Config*`) e `colaboradores-admin.jsx` (292 linhas) + `colaboradores-admin-store.js` (419).

**Fora do escopo:** conceder alçada (vpsistema.com/administracao); o uso das alçadas em cada tela.

### 15.2.2 Rota e arquivos
Rota `configuracoes`; URL `/admin/configuracoes/<aba>` (a aba vai no 2º segmento e é regravada com `replace`; padrão `usuarios`). A aba Administração guarda o item no 3º segmento (`useRotaItem('configuracoes', 'administracao')`). **A tela mora em `financeiro.jsx`** (arquivo do Financeiro, 5), por razão histórica; o módulo dono é este. **Conferido.**

### 15.2.3 Perfil e acesso
Item de menu com `restrict: ["admin"]`. **Não verificado** se a página bloqueia outro perfil que abra a URL. Alocação de módulos por grupo do menu (`MODULOS_POR_GRUPO_SIDEBAR`) está em `colaboradores-admin-store.js` e filtra o menu. **Conferido** (código).

### 15.2.4 O que a tela mostra
- **Administração:** colaboradores por departamento (foto real, nome, cargo, líder) e as alçadas de cada pessoa. **Somente leitura** desde 09/10/2026; aviso na tela aponta o vpsistema.com/administracao. **Dado real** (`colaboradores_vpsistema`, 51; `alcadas_capacidade`, 1.834).
- **Usuários & Perfis:** lista de `usuarios` e convites pendentes. **Dado real** (tabela `usuarios`, 34 linhas; `convites`, 0).
- **Permissões (RLS):** a seção de alçadas de proposta e, abaixo, uma **matriz de referência** com perfis (Admin, Comercial Sr., Pleno, Engenharia, Jurídico, Financeiro, Instalação) × 11 módulos (`rwx`). A própria tela diz que é o **"modelo de acesso planejado"** e que o controle por linha **não** é gerido por ela. **Texto fixo no código.**
- **Parâmetros:** duas cartas (Financeiros: câmbio R$ 5,18, margem mínima 22%, margem padrão 32%, comissão 4%, ICMS SP 18%, II 14%; Operacionais: SLAs, tempo médio de importação 55 dias, validade e garantia). **Texto fixo no código, não é lido do banco nem gravável.**
- **Integrações:** sete cartões (AIS, IMAP cotações, IMAP compras, SMTP, assinatura digital, Omie, WhatsApp), **todos com selo "Não configurado"**, por texto fixo.
- **Buckets Storage:** tabela fixa de **6** buckets com "Público/Privado". **Conferido** (código).

### 15.2.5 Botões e controles
Troca de aba; em Usuários, convidar e revogar convite; nas demais, só leitura. A concessão de alçada **não** acontece aqui. **Conferido** (`ConfigUsers`: `revogar`, `showConvite`).

### 15.2.6 Comportamento
A aba é espelhada na URL com `replace` (não lota o histórico). A aba Administração agrupa pessoas pela árvore de departamentos do vpsistema; a foto vem do `avatar_url` com `referrerPolicy="no-referrer"`. **Conferido.**

### 15.2.7 Dados
**Lê:** `colaboradores_vpsistema` (51), `alcadas_capacidade` (1.834), `perfis` (49, **39 ativos**), `usuarios` (34), `convites` (0). **Grava:** `convites` (convidar/revogar). **As abas Permissões (matriz), Parâmetros, Integrações e Buckets não leem nem gravam nada.** **Conferido.**

### 15.2.8 Regras e armadilhas
- **Telas que parecem configuração e não são (achado, sem correção):** a matriz de **Permissões**, os **Parâmetros** (R$ 5,18, 22%, 32%, 4%, 18%, 14%…), as **Integrações** ("Não configurado" em tudo, inclusive Omie e e-mail, que estão em produção) e os **Buckets** são texto no código. Quem lê pode achar que o câmbio do sistema é 5,18 ou que o Omie está desligado. Os números reais moram em outros módulos (ex.: câmbio no motor de preço, 5; ICMS por regra, 5). **Conferido.**
- **A lista de buckets está desatualizada:** mostra 6; o projeto tem **11** (público: `engenharia`, `tratativas`, `vistorias-anexos`, `ImagensTutoriais`; privados: `cotacao-fornecedor-anexos`, `emails-anexos`, `expedicao-comprovantes`, `fichas-imagens`, `formulario-elevador-anexos`, `parceiros-instaladores-anexos`, `propostas-imagens`). Faltam na tela, entre outros, `vistorias-anexos` (público) e `parceiros-instaladores-anexos`. **Conferido** (consulta a `storage.buckets` e código).
- **A decisão D4 (só `ImagensTutoriais` público) não se cumpriu:** `engenharia`, `tratativas` e `vistorias-anexos` continuam **públicos** (`engenharia` guarda contratos sociais, projetos e canhotos antigos). **Conferido** em `storage.buckets`; decisão em `docs/seguranca/decisoes.md` (**Herdado**).
- **`colaboradores_vpsistema` e `usuarios` abertas à chave pública** (SELECT/INSERT/UPDATE); `convites` aceita INSERT/SELECT/UPDATE de `anon`; `perfis` e `alcadas_capacidade` têm SELECT para `anon`. Quem tem a chave lê e-mails, níveis, departamentos e alçadas de todos; `perfis.whatsapp_number` existe como coluna (se está preenchida: **Não verificado**). **Conferido** (`pg_policies`, colunas).
- **Duas listas de pessoas:** `perfis` (39 ativos), `usuarios` (34) e `colaboradores_vpsistema` (51) coexistem sem chave única entre si. **Conferido** (contagens).
- **A matriz de permissões da tela contradiz a realidade:** o controle real é por alçada (`alcadas_capacidade`) e a tela de Permissões nunca foi o lugar de editá-lo. **Herdado/Conferido.**

### 15.2.9 Testes
**Não existe** teste de unidade nem e2e das abas de Configurações (**Conferido**). A rota entra no teste de fumaça (que não clica nas abas). Cenário: **Dado** o Administrador, **quando** abre Configurações › Administração, **então** vê as pessoas por departamento e o aviso de somente leitura.

### 15.2.10 Pendências e decisões
- **Achado, sem correção:** abas Permissões, Parâmetros, Integrações e Buckets são decorativas; decidir entre **ligar ao dado real** (listar `storage.buckets`, ler `parametros_*`, status real das integrações) ou **remover**.
- **Achado, sem correção:** buckets públicos além do decidido (15.2.8).
- Decidir o destino de `usuarios`/`convites` (pessoas convidadas ao VP Gestão) diante do login único do vpsistema. **Herdado.**
- O módulo `estoque` ainda não consta no catálogo de alçadas do front (`CATALOGO_MODULOS`) — **Herdado**, não reconferi.

### 15.2.11 Histórico
Administração por departamento em out/2026; alçadas passaram a ser concedidas no vpsistema em 09/10/2026; abas decorativas vêm da primeira versão da tela. **Herdado.**

---

# Parte comum de Administração

## PC-1 Mapa de ligações
**Herda de:** vpsistema.com (login único, cadastro de pessoas, alçadas via `vpsistema-sync`), Supabase (banco, Auth, Storage, Edge Functions, `pg_cron`). **Doa para:** todos os módulos (alçadas, identidade e auditoria). **Selo:** Herdado, exceto onde a tela foi citada como Conferida.

## PC-2 Pessoas, perfis e alçadas de ponta a ponta
A pessoa entra pelo **SSO do vpsistema**; o app guarda o e-mail em `window.__VP_USER`; `vp-auth.js` troca o token por sessão nativa (Edge Function `sso-exchange`); o nível e o departamento vêm de `perfis`; a capacidade por módulo vem de `alcadas_capacidade`, alimentada pelo vpsistema (`vpsistema-sync`). `PropostaStore.temCapacidade` decide na tela; as funções `vp_*` decidem no banco (onde a tabela já foi fechada). Administrador passa em tudo. **Conferido** (contagens: 39 perfis ativos de 49; 30 deles já têm sessão em `auth.users`; níveis: Administrador, Gestor, Colaborador). Detalhe do login e do modo em `01_geral.md` PC-6.

**Usuário de desenvolvimento local (04/11/2026):** em `localhost` o app não pede login e cria um usuário `dev@localhost` (id `dev-local`). Dois perfis, escolhidos por `/?dev=admin` (padrão, passa em tudo como Administrador) ou `/?dev=pleno` (usuário comum, não administrador, com **todas** as alçadas — `PropostaStore.temCapacidade`). Só vale em `localhost`/`127.0.0.1`/`0.0.0.0`; em produção nunca entra (`supabase.js`). **Atenção:** esse usuário fala com o banco pela **chave pública**, então funções e tabelas fechadas (ex.: Peguei da Separação QC, Corte) respondem "sem acesso" no local. Teste de função de banco com alçada exige sessão real. **Conferido** (código; a tela avisa a recusa).

## PC-3 Rotas, páginas públicas e arquivos
`/admin/logs` e `/admin/configuracoes/<aba>`. Nenhuma página pública deste módulo. Arquivos: `logs-admin.jsx`, `vp-log.js`, `vp-auth.js`, `colaboradores-admin.jsx`, `colaboradores-admin-store.js`, `financeiro.jsx` (as abas `Config*`), `engenharia-config.jsx` (**Não verificado** a que se destina).

## PC-4 Segurança real (#571): onde estamos
Plano em `docs/superpowers/plans/2026-10-02-autenticacao-e-rls-571.md`; decisões D1–D7 em `docs/seguranca/decisoes.md`; matriz em `docs/seguranca/matriz-acesso-rls.md`. **Conferido hoje no banco:** **198 de 278 tabelas** do esquema `public` têm política para `anon` ou `public`; **nenhuma** está sem RLS; 359 migrations no repositório. Já existe: funções `vp_email`, `vp_usuario_ativo`, `vp_eh_admin`, `vp_tem_capacidade`; `vp_fechar_tabela`/`vp_reabrir_tabela` com `vp_policy_backup` (61 linhas); `vp_auth_piloto` com o **coringa** (todos em `on`); a Edge Function `sso-exchange`; e as RPCs públicas por token (proposta, contrato de venda, contrato instalador, recibo, TV da Separação, Corrimão/Corte). Já fechadas: `contratos_venda_equipamentos` (D1) e as tabelas novas desde a Fase 1. **Falta:** fechar as demais ondas (A 82, B 33, C 48 na matriz de 04/10; hoje 198 tabelas) e os buckets. **Ordem que importa (Herdado):** o app só pode mandar o token nos dados depois de as tabelas terem política para `authenticated` — por isso a ordem das ondas. **Regra permanente:** tabela nova nasce fechada (Art. 26). **Limite honesto:** com tabela aberta, trava de tela é organização, não segurança (Art. 25).

## PC-5 Quem faz o quê
Administração é **só Administrador** no menu. As alçadas são concedidas no vpsistema.com/administracao, não aqui. Total hoje: **1.834** linhas de alçada. A allowlist e as travas de `send-email` e a escrita real no Omie têm regras próprias (Art. 14, 30; `01_geral.md` 1.5).

## PC-6 Edge Functions: inventário e regras de deploy
**Conferido hoje:** **43** funções ativas em produção (`list_edge_functions`); **42** pastas em `supabase/functions/`. **Em produção sem pasta no repositório: `conferir-clientes-omie`** (v1; viola o Art. 23, "nenhuma função em produção sem pasta"). Pastas em `supabase/functions-removidas/` (4) guardam o que foi apagado; **não redeployar**. **8 funções com `verify_jwt: false`** (o chamador não é o navegador autenticado): `capturar-lead-verticalparts`, `capturar-lead-quadro-comando`, `sso-exchange`, `vpsistema-sync`, `estoque-eventos`, `estoque-revisao`, `estoque-separacao`, `decisao-resposta-whatsapp`. **8 funções do repositório importam `supabase-js`** (`import` direto, **Conferido** por busca no código): `omie_sync_pagamentos_instaladores`, `publicar_ficha_omie`, `read-inbox`, `send-email`, `sign-email-anexos`, `sync-importacao-varejo`, `sync-pi-omie-pagamentos`, `whatsapp-notify` (o `CLAUDE.md` dizia 9 em 31/10/2026; `list-importacao-varejo` já foi reescrita sem a biblioteca). **Regras (Herdado):** função **nova** fala com o banco por `fetch` + PostgREST; redeploy de função existente exige comparar com a versão de produção (o repositório já esteve defasado) e testar numa cópia descartável; a ferramenta de deploy do MCP `6af018ee…` empacota dependências e a `65e71fcf…` só manda 1 arquivo e já causou `BOOT_ERROR`; o break-glass da API de gerenciamento está desligado e não se contorna. Funções que **escrevem no Omie** (`publicar_ficha_omie`, `pcp-omie-escrever`, `criar-requisicao-compra-importacao-varejo`) pedem teste real autorizado após qualquer redeploy.

## PC-7 Crons, buckets e integrações
- **Crons:** **42** ativos (**Conferido**, `cron.job`); dois rodam **a cada minuto** (`eventos-publicar-outbox`, `estoque-omie-endereco-sync`) e dois a cada 10 minutos (`read-inbox-poll`, `inbox-acordar-adiados`). A lista por módulo está nos documentos de cada um (1 PC-7, 7, 9, 11, 12, 13). Um cron que dispara `net.http_post` marcado `succeeded` só prova o disparo; o resultado real está na tabela de log da função.
- **Buckets (11):** privados com URL assinada (`cotacao-fornecedor-anexos`, `emails-anexos`, `expedicao-comprovantes`, `fichas-imagens`, `formulario-elevador-anexos`, `parceiros-instaladores-anexos`, `propostas-imagens`) e **públicos** (`engenharia`, `tratativas`, `vistorias-anexos`, `ImagensTutoriais`). **Conferido.**
- **Integrações em produção:** Omie (leitura livre; escrita só com autorização), caixa IMAP/SMTP `suporte@vpsistema.com`, WhatsApp (`whatsapp-notify`, `decisao-resposta-whatsapp`, gi-avisos na VPS), Copiloto (`vp-copiloto`), rastreio AIS (`ais-sync`), vpsistema (`vpsistema-sync`, `sso-exchange`). Os serviços transversais têm documento em `docs/modulos/16_servicos.md`. A tela de Integrações (15.2.4) **não reflete** isso.

## PC-8 Tabelas
`perfis`, `alcadas_capacidade`, `colaboradores_vpsistema`, `usuarios`, `convites`, `vp_logs`, `vp_auth_piloto`, `vp_policy_backup`, `api_rate_log`, `app_secrets` (valor nunca no repositório, Art. 28), `fluxo_pendentes`, `alertas`, `eventos_fluxo`, `decisoes_gerenciais`. Contagens em 15.x.7.

## PC-9 Navegação, cache, CI e testes
Aba na URL e `?v=` obrigatório (Art. 19). CI com dois checks exigidos para o merge ("Validar estrutura do projeto" e "Todas as telas abrem sem erro"); se um job for renomeado, a proteção da branch muda junto. Workflows: `ci.yml`, `e2e.yml`, `deploy.yml` (SSH redundante, sem uso real; o deploy real é a integração Git do hPanel). Teste do módulo: `vp-log.test.js`, `vp-auth.test.js`. **Sem teste:** Logs (tela) e Configurações.

## PC-10 Menu "?" e tutoriais
**Não verificado** se há tutorial de Logs e de Configurações. O menu "?" é descrito em `01_geral.md` PC-10.

## PC-11 Documentos soltos e destino do que foi concatenado
Seções do `CLAUDE.md` que tratam do módulo e têm destino aqui (a troca por ponteiro depende da confirmação do Gelson, Art. 13): "Segurança real (#571) — andamento" (Fases 0–3; resumo já em `01_geral.md` PC-3/PC-6, o detalhe técnico fica aqui no PC-4), "Edge Functions: órfãs apagadas, funções do Omie/webhook endurecidas e como redeployar" (→ PC-6), "Acessos confirmados" e "Auditoria #843" (→ PC-4/PC-6). Em `docs/`: `seguranca/decisoes.md`, `seguranca/matriz-acesso-rls.md`, `seguranca/cascata-assinatura.md` e `seguranca/estoque-ocultar-saldo.sql` ficam onde estão (histórico e referência); o plano `superpowers/plans/2026-10-02-autenticacao-e-rls-571.md` também. **Nada foi apagado.**

## PC-12 Benefícios trocados com os outros módulos

- **Recebido de Quadros de Comando (04/11/2026, texto em `14_quadros_comando.md` PC-12, Art. 49):** (a) o Omie repete a linha do item com **quantidade 0** — somar por código e ignorar o zero antes de contar linhas ou unidades; (b) **metro e peça nunca se somam** — total por unidade de medida; (c) a caixa de uma tabela longa deve ter a **altura da janela**, para a barra de rolagem lateral ficar à vista; (d) função de banco nova se testa **numa transação que se desfaz**, incluindo um usuário ativo **sem** a alçada (a recusa por "sem sessão" não prova a trava de alçada); (e) a **observação do item** do pedido do Omie (`pcp_pedido_itens.obs_item`) guarda o que a proposta mostra dentro do item. **Conferido** (04/11/2026).
**Recebidos:** de Fabricação — tabela que guarda token não pode ter leitura pública; telas duplicadas criam duas verdades; contar linhas antes de chamar de pronto. **Doados** (texto nos documentos de 1 a 13, linha "Recebido de Administração"): ver cada módulo.
- **Recebido de Serviços (01/11/2026, texto em `16_servicos.md` PC-2):** todo alerta com destinatário também vira WhatsApp pelo gi-avisos; para chegar certo, título curto com o essencial na frente, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos. `whatsapp-notify` e `vp-copiloto` foram removidas em 01/11/2026 (pastas em `supabase/functions-removidas/`; `16_servicos.md` S1 e S3); o inventário de PC-6 acima é anterior a isso (43 → 41 funções), e a tela Integrações (15.2.4) segue sem refletir os serviços em produção (`16_servicos.md` PC-6).
