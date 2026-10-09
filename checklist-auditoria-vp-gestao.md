# Checklist de Auditoria Read-Only — VP Gestão (`010_GestaoImportacao`)

> **Para uso do Claude Code.** Este checklist guia uma auditoria **estritamente de leitura** do repositório
> `https://github.com/verticalpartsIA/010_GestaoImportacao.git`, marcando acertos (✅) e erros (❌) em cada área,
> **sem tocar em nenhum arquivo**. Preencher item a item com evidência `arquivo:linha` — nunca no "achismo".

- Repositório auditado: `verticalpartsIA/010_GestaoImportacao` (branch `main`)
- Clonado/verificado em: **22/08/2026** (clone raso `--depth 1`)
- Modo da auditoria: **SOMENTE LEITURA** — proibido editar, formatar, commitar, criar branch ou abrir PR
- Autorização do mantenedor: criar **apenas este checklist**

---

## 0. Regras de ouro (anti-alucinação) — OBRIGATÓRIAS

| # | Regra | Consequência se violada |
|---|-------|--------------------------|
| R1 | **Nenhum item é marcado ✅ ou ❌ sem evidência real**: cite `arquivo:linha` lida de fato (via `cat`, `head`, `grep -n`) | Item marcado sem citação = item **inválido**, volta para "não verificado" |
| R2 | Sem evidência disponível → marcar **🔍 NÃO VERIFICADO** (nunca inferir, nunca "deve estar ok") | Acusação falsa contamina o relatório |
| R3 | **Proibido escrever em qualquer arquivo do repo** (inclusive `.claude/`, `docs/`). O relatório final vai para **fora** do clone (ex.: `~/auditoria-vp-gestao.md`) | Violação da autorização do mantenedor |
| R4 | Proibido rodar `npm install`, `npm run build`, `git pull`, `git checkout`, migrações ou qualquer comando que modifique estado | Alteração não intencional de código/dados |
| R5 | **Nunca imprimir, copiar ou commitar chaves/tokens** encontrados (mesmo anon). Reportar apenas `caminho:linha` e o tipo (ex.: "JWT anon, role anon") | Vazamento de segredo |
| R6 | Não inventar tabelas, rotas, módulos, endpoints ou números. Só existem nomes que apareceram em arquivos lidos | Alucinação de estrutura |
| R7 | Distinguir **"não verificado"** (não olhei) de **"não existe"** (procurei e não achei) | Conclusão errada sobre ausência |
| R8 | Para cada item, registrar o **comando usado** como evidência (ex.: `grep -rn "service_role" src/`) | Rastreabilidade da auditoria |
| R9 | Se achar algo quebrado, **registrar** (❌ + impacto). Proibido "consertar" na hora | Escopo read-only |
| R10 | Antes de fechar: `git status` deve estar **idêntico** ao início da auditoria (limpo) | Prova de que nada foi tocado |

---

## 1. Protocolo de execução (passo a passo)

1. `git clone --depth 1 <repo>` para pasta TEMPORÁRIA (fora de qualquer projeto em uso).
2. `git rev-parse HEAD` → registrar o **commit auditado** no topo do relatório.
3. `git status` → registrar estado inicial.
4. Percorrer as seções 5 a 14 abaixo **na ordem**, preenchendo a coluna *Status* e *Evidência*.
5. Sempre confirmar suspeitas com `grep -rn`/`sed -n 'N,Mp'` antes de marcar ❌.
6. Produzir o relatório final no formato da seção 15, **fora** do clone.
7. `git status` final → deve ser idêntico ao passo 3. Anexar ao relatório.

---

## 2. Legenda de classificação

| Símbolo | Significado |
|---------|-------------|
| ✅ | **Acerto** — prática correta, verificada com evidência |
| ❌ | **Erro / defeito** — comportamento ou prática incorreta, verificada |
| ⚠️ | **Risco / pendência** — merece decisão consciente do mantenedor |
| 🔍 | **Não verificado** — sem evidência nesta auditoria (falta tempo/acesso) |
| N/A | Não se aplica a este projeto |

Colunas obrigatórias em cada item: **Status · Onde verificar (`arquivo:linha`) · Evidência/comando · Impacto**.

---

## 3. Resumo do projeto auditado (fatos verificados nesta sessão)

| Item | Valor verificado |
|------|------------------|
| Descrição (README) | Plataforma corporativa VP Gestão: venda → fornecimento → importação → engenharia → obra → instalação → entrega → inteligência operacional de transporte vertical |
| Frontend | React via CDN (UMD) + Babel Standalone **sem bundler** — `src/*.jsx` carregados dinamicamente (`src/jsx-loader.js`) |
| Backend | `server.js` — Express (dependência única: `express ^4.19.2`), porta `process.env.PORT \|\| 3000`, proxy read-only para projeto Supabase "Propostas" via service role |
| Dados | Supabase/PostgreSQL — `src/supabase.js` (client anon) + 44 migrações em `supabase/migrations/` |
| Edge Functions | 5 em `supabase/functions/`: `publicar_ficha_omie`, `vp-copiloto`, `ais-sync`, `ncm-duimp-assist`, `vp-translate` |
| Testes | 11 arquivos `*.test.js` em `src/`; runner próprio `scripts/run-tests.js` (`npm test`) |
| Lint / Build | **Stubs** (`package.json`): `lint` e `build` apenas ecoam "sem erros" / "sem etapa de build" |
| Build de PDF | Vite separado em `pdf-bundle/` (`@react-pdf/renderer`); bundles de ~1,2 MB versionados em `src/*.reactpdf.bundle.js` |
| CI/CD | `.github/workflows/ci.yml` (valida arquivos críticos + proíbe `service_role` no frontend; `npm ci && npm test`) e `deploy.yml` (Hostinger via SSH, `git pull`, `npm install --omit=dev`) |
| Documentação | `README.md`, `CLAUDE.md`, `FluxogramaPortal.md`, `PUBLICACAO_FINAL_CHECKLIST.md`, `BUG-8-IMPLEMENTATION.md`, `instructions.md`, `instrucaocompra.md`, `docs/` (governança, relatórios) |
| Agentes `.claude/` | 5 definidos: `ceo-agent`, `mock-agent`, `database-agent`, `ui-audit-agent`, `git-agent` |
| Segredos | `.env.example` afirma: nenhuma env obrigatória; chaves anon no frontend são intencionais; service role do projeto "Propostas" fica SÓ no servidor (env ou `.propostas-key.js` fora do git) |
| Gitignore | Cobre `.env`, `.env.local`, `.propostas-key.js`, `uploads/*.pdf`, `node_modules/`, `dist/`, `version.json`, `Andreia/` |

> ⚠️ Achado estrutural a confirmar (item E2): existem **duas árvores de migração** — `supabase/migrations/` (~44 arquivos, canônica) e `migrations/` (2 arquivos antigos `001/002-create-propostas-table.sql`). Verificar qual é a fonte da verdade e se a pasta antiga deveria ser removida/arquivada.

---

## 4. Checklist por área

### A. Escopo & governança da auditoria

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| A1 | Commit auditado registrado no relatório | `git rev-parse HEAD` | | | Rastreabilidade |
| A2 | `git status` limpo no início E no fim da auditoria | `git status` | | | Prova de read-only |
| A3 | Nenhum arquivo do repo alterado durante a sessão | comparar `git status` início/fim | | | Conformidade com autorização |
| A4 | Relatório final salvo FORA do clone | `~/auditoria-vp-gestao.md` | | | Não contamina o repo |

### B. Segredos & segurança do código (prioridade máxima)

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| B1 | Nenhuma chave `service_role` no frontend (`src/`, `index.html`, `.html` estáticos) | `grep -rn "service_role\|serviceKey\|SERVICE" src/ index.html *.html` | | | Exposição total do banco se vazar |
| B2 | Chaves hardcoded em `src/supabase.js` são **anon** (role `anon`) e não `service` | `src/supabase.js` (~linhas 7–8 e ~linha 21) | | | Anon é esperado em client web; service seria crítico |
| B3 | `server.js` usa service role vinda de env/arquivo local, **nunca** literal | `server.js` (bloco "Credenciais do projeto Propostas") | | | Vazamento de service role |
| B4 | `.propostas-key.js` **não existe** no repo (está no `.gitignore`) | `ls .propostas-key.js 2>&1` + `grep -rn "propostas-key" .gitignore` | | | Segredo versionado? |
| B5 | `.env` / `.env.local` não versionados | `git ls-files | grep -E "\.env"` | | | Segredo versionado? |
| B6 | `deploy.yml` usa `secrets.*` do GitHub (sem senha/host hardcoded) | `.github/workflows/deploy.yml` | | | Credencial SSH exposta |
| B7 | Nenhum token JWT/anexo em logs, comentários ou commits do histórico raso | `grep -rn "eyJ" --include="*.js" --include="*.md" .` (revisar ocorrências) | | | Token válido público |
| B8 | RLS habilitada nas tabelas sensíveis (clientes, propostas, contratos, financeiro, dossiê) | `supabase/migrations/*dossier_obra_rls_policies*.sql` e demais migrations com `ENABLE ROW LEVEL SECURITY` | | | Dado exposto a qualquer usuário anon |
| B9 | Buckets de anexos/imagens têm políticas restritas (não público em geral) | migrations `*create_propostas_imagens_bucket*`, `*create_fichas_imagens_bucket*` | | | Arquivos acessíveis sem auth |
| B10 | Edge Functions validam o autor (JWT) antes de agir | `supabase/functions/*/index.ts` | | | Function pública executando ações |
| B11 | Headers de segurança no serve estático (CSP, X-Frame-Options...) — se aplicável | `server.js` (middleware de headers) | | | Clickjacking/XSS amplificado |
| B12 | Uploads não executáveis e com limite de tamanho | `src/formulario-elevador*.jsx`, `server.js` (`express.json limit 4mb`), buckets | | | Upload malicioso |

### C. Autenticação & autorização (SSO)

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| C1 | SSO guard funcional: app só acessível via `vpsistema.com` (token na URL) | `src/supabase.js` (bloco "SSO Guard") | | | Acesso sem convite |
| C2 | Token SSO é **validado** (assinatura/expiração), não apenas decodificado | `src/supabase.js` (`decodeJwtPayload`) → verificar se há verificação de `exp` e validação no projeto `vpsistema` | | | Forjar identidade na URL |
| C3 | Deep link restaurado pós-SSO (issues #279/#281) funciona | `src/supabase.js` (restauração de path) | | | UX/regressão |
| C4 | Rotas do app exigem sessão (redirect p/ login quando sem token) | `src/app.jsx` (switch de rotas) + `src/router.js` | | | Acesso a tela sem login |
| C5 | Convites de usuário (migration `20260814010000_convites_usuarios`) geram token único e expirável | migration + código de convite (`src/colaboradores-admin*.jsx`) | | | Convite reutilizável/eterno |
| C6 | `KNOWN_ROUTES` (router.js) está em sincronia com o `switch(route)` de `app.jsx` | `src/router.js` vs `src/app.jsx` | | | Rota órfã/inatingível |
| C7 | Sessão em `sessionStorage` (não `localStorage`) para token de identidade | `src/supabase.js` (`saveUser`) | | | Token persistente no disco |

### D. Validação de entrada & sanitização

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| D1 | Parâmetro de rota sanitizado antes de montar query | `server.js` — `/api/propostas/:numero` (`replace(/[^0-9]/g, '')` visto) | | | Injeção/query inválida |
| D2 | Corpo JSON limitado | `server.js` (`express.json({ limit: '4mb' })` visto) | | | Payload gigante |
| D3 | Valores montados em query PostgREST são escapados/filtrados (e.g. `numero=eq.${numero}`) | `server.js` (endpoints `/api/propostas/*`) | | | Injeção via PostgREST |
| D4 | Inputs de formulário validados no cliente (e-mail, CNPJ, CPF, valores) | `src/formulario-elevador*.jsx`, `src/cadastros*.jsx`, `src/rh-homologacao.jsx` | | | Dado sujo no banco |
| D5 | Sem `dangerouslySetInnerHTML`/`innerHTML` com dado de usuário sem sanitizar | `grep -rn "dangerouslySetInnerHTML\|innerHTML" src/` | | | XSS |
| D6 | Dados de usuário em PDF (pedido/proposta) escapados | `src/pedido-fornecedor-reactpdf.entry.js`, `pdf-bundle/proposta-reactpdf.entry.js` | | | Injeção no PDF |
| D7 | CEP/endereço via API externa tratam falha/timeout | `src/enderecos-api.js` | | | UX/travamento |

### E. Banco, migrações & dados de importação (coração do projeto)

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| E1 | Migrações ordenáveis por timestamp e aplicáveis em sequência | `supabase/migrations/` (padrão `AAAAMMDDHHMMSS_nome.sql`) | | | Aplicação fora de ordem |
| E2 | **Duas árvores de migração** (`supabase/migrations/` vs `migrations/`) — definir a canônica e arquivar a órfã | `ls migrations/` vs `ls supabase/migrations/` | | | Confusão de esquema/fonte da verdade |
| E3 | Migrações são idempotentes/versionadas (nada de CREATE sem IF NOT EXISTS reaplicável) | revisar 5–10 migrations mais recentes | | | Re-aplicação quebra |
| E4 | Migrações possuem `revert`/nota de rollback ou estratégia documentada | `CLAUDE.md`, `docs/`, migrations | | | Sem saída de emergência |
| E5 | `seed_demo_data.sql` claramente marcado como demo (não roda em prod) | `supabase/seed_demo_data.sql` | | | Dado fake em prod |
| E6 | Fluxo de importação (DUIMP/NCM/DI-Siscomex) grava dados enriquecidos de forma consistente | `src/embarques-importacao*.jsx`, `src/ncm*.jsx`, `supabase/functions/ais-sync/index.ts`, `supabase/functions/ncm-duimp-assist/index.ts` | | | Importação corrompida |
| E7 | Sincronização AIS (`embarques_last_ais_sync`) trata divergências e idempotência | migration `20260530000000_embarques_last_ais_sync.sql` + `ais-sync` | | | Sync duplicado/perdido |
| E8 | Gatilhos/regras de negócio (workflow, ficha) centralizados e testados | `src/gatilhos-engine.js`, `src/ficha-workflow-engine.js`, `src/decisoes-store.js` | | | Regra espalhada |
| E9 | Índices nas colunas mais filtradas (status, data, cliente, fornecedor) | migrations (procurar `CREATE INDEX`) | | | Query lenta em produção |
| E10 | Auditoria/trilha de alterações em dados críticos (logs-admin) | `src/logs-admin.jsx`, `src/vp-log.js`, `src/notificacoes-processamento.js` | | | Sem rastro de quem mudou |
| E11 | Master ID único e estável entre fases (proposta → contrato → obra) | `src/master-id-engine.js` + migrations `*master_id*` | | | Quebra de rastreabilidade |
| E12 | Integridade referencial (FKs) e constraints de unicidade críticas | migrations recentes (`dossier_obra`, `propostas`, `contratos`) | | | Registro órfão |

### F. Lógica de negócio crítica (financeiro/contratos)

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| F1 | Cálculo DIFAL coberto por teste e com valores de referência documentados | `src/difal-engine.js` + `src/difal-engine.test.js` | | | Imposto errado |
| F2 | Precificação (markup, tabela) coberta por teste | `src/precificacao-elevador-engine.js` + `.test.js` | | | Preço errado |
| F3 | Herança de proposta (dados legados) preserva números/condições | `src/proposta-heranca.js`, `src/proposta-legado.js` + `.test.js` | | | Dado perdido no fluxo |
| F4 | Engines de contrato (venda/instalador) geram cláusulas consistentes com os dados | `src/contrato-venda-engine.js`, `src/contrato-instalador-engine.js` | | | Contrato juridicamente frágil |
| F5 | Cálculos financeiros (parcelas, juros, multa) testados | `src/financeiro.jsx`, `src/aval-financeiro-store.js` | | | Número errado ao cliente |
| F6 | Arredondamento/moeda consistente (evitar float puro em BRL) | `src/utils.js`, engines de precificação | | | Centavos divergentes |
| F7 | Regras de comissão/venda coerentes | `src/comercial.jsx`, `src/tratativas-store.js` | | | Comissão errada |

### G. Erros, logs & observabilidade

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| G1 | Erros de API tratados com mensagem amigável e sem detalhe técnico vazado | `src/toast.jsx`, stores (`*store.js`) | | | UX + vazamento de interno |
| G2 | `server.js` responde erro estruturado JSON nos proxies | `server.js` (rotas `/api/propostas/*`) | | | Diagnóstico ruim |
| G3 | Logs (`vp-log.js`) não registram dados sensíveis (CPF, token, senha) | `src/vp-log.js` + `grep -rn "console\.log" src/ | head` | | | PII em log |
| G4 | Proxy "Propostas" sem service key retorna `{ok:true, propostas:[]}` — **mascara falha de configuração?** | `server.js` (rota `/api/propostas/list`) | | | Silêncio quando deveria alarmar |
| G5 | Falha no `/version.json` tem fallback documentado | `server.js` (`readVersionInfo` cache 30s visto) | | | UX de atualização |
| G6 | Erros em Edge Functions retornam status HTTP correto | `supabase/functions/*/index.ts` | | | Integração silenciosa |

### H. Testes & qualidade

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| H1 | `npm test` passa localmente **sem modificar nada** | `node scripts/run-tests.js` (read-only; não instala nada) | | | Regressão existente |
| H2 | CI executa `npm ci && npm test` e valida arquivos críticos + ausência de `service_role` | `.github/workflows/ci.yml` (visto) | | | Fuga de segredo chega a prod |
| H3 | Últimos runs do CI estão verdes | GitHub Actions do repo (aba Actions) | | | CI vermelho ignorado |
| H4 | Lint é **stub** (echo) — sem checagem real de estilo/erros | `package.json` script `lint` | | | Erro trivial passa |
| H5 | Engines críticos sem teste identificados (contratos, financeiro, gastilhos, gerador de PDF) | comparar `src/*engine.js` × `src/*.test.js` | | | Quebra silenciosa |
| H6 | Testes de RLS/migrations ausentes ou presentes | `grep -rn "migration\|rls" src/*.test.js` | | | Política errada não detectada |
| H7 | Testes não dependem de rede/Supabase real (determinísticos) | revisar imports dos 11 `.test.js` | | | Teste flaky/caro |

### I. Build, CI/CD & deploy

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| I1 | Build é stub por decisão explícita (UMD/CDN) e documentado | `package.json` + `README.md`/`CLAUDE.md` | | | Confusão sobre "build" |
| I2 | Bundles de PDF (~1,2 MB: `proposta-reactpdf.bundle.js`, `pedido-fornecedor-reactpdf.bundle.js`) **versionados** — avaliar se deveriam ser gerados no deploy | `src/*.reactpdf.bundle.js` + `pdf-bundle/vite.config.js` | | | Repo inchado / divergência manual |
| I3 | Deps de produção mínimas (só `express`) — pdf/vite só em dev | `package.json` (visto) | | | Superfície de ataque |
| I4 | `deploy.yml` faz `git pull` + `npm install --omit=dev` sem rodar testes/CI no servidor | `.github/workflows/deploy.yml` (visto) | | | Deploy de código vermelho |
| I5 | Deploy depende do CI passar (proteção de branch) | config do branch `main` no GitHub | | | Push direto quebra prod |
| I6 | `version.json` gerado em 2 lugares (workflow e servidor) — convergente? | `deploy.yml` + `server.js` (`/version.json`) | | | Versão exibida errada |
| I7 | Node compatível: `engines >=18` vs Hostinger Node 22 vs CI Node 20 | `package.json` + `deploy.yml` + `ci.yml` (Node 20) | | | Divergência de runtime |
| I8 | `tmp/restart.txt` existe na estrutura para o touch do deploy (senão deploy falha em silêncio) | `ls tmp/` (se clonado) ou nota de deploy | | | Deploy sem restart |

### J. Performance & frontend

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| J1 | Carregamento de ~130 módulos via `jsx-loader` — parse no browser (Babel standalone) é caro; avaliar lazy-load/rota | `src/jsx-loader.js`, `index.html`, `src/app.jsx` | | | Tela inicial lenta |
| J2 | Bundles de PDF só carregados quando a rota pede (não no boot) | `index.html` + `src/pedido-fornecedor.jsx`, `src/proposta-*.jsx` | | | Pagamento de custo desnecessário |
| J3 | Consultas em laço (N+1) nas stores (clientes, fornecedores, contratos) | `grep -rn "from(.*).then\|\.select(" src/*store.js` | | | Lento com dados reais |
| J4 | Cache do `/version.json` (30s) adequado | `server.js` (visto) | | | OK/ajuste fino |
| J5 | Imagens/logo locais (não hotlink externo) | `assets/`, `index.html` | | | Dependência externa |

### K. Documentação & rastreabilidade

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| K1 | `README.md` reflete estrutura/fluxo atuais (reestruturado em 17/08/2026) | `README.md` | | | Doc = fonte da verdade |
| K2 | `CLAUDE.md` define regras para agentes (o que este checklist complementa) | `CLAUDE.md` | | | Agente desgovernado |
| K3 | `PUBLICACAO_FINAL_CHECKLIST.md` cobre o que este checklist NÃO cobre (aceite de publicação) | `PUBLICACAO_FINAL_CHECKLIST.md` | | | Lacuna de processo |
| K4 | Bugs conhecidos documentados (ex.: `BUG-8-IMPLEMENTATION.md`) atualizados | `BUG-8-IMPLEMENTATION.md`, `docs/`, `.claude/*relatorio.md` | | | Bug "corrigido" sem registro |
| K5 | Screenshots em `docs/screenshots/` (01–10) correspondem às telas atuais | `docs/screenshots/` vs módulos | | | Doc visual desatualizado |
| K6 | `migrations/` órfã documentada (ver E2) | `README.md`/`CLAUDE.md` | | | Ambiguidade de esquema |
| K7 | Instruções de operação (`instructions.md`, `instrucaocompra.md`) sem segredo | `instructions.md`, `instrucaocompra.md` | | | Vazamento em doc |

### L. Higiene do repositório

| ID | Verificação | Onde verificar | Status | Evidência | Impacto |
|----|-------------|----------------|--------|-----------|---------|
| L1 | Arquivos temporários/prints versionados sem necessidade (`uploads/pasted-*.png`, `audit/*.png`) | `uploads/`, `audit/` | | | Repo sujo |
| L2 | Pasta com acento `relatórios/` + `docs/relatorios/` — duplicidade e portabilidade | `ls relatórios/ docs/relatorios/` | | | Confusão/CI case-sensitive |
| L3 | `package-lock.json` presente e consistente | `package-lock.json` (visto) | | | Build reprodutível |
| L4 | `.gitignore` cobre `version.json` e `Andreia/` (decisões conscientes, documentadas) | `.gitignore` (visto) | | | Lixo versionado |
| L5 | HTMLs raiz legados (`assinar.html`, `index-print.html`, `cotacao.html`, `formulario-cliente.html`, `status-obra.html`) ainda usados? | comparar com `src/app.jsx`/rotas | | | Código morto |
| L6 | Histórico raso OK para auditoria? (se precisar de histórico completo, clonar sem `--depth 1`) | `git rev-list --count HEAD` | | | Cobertura da auditoria |
| L7 | Tamanho/limite do repo (bundles 1,2 MB × 2 + histórico) | `du -sh .git` | | | Clone lento |

---

## 5. Formato do relatório final (a ser produzido pelo Claude Code)

1. **Cabeçalho**: repo, commit (`git rev-parse HEAD`), data, duração, `git status` início/fim.
2. **Resumo executivo**: nº de ✅ / ❌ / ⚠️ / 🔍 / N/A por área, e top 5 achados por severidade.
3. **Tabela de achados críticos (❌ e ⚠️ altos)**: colunas *ID · Severidade (Crítico/Alto/Médio/Baixo) · Descrição · Evidência (arquivo:linha) · Impacto · Recomendação*.
4. **Checklist completo preenchido** (seções 4–13 acima), item a item.
5. **Lista de "não verificado" (🔍)** — para auditoria futura.
6. **Anexo**: comandos executados e garantia read-only (`git status` limpo no fim).

---

*Este checklist foi criado por auditoria externa (22/08/2026) com base na estrutura real do repositório no branch `main`.
Nenhum arquivo do repositório foi modificado para produzi-lo — validação da estrutura via clone em diretório temporário.*
