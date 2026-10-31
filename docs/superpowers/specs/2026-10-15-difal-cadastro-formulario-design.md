# DIFAL do cadastro ao Formulário — Inscrição Estadual, Contribuinte e aviso

Data: 15/10/2026 · Status: **desenho aprovado em conversa, aguardando revisão deste arquivo** · Nenhum código escrito.

## 1. Problema

O DIFAL só entra no preço na **Precificação**. Quem alimenta o motor (`finalidade_compra` + `contribuinte_icms`) é o vendedor, e esse dado quase não existe:

- Dos 1.230 clientes, **1.215 não têm "Contribuinte de ICMS" respondido** e só **1 tem Inscrição Estadual** (consulta de 15/10/2026).
- O cadastro de cliente nasce com `contribuinte_icms = false` (`cadastros.jsx`, `FORM_VAZIO`), então "não respondido" parece "Não".
- O **Lead não tem** campo de Inscrição Estadual nem de Contribuinte.
- A consulta ao Omie (`omie-buscar-cliente`) não devolve Inscrição Estadual, Contribuinte nem endereço, embora o Omie tenha (caso ESCAMAX DF: IE 0788776500196, contribuinte "S").
- O Formulário de Equipamentos não mostra nada do DIFAL ao vendedor.
- A Precificação calcula com DIFAL zerado e **sem avisar**.

**Caso real — cotação 984 (MALDIVAS INCORPORACAO SPE LTDA, Florianópolis/SC):** finalidade vazia, contribuinte vazio, sem IE, cliente fora do Omie. Precificação calculada com `valor_difal = 0` e mensagem "Informe se o cliente é Contribuinte de ICMS…". Valor da operação R$ 218.465,51. Se o cliente for não contribuinte, o DIFAL é custo da VerticalParts (GNRE) e o preço está errado.

## 2. Regras (decididas com o usuário)

1. **Pergunta única** no Lead e no Cliente: *"Esta empresa tem Inscrição Estadual?"* com 3 respostas:
   - **Sim** → pede o número da IE; grava `contribuinte_icms = true`.
   - **Não / isento** → grava `contribuinte_icms = false`.
   - **Não sei ainda** → **deixa em branco** (`null`). Nunca vira "Não" sozinho.
2. O dado **viaja**: Lead → Cliente (ao converter) → Formulário (pré-preenchido; o vendedor confirma ou corrige). Continua **obrigatório para enviar** a cotação (rascunho segue livre).
3. **Omie primeiro**: IE e Contribuinte vindos do Omie entram só como **sugestão** que o vendedor confirma.
4. **Aviso do DIFAL no Formulário**, abaixo de "Finalidade da compra": UF da obra, se o DIFAL incide, alíquotas da tabela e quem recolhe (cliente ou VerticalParts). **Sem valor em R$** (o preço ainda não existe).
5. **Mesmo motor** da Precificação (`DifalEngine.calcular`). Não duplicar a regra.
6. **Precificação barrada**: com DIFAL pendente (sem finalidade ou sem contribuinte) mostra alerta vermelho no topo e **não permite aprovar nem gerar Proposta**.
7. **Lista de pendências**: cotações abertas cujo DIFAL não está resolvido.
8. **Atualização de Custos intocada**: a tabela `difal_estados` e `cadastro-custos*` / `difal-engine.js` só são **lidos**. Qualquer mudança neles exige o "Confirmo" do usuário (trava de 13/10/2026). Este desenho não precisa alterá-los.

## 3. Componentes

| Peça | Mudança |
|---|---|
| `leads` (banco) | + `inscricao_estadual text`, + `contribuinte_icms boolean` (nulos). Migration aditiva, exige CONFIRMO ao aplicar. |
| `comercial.jsx` (Novo/Editar Lead) | Pergunta de 3 respostas + campo do número. |
| `cadastros.jsx` (Cliente) | Mesma pergunta; **`contribuinte_icms` passa a nascer `null`**, não `false`. |
| Conversão Lead→Cliente (`criarOuVincularDeLead`) | Leva IE e Contribuinte. |
| `omie-buscar-cliente` | Devolve também `inscricao_estadual`, `contribuinte` e endereço. **Testar numa cópia antes de redeployar** (histórico de BOOT_ERROR). |
| `EnderecoAPI.consultarCnpjOmieFirst` | Repassa esses campos; preenche só campos vazios, como sugestão. |
| `formulario-elevador.jsx` | Pré-preenchimento + quadro de aviso do DIFAL (componente próprio, lê `difal_estados`). |
| `precificacao-elevador.jsx` / store | Alerta e bloqueio de aprovar/gerar Proposta com DIFAL pendente. **`precificacao-elevador.jsx` e o store são áreas blindadas** (Containers e Mão de obra): só tocar a região do alerta/bloqueio, com confirmação explícita antes de editar. |
| Pendências de DIFAL | Lista somente leitura (local a definir no plano: Controle de Cotações ou Prazos & Pendências). |

## 4. Fluxo de dados

`Lead (pergunta IE)` → `Cliente (herda; Omie sugere)` → `Formulário (pré-preenchido, vendedor confirma, obrigatório)` → `aviso do DIFAL (tabela + DifalEngine)` → `Precificação (calcula; bloqueia se pendente)` → `Proposta`.

## 5. Erros e casos de borda

- Omie fora do ar / `encontrado: null`: nunca tratar como "não tem IE"; segue em branco.
- PF (CPF): a pergunta existe, mas a consulta de CNPJ não roda.
- Cliente já com Contribuinte `false` gravado antes desta regra: não dá para distinguir "Não" de "nunca respondido". Por isso não há correção em massa; o dado é confirmado quando a cliente for aberto num Formulário.
- UF de destino sem linha em `difal_estados`: aviso "sem regra cadastrada", sem bloquear.
- Operação interna (SP→SP) ou revenda: sem DIFAL, como o motor já faz.
- Revenda + não contribuinte: mantém o alerta amarelo existente.

## 6. Fora desta entrega

- Consulta SEFAZ / Sintegra (decidir depois de medir quantos clientes o Omie já resolve).
- Correção em massa dos 1.215 clientes sem resposta.
- Valor do DIFAL em R$ no Formulário.

## 7. Cotação 984 — resolução

Depende de duas respostas do usuário (não inventar): **finalidade** (uso/consumo/ativo ou revenda) e se a MALDIVAS tem **IE ativa em SC** (e qual). Depois: Regiane destrava o Formulário (com motivo), preenche, e a Precificação é **recalculada**. Esta é uma correção de dados reais, feita à parte do código e só com autorização.

## 8. Testes

- Unidade: regra das 3 respostas → contribuinte (`true/false/null`); herança Lead→Cliente→Formulário; função pura do aviso (UF, categoria, alíquotas, responsável).
- Precificação: DIFAL pendente bloqueia aprovar/gerar Proposta; resolvido, libera.
- Omie: cópia da Edge Function devolve IE/contribuinte do ESCAMAX DF (`codigo_cliente_omie` 709496211).
- `npm test`, `node scripts/check-cache-bust.js origin/main`, CI e E2E.
- Verificação no navegador local com cliente de teste descartável (apagado no fim).

## 9. Próximo passo

Revisão deste arquivo pelo usuário → `writing-plans` (plano de implementação em etapas pequenas).
