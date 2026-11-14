# Permissões por função/departamento (alçadas e "Valores R$")

> **Status:** Specify e Clarify escritos em 14/11/2026. **Plan, Tasks e Analyze só depois das respostas do Gelson** (Art. 37). Nada de migration, tabela, deploy ou mudança de permissão sem "Confirmo" (Art. 14).
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

## 3. Plan / 4. Tasks / 5. Analyze
**Pendentes** (só depois do Clarify). Esboço, sem compromisso: tabelas à la Spatie (`papeis`, `papel_permissoes`, `perfil_papeis`, `perfil_permissoes` com `efeito`), função SQL de permissão efetiva, relatório "quem perderia o quê" antes de qualquer carga, e contrato do `vpsistema-sync`.
