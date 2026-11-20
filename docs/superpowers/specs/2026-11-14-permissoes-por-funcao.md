# Permissões por função/departamento (alçadas e "Valores R$")

> **Status:** Specify e Clarify escritos em 14/11/2026; **8 respostas confirmadas pelo Gelson em 14/11/2026 (seção 2.1), com 5 pontos ainda ABERTOS**. **Plan, Tasks e Analyze escritos em 15/11/2026** (seções 3 a 5), com os 5 pontos ABERTOS como parâmetros; o Analyze (A1) corrige um desenho meu anterior e pede decisão (Art. 37). Nada de migration, tabela, deploy ou mudança de permissão sem "Confirmo" (Art. 14).
> **Módulo dono:** 15 Administração (`docs/modulos/15_administracao.md`). Quando houver decisão, ela migra para lá (Art. 38/42).
> **Selos (Art. 6):** *Conferido* = visto no banco/código/página em 14/11/2026; *Não verificado* = não li.

## 1. Specify

### 1.1 Contexto e objetivo
Hoje as alçadas (`alcadas_capacidade`, módulo × capacidade) e o "Valores R$" (`valores_acesso`: modo todos/nenhum + `liberar[]`/`esconder[]` por etiqueta `modulo.etiqueta`) são concedidos **pessoa a pessoa**. O Gelson reconhece que o certo é conceder por **função/departamento** e deixar a pessoa só com **exceções**. Objetivo: o acesso de alguém = o que a(s) função(ões) dele permite(m) + exceções individuais explícitas, com padrão **negar**.

### 1.2 Estado atual (Conferido, banco, 14/11/2026)
- Não existe tabela de função/papel/grupo no hub. **Conferido.**
- 1.834 linhas em `alcadas_capacidade`; `valores_acesso` com 45 pessoas (41 `nenhum`, 4 `todos`). **Conferido.**
- 31 de 50 perfis estão em **modo manual** (`perfis.acesso_manual`); 326 linhas de alçada desses perfis têm `concedido_em` a partir de 14/10/2026. **Conferido.**
- No mesmo departamento (sem os Administradores) os conjuntos divergem: por exemplo, Logística/Almoxarifado/Produção tem 9 pessoas, 18 permissões em comum (≥70%) e 63 individuais; Engenharia, 7 pessoas, 57 em comum e 49 individuais; Marketing, 2 pessoas e 0 em comum. **Conferido** (o corte de 70% é **suposição** minha, só para a análise).
- `perfis.departamento` tem **12 grafias** para 8 setores (ex.: "Logistica" e "Logística/Almoxarifado/Produção", "MKT" e "Marketing", "Vendas" e "Comercial"), **8 perfis ativos sem departamento** e **21 que divergem** de `colaboradores_vpsistema.departamento`. **Conferido.**
- O front (`src/`) não lê nem mostra `valores_acesso`; a trava de valores no banco (`vp_valores_regra`, 17 tabelas) está ligada só para 1 e-mail (`vp_valores_piloto`). **Conferido.**
- A fonte das alçadas e dos valores é o vpsistema.com/administracao, copiada pelo `vpsistema-sync`. **Herdado** (docs do módulo 15 e plano de 13/10); o repositório do vpsistema **não foi lido**.

### 1.3 O que aproveitar de projetos de referência (lido em 14/11/2026)
Só o **desenho**; nenhum código ou dependência entra (Art. 18).
- **Spatie laravel-permission** — migration lida inteira: `permissions`, `roles`, `role_has_permissions` (PK permissão×papel), `model_has_roles` (PK papel×modelo) e `model_has_permissions` (permissão **direta**, exceção por pessoa). A doc diz que permissões são herdadas dos papéis e recomenda dar permissão a papéis em vez de direta. Não documenta negar permissão herdada. **Conferido** (https://github.com/spatie/laravel-permission/blob/main/database/migrations/create_permission_tables.php.stub; https://spatie.be/docs/laravel-permission/v8/basic-usage/role-permissions).
- **Casbin** — "deny-override: both allow and deny authorizations are supported, deny overrides the allow"; hierarquia de papéis. Biblioteca Go. **Conferido** (https://github.com/apache/casbin). `casbin-dashboard`: último commit 08/09/2023, exige Go+MySQL.
- **OpenFGA** — papel = relação direta, permissão = relação derivada; exclusão `but not` e união `or`. Serviço próprio (Go). **Conferido** (https://openfga.dev/docs/modeling/roles-and-permissions, https://openfga.dev/docs/configuration-language). OPAL só distribui políticas para OPA/Cedar: descartado.
- **CASL** — regras com ação, sujeito, condição e campos; `cannot` (regra inversa). Docs do site vieram vazias (renderizadas por JS); formato de `fields`, precedência `can`/`cannot` e uso por CDN **Não verificados** (https://github.com/stalniy/casl).
- **NocoDB** — permissão por campo controla só **edição**: "Field permissions do not control field visibility". **Conferido** (https://nocodb.com/docs/product/collaboration/field-permissions). Serve de alerta: "Valores R$" é de **visibilidade**.
- **Filament** — sem policy, o acesso é **liberado** por padrão (https://filamentphp.com/docs/5.x/advanced/security.md). **Next Shadcn starter** — RBAC só de navegação; esconder menu não protege dados. Lições: o hub deve **negar por padrão** e a trava de tela não é segurança (Art. 25). **Conferido.**
- **Budibase, NocoDB, Filament, Next Shadcn:** outra stack/licença; só referência de tela. **Não verificado:** datas e versões de release da maioria; plugins de roles do Filament.

### 1.4 Requisitos
- **FR01** Existir o conceito de **função** (departamento ou função transversal) com um conjunto de permissões.
- **FR02** Uma pessoa pode ter **uma ou mais funções**; o acesso é a **união** das funções.
- **FR03** Exceção individual explícita: **conceder** ou **negar** uma permissão; **negar vence** (como no Casbin).
- **FR04** "Valores R$" entra como permissões da função (modo e etiquetas), não como cadastro por pessoa.
- **FR05** Padrão **negar**: sem função e sem exceção, a pessoa só tem o que a regra mínima (Geral) dá hoje.
- **FR06** A decisão de acesso vem de **uma função SQL única** no banco; o front só exibe o resultado.
- **FR07** Departamento com **fonte única** (hoje 12 grafias, 8 vazios, 21 divergentes).
- **FR08** Tela da aba Administração: ver a função de cada pessoa, o que vem da função e o que é exceção, e a diferença para o que existe hoje antes de qualquer troca.

### 1.5 Regras de negócio
- Conceder/retirar acesso é ato administrativo, registrado em `vp_logs` (quem, quando, o quê).
- Função nunca é apagada se alguém a usa (mesmo espírito do Art. 16/27).
- Na migração, **nenhuma pessoa perde acesso sem ser listada antes** ("quem perderia o quê").

### 1.6 Fora do escopo
Implementar no repositório do vpsistema; trocar de login/SSO; fechar RLS das tabelas (issue #571, plano próprio); adotar biblioteca externa; alterar a trava de valores no banco (`vp_valores_piloto`) antes da decisão.

### 1.7 Cenários de aceitação
- **Dado** uma função "Logística" com permissões P, **quando** a pessoa A é vinculada a ela, **então** A tem P sem nenhuma linha individual.
- **Dado** a pessoa A com a função e uma exceção "negar X" (X ∈ P), **quando** o acesso é calculado, **então** A não tem X.
- **Dado** uma pessoa sem função nem exceção, **então** ela só tem o acesso mínimo (Geral).
- **Dado** a função "Financeiro" liberando as etiquetas de valores V, **então** quem tem a função vê V e quem não tem não vê, **sem** linha em `valores_acesso` por pessoa.
- **Dado** a migração em ensaio, **quando** o relatório "quem perderia o quê" é gerado, **então** nenhuma pessoa muda de acesso antes de o Gelson aprovar a lista.

## 2. Clarify — perguntas ao Gelson (responder antes do Plan)
1. **Fonte única do departamento:** usar `colaboradores_vpsistema.departamento` (vpsistema) e corrigir os 21 divergentes e os 8 sem departamento? Quem corrige: você no vpsistema ou o hub normaliza uma tabela de apelidos (ex.: "MKT" = "Marketing")?
2. **Granularidade das funções:** Logística junta almoxarifado, produção e contas de função (63 permissões individuais). Quebrar em funções menores (almoxarifado, produção, quadro de comando…) ou um departamento só com exceções?
3. **Marketing e contas de função:** as 2 pessoas de Marketing não têm nenhuma permissão em comum, e há contas de função (almoxarifado, produção, automação) que não são pessoas. Elas viram função própria ou continuam como perfil individual?
4. **Quem é Administrador:** o nível `Administrador` continua como atalho de tudo, ou também passa a ser função?
5. **Valores R$ por função:** quais funções veem valores e de quais etiquetas (`modulo.etiqueta`)? Existe uma lista pronta?
6. **Onde cadastrar a função:** você decidiu o vpsistema. Confirma que o hub **só recebe** (papéis, permissões e vínculos pelo `vpsistema-sync`) e **não** edita funções, nem para quem está em modo manual? O que acontece com os 31 em modo manual: voltam a sincronizar ou ficam como exceção?
7. **Padrão negar:** hoje quem não tem a alçada não vê o módulo, mas o "Valores R$" está desligado para quase todos. Ligar `vp_valores_piloto` para todos entra na mesma entrega ou em outra?
8. **O doc 15.2.4 ("somente leitura") ou o código (modo manual) vale?** (Art. 12; pendência já registrada no módulo 15.)

### 2.1 Respostas do Gelson (14/11/2026)
O Gelson **confirmou as 8 respostas** abaixo (propostas por mim a partir dos dados; a decisão é dele). Os dados citados são **Conferidos** no banco em 14/11/2026. Os pontos marcados **ABERTO** continuam sem decisão e o Plan não pode fechá-los por suposição.

1. **Fonte do departamento.** O departamento do vpsistema (`colaboradores_vpsistema.departamento`) é a fonte única, corrigida **lá**; o hub só lê. **Não** haverá tabela de apelidos: "MKT" em `perfis` corresponde a quatro departamentos diferentes no vpsistema, então o nome não é chave confiável. Os 8 perfis ativos sem departamento têm departamento no vpsistema (Comercial 3, Engenharia 2, Marketing 1, Jurídico 1, CEO 1). Divergências: 22 (21 com colaborador + 1 perfil sem colaborador). **ABERTO:** uma pessoa está como "MKT" no hub e **sem departamento** no vpsistema; alguém decide o departamento certo.
2. **Logística: duas camadas.** Departamento-base mais **funções adicionais** que a pessoa soma (casa com FR02). Motivo: um departamento só não serve (9 pessoas, 18 permissões em comum, 63 individuais). **ABERTO:** o Gelson define os nomes e o recorte das funções (por exemplo almoxarifado, produção, gestão); o spec não os inventa.
3. **Marketing e contas que não são pessoas.** Marketing (2 pessoas, 3 alçadas no total, nenhuma em comum) é definido **à mão**; dois casos não formam padrão. As **contas de sistema** (almoxarifado, automação, produção corrimão, automação quadro) ganham função própria de "conta de posto de trabalho", com permissões explícitas. O parceiro externo (e-mail fora do domínio da empresa, 10 alçadas) ganha função de "parceiro externo". **ABERTO:** a conta de automação do quadro tem 0 alçadas; o Gelson diz se ainda é usada.
4. **Administrador = atalho de superusuário, não função.** Há 5 Administradores; o nível já libera tudo (`temCapacidade`), então as alçadas gravadas deles (3 a 261) não mudam o acesso. **ABERTO:** o Gelson revê se os 5 devem mesmo ser superusuário.
5. **Valores R$ por função: partir do que as pessoas já têm.** Matriz **inicial, a confirmar**: Financeiro = todos; Compras = valores de compra, preço de fornecedor, pedidos, análise de preços, IMS, embarques e P.I.; Engenharia/Obras = custo de vistoria, valores de obra e pagamento a instaladores; Vendas = preço da proposta. Só 12 etiquetas têm regra no banco (`vp_valores_regra`); as demais, mesmo atribuídas, **ficam sem trava** até receberem regra (Task 10 do plano de 13/10). **Não verificado:** li as etiquetas só de uma amostra de pessoas na tela, não a lista completa em `valores_acesso`. **ABERTO:** o Gelson confirma a matriz por departamento.
6. **O hub só recebe; modo manual vira estado transitório.** O hub recebe do vpsistema papéis, permissões e vínculos (`vpsistema-sync`); não edita funções. Os 31 perfis em modo manual **só voltam a sincronizar depois** do relatório "quem perderia o quê" aprovado, e **antes** de voltar as exceções de cada um são exportadas para virarem exceção individual (a própria tela avisa que voltar a sincronizar "pode apagar o que foi marcado aqui"; são 459 linhas de alçada que não vieram do vpsistema).
7. **Ligar a trava de valores para todos é entrega separada, depois.** Exige antes a simulação "quem perde leitura e escrita" (em 13/10 eram 8 pessoas sem leitura e 13 sem escrita); hoje só um e-mail está em `vp_valores_piloto`. **Não reconferido hoje:** quantos perfis ainda não têm sessão (leem tudo pela chave pública).
8. **O código é a realidade (modo manual existe e 31 perfis o usam).** Decisão de princípio: o doc 15.2.4 ("somente leitura") deve passar a descrever os dois estados e marcar o manual como transitório. **A edição do doc ainda NÃO foi feita**; faz-se quando o Gelson pedir (é o doc do módulo, não o `CLAUDE.md`).

**Efeito nos requisitos:** FR02 (várias funções por pessoa) vale com duas camadas (departamento + função); FR07 (departamento com fonte única) = vpsistema; FR05 (negar por padrão) mantido; FR04 (Valores R$ na função) depende da matriz da resposta 5.

## 3. Plan
> Escrito em 15/11/2026. **Os 5 pontos ABERTOS da seção 2.1 entram como parâmetros**: nenhuma Task que dependa deles pode ser executada antes de o Gelson decidir. Nenhuma migration, deploy ou mudança de permissão sem "Confirmo" (Art. 14).

### 3.1 O que já existe e vale reaproveitar (Conferido no código, 15/11/2026)
- **Decisão de acesso no banco:** `vp_tem_capacidade(modulo, cap)` = `vp_eh_admin()` **ou** existe linha em `alcadas_capacidade` do perfil logado (`supabase/migrations/20261004190000_vp_auth_helpers.sql`). Já é a **fonte única** no banco.
- **Decisão de acesso no front:** `temCapacidade` (`src/proposta-store.js:707`) lê `alcadas_capacidade` direto e guarda cache por chave.
- **Valores R$:** `vp_ve_valor(perfil, etiqueta)` lê `valores_acesso` (`modo` todos/nenhum + `liberar[]`/`esconder[]`) (`20261009270000_valores_acesso_vindo_do_vpsistema.sql`).
- **Contrato do vpsistema com o hub, hoje, por pessoa e já "achatado":** a Edge Function `vpsistema-sync` aceita `set_alcadas` (e-mail, capacidades, módulos), `set_email` e `set_valores` (e-mail, modo, liberar, esconder); cada ação chama uma RPC `vpsistema_set_*` só do `service_role` (`supabase/functions/vpsistema-sync/index.ts`).
- **Modo manual:** com `perfis.acesso_manual`, `vpsistema_set_alcadas` **não mexe** na pessoa (`20261014100000_acesso_manual_por_perfil.sql`). **`vpsistema_set_valores` não tem essa proteção** (nenhuma migration de 14/10 a cita), por isso `valores_acesso` segue sendo sobrescrito, inclusive em perfis manuais.

### 3.2 Decisão de arquitetura (a confirmar pelo Gelson)
Como as funções moram no **vpsistema** e o hub **só recebe** (resposta 6), a função é **resolvida lá** e o hub continua recebendo o **resultado por pessoa**, pelo contrato que já existe. O hub **não** ganha motor de função nem tabelas de papel nesta entrega.
- **Vantagem:** o banco e o front não mudam de regra (`vp_tem_capacidade`, `temCapacidade`, `vp_ve_valor` ficam como estão); o risco de quebrar produção é pequeno e cada passo é reversível.
- **O que se perde:** o hub não sabe, por conta própria, *de onde* veio cada permissão (função × exceção). Para FR08 isso se resolve com **um campo informativo `origem`** enviado pelo vpsistema (ver T6), sem recalcular nada no hub.
- **Alternativa descartada por enquanto:** replicar papéis no hub (`papeis`, `papel_permissoes`, `perfil_papeis`, `perfil_permissoes` com `efeito`). Só vale se o Gelson decidir que o hub passa a calcular o acesso; contradiz a resposta 6 e dobra a fonte da verdade (ver Analyze, A1).

### 3.3 Fases
1. **Preparar os dados (sem mudar acesso):** fonte única de departamento no vpsistema (resp. 1); relatório "quem perderia o quê" por pessoa, comparando o acesso de hoje com o que as funções dariam.
2. **Modelar no vpsistema:** funções (departamento-base + funções adicionais, resp. 2), contas de sistema, parceiro externo, matriz de Valores R$ (resp. 5). Entrega do lado do vpsistema, **fora deste repositório**.
3. **Adaptar o hub ao contrato:** proteger `valores_acesso` do modo manual, acrescentar `origem`, mostrar na tela.
4. **Migrar por onda:** primeiro departamentos pequenos, com exportação das exceções antes de tirar alguém do modo manual (resp. 6).
5. **Depois, entrega separada (resp. 7):** ligar a trava de valores para todos, após simulação.

## 4. Tasks
> Cada Task é pequena e verificável. **[hub]** = neste repositório; **[vps]** = no repositório do vpsistema (fora do escopo desta sessão; o hub só define o contrato). **Bloqueada** = depende de ponto ABERTO.

- **T001 [hub] Relatório "quem perderia o quê".** Consulta somente leitura (sem migration): por pessoa, alçadas de hoje × alçadas que a função candidata daria, e o mesmo para `valores_acesso`. Saída em tabela por departamento, **sem nomes no repositório** (só no chat). *Verificação:* totais batem com `alcadas_capacidade` (1.834 linhas) e `valores_acesso` (45). **Bloqueada** para a parte de Valores R$ até a matriz (ABERTO 5).
- **T002 [vps] Departamento único.** Corrigir no vpsistema os 22 casos divergentes e os 8 sem departamento; decidir a pessoa "MKT" sem departamento (ABERTO 1). *Verificação:* `perfis.departamento` = `colaboradores_vpsistema.departamento` para todos os ativos.
- **T003 [vps] Modelar funções.** Departamento-base + funções adicionais; **negar vence**; padrão negar (FR01–FR05). **Bloqueada** pelos nomes e recortes de Logística (ABERTO 2), pela conta de automação do quadro (ABERTO 3) e pela revisão dos Administradores (ABERTO 4).
- **T004 [vps] Matriz de Valores R$ por função.** Etiquetas por departamento a partir da proposta da resposta 5. **Bloqueada** (ABERTO 5).
- **T005 [hub] Proteger `valores_acesso` do modo manual.** Migration: `vpsistema_set_valores` passa a ignorar perfis com `acesso_manual` (mesmo critério de `vpsistema_set_alcadas`). *Verificação:* teste em transação desfeita — perfil manual não muda; perfil normal muda. Precisa de **"Confirmo"** (Art. 14).
- **T006 [hub] Campo `origem`.** Migration: coluna informativa em `alcadas_capacidade` (e em `valores_acesso` por etiqueta, se couber) e extensão compatível de `set_alcadas`/`set_valores` (parâmetro novo opcional; chamadas antigas continuam valendo). Precisa de **"Confirmo"**.
- **T007 [hub] Tela.** No detalhe da pessoa (aba Administração), mostrar a origem (função × exceção) e manter "Valores R$" como está (somente leitura, já em produção). *Verificação:* abrir a tela de verdade (Art. 34) e conferir contra o banco.
- **T008 [hub] Exportar exceções dos perfis manuais.** Antes de qualquer perfil voltar a sincronizar (resp. 6): lista, por perfil manual, do que está gravado à mão (as 459 linhas de origem diferente do vpsistema). Saída para o Gelson aprovar; **não** muda nada.
- **T009 [hub] Onda 1 de migração.** Tirar do modo manual os perfis dos departamentos já modelados, **um departamento por vez**, depois da T001/T008 aprovadas. Precisa de **"Confirmo"** por onda. *Reverter:* `hub_set_acesso_manual(perfil, true)` e reaplicar a exportação da T008.
- **T010 [hub] Documentação.** Atualizar `docs/modulos/15_administracao.md` (15.2.4: dois estados; modo manual transitório; nova origem), `npm run rag`, ajuda do "?" e pedido de tutorial à sessão de tutoriais (Art. 46/52). A edição do 15.2.4 **só quando o Gelson pedir**.
- **T011 [hub] Simulação da trava de valores para todos** (entrega separada, resp. 7): "quem perde leitura e escrita" e quantos perfis ainda não têm sessão. **Não** liga nada; só mede.

**Ordem:** T001 → T002 → T003/T004 (vpsistema, em paralelo, depois dos ABERTOS) → T005 → T006 → T007 → T008 → T009 (por onda) → T010; T011 em separado.

## 5. Analyze (auditoria crítica, 15/11/2026)
Cruzamento da Constituição, da seção 1, das respostas (2.1), do Plan e das Tasks.

- **A1 — Contradição do meu desenho anterior (corrijo, Art. 5).** O "modelo proposto" que apresentei antes (tabelas `papeis` etc. no hub, com função SQL de permissão efetiva) **contradiz a resposta 6** ("o hub só recebe; não edita funções") e **duplicaria a fonte da verdade** (vpsistema e hub). O Plan 3.2 troca isso por: função resolvida no vpsistema, hub recebe o achatado. FR06 ("função SQL única no hub") **já é verdade hoje** (`vp_tem_capacidade`), então não exige trabalho novo. **Decisão necessária:** o Gelson confirma que o hub não calcula funções.
- **A2 — FR03 ("negar vence") e FR05 ("negar por padrão") ficam no vpsistema.** O hub só vê o resultado final por pessoa e não consegue provar a regra. O teste dessas regras é do vpsistema (**fora deste repositório**); no hub só se confere o efeito (T001).
- **A3 — Lacuna real de segurança hoje: `valores_acesso` não respeita o modo manual.** Confirmado em 3.1. Sem a T005, tirar alguém do modo manual ou mexer à mão em Valores R$ é desfeito pela próxima sincronia, e o inverso também. Prioridade alta, baixo risco.
- **A4 — Segurança real não vem desta mudança.** `valores_acesso` tem `SELECT` para `anon` e `authenticated` (`using (true)`), e `vp_ve_valor` é executável por `anon`. Função/permissão por departamento organiza o acesso, mas **não fecha a leitura** (Art. 25, issue #571). Não prometer mais do que isso na tela nem no doc.
- **A5 — "Valores R$" na função depende de etiquetas sem regra.** Só 12 etiquetas têm regra no banco (`vp_valores_regra`); a matriz da resposta 5 cita etiquetas fora disso (**Não verificado** a lista completa em `valores_acesso`). Atribuir uma etiqueta sem regra **não protege nada**. A T004 deve listar quais etiquetas da matriz ainda não têm regra antes de a matriz ser aprovada.
- **A6 — Risco de perda de acesso na migração.** São 31 perfis manuais, 459 linhas de origem diferente do vpsistema e a tela avisa que voltar a sincronizar pode apagá-las. Mitigação: T008 antes de T009, onda por departamento, reversão pelo `hub_set_acesso_manual`.
- **A7 — Dependência externa não visível daqui.** T002, T003 e T004 são do vpsistema, cujo repositório **não foi lido**; os prazos e a viabilidade do contrato `origem` (T006) são **Não verificados**. Se o vpsistema não puder enviar `origem`, a FR08 vira só "função × exceção" calculada na T001, sem campo novo.
- **A8 — Casos de borda.** Pessoa sem departamento no vpsistema (ABERTO 1); conta de sistema com 0 alçadas (ABERTO 3); parceiro externo com e-mail fora do domínio (resp. 3); 1 perfil ativo sem colaborador e 13 colaboradores sem perfil (duplicados) — T002 precisa tratá-los **antes** de qualquer função por departamento.
- **A9 — Constituição.** Nada aqui altera o `CLAUDE.md` (Art. 13). Migrations T005/T006 pedem "Confirmo" (Art. 14/31) e nascem **sem** abrir política para a chave pública (Art. 26). T010 segue Art. 42/46/52. Sem nomes de pessoas no repositório (Art. 28).
- **A10 — Teste (Art. 33/34).** T005 e T006 têm regra de negócio no banco: testar em transação desfeita antes do "Confirmo"; T007 é tela: abrir de verdade (já há script de navegador local para isso). Testes de unidade só onde houver lógica pura nova no hub (hoje nenhuma prevista).

**Correções que o Analyze pede antes de implementar (aguardam decisão do Gelson):** (1) confirmar A1 (hub não calcula funções); (2) aprovar T005 como primeiro passo isolado; (3) decidir os 5 pontos ABERTOS, que destravam T003/T004.
