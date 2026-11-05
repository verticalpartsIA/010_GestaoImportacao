# 5 Financeiro & Preços — documento do módulo (REAL, fonte da verdade — 31/10/2026)

> **Status: REAL (documento oficial do módulo 5), aprovado pelo Gelson em 31/10/2026**, no molde de `01_geral.md`, `02_crm.md`, `03_cadastros_mestres.md` e `04_comercial_pre_venda.md`. Histórico de entrega (PR, hash) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é onde o **preço** e o **dinheiro** se formam. O preço de venda sai daqui e vira Proposta, Contrato e comissão; os avais daqui liberam a **compra na China**. Um número errado se espalha. As tabelas da Atualização de Custos estão sob a **trava por "Confirmo"** do `CLAUDE.md` (5.1) e duas áreas da Precificação são **🔒 blindadas** (5.2): este documento descreve o que existe e **aponta** a lei, não a afrouxa.
>
> **Fonte da verdade:** o código e o banco, conferidos em 31/10/2026 (`origin/main` `980586c`). **Conferido** quer dizer lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** quer dizer que veio do `CLAUDE.md` ou de uma spec e **não** foi reconferido agora; **Não verificado** é o que não foi possível conferir. Sem selo vale como Não verificado (Art. 6). Sem número de linha (envelhece): cita-se arquivo e função.
>
> **Escopo do módulo:** as cinco telas do grupo "Financeiro & Preços" do menu (`NAV_GROUPS` em `shell.jsx`): **Atualização de Custos**, **Precificação**, **Aval Financeiro**, **Emissão de NF** e **Comissões**. O mapa do `CLAUDE.md` listava "Precificação, Atualização de Custos, Avais" e não citava Emissão de NF nem Comissões; **vale o menu** (Conferido). Fora deste módulo: Formulário, Cotação a Fornecedor e Proposta (4); Aval Jurídico e Contrato de Venda (6); P.I. e Embarques (7); Prazos & Pendências, Central de Decisões, Notificações e Dashboard (1); Pagamentos a Instaladores (11); Expedição e a leitura de pedidos do Omie (12 e 13).
>
> **Arquivos do módulo que moram em arquivos de outro módulo (Conferido):** `ComissoesPage` está em `financeiro.jsx` (o arquivo de Prazos & Pendências e Notificações, módulo 1); `PropostasPage` está em `precificacao.jsx` (descrita no 4.5).

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md` ("Como esta numeração funciona"). Aqui vale a mesma: módulo = **5**; telas filhas = **5.1 a 5.5**, na ordem do menu; o conteúdo comum fica na **Parte comum**, com prefixo PC-.
- **Tudo o que é janela, aba, cartão ou modo de uma tela pertence a ela.** Na 5.1 estão as seis abas; na 5.2 a fila, o detalhe de cálculo, a Memória de cálculo, os modais e o modo "Outros projetos"; na 5.3 as cinco janelas de ação.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
5. **Financeiro & Preços**
   5.1 Atualização de Custos (seis abas: Instalação — Elevadores, Instalação — Escada/Esteira, Containers, Frete interno, DIFAL, Regras de ICMS)
   &nbsp;&nbsp;&nbsp;5.1.1 O que é · 5.1.2 Rota e arquivos · 5.1.3 Perfil e acesso · 5.1.4 O que a tela mostra · 5.1.5 Botões e controles · 5.1.6 Comportamento · 5.1.7 Dados (lê/grava) · 5.1.8 Regras e armadilhas · 5.1.9 Testes · 5.1.10 Pendências e decisões · 5.1.11 Histórico
   5.2 Precificação (fila, detalhe de cálculo, Memória de cálculo e modo "Outros projetos")
   &nbsp;&nbsp;&nbsp;5.2.1 O que é · 5.2.2 Rota e arquivos · 5.2.3 Perfil e acesso · 5.2.4 O que a tela mostra · 5.2.5 Botões e controles · 5.2.6 Comportamento · 5.2.7 Dados (lê/grava) · 5.2.8 Regras e armadilhas · 5.2.9 Testes · 5.2.10 Pendências e decisões · 5.2.11 Histórico
   5.3 Aval Financeiro (fila e cinco janelas)
   &nbsp;&nbsp;&nbsp;5.3.1 O que é · 5.3.2 Rota e arquivos · 5.3.3 Perfil e acesso · 5.3.4 O que a tela mostra · 5.3.5 Botões e controles · 5.3.6 Comportamento · 5.3.7 Dados (lê/grava) · 5.3.8 Regras e armadilhas · 5.3.9 Testes · 5.3.10 Pendências e decisões · 5.3.11 Histórico
   5.4 Emissão de NF
   &nbsp;&nbsp;&nbsp;5.4.1 O que é · 5.4.2 Rota e arquivos · 5.4.3 Perfil e acesso · 5.4.4 O que a tela mostra · 5.4.5 Botões e controles · 5.4.6 Comportamento · 5.4.7 Dados (lê/grava) · 5.4.8 Regras e armadilhas · 5.4.9 Testes · 5.4.10 Pendências e decisões · 5.4.11 Histórico
   5.5 Comissões
   &nbsp;&nbsp;&nbsp;5.5.1 O que é · 5.5.2 Rota e arquivos · 5.5.3 Perfil e acesso · 5.5.4 O que a tela mostra · 5.5.5 Botões e controles · 5.5.6 Comportamento · 5.5.7 Dados (lê/grava) · 5.5.8 Regras e armadilhas · 5.5.9 Testes · 5.5.10 Pendências e decisões · 5.5.11 Histórico
   Parte comum de Financeiro & Preços (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 Como o preço se forma (herança e cálculo) · PC-3 Os avais e a liberação da compra · PC-4 As três "comissões" · PC-5 Imposto e margem: ICMS, DIFAL e a regra dos 15% · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos e rotinas · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
6. Contratos & Jurídico → `06_contratos_juridico.md` (REAL)

## Glossário (módulo Financeiro & Preços)
Termos gerais (soft-delete, alerta, alçada, Nº da cotação) estão no glossário de `01_geral.md`; **Código do equipamento**, **Cotação a fornecedor**, **Proposta**, **Líder** no de `04_comercial_pre_venda.md`; **Omie primeiro** no de `03_cadastros_mestres.md`. Não se repetem aqui.
- **Atualização de Custos:** as tabelas de referência de custo que a Precificação herda. Está sob a **trava por "Confirmo"** do `CLAUDE.md`.
- **Tração (2:1 / 4:1):** modo de suspensão do elevador; chave da tabela de mão de obra.
- **Mão de obra (MO):** custo de instalar um equipamento, achado por tração × capacidade × paradas na tabela de instalação. Cada equipamento físico paga a sua.
- **Linha estimada (`is_estimativa`):** valor da tabela de MO sugerido por regressão estatística, nunca uma cotação real; exige aprovação antes de virar preço.
- **Projeto especial:** combinação de tração/capacidade/paradas fora da cobertura da tabela de MO; o valor não entra sozinho na conta.
- **Capatazia, GRI, AFRMM:** custos de container. Capatazia = movimentação no porto; **GRI** (General Rate Increase) = sobretaxa do frete marítimo; **AFRMM** = adicional ao frete para a Marinha Mercante, **8% de (preço + capatazia + GRI)**, calculado, nunca digitado.
- **Frete interno (L / LS):** tabela Santos → 27 capitais de duas transportadoras. **L** = carga solta; **LS** = caminhão compatível com container fechado. O valor é **por container**.
- **DIFAL:** diferencial de alíquota de ICMS. Pode ser custo da VerticalParts (cliente não contribuinte, guia GNRE) ou do cliente (contribuinte).
- **VMLE / VMLD / CIF:** valor das mercadorias no local de embarque / de destino / custo + seguro + frete. Siglas da planilha do Financeiro.
- **Mark-up (% do preço):** neste módulo é uma **margem sobre o preço de venda**, não sobre o custo. Preço = custo da nota ÷ (1 − impostos da venda − mark-up).
- **Margem efetiva / margem mínima:** margem real do cálculo / piso (15% no parâmetro padrão) abaixo do qual a aprovação pede confirmação e o CEO entra.
- **VPPC-0990 / VPPC-0990-B:** número da precificação: o mesmo inteiro da cotação com prefixo próprio e, quando o fornecedor revisou, a letra da revisão.
- **Lucro líquido por equipamento:** parte do lucro total de cada equipamento depois de pagar a sua mão de obra. A soma fecha sempre no lucro total.
- **Lucro líquido desejado (CEO):** valor que o CEO quer receber por equipamento; a tela calcula o desconto de preço que o produz.
- **PTAX:** cotação oficial do dólar. A Precificação oferece a do dia da cotação (congelada) e a de agora.
- **Aval de Pagamento / Aval de venda (score):** o **primeiro** é o que libera a compra (manual, depois do sinal). O **segundo** é uma consulta de crédito **opcional** que não bloqueia nada.
- **Sinal:** pagamento inicial do cliente, confirmado pelo Financeiro.
- **Teto de custo:** preço de venda × (1 − margem mínima), gravado quando o CEO aprova; os custos reais depois dele são comparados com ele.
- **Conferência proposta × NF:** registro manual, na Emissão de NF, de que a nota confere com a proposta.
- **Histórico (pedido):** pedido já entregue antes do sistema; não tem SLA.
- **Split de comissão / origem da venda:** a regra de comissão divide o valor entre recebedores conforme a "Origem da venda" do formulário.

---

## 5.1 Atualização de Custos

### 5.1.1 O que é
Seis tabelas de referência de custo, editáveis célula por célula, que a **Precificação herda** sozinha conforme o equipamento: mão de obra de instalação de elevador, instalação de escada/esteira, containers (preço, capatazia, GRI, AFRMM calculado), frete interno por capital, DIFAL por estado (com simulador) e regras de ICMS na venda. **Conferido** em `cadastro-custos.jsx`, `cadastro-custos-store.js`, `difal-engine.js` e no banco, 31/10/2026.

**Fora do escopo desta tela:** calcular o preço (5.2); custo de materiais do PCP (módulo 13: `custo_manual`); cadastro de Matérias-Primas e Produtos (3 e 13); os **parâmetros fiscais padrão** (regime, II, PIS, COFINS…), que **não têm tela** (5.2.10 item 1).

**🔒 Trava por "Confirmo" (`CLAUDE.md`, 13/10/2026):** as tabelas `custos_instalacao_elevador`, `custos_instalacao_escada_esteira`, `custos_containers`, `custos_frete_interno`, `custos_frete_observacoes` e `difal_estados`, e os arquivos `cadastro-custos.jsx`, `cadastro-custos-store.js` e `difal-engine.js`, só mudam por sessão do Claude **depois de o Gelson escrever "Confirmo"** para aquela mudança. O uso normal da tela pelos colaboradores **não** é coberto. `regras_icms_venda` não está na lista da trava, mas mora na mesma tela (aba nova de 15/10/2026): **trate com o mesmo cuidado** (Herdado; o Gelson decide).

### 5.1.2 Rota e arquivos
- Rota `cadastro-custos`; URL `/cadastros/cadastro-custos/<aba>`, com `<aba>` = `instalacao-elevadores`, `instalacao-escada-esteira`, `containers`, `frete`, `difal` ou `regras-icms`. Na aba de elevadores a tração vai no 3º segmento (`/2-1`, `/4-1`; o `:` não cabe em URL). Item "Atualização de Custos" do grupo Financeiro & Preços; **o cabeçalho da tela diz "Cadastros · Atualização de Custos" e o caminho de navegação diz "Cadastros"** (o menu está em Financeiro; Conferido). Rota na lista `SYNC_PASSTHROUGH_ROUTES` de `app.jsx`: o `subsel` é o slug da aba. **Conferido** em `shell.jsx`, `router.js`, `app.jsx` e `docs/MAPA_DE_ROTAS.md`.
- Arquivos: `src/cadastro-custos.jsx` (`window.CadastroCustosPage`, seis componentes de aba), `src/cadastro-custos-store.js` (`window.CadastroCustosStore`: listar/salvar/remover, `buscarCustoElevador`, `estimarValorElevador`, `sugerirFrete`, `buscarRegraIcmsVenda`), `src/difal-engine.js` (`window.DifalEngine`), `src/capacidade-passageiros.js` (coluna "Quant. passageiros"). Os campos de dinheiro usam `PZCurrencyInput`, definido em `precificacao-elevador.jsx` (5.2).

### 5.1.3 Perfil e acesso
- **O item do menu não tem `restrict` e a rota não está em `RESTRICTED`** de `app.jsx`: qualquer perfil que veja o menu abre a tela. As outras quatro telas do módulo são restritas ao Financeiro e ao Administrador (5.2.3). O tutorial diz o mesmo ("aberta a mais perfis", Herdado). **Conferido.**
- A alçada `cadastro-custos` existe no catálogo de Administração › Alçadas, mas **a tela não chama `temCapacidade`**. **Conferido** (busca em `cadastro-custos.jsx`).
- **Banco (Conferido, 31/10/2026):** as três tabelas de instalação (elevador e escada/esteira) e containers têm RLS ligada e política `ALL` para `anon` e `authenticated` (tudo liberado à chave pública), **mais** a política de leitura `vp_valores_leitura` e o gatilho `vp_valores_guarda` (modo `fechada`, etiquetas `cadastro-custos.custos` e `precificacao.custos_precificacao`). `custos_frete_interno`, `custos_frete_observacoes` e `difal_estados`: `ALL` para `anon` e `authenticated`, **sem** a guarda de valores. `regras_icms_venda`: leitura para `anon` e `authenticated`; inserir e atualizar **só `authenticated`**. A guarda dispara só para sessão nativa (`authenticated`) e depende de a função `vp_valores_ligado()` estar ligada (a função **não foi lida**); a tabela do piloto `vp_valores_piloto` tem 1 linha (PC-6).

### 5.1.4 O que a tela mostra
Cabeçalho "Cadastros · Atualização de Custos" / **Atualização de Custos** / subtítulo "Tabelas de referência de custo — Instalação de Equipamentos, Containers, Frete interno, DIFAL e Regras de ICMS…"; seletor de seis abas; legenda "Campo editável (preenchimento do usuário)" e "Campo calculado automaticamente". **Conferido.**
- **Instalação — Elevadores:** cartão "Instalação — Elevadores", botões **Tração 2:1** / **Tração 4:1**, tabela **Capacidade máx. (kg) · Quant. passageiros (calculada: kg ÷ 75, arredondado para baixo) · Paradas · Dias p/ montagem · Qtd. montadores · Valor reajustado (R$)** e uma lixeira por linha; selo **Estimativa** nas linhas estimadas; linha sem valor com os dados completos mostra "Sugestão (estimativa, N linhas reais…): R$ X" com o botão **Usar**. Vazio: "Nenhuma linha cadastrada pra tração X ainda — clique em '+ Adicionar linha'."
- **Instalação — Escada/Esteira:** duas linhas fixas (Escada Rolante, Esteira Rolante) com **São Paulo (R$)** e **Outros Estados (R$)**.
- **Containers:** tabela larga (rolagem lateral esperada) com **Tipo · Compr. (m) · Altura · Capac. (m³) · Preço (USD) · Preço (R$) · Capatazia (USD) · Capatazia (R$) · GRI (USD) · GRI (R$) · AFRMM (USD) · AFRMM (R$) · Data cotação · Fornecedor · Observações** e lixeira. As duas colunas de AFRMM são cinza (calculadas, 8%). Sob o Preço (R$) aparece "Câmbio hoje: X" com **Recalcular** quando há USD.
- **Frete interno:** cartão "Tabela de Frete Interno — Contêiner 40' · Porto de Santos" com a referência da planilha; colunas **Origem · Destino · UF · Transportadora 1 (Frete L, Frete LS) · Transportadora 2 (Frete L, Frete LS) · Valor da carga (R$)**; "caso a caso" quando o campo está vazio e há observação; três cartões de observações (gerais, Transportadora 1, Transportadora 2), um campo por observação.
- **DIFAL:** cartão **Simulador de DIFAL** (Destino (UF), Valor da operação (R$), Origem da mercadoria: Estrangeira (importada) ou Nacional) com o resultado do motor; cartão **Tabela de DIFAL por estado** (UF · Estado · Categoria · Alíq. interna · Interestadual nacional · Interestadual estrangeira · Fundo de combate) e a nota "Alíquotas em %, ex.: 20 = 20%".
- **Regras de ICMS:** cartão **Regras de ICMS na venda** (Origem · Destino · Mercadoria · NCM · Alíquota efetiva · Fundamento · Ativa) e cartão **Nova regra** (UF de destino, Mercadoria, NCM (opcional), Alíquota efetiva, Fundamento).

### 5.1.5 Botões e controles
| Controle | O que faz |
|---|---|
| Abas (seis) | Trocam a aba e a URL |
| **Tração 2:1 / 4:1** | Filtram a tabela de MO (a tração vai para a URL) |
| **+ Adicionar linha** (elevadores) | Cria uma linha com capacidade 0 e paradas 1 (placeholder); o Financeiro edita na tabela |
| Célula de MO | Salva **ao sair do campo**; editar o valor tira o selo "Estimativa" |
| **Usar** (sugestão) | Grava o valor estimado e marca a linha como estimativa |
| Lixeira (elevadores) | Pergunta "Remover a linha de até X kg / N paradas? Não afeta precificações que já buscaram esse valor antes" e **apaga de verdade** |
| Células de Escada/Esteira | Salvam ao sair do campo |
| **+ Adicionar container** | Cria "Novo container <hora>" (o tipo é único no banco); o Financeiro renomeia |
| Preço / Capatazia / GRI (USD) | Salvam e recalculam o R$ pelo câmbio de hoje num único save |
| Preço / Capatazia / GRI (R$) | Editáveis; **Recalcular** reaplica o câmbio de hoje |
| Lixeira (containers) | Pergunta "Remover o container …?" e apaga |
| Células do Frete | Salvam ao sair do campo; observações salvam ao sair, e texto vazio não grava |
| Simulador de DIFAL | Só calcula na tela; não grava |
| Categoria / alíquotas do DIFAL | Salvam ao sair do campo (digita-se em %, grava-se fração) |
| Alíquota e Ativa (regras de ICMS) | Salvam na hora (a alíquota ao sair do campo) |
| **Adicionar regra** | Grava a regra nova (exige UF de destino e alíquota entre 0 e 100%) |

### 5.1.6 Comportamento
**Conferido** no código.
1. **Busca de MO** (`buscarCustoElevador`, chamada pela Precificação): tração exata + paradas exatas + `capacidade_max_kg` maior ou igual à do equipamento; vale a **menor capacidade máxima que comporta o elevador**; dentro dela, valor maior que zero primeiro e cotação real antes de estimativa. Mais de uma linha casando gera aviso no console para limpar a tabela. A "capacidade mínima" deixou de existir.
2. **Estimativa:** regressão de mínimos quadrados sobre as linhas reais da mesma tração (precisa de 4 ou mais); descarta variável sem variação; arredonda para múltiplo de 50. Nunca preenche sozinha.
3. **Containers:** USD × câmbio de hoje (`CambioAPI`) preenche o R$ no mesmo save; o R$ continua editável (câmbio é sugestão). O AFRMM é só exibição.
4. **Frete:** `sugerirFrete` (função pura): destino = cidade da obra se for uma das capitais, senão a capital do estado (marca "porUf"); padrão = modalidade LS da transportadora mais barata; só LS sem valor cai para L; total = valor × nº de containers. Campo vazio ou zero não é opção.
5. **DIFAL:** o simulador chama o **mesmo motor** da Precificação (origem fixa SP, finalidade uso/consumo/ativo, contribuinte sim).
6. **Regra de ICMS:** `buscarRegraIcmsVenda` devolve a regra ativa por UF de origem, UF de destino e origem da mercadoria (NCM em branco vale para qualquer NCM). **Falha de consulta lança erro** (o cálculo para; não cai em silêncio no 4%).
7. **Log:** salvar, editar e excluir chamam `VPLog.registrar` (módulo "Cadastros").

### 5.1.7 Dados — o que lê e o que grava
**Lê e grava** (Conferido, contagens de 31/10/2026): `custos_instalacao_elevador` (163 linhas: 121 de tração 2:1 e 42 de 4:1; 2 sem valor; 1 inativa; 0 estimadas), `custos_instalacao_escada_esteira` (2), `custos_containers` (2: 20HC e 40HC, cotação de 29/10/2026), `custos_frete_interno` (27), `custos_frete_observacoes` (23), `difal_estados` (27 UFs) e `regras_icms_venda` (1: SP→SP, importada, 12%, ativa). **Herda de:** digitação do Financeiro (planilhas de origem `DIFAL.xlsx` e aba FRETE, Herdado) e do câmbio ao vivo. **Doa para:** a Precificação (5.2) por cinco caminhos (MO, containers, frete sugerido, DIFAL, ICMS da venda); o Contrato do Instalador e o Dashboard financeiro (custo de instalação, Herdado); Embarques (o tipo de container, 7).

### 5.1.8 Regras e armadilhas
- **Trava por "Confirmo"** (5.1.1). Leitura é livre.
- **Vocabulário de container:** a Precificação grava códigos ISO (`20'DV`, `40'HC`…) e o cadastro usa nomes (`20HC (High Cube)`…). O mapa `CONTAINER_ISO_PARA_CUSTOS` traduz só para achar a linha; **não troque os nomes** (o Embarque lê os códigos ISO). Tipos sem equivalente (Insulated, Open Side, Tank, Ventilated, Hard Top, Pallet Wide) **não herdam preço** de propósito.
- **Edição de linha inteira × de um campo:** na aba de elevadores a edição é um UPDATE de **um campo só** (regra de 31/08/2026: gravar a linha inteira revertia campos editados em sequência rápida). Escada/Esteira e Containers ainda gravam `{ ...linha, [campo]: valor }` (5.1.10 item 3).
- **Percentuais:** digita-se em % (12 = 12%) e grava-se fração (0,12).
- **Larguras mínimas (`minWidth`)** nas colunas de Containers existem para o valor digitado não ser cortado; coluna nova precisa de uma.
- **O 20HC e o 40HC valem o que o Financeiro digitou** (hoje: preço 4.500 e 5.000 US$, capatazia 350 US$, GRI 0). O `CLAUDE.md` cita outros números (ex.: 40HC a US$ 8.780,89 e GRI de US$ 1.000): são de outra data, **não são defeito** (5.1.10 item 5).
- **DIFAL "Base Dupla com FCP"** (Alagoas e Sergipe) é réplica da planilha e **deve ser validada com a Contabilidade** antes do uso real (comentário do motor, Herdado).

### 5.1.9 Testes
**Conferido** (rodados em 31/10/2026): `cadastro-custos-frete.test.js` (7: `sugerirFrete`), `difal-engine.test.js` (13), `capacidade-passageiros.test.js` (4), `regras-icms-venda.test.js` (2: `buscarRegraIcmsVenda`). **Não há teste** da escolha de faixa de `buscarCustoElevador` (o teste do store da Precificação usa uma versão simulada dela), de `estimarValorElevador`, dos salvamentos nem de componente. O e2e só abre a rota (fumaça).

**Cenários de aceitação**
1. *Dado* uma consulta de regra de ICMS que falha, *quando* se busca a regra, *então* a função lança erro e **não** devolve "sem regra" (`regras-icms-venda`).
2. *Dado* uma regra com NCM em branco e outra com NCM, *quando* se busca, *então* vale a regra sem NCM (`regras-icms-venda`; ver 5.1.10 item 6).
3. *Dado* uma obra em cidade fora da tabela de frete, *quando* se sugere o frete, *então* usa a capital do estado e marca `porUf` (`cadastro-custos-frete`).
4. *Dado* "cotado caso a caso" (campo vazio), *quando* se sugere o frete, *então* esse valor não vira opção (`cadastro-custos-frete`).
5. *Dado* um estado de "Base Única", *quando* o motor calcula, *então* DIFAL = valor × (alíquota interna − interestadual); o simulador da aba usa esse mesmo motor (`difal-engine`). **A categoria "Base Dupla com FCP" não tem teste.**

### 5.1.10 Pendências e decisões
1. **Não há tela para os Parâmetros Fiscais padrão** (`parametros_fiscais_elevador`, 1 linha "default": regime Presumido, ICMS venda 4%, II 20%, margem mínima 15%, mark-up padrão 40,5%, comissão do vendedor 2%…). A Precificação diz "para mudar o padrão do sistema, atualize em Parâmetros Fiscais", e o store tem `salvarParametrosFiscais`, mas **nenhuma tela o chama**. Hoje só se muda por SQL. **Achado, sem correção.** Conferido.
2. **A tela é aberta a qualquer perfil** que veja o menu, e a RLS libera tudo à chave pública. A trava por "Confirmo" é só conduta de sessão do Claude (o `CLAUDE.md` já registra o limite honesto). **Decisão do Gelson:** restringir a tela ao Financeiro e ao Administrador, como as outras quatro?
3. **Gravação da linha inteira em Escada/Esteira e Containers** (`{ ...linha, [campo]: valor }`), o mesmo padrão que causou o bug de 31/08/2026 nos elevadores. Hoje com 2 linhas em cada tabela o risco é pequeno. **Achado, sem correção.** Não testado.
4. **Os 27 DIFAL e as 27 capitais** são lidos sem paginar (abaixo de 1.000). Sem risco hoje.
5. **Números do `CLAUDE.md` defasados** (containers, GRI, 20HC a R$ 30.100,20): o banco mostra 20HC a R$ 24.138,45 e 40HC a R$ 26.820,50 (cotação de 29/10/2026). É dado vivo do Financeiro; a seção antiga continua como histórico (Art. 12: ela cita valores que não valem mais).
6. **Só uma regra de ICMS** (SP→SP). Outras UFs caem no 4% global e avisam na Memória de cálculo. A coluna NCM existe mas **a busca ignora o NCM** quando a regra tem um (devolve a primeira regra sem NCM, senão a primeira da lista). Conferido.
7. **Texto do Copiloto** desta tela está desatualizado (5.5 PC-10).
8. **Ajuda "?" não existe** para `cadastro-custos`; o tutorial existe (PC-10).
9. **Sem teste de componente nem da escolha de faixa da busca de MO** (5.1.9).

### 5.1.11 Histórico
A aba de DIFAL e a de Frete interno chegaram em 10/10/2026; a de Regras de ICMS em 15/10/2026 (SP→SP importado a 12%, com "Confirmo"); as colunas AFRMM e as larguras mínimas dos Containers, em 13/10/2026 (com "Confirmo").

---

## 5.2 Precificação

### 5.2.1 O que é
A tela onde o Financeiro forma o **preço de venda** de uma cotação de elevador. Tem dois modos: **Elevadores** (o padrão e o real) e **Outros projetos** (uma calculadora antiga). No modo Elevadores há a **fila** (as cotações já respondidas pelo fornecedor, ou os formulários enviados direto) e o **detalhe de cálculo** de cada cotação (VPPC-<Nº>), que herda o Formulário, a resposta do fornecedor e as tabelas da 5.1, aplica o **método da planilha do Financeiro**, rateia o preço por equipamento e, ao **aprovar**, cria a Proposta. **Conferido** em `precificacao.jsx`, `precificacao-elevador.jsx`, `precificacao-elevador-store.js`, `precificacao-elevador-engine.js`, `precificacao-memoria.jsx` e no banco, 31/10/2026.

**Fora do escopo desta tela:** o Formulário e a Cotação a Fornecedor (4.1 e 4.3); editar e enviar a Proposta (4.5); os avais e a compra (5.3 e 4.3); as tabelas de custo (5.1); o cálculo de escada e esteira (não têm motor próprio; entram na fila com preço de venda lançado à mão, ver 5.2.6 e 5.2.11).

### 5.2.2 Rota e arquivos
- Rota `precificacao`; URL `/comercial/precificacao[/<id da precificação>]` (o id vai no `subsel` e na URL; voltar do navegador fecha o detalhe). Item "Precificação" do grupo Financeiro & Preços, restrito (5.2.3); **o caminho de navegação diz "Comercial / Precificação"** (o rótulo do menu é Financeiro). O modo (Elevadores ou Outros projetos) é estado local, **não vai para a URL**. **Conferido** em `shell.jsx`, `router.js`, `app.jsx` e `docs/MAPA_DE_ROTAS.md`.
- Arquivos: `src/precificacao.jsx` (`PrecificacaoPage`, o modo "Outros projetos" e a `PropostasPage` do 4.5), `src/precificacao-elevador.jsx` (fila, detalhe, modais, `PZCurrencyInput`, `PZPercentInput`), `src/precificacao-elevador-store.js` (herança, mão de obra, cálculo, aprovação), `src/precificacao-elevador-engine.js` (motor), `src/precificacao-memoria.jsx` (`window.PZMemoriaCalculo`), `src/difal-engine.js`, `src/cambio-api.js`, `styles/planilha.css`.

### 5.2.3 Perfil e acesso
- **Restrita ao Financeiro e ao Administrador** (`restrict` no menu e `RESTRICTED` em `app.jsx`). **A tela não chama `temCapacidade`** e `aprovar()` não confere alçada nem papel. A alçada `precificacao` existe no catálogo e **não** é conferida. **Conferido.**
- **Banco (Conferido):** `precificacoes_elevador` (RLS ligada) tem `ALL` para `anon` e `authenticated` **mais** `vp_valores_leitura` e o gatilho `vp_valores_guarda` (modo `fechada`, etiquetas `precificacao.custos_precificacao` e `precificacao.margem`). `parametros_fiscais_elevador`: `ALL` para `anon` e `authenticated`. Está na publicação de Realtime, mas **a tela não escuta** (nenhum `channel(` no arquivo).

### 5.2.4 O que a tela mostra
**Fila (modo Elevadores).** Cabeçalho "Financeiro · Precificação" / **Precificação — Equipamentos** / "Cotações já respondidas pelo fornecedor, ou formulários enviados direto (preço já combinado por fora)…"; seletor **Elevadores / Outros projetos**; busca "Buscar Cotação Nº, cliente ou fornecedor…" (acha também o rótulo formatado, ex. "VPCT-0950-B"); tabela **Cotação Nº · Cliente · Fornecedor · Respondido em · Decisão de compra · Precificação · Abrir**, todas ordenáveis. "Precificação" mostra Não iniciada, Recebida, Em análise (calculada) ou Aprovada. Linha sem fornecedor mostra "Direto (sem fornecedor)"; fornecedor com revisão mais nova mostra "· substituída por …" em vermelho.

**Detalhe (de cima para baixo).** Título com o número da precificação e o selo "Cotação Nº …"; aviso vermelho "Verifique os valores antes de enviar" (câmbio fora de 1 a 20, mark-up de 100% ou mais, ou preço absurdo diante do custo); cartões:
1. **Unidades desta cotação** (herdado do Formulário e da resposta do fornecedor): UNIDADE (com a faixa de códigos dos equipamentos físicos), Modelo (fornecedor), Quantidade, **% sobre o dólar**, **(USD) PTAX No dia da Cotação**, **(USD) PTAX Agora**, Custo Fornecedor (USD), **Custo Fornecedor (R$) — dólar do cálculo** (amarelo), R$ no dia da cotação, R$ agora; linha "Total do fornecedor (VMLE)"; aviso quando o preço está calculado com o dólar antigo; nota "Dólar usado no cálculo".
2. **Mão de obra — busca automática:** Unidade (código do equipamento físico), Tração, Capacidade (com passageiros), Paradas, Situação (Confirmado, Estimativa — não confirmada, Projeto especial, Pendente, Fora do escopo VP), Regra usada, Valor (R$); selo "manual" no equipamento acrescentado.
3. **Despesas de importação:** VMLE (USD) *, Seguro (USD), Frete internacional informado (USD) (só se já houver valor), Siscomex (R$), Câmbio (R$/US$) * com "Dólar agora" e **Usar**, Outras despesas (R$), Despachante + Desembaraço (R$), Demurrage (R$); linhas de **Containers** (Tipo, Qtd, Preço do container, Capatazia, GRI) com subtotais e aviso "Difere do cadastro de Containers".
4. **Despesas Operacionais — Instalação e Montagem:** lista fixa de 7 itens (MÃO DE OBRA somente leitura = soma da tabela acima; CUSTOS ENGENHARIA, ART, ANDAIME, TALHA, EMPILHADEIRA, AJUDANTES).
5. **Despesas Extras:** Frete interno (R$), Armazenagem (R$), % de Serviços, Contingência (R$), Outros custos não recuperáveis (R$), **Ad - Valorem (R$)** (só leitura, 0,1% do VMLD, depois de Calcular), faixa **Sugestão automática do frete interno**, e **Itens avulsos**.
6. **Resumo de Custos** (14 linhas e a Soma; "Custos Imposto" e "AFRMM" só depois de Calcular).
7. **Alavancas do Financeiro:** MARK-UP (% do preço de venda) *, Comissão consultoria (%) — 0 a 5% *, Comissão vendedor (%) *, Comissão indicação (%), Margem mínima (%); botão "Ver/editar parâmetros fiscais (regime, impostos)" com 12 campos do snapshot desta precificação.
8. **DIFAL** (resultado) ou **"DIFAL — cadastro do cliente incompleto"** com o botão de devolução ao Vendas.
9. **Formação do Preço** (texto do método) e, depois de calcular, **Preço de venda:** custo econômico completo, a tabela por equipamento (VLR Proposta; Lucro líquido por Equip.; Lucro líquido desejado (CEO); Desconto no preço; Preço p/ Venda), total da cotação, Equipamento × Mão de obra pelo "% de Serviços", Margem efetiva, Lucro final e os avisos de divisor inválido, margem negativa e abaixo da mínima.
10. **Memória de cálculo — método da planilha** (só leitura, ao vivo) com as abas **Resumo, 1 · Importação (CIF), 2 · Impostos da importação, 3 · Instalação e despesas, 4 · Impostos e créditos da venda, 5 · Preço, comissões e lucro, 6 · Equipamentos, 7 · Containers e frete**.

**Modo "Outros projetos"** (calculadora antiga): cabeçalho "Comercial · Precificação" / **Precificação**; três KPIs (Projetos convertidos, Com análise aprovada, Valor em pipeline); busca; tabela Projeto · Cliente · Valor · Status; e, ao clicar, a calculadora (FOB, câmbio, impostos, custos técnicos da Análise Técnica, despesas locais, margem + comissão), o "Resumo" e "Histórico de Versões".

### 5.2.5 Botões e controles
| Controle | O que faz |
|---|---|
| **Elevadores / Outros projetos** | Troca o modo |
| Linha da fila / **Abrir** | Abre a precificação existente, ou **cria** uma nova (herança do Formulário e do fornecedor) |
| **Voltar** (detalhe) | Volta à fila e limpa a URL |
| **Salvar rascunho** | Grava sem calcular |
| **Calcular** | Valida os obrigatórios, grava e roda o motor (6.1 abaixo) |
| **Aprovar precificação** | Só depois de calcular; trava e cria a Proposta (5.2.6 item 10) |
| **Ressincronizar do fornecedor** | Compara com a resposta do fornecedor, mostra o que vai mudar e pede confirmação |
| **Acrescentar equipamento** | Abre "Acrescentar equipamento" (idêntico a um já cotado, ou novo com tração/capacidade/paradas; quantidade) |
| **Recalcular** (mão de obra) | Refaz a busca com o dado atual do Formulário |
| **Trocar** (por equipamento) | Edita tração/capacidade/paradas e **grava no Formulário** da Unidade |
| **Remover** (por equipamento) | Abre "Excluir Mão de obra deste equipamento?" com caixa de ciência; exclui **só a mão de obra** |
| **Devolver ao cálculo** | Desfaz o Remover |
| Marcadores de PTAX e **% sobre o dólar** | Escolhem o dólar do cálculo (PTAX marcada × (1 + %)) e preenchem o Câmbio |
| **Usar** (Dólar agora) | Copia o dólar ao vivo para o Câmbio |
| **+ Adicionar container** / lixeira | Adiciona e remove linhas de container |
| **Usar sugestão** (frete) | Aplica o frete sugerido; escolher a transportadora/modalidade na lista; sem cidade conhecida pede a capital |
| **+ Adicionar item** / lixeira (avulsos) | Itens livres de despesa |
| **Preencher todos** / **Limpar** (CEO) | Aplicam ou limpam o líquido desejado de todos os equipamentos |
| **Levar ao cálculo** | Ajusta o MARK-UP para o total fechar no preço sugerido pelo CEO; depois é preciso **Calcular** |
| **Ver/editar parâmetros fiscais** | Mostra os 12 percentuais do snapshot desta precificação |
| **Devolver ao Vendas para completar o cadastro** | Avisa o vendedor dono da cotação (alerta individual com link para o cliente) |
| Abas da Memória de cálculo | Trocam o passo mostrado |
| "Outros projetos": **Exportar planilhas**, **Nova precificação**, **Versões**, **Duplicar** (os dois últimos **desabilitados**), **Gerar proposta** | Exporta CSV; abre a calculadora; só navega ao editor |

### 5.2.6 Comportamento
**Conferido** no código.
1. **Nascimento:** abrir uma linha sem precificação **cria** a precificação (`criar`). O número é o do Nº da cotação com prefixo VPPC (`VPPC-0990`) e a **letra da revisão do fornecedor** (`-B`); colisão avança para a próxima letra livre, mas antes reaproveita a precificação já existente da mesma cotação (corrida de dois cliques). O rascunho herda: unidades e quantidades do Formulário (ou da resposta do fornecedor), preço unitário e VMLE da resposta, frete internacional e taxas extras do fornecedor, **containers** da resposta (`parseContainerNo`, ex. "1x40HC + 1x20GP") com preço, capatazia e GRI do cadastro, parâmetros fiscais padrão (snapshot), mark-up padrão, comissão do vendedor e de indicação padrão, **consultoria em branco**, 30% de serviços.
2. **Mão de obra:** cada Unidade com quantidade N vira **N linhas**; os códigos dos equipamentos físicos são **corridos de 1 a N**, ordenados da menor para a maior quantidade de paradas (empate: menor capacidade), nunca com sufixo aninhado. O equipamento acrescentado fica só nesta precificação e **nunca** vira Unidade do Formulário. **Remover** nunca mexe na quantidade: só marca a MO como excluída (`moExcluidos`).
3. **Reaplicação da herança de containers a cada abertura** da tela: preenche só o que está vazio; nunca sobrescreve valor digitado.
4. **Dólar:** o campo "Câmbio (R$/US$)" é o único que o motor usa. Marcar uma PTAX ou digitar o % sobre o dólar preenche o câmbio; o preço de venda só refaz ao **Calcular** (aviso amarelo enquanto estiver desatualizado). O câmbio da cotação é o do dia da resposta do fornecedor, congelado.
5. **Frete interno sugerido:** preenche sozinho **só** se o campo está vazio (uma vez por abertura); o digitado nunca é sobrescrito.
6. **Calcular** (`calcularEsalvar`): (a) acha a **regra de ICMS da venda** pela UF de destino (a UF da obra; senão a do cliente; UF normalizada sem espaço e em maiúscula) e grava a alíquota e a regra no snapshot; sem regra, volta ao % global e marca "sem_regra"; (b) roda o motor numa 1ª passada sem DIFAL; (c) calcula o **DIFAL** sobre o **preço do equipamento** (preço × (1 − % de serviços)), iterando até a base igualar o equipamento final (até 30 voltas); (d) roda o motor de novo com o DIFAL (quando é custo da VerticalParts); (e) grava `resultado` (motor antigo, V1) e `resultado_v2` (**o oficial**), `difal`, o snapshot e `status = calculado`. Falha na consulta de ICMS interrompe o cálculo.
7. **Validação antes de calcular:** células obrigatórias (VMLE > 0, Câmbio > 0, Mark-up preenchido, Consultoria de 0% a 5%, Comissão do vendedor > 0) acendem em vermelho; Câmbio fora de 1 a 20 e Mark-up de 100% ou mais bloqueiam com aviso.
8. **Método:** `calcularPlanilha` (PC-2): preço = custo da nota ÷ (1 − impostos da venda − mark-up). O V1 e os dois modos antigos (markup sobre o custo, margem sobre a venda) continuam no código só para testes e precificações antigas; precificação antiga é convertida ao recalcular.
9. **Preço por equipamento:** o total é rateado pelo custo do fornecedor em US$ (`ratearPorModelo`); o **lucro líquido por equipamento** é o rateio do lucro total menos a MO de cada um (`ratearLucroPorEquipamento`; a soma fecha no lucro total). O **líquido desejado do CEO** vira desconto de preço = (líquido calculado − desejado) ÷ (1 − % impostos da venda − % comissões); **"Preço p/ Venda" não alimenta a Proposta sozinho**. "Levar ao cálculo" devolve a alavanca (`alavancaParaPreco`).
10. **Aprovar** (`aprovar`): exige resultado calculado; confere campos obrigatórios (VMLE, câmbio, unidades, ao menos 1 item de instalação, comissão do vendedor, consultoria de 0 a 5%); se a margem efetiva (V2; V1 se não houver V2) está abaixo da mínima, **pede confirmação** (`forcarAbaixoMinima`); grava `status = finalizado`, quem e quando; registra em `vp_logs`; e **cria a Proposta automaticamente** (`criarPropostaAutomatica`: número VPPR-<Nº>[-letra], idempotente por revisão, fixa esta precificação com `precificacaoId`; falha aqui não desfaz a aprovação, só avisa no console). A Proposta nasce editável.
11. **Devolver ao Vendas:** alerta individual ao vendedor dono (`created_by`) com link para o cadastro do cliente; sem dono não publica aviso global, só registra em `vp_logs`.
12. **Ressincronizar:** faz um ensaio (`dryRun`), mostra as diferenças de modelo/valor/VMLE e pede confirmação; sem fornecedor de origem (envio direto) lança erro claro.

### 5.2.7 Dados — o que lê e o que grava
**Lê:** `cotacoes_elevador_fornecedor` (respondidas, em análise, aprovadas, categoria elevador), `formularios_elevador` (+ `clientes`, `_unidades`), `precificacoes_elevador`, `parametros_fiscais_elevador`, `custos_*`, `difal_estados`, `regras_icms_venda`; PTAX por `CambioAPI`. **Grava:** `precificacoes_elevador` (37 linhas: 9 rascunho, 1 calculado, 27 finalizadas), `formularios_elevador_unidades` (só o "Trocar"), `propostas` (a automática, pelo `PropostaStore`), `alertas` (devolução ao Vendas) e `vp_logs`. **Herda de:** 4.1 (Formulário), 4.3 (resposta, câmbio, containers), 5.1 (custos) e dos parâmetros fiscais. **Doa para:** a Proposta (preço por equipamento rateado, códigos, MO por equipamento, forma de pagamento; **o DIFAL não aparece** na proposta, 4.5), o Aval Financeiro (margem para a regra do CEO e teto de custo, 5.3), a Central de Decisões (1.3), o Contrato de Venda e o do Instalador via Proposta (6 e 11), a P.I. e o Embarque (7), o Projeto de Elevadores (códigos dos equipamentos, 8 e 9) e Prazos & Pendências (etapa "Precificação"). **Conferido** nos stores; o que passa pela Proposta está em `04_comercial_pre_venda.md`.

### 5.2.8 Regras e armadilhas
- **🔒 Área blindada — Preço (R$) de Containers (`CLAUDE.md`, 28/09/2026):** a herança do preço só preenche container **sem preço nenhum**; `tipo_tamanho` continua em códigos ISO; a herança é **reaplicada em `carregar()`** (não volte a um `obter(id)` puro) e não persiste sozinha (o Financeiro precisa salvar); tipos sem equivalente ISO ficam em R$ 0,00 de propósito. Capatazia e GRI seguem a mesma regra. **Pare e confirme antes de editar.**
- **🔒 Área blindada — Mão de obra × quantidade > 1 (`CLAUDE.md`, 28/09/2026):** uma Unidade de quantidade N vira N linhas; a numeração é corrida; "Trocar" aparece em toda linha do grupo e a linha em edição é identificada pela `chave` (unidade + índice), nunca só pelo `unidadeId`; "Remover" **nunca** mexe em `quantidade`; "Acrescentar" só mexe no snapshot desta precificação. As chamadas de log nessas funções devem ser mantidas.
- **Container e capatazia são Despesa Operacional por decisão do Financeiro** (01/10/2026), mas na planilha o frete marítimo (container + capatazia + GRI) entra no CIF e paga II, PIS, COFINS, ICMS e AFRMM (PC-2). **Não mova container/frete de volta para a base aduaneira sem decisão do Financeiro.** Não digite AFRMM em "Outras despesas": o motor já o calcula (digitar em dobro inflou o custo uma vez).
- **IRPJ adicional e comissão de consultoria padrão = 0** (como na planilha); o snapshot de precificações antigas pode trazer os valores velhos.
- **Todo campo "(%)" é digitado em ponto percentual** (17,5 = 17,5%) e guardado em fração; mark-up de 100% ou mais é erro de digitação e zera o preço.
- **Hooks antes do `return` condicional** (a fila declara `busca` e `ord` antes do detalhe).
- **Mark-up: ainda existem `mark_up_pct_expresso` e o parâmetro `mark_up_padrao_expresso_pct`** no payload e no banco, sem uso (o card de 90 dias saiu em 10/10/2026). Não reintroduza o campo na tela.
- **O DIFAL incide só no preço do equipamento**, nunca no total nem em equipamento + serviço (regra do Financeiro, 19/10/2026).
- **Um único card "Preço de venda"** (120 dias, container compartilhado e dividido por 2 quando há 1 equipamento; um container comporta no máximo 2 elevadores). Não há mais card de 90 dias, nem `resultado_v2_expresso` preenchido.
- **Letra de revisão:** a precificação da revisão B é outra linha, com o próprio número; a fila marca a revisão antiga como "substituída por …".
- **Uso do "Trocar" pela Precificação passa pela trava do Formulário** (PC-4 de `04_comercial_pre_venda.md`): é o único caminho que grava no Formulário travado.

### 5.2.9 Testes
**Conferido** (rodados em 31/10/2026): `precificacao-elevador-engine.test.js` (34), `precificacao-elevador-store.test.js` (28), `precificacao-pendentes-letra.test.js` (4), `precificacao-proposta-revisao.test.js` (5), `proposta-heranca-precificacao-pin.test.js` (3), `difal-engine.test.js` (13, compartilhado com 5.1). O motor tem um **teste "golden 963"** que reproduz a planilha do Financeiro ao centavo. **Não há teste de componente** (`PrecificacaoElevadorDetalhe`, `PZPrecoPorEquipamento`) nem da fila; o e2e só abre a rota. Teste que grava dados usa "TESTE CLAUDE (excluir)" e apaga no fim (Art. 10).

**Cenários de aceitação**
1. *Dado* o conjunto de insumos da cotação 963, *quando* se calcula pelo método da planilha, *então* preço, impostos, comissões e lucro por equipamento batem com o Excel e a soma dos líquidos fecha no lucro total (`engine`, "golden 963" e `ratearLucroPorEquipamento`).
2. *Dado* um mark-up "sobre o preço", *quando* se pede o preço-alvo do CEO, *então* `alavancaParaPreco` devolve o mark-up que fecha exatamente nesse preço; preço abaixo do custo é inválido (`engine`).
3. *Dado* 21 equipamentos (cotação 957), *quando* a MO é expandida, *então* os códigos saem corridos de 1 a 21, sem repetir e sem sufixo aninhado (`store`).
4. *Dado* "Remover" em um equipamento, *então* a quantidade da Unidade nunca diminui; só a MO dele é excluída (`store`).
5. *Dado* uma revisão B recém-calculada ao lado da original já finalizada, *quando* se cria a proposta pela fila, *então* usa os preços **da revisão B** (`proposta-heranca-precificacao-pin`).

### 5.2.10 Pendências e decisões
1. **Ajuda "?" desatualizada:** o texto de `precificacao` diz "Só libera depois da Análise Técnica aprovada", o que vale **só para o modo "Outros projetos"**; o modo Elevadores não exige Análise Técnica (Conferido). **Achado, sem correção.**
2. **Texto do Copiloto** (`vp_copiloto_docs`, linhas `rota:precificacao` e `rota:cadastro-custos`, de 10/10/2026): fala de "ICMS venda (%) (4%)" sem a regra por UF, não cita a linha AFRMM do Resumo de Custos, o Ad - Valorem, a devolução ao Vendas nem a aba Regras de ICMS, e lista cinco abas em vez de seis. **Não existem linhas** para `aval-financeiro`, `emissao-nf` nem `comissoes` (Conferido por SELECT). A correção é um UPDATE nas linhas (sem redeploy). **Pendência.**
3. **A aprovação não barra DIFAL pendente.** A spec de 15/10/2026 (PC-11) previa alerta e bloqueio de aprovar e de gerar Proposta; hoje há o cartão "cadastro do cliente incompleto" e o botão de devolução, mas `aprovar()` não confere. Ver também 4.1.10 item 10. **Achado, sem correção.**
4. **"Aprovar" e "Calcular" não conferem alçada.** Quem abre a tela (Financeiro e Administrador) faz tudo. **Decisão do Gelson:** ligar uma alçada de aprovação?
5. **O modo "Outros projetos"** tem "Versões" e "Duplicar" desabilitados "em desenvolvimento", um histórico de versões fixo (v1), valores iniciais fixos (câmbio 5,20; II 14%; IPI 8%; PIS+COFINS 11,75%; ICMS 18%…) que não são os do motor oficial, não grava nada e o botão "Gerar proposta" só navega. **Decisão do Gelson:** manter ou aposentar.
6. **Dois motores gravados:** `calcular` (V1) grava `resultado` e `calcularV2` (modo planilha) grava `resultado_v2`; a aprovação e as telas leem o V2 (V1 só de reserva). Duplicidade herdada. **Achado, sem correção.**
7. **Leituras sem paginação:** `listarPendentes` lê `precificacoes_elevador` e `cotacoes_elevador_fornecedor` inteiras (37 linhas hoje). Sem risco hoje.
8. **Realtime:** a tabela está publicada e a tela não escuta; a fila só atualiza ao reabrir (resposta ao ponto aberto de 4 PC-7).
9. **A trava por "Confirmo" não cobre `precificacao-elevador.jsx` inteiro**, só as duas áreas blindadas e as tabelas da 5.1.
10. **Tutorial** existe (PC-10).

### 5.2.11 Histórico
O método da planilha virou o **único** método em 10/10/2026 (a planilha "JA - Cotação 963" é a fonte da verdade, e o card de 90 dias saiu); o preço por equipamento e o líquido do CEO, em 08 e 10/10/2026; a regra de ICMS por UF, em 15/10/2026; as letras de revisão na precificação, em 22 e 23/10/2026.

---

**Escada e esteira na fila (05/11/2026, cotação 1009 — pedido do Gelson).** Antes a fila lia só `categoria_produto = elevador` (`precificacao-elevador-store.js`): a Seloon (escada e esteira) passava direto do Formulário para a Proposta, sem passar pelo Financeiro. Agora `listarPendentes` traz também `escada_rolante` e `esteira_rolante` (cotação respondida), com a marca "· Escada"/"· Esteira" na coluna Cotação Nº. **Decisão do Gelson: sem motor de cálculo** — não existe planilha de fórmula para escada/esteira. Abrir a linha leva a `PZEEDetalhe` (`precificacao-escada-esteira.jsx`): mostra o custo do fornecedor por equipamento (US$, só leitura) e o Financeiro lança o **preço de venda unitário (R$)**; "Finalizar" exige preço em todos os equipamentos; "Reabrir" volta a rascunho. Dados na tabela própria `precificacoes_escada_esteira` (numero `VPPC-ER<Nº>`/`VPPC-ES<Nº>`, com letra de revisão da cotação; nasce fechada, alçada `precificacao` ver/criar/editar). Na Proposta de escada/esteira, "Herdar dados" preenche `valorUnit` de cada equipamento com a precificação **finalizada** (nunca sobrescreve o digitado; rascunho não vale). **Limites:** envio direto à Precificação (sem cotação de fornecedor) ainda cria só precificação de elevador; a Proposta não é criada sozinha ao finalizar (diferente do elevador); a precificação de escada/esteira não emite evento no motor de gatilhos nem passa pelos avais. **Selo: Não verificado** (código e testes de unidade feitos; migration `20261105110000` ainda não aplicada no banco; sem clique real com dado real). Testes: `precificacao-escada-esteira-calc.test.js`.

## 5.3 Aval Financeiro

### 5.3.1 O que é
A **fila do Financeiro**: toda proposta **aprovada pelo cliente** (vigente ou pendente de aditivo) com o seu registro de aval. Dali o Financeiro registra a **consulta de score** e o **aval de venda** (ambos **opcionais**, não bloqueiam nada), **confirma o sinal pago** e dá o **Aval de Pagamento** (manual, depois do sinal). A tela também mostra, por proposta, os outros avais da compra (Jurídico, Projeto de Instalação assinado, CEO). **Conferido** em `aval-financeiro.jsx`, `aval-financeiro-store.js`, `aval-engenharia.jsx` e no banco, 31/10/2026.

**Fora do escopo desta tela:** o Aval Jurídico (tela própria, 6); a assinatura do Projeto de Instalação (8 e 9: aqui só aparece o selo); o botão "Decidir comprar" (4.3); as etapas e SLAs (Prazos & Pendências, 1); gerar e enviar o contrato (6).

### 5.3.2 Rota e arquivos
- Rota `aval-financeiro`; URL `/adm-financeiro/aval-financeiro[/<id da proposta>/<consulta|aprovar|reprovar|sinal|pagamento>]` (a janela aberta e a proposta vão na URL; `useRotaId` + `useRotaItem`). Item "Aval Financeiro". **Conferido.**
- Arquivos: `src/aval-financeiro.jsx` (`window.AvalFinanceiroPage`), `src/aval-financeiro-store.js` (`window.AvalFinanceiroStore`), `src/aval-engenharia.jsx` e `src/aval-engenharia-store.js` (selo e estado do Aval Engenharia), `src/decisoes-store.js` (regra do CEO).

### 5.3.3 Perfil e acesso
Restrita ao Financeiro e ao Administrador (menu e `RESTRICTED`). **A tela não chama `temCapacidade`**; a alçada `aval-financeiro` está no catálogo e **não** é conferida. Qualquer pessoa que abre a tela pode dar qualquer um dos avais. **Banco (Conferido):** `avais_financeiros` (RLS ligada) tem `af_delete`, `af_insert`, `af_leitura` e `af_update` para o **público** **mais** `vp_valores_leitura` e `vp_valores_guarda` (etiqueta `aval-financeiro.valores_aval`); **não** está no Realtime.

### 5.3.4 O que a tela mostra
Cabeçalho "Financeiro · Aval de Vendas" / **Aval Financeiro** / subtítulo "Abre junto com o Aval Jurídico quando o cliente aprova a proposta · a compra na China libera com Aval de Pagamento (depois do sinal) + Aval Jurídico — CEO só se a margem ficar abaixo de 15% · consulta de score e aval de venda são opcionais."; quatro KPIs (**Aguardando consulta**, **Aguardando aval**, **Aguardando sinal**, **Reprovados**); cartão **Fila do Financeiro** ("N propostas aprovadas pelo cliente"), uma linha por proposta com número do documento, cliente, valor, selo de status (Aguardando consulta, Aguardando aval, Aprovado, Reprovado), selo "Sinal pago" e, abaixo, os selos dos avais: **Aval de Pagamento OK / pendente (após o sinal)**, **Aval Jurídico OK / pendente / reprovado**, o selo do **Aval Engenharia**, e **"CEO não precisa aprovar (margem X%)"**, **"CEO aprovou · data"** ou o botão **"Aprovação CEO (Diego) — margem X"**. Fila vazia: "Nenhuma proposta aprovada aguardando o Financeiro ainda." **Conferido.**

### 5.3.5 Botões e controles
| Controle | Quando aparece | O que faz |
|---|---|---|
| **Consultar score** | status "Aguardando consulta" | Abre **Consultar score do cliente** (Fonte: Serasa, SPC, Boa Vista ou Outro; Score / resultado *; Classificação; Observações) → **Registrar consulta** |
| **Refazer consulta** | status "Aguardando aval" | Reabre a mesma janela |
| **Reprovar** | status "Aguardando aval" | Abre **Reprovar venda** (observações com o motivo) → **Confirmar reprovação** |
| **Dar aval** | status "Aguardando aval" | Abre **Dar aval — liberar venda** (mostra a consulta; observações opcionais) → **Confirmar aval** |
| **Confirmar sinal** | sem sinal pago e não reprovado | Abre **Confirmar sinal pago** (Valor recebido (R$); Data do pagamento) → **Confirmar sinal** |
| **Dar Aval de Pagamento** | sem Aval de Pagamento; **habilitado só com o sinal pago** | Abre **Dar Aval de Pagamento** (observações) → **Dar Aval de Pagamento** |
| **Aprovação CEO (Diego) — margem X** | margem abaixo de 15% ou desconhecida e sem aprovação | Registra a aprovação do CEO nesta tela (e fecha a decisão da Central, se for o aprovador) |

### 5.3.6 Comportamento
**Conferido.**
1. **Abrir a fila cria o registro de aval** de toda proposta aprovada que ainda não tem (`garantirRegistro`); na prática o gatilho do banco já o criou na aprovação (PC-7).
2. **Valem os avais da revisão vigente:** a fila só traz propostas aprovadas com vigência `vigente` ou `pendente_aditivo`; `getByNumeroCotacao` prefere o aval da proposta vigente da cotação e, sem vigente com aval, cai no mais recente.
3. **Cada ação** grava no registro, registra em `vp_logs` (módulo "Aval Financeiro") e emite um evento de fluxo: `FINANCEIRO_CONSULTOU_SCORE`, `FINANCEIRO_APROVOU_VENDA` / `FINANCEIRO_REPROVOU_VENDA`, `SINAL_PAGO`, `AVAL_PAGAMENTO_CONFIRMADO` e `FINANCEIRO_APROVOU_CEO`. Cada evento cria ou fecha etapas na cadeia da cotação (motor do módulo 1).
4. **Teto de custo:** quando o CEO aprova, grava `custo_teto` = preço de venda (V2) × (1 − margem mínima) da precificação finalizada. Custos reais posteriores (`registrarCustoReal`) são somados e, se passarem do teto, geram um alerta de estouro (sem bloquear). Sem precificação finalizada, não há teto.
5. **CEO por duas portas:** aprovar nesta tela grava também a decisão `compra_equipamento_ceo` da Central; aprovar na Central grava aqui. Os dois gates aceitam qualquer das duas.
6. **O aval de score e o aval de venda não bloqueiam o contrato** (`podeEnviarContrato` devolve sempre `ok`); **reprovar** só muda o selo e esconde os botões de avaliação (e dispara um evento).

### 5.3.7 Dados — o que lê e o que grava
**Lê:** `propostas`, `avais_juridicos`, `precificacoes_elevador`, `decisoes_gerenciais`, projetos de instalação e assinaturas (via `AvalEngenhariaStore`). **Grava:** `avais_financeiros` (3 linhas hoje: 1 aprovada com sinal e Aval de Pagamento; 2 em "Aguardando consulta", sem sinal), `cotacao_custos_reais` (0 linhas), `alertas` (estouro) e `vp_logs`. **Herda de:** 4.5 (proposta aprovada), 5.2 (margem, preço), 6 (Aval Jurídico), 8 e 9 (projeto assinado), 1.3 (decisão do CEO). **Doa para:** o botão "Decidir comprar" (4.3) e o gate da P.I. (7), por `podeIniciarCompra`; a cadeia de etapas e as notificações (1); o dashboard financeiro (custo real × teto). **Colunas** do registro (Conferido): consulta, aval, sinal, aval de pagamento, aprovação do CEO e do responsável, teto, margem aceita, herança de aval entre revisões (`herdado_de_proposta_id`, `motivo_reabertura`).

### 5.3.8 Regras e armadilhas
- **A compra na China exige três avais, mais o CEO só se a margem for baixa** (PC-3). Esta tela mostra o estado; a regra mora em `podeIniciarCompra`. **Não afrouxe.**
- **Aval de Pagamento ≠ aval de venda.** O primeiro libera a compra e vem **depois do sinal**; o segundo é a consulta de crédito opcional. Os nomes parecem o mesmo clique e já enganaram o Financeiro (caso real de outubro).
- **O Aval de Pagamento pode ser dado aqui ou em Prazos & Pendências** (a mesma chamada, o mesmo evento).
- **A aprovação do CEO só aparece** quando a margem efetiva da precificação é menor que 15% ou desconhecida (mesma constante do envio de proposta, PC-5).
- **Teto de custo** nasce da aprovação do CEO, não do Aval de Pagamento.

### 5.3.9 Testes
**Conferido** (11 testes em 31/10/2026): `aval-financeiro-store.test.js` cobre `podeEnviarContrato` (não bloqueia), `podeIniciarCompra` nos cenários da margem e da ausência de `DecisoesStore`, o gate com o projeto não assinado, o motor de gatilhos com três avais, `AvalEngenhariaStore.resumir`, a preferência pelo aval da proposta vigente e a fila só com vigentes. Sem teste de componente nem de `registrarCustoReal`. E2E só de fumaça.

**Cenários de aceitação**
1. *Dado* margem de 25,9%, Aval de Pagamento e Aval Jurídico dados e projeto assinado, *quando* se consulta o gate, *então* a compra está liberada e o CEO não aparece (`aval-financeiro-store`).
2. *Dado* margem abaixo de 15%, *quando* o CEO ainda não aprovou, *então* o gate bloqueia e cita a margem.
3. *Dado* uma cotação com revisão A vigente, *quando* se lista a fila, *então* só aparece a revisão vigente (`aval-financeiro-store`).

### 5.3.10 Pendências e decisões
1. **A tela e o `aprovar`/`darAval` não conferem alçada ou papel** além do menu (5.3.3). **Decisão do Gelson.**
2. **`aprovarComoOwner`/`isOwner` existem no store e a tela não os usa** (a "minha aprovação" saiu em 29/09/2026). Código morto. **Achado.**
3. **Reprovar não faz nada além do selo:** o contrato e a compra seguem pelos outros gates. **Achado, sem correção.** Confirmar com o Financeiro se é isso mesmo que se quer.
4. **A fila grava ao ler** (`garantirRegistro` em `listarFila`, com `Promise.all`): um índice único por proposta impediria duplicata, mas uma corrida entre o gatilho e a tela poderia lançar erro e esvaziar a lista. **Não testado.** Risco baixo (o gatilho cria na aprovação).
5. **"Valor recebido" do sinal é opcional e não é validado** (`Number(valor)`; vazio vira nulo). **Achado.**
6. **Sem Copiloto e sem ajuda "?"** para esta rota (5.2.10 item 2); o tutorial existe (PC-10).
7. **`avais_financeiros` está com as quatro políticas abertas ao público.** Faz parte do plano da #571 (PC-6).

### 5.3.11 Histórico
O gate passou de "score aprovado" para "Aval de Pagamento + Aval Jurídico" em 29/09/2026; o Aval Engenharia (assinatura do projeto) entrou como terceiro aval em 08/10/2026; a aprovação do CEO por duas portas, em 11/10/2026; as revisões comerciais (aval da proposta vigente), em 22/10/2026.

---

## 5.4 Emissão de NF

### 5.4.1 O que é
A tela de **acompanhamento** dos pedidos de venda do Omie entre a **fabricação concluída** e a **nota fiscal**: mostra quais pedidos já podem ser faturados, quais já têm NF (o campo "faturado" do pedido no Omie), o **SLA de cada etapa** e deixa o Financeiro registrar a **conferência proposta × NF**. **Ela não emite nada:** a nota é emitida pelo Fiscal no Omie. **Conferido** em `emissao-nf.jsx`, `pcp-pedido-sla.js` e no banco, 31/10/2026.

**Fora do escopo desta tela:** emitir NF (Omie); produzir o pedido e gerar OP (13); despachar (Expedição, 12); a leitura dos pedidos do Omie (Edge Function `sync-pcp-pedidos`, do PCP, 12 e 13).

### 5.4.2 Rota e arquivos
- Rota `emissao-nf`; URL `/adm-financeiro/emissao-nf[/<nº do pedido>]` (o nº abre a conferência daquele pedido; `useRotaId`). Item "Emissão de NF". **Conferido.**
- Arquivos: `src/emissao-nf.jsx` (`window.EmissaoNFPage`), `src/pcp-pedido-sla.js` (`window.PcpPedidoSLA`), `src/pcp-etapas-omie.js` (nomes das etapas do Omie).

### 5.4.3 Perfil e acesso
Restrita ao Financeiro e ao Administrador. **A leitura não exige alçada**; o botão **Conferir** só aparece com a alçada `emissao-nf.editar` (`temCapacidade`); é a **única** alçada que uma tela deste módulo confere. **Banco (Conferido):** `pcp_pedido_acompanhamento` (RLS ligada) lê, insere e atualiza para o público; `pcp_pedidos` só lê para o público; `pcp_expedicoes` lê, insere e atualiza. A etiqueta de valor `emissao-nf.faturamento` **não tem regra de banco** (Herdado do plano de 13/10/2026).

### 5.4.4 O que a tela mostra
Cabeçalho "Financeiro · Fiscal" / **Emissão de NF** / subtítulo com a hora da última leitura do Omie e quantas propostas/pedidos de etapa 00/10 ficam de fora; seis botões de resumo (**Fabricados — aguardando emissão**, **Em produção / sem OP**, **NF parcial**, **NF emitida**, **SLA atrasado**, **Histórico (sem SLA)**) e **Todos**; tabela **Pedido · Cliente · Valor · Produção (OP) · Registros no Omie / NF · SLA · Conferência**; rodapé com a regra do SLA. Filtro inicial: "aguardando". Vazio: "Nenhum pedido nesta situação." **Conferido.**

### 5.4.5 Botões e controles
| Controle | O que faz |
|---|---|
| Botões de resumo e **Todos** | Filtram a lista |
| **Atualizar do Omie** | Chama `sync-pcp-pedidos` com `{ atualizar_abertos: true }` (relê pedidos ainda não entregues) |
| Número da OP | Abre o PCP na OP-mãe do pedido |
| **Expedição →** | Abre a Expedição (aparece com ao menos um registro faturado) |
| **Conferir** / **Fechar** | Só com `emissao-nf.editar`; abre o painel de conferência do pedido |
| Painel: **Conferência proposta × NF** (Conferência pendente, Conferida, Entregue — regularizar NF), **Observação**, caixa **Histórico (já entregue antes do sistema — sem SLA)**, **Salvar** | Grava em `pcp_pedido_acompanhamento` |

### 5.4.6 Comportamento
**Conferido.**
1. **Agrupa por nº de pedido:** um pedido pode ter vários registros no Omie (parciais). A situação é **NF emitida** só se **todos** estão faturados, **NF parcial** se alguns, **Aguardando emissão** se a OP-mãe está concluída, senão **Em produção / sem OP**.
2. **Etapa 00 (proposta) e 10 (pedido previsto) não entram** (continuam em `pcp_pedidos` para os relatórios de venda).
3. **SLA** (`PcpPedidoSLA.calcular`): OP criada em até 1 dia útil da entrada do pedido; produção até a previsão (a da OP-mãe, senão a mais cedo do pedido); NF em até 1 dia útil depois da produção; despacho em até 1 dia útil depois da NF. Dia útil = segunda a sexta, **sem feriados**. Pedido marcado "Histórico" não tem SLA. Cada etapa fica no prazo, fora do prazo, em andamento, atrasada ou aguardando.
4. **Conferir** grava (upsert por `numero_pedido`) a conferência, o histórico e a observação, com quem e quando; registra em `vp_logs` (módulo "Emissão de NF").
5. **Leitura automática do Omie** a cada 30 minutos, de segunda a sexta, das 7h às 19h de Brasília (PC-7).

### 5.4.7 Dados — o que lê e o que grava
**Lê:** `pcp_pedidos` (288 linhas: etapa 00: 150; 10: 0; 20: 13; 50: 36; 60: 40 faturadas; 70: 38 faturadas; 80: 11), `pcp_ordens` (OP-mãe, `frente = pedido`), `pcp_expedicoes` (0 linhas) e `pcp_pedido_acompanhamento` (17: 7 pendentes e 10 marcadas como histórico). **Grava:** `pcp_pedido_acompanhamento` e `vp_logs`; o botão "Atualizar do Omie" faz a Edge Function gravar `pcp_pedidos` e `pcp_pedido_itens`. **Herda de:** o Omie (pedido e NF), 13 (OP-mãe concluída), 12 (despacho). **Doa para:** a Expedição (a trava exige NF, 12) e o alerta de prazos do PCP (Edge Function `alerta-pcp-prazos`, que tem uma cópia do cálculo do SLA).

### 5.4.8 Regras e armadilhas
- **Esta tela é só acompanhamento.** Não emita nem altere NF pelo código.
- **"Faturado" é por registro do Omie.** Pedido antigo em etapa 80 pode aparecer "não faturado" sem estar errado: use "Conferir".
- **Cópia do cálculo do SLA** em `supabase/functions/alerta-pcp-prazos/index.ts` (bloco `BEGIN CALC … END CALC`): `alerta-pcp-paridade.test.js` falha se um lado mudar sem o outro. **Mudou o SLA? Mude os dois e republique a função.**
- **Datas puras** (`aaaa-mm-dd`) são formatadas em texto, sem `new Date()` (cairia um dia no fuso do Brasil).
- Pedido de etapa 00/10 não é trabalho de NF e atrasaria o SLA de mentira (por isso fica de fora).

### 5.4.9 Testes
**Conferido:** `pcp-pedido-sla.test.js` (4: dias úteis, histórico sem SLA, OP atrasada, fluxo no prazo e fora) e `alerta-pcp-paridade.test.js` (5, compartilhado com o PCP). Sem teste de componente nem da agregação por pedido. E2E só de fumaça.

**Cenários de aceitação**
1. *Dado* um pedido com dois registros no Omie e só um faturado, *quando* a tela agrupa, *então* a situação é "NF parcial" (**sem teste**: comportamento do código).
2. *Dado* um pedido entrado numa sexta, *quando* o SLA da OP é calculado, *então* o limite é a segunda seguinte (`pcp-pedido-sla`, dias úteis).
3. *Dado* um pedido marcado "Histórico", *então* não tem SLA e não conta como atrasado.

### 5.4.10 Pendências e decisões
1. **A tela lê `pcp_pedidos` com `limit(500)`** (hoje 288) e `pcp_expedicoes` e `pcp_pedido_acompanhamento` com `limit(1000)`: passando disso a lista corta em silêncio. **Achado, sem correção.**
2. **O SLA ignora feriados** (decisão registrada no arquivo). Os feriados do sistema (1.4 e Notificações) não são usados aqui.
3. **Nenhuma conferência foi feita ainda:** as 17 linhas estão todas "pendentes" (10 delas "histórico"). Não é defeito, é falta de uso.
4. **`pcp_expedicoes` está vazia** (0 linhas): a Expedição não foi usada em produção até 31/10/2026 (Conferido).
5. **Sem Realtime e sem ajuda "?"**; sem linha no Copiloto; **tutorial não existe** para Emissão de NF (o do módulo a cita).
6. **Sem teste de componente** (5.4.9).

### 5.4.11 Histórico
Nasceu em 03/10/2026 junto da fila de produção e da Expedição do PCP; o SLA e a conferência vieram no mesmo dia; o agrupamento por nº de pedido e a leitura automática do Omie, em 03/10/2026.

---

## 5.5 Comissões

### 5.5.1 O que é
A tela que lista as **comissões de venda** (uma linha por recebedor), aplica as **regras de comissionamento por origem da venda** e deixa o Financeiro **aprovar** e **pagar**. Uma fila no topo mostra as **propostas assinadas ainda sem comissão** e o botão que a gera. **Conferido** em `ComissoesPage` (`financeiro.jsx`), `comissionamento-store.js` e no banco, 31/10/2026.

**Fora do escopo desta tela:** a **comissão do vendedor e a de consultoria da Precificação** (5.2: abatem do lucro do preço e **não** geram linha aqui, PC-4); a **comissão manual do lead** (CRM, 2.1); pagar de fato (o "Pagar" aqui só muda o status, 5.5.8).

### 5.5.2 Rota e arquivos
- Rota `comissoes`; URL `/adm-financeiro/comissoes`; item "Comissões"; caminho de navegação "Financeiro / Comissões". **Conferido.**
- Arquivos: `ComissoesPage` em `src/financeiro.jsx` (o arquivo do módulo 1), `src/comissionamento-store.js` (`window.ComissionamentoStore`), `src/print-app.jsx` (também a abre na versão de impressão).

### 5.5.3 Perfil e acesso
Restrita ao Financeiro e ao Administrador. **Não existe alçada `comissoes` no catálogo** e a tela não chama `temCapacidade`. **Aprovar, Aprovar (diretoria), Aprovar todas e Pagar** funcionam para qualquer um que abra a tela (**inclusive "diretoria"**: nada confere se quem clica é o aprovador). **Banco (Conferido):** `comissoes` e `regras_comissionamento` (RLS ligada) leem, inserem e atualizam para o **público**, **sem DELETE**, mais `vp_valores_leitura` e `vp_valores_guarda` (modo `fechada`, etiqueta `precificacao.comissao`).

### 5.5.4 O que a tela mostra
Cabeçalho "Financeiro · Comissões" / **Comissões — Q2/26** (**fixo no código**) / "Comissionamento sobre faturamento líquido · liberação após confirmação de entrada"; quatro KPIs (**Total comissões Q2**, **Aprovado**, **Aguardando**, **Maior comissão**); cartão **Propostas assinadas aguardando geração de comissão** (só quando há) com Proposta, Cotação Nº, Valor e **Gerar comissão**; cartão **Resumo por vendedor** com **Vendedor (e cargo) · Projetos fechados · Faturamento líquido · % · Comissão Q2 · Progresso ("% meta Q" contra 150.000 fixo) · Status · ação**; rodapé "Total a pagar Q2/26". Vazio: "Nenhum registro cadastrado." **Conferido.**

### 5.5.5 Botões e controles
| Controle | O que faz |
|---|---|
| **Folha de pagto** | Baixa `folha-comissoes-q2.csv` com as linhas (vendedor, cargo, projetos, faturado, %, comissão, status) |
| **Aprovar todas** | Aprova todas as pendentes que **não** exigem diretoria (passa para "Aprovado" em lote) |
| **Gerar comissão** (fila) | Cria as linhas da proposta pela regra da origem da venda |
| **Aprovar** | Status "Aprovado" |
| **Aprovar (diretoria)** | Para "Aguardando aprovação diretoria"; status "Aprovado" (sem conferir quem aprova) |
| **Pagar** | Para "Aprovado"; status "Pago" |

### 5.5.6 Comportamento
**Conferido.**
1. **Gerar comissão** (`gerarComissoesDaProposta`): só para proposta **aprovada**; lê `origem_venda` e `vendedor` do **Formulário da mesma cotação**; busca a regra pela origem; para cada **split** da regra cria uma linha com recebedor, `pct` (guardado como 100 × fração), `comissao = valor total da proposta × fração`, status "Aguardando aprovação" ou "Aguardando aprovação diretoria" (se o percentual passa do limite da regra). É **idempotente** (erro se já existe comissão da proposta).
2. **Erros explicam o motivo:** sem origem da venda no formulário ("não informou 'Origem da venda'") ou sem regra cadastrada para a origem.
3. **A fila** lista até 50 propostas aprovadas e vigentes sem linha em `comissoes`.
4. **Aprovar e Pagar** atualizam o status com `.select()` e tratam 0 linhas como erro (RLS) em vez de falso sucesso; registram em `vp_logs`.
5. As quatro **regras** vivem em `regras_comissionamento`: Conquista Vendedor; Indicação VerticalParts; Indicação Escamax + Vendedor (2 splits); Indicação Terceiros (limite de 2% sem aprovação, aprovador Diego). **Não há tela** para editá-las (5.5.10 item 2).

### 5.5.7 Dados — o que lê e o que grava
**Lê e grava:** `comissoes` (**0 linhas hoje**; colunas: vendedor, cargo, projetos, faturado, comissão, pct, status, período, cotação, proposta, origem, recebedor, exige diretoria, aprovador), `regras_comissionamento` (4). **Lê:** `propostas`, `formularios_elevador`. **Herda de:** 4.5 (proposta aprovada), 4.1 (origem da venda e vendedor). **Doa para:** o Dashboard (`supabase.js` carrega `comissoes` e o KPI de comissões pendentes, 1.1) e a folha de pagamento (CSV). **Hoje:** há 3 propostas aprovadas e vigentes; **só 1 tem formulário com origem da venda preenchida**. Entre os 61 formulários, a origem "Site VerticalParts" (2) **não tem regra** e 8 estão sem origem; gerar comissão dessas daria erro.

### 5.5.8 Regras e armadilhas
- **"Pagar" não paga:** só muda o status para "Pago". Não há integração com o Omie nem com o Contas a Pagar.
- **A base é o valor total da proposta**, embora o texto da tela diga "faturamento líquido".
- **"Aprovar todas" ignora** as que exigem diretoria (por desenho).
- **Percentual:** `pct` é guardado como 100 × fração e exibido com "%".
- **Segurança:** como toda a escrita está liberada ao público, o "limite que exige diretoria" é regra de tela (PC-6).

### 5.5.9 Testes
**Não há teste** de `comissionamento-store.js` nem da tela (Conferido: nenhum `*.test.js` o cita). O KPI de comissões pendentes do Dashboard é coberto por `dashboard-metrics-financeiro.test.js` (9 testes), que usa os status "Aguardando" e "Paga" (5.5.10 item 3). Cenário sem teste (Art. 33 pede teste junto da regra nova; isto é dívida): **dado** uma proposta aprovada com origem "Conquista Vendedor", **quando** se gera a comissão, **então** nasce uma linha por split com a soma igual ao percentual da regra.

### 5.5.10 Pendências e decisões
1. **Três vocabulários de status:** a tela e o motor usam "Aguardando aprovação", "Aguardando aprovação diretoria", "Aprovado" e "Pago"; o KPI do Dashboard e seus testes contam só `status === 'Aguardando'` e falam em "Paga". **Comissões geradas pelo motor não entram nesse KPI.** Hoje não há linhas, então sem efeito. **Achado, sem correção** (também para a Geral, 1.1).
2. **Sem tela para editar as regras de comissionamento:** `salvarRegra` e `listarRegras` existem no store e **nenhuma tela os chama**. Editar é por SQL.
3. **Origem da venda faltando:** ver 5.5.7. Decisão do Gelson: criar a regra de "Site VerticalParts"? tornar a origem obrigatória no Formulário?
4. **Ninguém confere quem aprova "diretoria"** (5.5.3). Decisão do Gelson.
5. **Rótulos fixos no código:** "Q2/26", "150.000" de meta, "pagamento dia 10", "N colaboradores" (conta linhas). Quando entrar o 4º trimestre, a tela continua dizendo Q2.
6. **A tabela `comissoes` está vazia:** a tela nunca foi usada de ponta a ponta em produção (Conferido). Não testei a geração (gravaria dado real).
7. **Sem ajuda "?"**, sem linha no Copiloto; tutorial existe (PC-10).

### 5.5.11 Histórico
O motor de regras por origem da venda nasceu na issue #68; a fila de "propostas assinadas aguardando comissão" e a geração automática vieram depois (data exata **não verificada**).

---

# Parte comum de Financeiro & Preços

## PC-1 Mapa de ligações
**Conferido** (código e banco), 31/10/2026, salvo onde dito.

| De → Para | O que passa | Telas |
|---|---|---|
| Formulário (4.1) → Precificação | unidades, tração, capacidade, paradas, cidade/UF da obra, finalidade da compra, contribuinte de ICMS | 4.1 → 5.2 |
| Cotação a fornecedor (4.3) → Precificação | preço unitário em US$, modelo, VMLE, frete internacional, containers, câmbio do dia da resposta | 4.3 → 5.2 |
| Atualização de Custos → Precificação | mão de obra, preço/capatazia/GRI do container, frete sugerido, DIFAL, ICMS da venda | 5.1 → 5.2 |
| Precificação → Proposta (4.5) | preço de venda por equipamento (rateado), códigos, MO por equipamento, forma de pagamento; **sem DIFAL**; a proposta nasce sozinha ao aprovar | 5.2 → 4.5 |
| Precificação → Central de Decisões (1.3) | margem efetiva: abaixo de 15% ou desconhecida chama o CEO | 5.2 → 1.3 |
| Proposta aprovada → Aval Financeiro e Aval Jurídico | o gatilho do banco abre os dois registros e uma notificação | 4.5 → 5.3, 6 |
| Aval Financeiro → "Decidir comprar" (4.3) e P.I. (7) | `podeIniciarCompra`: três avais, mais o CEO se a margem exige | 5.3 → 4.3, 7 |
| Aval Engenharia (8, 9) → Aval Financeiro | projeto de instalação assinado vira o terceiro aval | 8/9 → 5.3 |
| Pedidos do Omie (12) → Emissão de NF | etapa 20, 50, 60, 70, 80; faturado; OP-mãe | 12, 13 → 5.4 |
| Emissão de NF → Expedição (12) | a trava da Expedição exige NF | 5.4 → 12 |
| Proposta aprovada + Formulário → Comissões | origem da venda, vendedor, valor total | 4.5, 4.1 → 5.5 |
| Eventos de fluxo → Prazos & Pendências (1) | cada ação de aval cria ou fecha uma etapa | PC-7 |
| Comissões → Dashboard (1.1) | KPI de comissões pendentes | 5.5 → 1.1 |

## PC-2 Como o preço se forma (herança e cálculo)
**Conferido** em `precificacao-elevador-engine.js` (função `calcularPlanilha`) e no store.
1. **Um só método, o da planilha do Financeiro:** preço de venda = custo da nota (já sem créditos) ÷ (1 − impostos da venda − **mark-up**). O mark-up é uma margem sobre o **preço**. O frete internacional, o container, a capatazia e a GRI entram no CIF (pagam II, PIS, COFINS, ICMS e **AFRMM**); despachante, ad-valorem, frete interno, armazenagem, instalação, contingência e outros custos não recuperáveis **só abatem do lucro**, depois do preço.
2. **Containers:** os valores em R$ do cadastro viram US$ pelo câmbio da cotação e somam ao frete. Com 1 equipamento, container e capatazia são **divididos por 2** (um container comporta no máximo 2 elevadores); com 2 ou mais, o container é pago uma vez só e não divide.
3. **Lucro final** = lucro da venda − contingência − outros custos não recuperáveis; **margem efetiva** = (lucro + comissão de consultoria) ÷ preço.
4. **Rateio:** o preço total divide-se entre as unidades pelo custo do fornecedor em US$ (`ratearPorModelo`); a mão de obra é específica de cada equipamento e pesa só nele no **lucro por equipamento** (`ratearLucroPorEquipamento`).
5. **Dólar:** câmbio único gravado (`tx_cambial`); a PTAX (do dia da cotação ou de agora) e o % sobre o dólar só o preenchem. O câmbio da cotação é congelado no dia da resposta do fornecedor.
6. **Comissões:** vendedor (padrão 2%), indicação (padrão 0%) e consultoria (digitada de 0% a 5%, obrigatória) saem do lucro, não do preço — PC-4.
7. **Cada herança preenche só campo vazio** e nunca sobrescreve o que o Financeiro digitou.

## PC-3 Os avais e a liberação da compra
**Conferido** em `aval-financeiro-store.js`.
- **O botão "Decidir comprar"** (4.3) e o gate da P.I. exigem, nesta ordem: **(1) Aval de Pagamento** do Financeiro; **(2) Aval Jurídico** aprovado; **(3) assinatura do Projeto de Instalação** pelo cliente (por cotação: todos os projetos assinados; ID-TAG não conta; cotação sem projeto salvo não passa); **(4) aprovação do CEO**, **só** quando a margem efetiva é menor que 15% ou desconhecida. Falhar ao consultar o estado do projeto **bloqueia**.
- O que **não** trava mais: aval de score e aval de venda; sinal pago como checagem própria (o Aval de Pagamento já vem depois dele); contrato assinado; revisão técnica de Engenharia; aprovação do responsável pelo sistema.
- **Os registros dos avais Financeiro e Jurídico abrem juntos** quando a proposta é aprovada (gatilho `fn_avais_abrir_na_proposta`, que também herda o aval entre revisões) e uma notificação "Avais OK" avisa quando tudo fecha (`fn_avais_notificar_ok`, dita o que ainda falta).
- **Com revisões comerciais**, o aval que vale é o da proposta **vigente** da cotação.

## PC-4 As três "comissões"
Há três coisas com o mesmo nome. **Não se somam e não se ligam entre si** no código (Conferido; a ligação por regra de negócio **não foi verificada**):
1. **Comissão dentro da Precificação (5.2):** vendedor, indicação e consultoria, em % do preço. São um **custo do cálculo** (abatem do lucro); não geram linha em `comissoes`.
2. **Comissão manual do lead (CRM, 2.1):** % do lead (2% se em branco), mostrada como "comissão prevista"; não gera linha em `comissoes`.
3. **Comissão paga (5.5):** a lista `comissoes`, gerada da proposta aprovada pela regra da **origem da venda**.
Esta divergência de origem é conhecida; **decisão do Gelson** sobre unificar ou manter separadas fica em 5.5.10.

## PC-5 Imposto e margem: ICMS, DIFAL e a regra dos 15%
- **Margem e CEO:** a constante `LIMITE_MARGEM_SEM_CEO` (15%, em `decisoes-store.js`) vale para o envio da proposta (4.5), para a decisão de compra (`compra_equipamento_ceo`) e para o selo do Aval Financeiro. A **margem mínima** do parâmetro padrão também é 15%; a tela pode editá-la por precificação.
- **ICMS da venda** vem da regra por UF de destino (5.1, aba Regras de ICMS): SP→SP importado a 12% (Herdado: o Gelson pediu conferir com o contador o RICMS/SP vigente); sem regra, cai no ICMS venda global do parâmetro (4%) e a Memória de cálculo avisa.
- **DIFAL:** UF origem fixa SP; destino = UF da obra, senão a do cliente; mesma UF ou finalidade "Revenda" = sem DIFAL; "Uso e consumo / Ativo imobilizado" = devido. Cliente **contribuinte** recolhe (não é custo da VerticalParts); **não contribuinte** = guia GNRE da VerticalParts, que abate do lucro. Base: o preço do equipamento. Sem "Contribuinte de ICMS" respondido, o DIFAL não calcula e a tela oferece **devolver ao Vendas**. A proposta **não mostra** o DIFAL (4.5).
- **Regime tributário:** Presumido (parâmetro padrão); o Simples não aproveita crédito (o motor trata).

## PC-6 Identidade, alçadas e segurança
**Conferido** (banco, 31/10/2026):

| Tabela | RLS | Políticas |
|---|---|---|
| `custos_instalacao_elevador`, `custos_instalacao_escada_esteira`, `custos_containers` | ligada | `ALL` para `anon` e `authenticated` **mais** `vp_valores_leitura` e o gatilho `vp_valores_guarda` |
| `custos_frete_interno`, `custos_frete_observacoes`, `difal_estados`, `parametros_fiscais_elevador` | ligada | `ALL` para `anon` e `authenticated` |
| `regras_icms_venda` | ligada | leitura `anon` e `authenticated`; inserir e atualizar só `authenticated` |
| `precificacoes_elevador` | ligada | `ALL` para `anon` e `authenticated` **mais** `vp_valores_leitura` e `vp_valores_guarda` |
| `avais_financeiros` | ligada | ler, inserir, atualizar e **apagar** para o público **mais** `vp_valores_leitura` e `vp_valores_guarda` |
| `cotacao_custos_reais` | ligada | ler, inserir, atualizar e **apagar** para o público |
| `comissoes` | ligada | ler, inserir e atualizar para o público (sem DELETE) **mais** `vp_valores_*` |
| `regras_comissionamento` | ligada | ler, inserir e atualizar para o público **mais** `vp_valores_*` |
| `pcp_pedido_acompanhamento`, `pcp_expedicoes` | ligada | ler, inserir e atualizar para o público |
| `pcp_pedidos` | ligada | só ler para o público |

- **Trava na tela é organização, não segurança** (Art. 25). Os botões "diretoria" e "restrito ao Financeiro" são do navegador. O que o banco garante sozinho: a guarda de valores `vp_valores_guarda` (só para sessão nativa e, para valer, ligada para a pessoa).
- **Desfoque e guarda de valores em R$ (`vp_valores_*`):** a regra de quem vê valores vem do vpsistema (tabela `valores_acesso`); 7 das 17 tabelas com regra são deste módulo (`custos_containers`, `custos_instalacao_elevador`, `custos_instalacao_escada_esteira`, `precificacoes_elevador`, `avais_financeiros`, `comissoes`, `regras_comissionamento`). A tabela `vp_valores_piloto` tem 1 linha. O **plano** de 13/10/2026 (PC-11) é o desenho do desfoque na tela; **não verifiquei** quais telas deste módulo já usam o componente de valor: não achei `src/vp-valores.js` (Conferido, a lista de `src` não o traz). **Não verificado:** se algum valor de R$ já aparece desfocado nas telas daqui.
- **Alçadas do módulo** (catálogo × uso na tela): só `emissao-nf.editar` é conferida. `cadastro-custos`, `precificacao`, `aval-financeiro` e `emissao-nf` (ver) existem no catálogo e **não** são conferidas; **`comissoes` não existe no catálogo**. O menu restringe a Financeiro e Administrador (exceto Atualização de Custos).
- **Edge Functions do módulo:** nenhuma é só deste módulo. A Emissão de NF chama `sync-pcp-pedidos` (PCP). Nenhuma foi alterada nesta tarefa.

## PC-7 Gatilhos e rotinas
- **Gatilhos do banco** (**Conferido**): em `avais_financeiros`: `trg_avais_financeiros_ok`, `trg_avais_financeiros_ceo_ok` e `vp_valores_guarda`; funções `fn_avais_abrir_na_proposta` (abre os avais na aprovação da proposta) e `fn_avais_notificar_ok`; em `precificacoes_elevador`: `trg_precificacao_marca_inicio` (marca o início da etapa "Precificação" da cotação, falha engolida) e `vp_valores_guarda`; `vp_valores_guarda` também em `comissoes`, `regras_comissionamento` e nas três tabelas de custo da 5.1.
- **Eventos de fluxo emitidos** (**Conferido** no código): `FINANCEIRO_CONSULTOU_SCORE`, `FINANCEIRO_APROVOU_VENDA`, `FINANCEIRO_REPROVOU_VENDA`, `SINAL_PAGO`, `AVAL_PAGAMENTO_CONFIRMADO`, `FINANCEIRO_APROVOU_CEO`, `FINANCEIRO_APROVOU_OWNER` (sem uso na tela). A Precificação não emite evento próprio ao aprovar; a Proposta criada dispara o dela (4).
- **Rotinas agendadas** (**Conferido** em `cron.job`, horários em UTC): `sync-pcp-pedidos-etapa20` (`0,30 10-22 * * 1-5`, ou seja, de 7h a 19h de Brasília) e `sync-pcp-pedidos-abertos` (`10,40 10-22 * * 1-5`) alimentam a Emissão de NF; `sync-pcp-pedidos-previsao-etapa10` e `pcp-pedidos-tirar-etapa10` (a limpeza de hora em hora) mantêm a etapa 10 fora das telas de NF; `pcp-carga-semanal-2-ler` (domingo). **Nenhuma rotina é específica de Precificação, Avais ou Comissões.**
- **Realtime:** `precificacoes_elevador` está publicada e nenhuma tela escuta (5.2.10 item 8); `avais_financeiros`, `comissoes` e `pcp_pedidos` **não** estão na publicação.

## PC-8 Tabelas
**Conferido** (31/10/2026; linhas = contagem exata).

| Tabela | Para que serve | Linhas |
|---|---|---|
| `custos_instalacao_elevador` | mão de obra por tração × capacidade × paradas | 163 |
| `custos_instalacao_escada_esteira` | valor fixo por tipo, SP × outros estados | 2 |
| `custos_containers` | preço, capatazia e GRI por tipo de container | 2 |
| `custos_frete_interno` / `custos_frete_observacoes` | frete Santos → capitais / notas da planilha | 27 / 23 |
| `difal_estados` | categoria e alíquotas de DIFAL por UF | 27 |
| `regras_icms_venda` | ICMS da venda por UF de origem e destino | 1 |
| `parametros_fiscais_elevador` | parâmetros fiscais padrão (snapshot na precificação) | 1 |
| `precificacoes_elevador` | a precificação (insumos, snapshot, resultado, DIFAL, status) | 37 |
| `avais_financeiros` | consulta, aval, sinal, Aval de Pagamento, CEO, teto | 3 |
| `cotacao_custos_reais` | gastos reais contra o teto | 0 |
| `comissoes` / `regras_comissionamento` | linhas de comissão / regras por origem | 0 / 4 |
| `pcp_pedidos`, `pcp_pedido_acompanhamento`, `pcp_expedicoes` | pedidos do Omie / conferência da NF / despacho | 288 / 17 / 0 |

## PC-9 Navegação, cache e testes
A regra geral (hooks, `setSubsel` + `setRoute`, estado na URL, cache `?v=`, jsx-loader) está em `01_geral.md` PC-9. O que é específico daqui:
- **Estado na URL:** aba de Atualização de Custos (e a tração); precificação aberta (id); janela e proposta do Aval Financeiro; pedido em conferência da Emissão de NF. **Não vai para a URL:** o modo Elevadores/Outros projetos e a aba da Memória de cálculo.
- **Hooks antes do `return` condicional** na fila da Precificação (já corrigido uma vez).
- **Testes:** **115 testes nos 11 arquivos citados** nas telas (5.1: 26; 5.2: 74 sem contar o de DIFAL repetido; 5.3: 11; 5.4: 4 e a paridade de 5); o conjunto todo: **920 testes passam, 0 falham** (Conferido, `npm test`, 31/10/2026). `node scripts/check-cache-bust.js origin/main` rodado nesta tarefa. **E2E** (`npm run test:e2e`) **não rodado** (roda no CI); não há e2e específico, só a fumaça de rotas. A Comissões não tem teste (5.5.9).

## PC-10 Menu "?" e tutoriais
Conferido em `shell.jsx` (`HELP_TOPICS`, `TUTORIAIS`) e em `TreinamentoVP/`, 31/10/2026.
- **Ajuda "?"** existe só para `precificacao` (e o texto está desatualizado, 5.2.10 item 1). **Não existe** para `cadastro-custos`, `aval-financeiro`, `emissao-nf` nem `comissoes`.
- **Copiloto VP:** só há texto em `vp_copiloto_docs` para `rota:cadastro-custos` e `rota:precificacao`, ambos de 10/10/2026 e defasados; para as outras três telas **não há linha** (5.2.10 item 2).
- **Tutoriais** em `TreinamentoVP/financeiro-precos/` (módulo, `atualizacao-de-custos`, `precificacao`, `aval-financeiro`, `comissoes`): o do módulo é de **09/10/2026**; **não há tutorial de Emissão de NF**. A pasta está **fora do Git** (de outra sessão): não mexi. Telas mudaram depois (AFRMM, Ad-Valorem, regra de ICMS, devolução ao Vendas, Aval Engenharia, abas de Frete e DIFAL). **Tutorial não se edita à mão:** pedir à sessão de tutoriais para regenerar (Art. 46).
- **Cache do navegador:** ver `04_comercial_pre_venda.md` PC-10 (`?v=` igual ao publicado).

## PC-11 Documentos soltos e destino do que foi concatenado
Busca feita em `CLAUDE.md`, raiz, `docs/`, `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/seguranca/`, `docs/revisoes/`, `handoffs/` e `TreinamentoVP/` (Art. 50). Nada foi apagado.

| Origem | Destino | Situação |
|---|---|---|
| Seções do `CLAUDE.md` só deste módulo: "Precificação — preço de venda declarado por equipamento", "AFRMM em Containers + Resumo de Custos", "Regras de ICMS na venda por UF de destino" | **Concatenadas** aqui (5.1, 5.2 e PC-2, PC-5) | cada uma ganha no `CLAUDE.md` uma nota "→ parte já migrada para Financeiro & Preços"; o texto antigo **continua** lá até o Gelson aprovar a retirada |
| Seções **mistas**: "Precificação — método da planilha é o ÚNICO método; passageiros = kg ÷ 75" (passageiros também é do Formulário e da Proposta), "Avais Financeiro e Jurídico", "Avais — 2ª rodada", "Aval Engenharia", "Alçadas — Envio de Proposta: CEO só decide…", "PCP — Fila de produção → Emissão de NF → Expedição" (dentro da seção do PCP), "Auditoria de amarrações" (item do CEO em dois lugares), "Segurança real (#571)" | **Ficam** no `CLAUDE.md` com nota; o trecho do módulo 5 está aqui (PC-3, PC-5, 5.3, 5.4) | mistas: não se apagam |
| **🔒 Áreas blindadas** do `CLAUDE.md`: "Preço (R$) de Containers", "Mão de obra × quantidade > 1…" e a **trava por "Confirmo" da Atualização de Custos** | **Continuam no `CLAUDE.md`** (são lei, como a de Cadastros); aqui só se descreve e se aponta (5.1.1, 5.2.8) | ganham uma nota "detalhe → Financeiro & Preços" |
| `docs/superpowers/specs/2026-10-15-difal-cadastro-formulario-design.md` | 5.2.10 item 3, PC-5 e `04` 4.1.10 | **Desenho aprovado, só em parte implementado**: fica como histórico; o que falta está nas pendências. O `2026-10-31-mapa-de-destino-docs-soltos.md` o dava como "aguarda 05": **resolvido aqui** |
| `docs/superpowers/plans/2026-10-13-desfoque-de-valores-hub.md` | PC-6 | Plano do desfoque de valores em R$ (módulo 15 e todas as telas com valor). Apontado, não copiado; **Não verificado** o quanto foi executado |
| `docs/revisoes/00` a `03` (revisões comerciais) | PC-3 e `04` 4.5.8 | A Etapa 2 (vigência dos avais, `docs/revisoes/02-…`) é desenho; já há no banco `herdado_de_proposta_id` e o aval da proposta vigente. Ficam onde estão. **Decisão do Gelson** (já em aberto no módulo 4) |
| `docs/seguranca/matriz-acesso-rls.md` e `docs/superpowers/plans/2026-10-02-autenticacao-e-rls-571.md` | PC-6 e 14 | Apontados, não copiados |
| `.claude/skills/tutorial-vp-gestao/references/herancas.md` e `modulos.md` | PC-10 | Referência da sessão de tutoriais; só apontada |
| `TreinamentoVP/financeiro-precos/*` | PC-10 | Tutoriais gerados por outra sessão (fora do Git); só apontados |
| `README.md`, `AUDITORIA_FORENSE_E2E_SCORE.md`, `docs/PROJETO_INCRIVEL.md`, `.claude/agents/*`, `.claude/2026_*_relatorio.md` | — | Citam precificação de passagem; sem trecho que valha concatenar. Ficam como histórico |
| `docs/eventos/`, `docs/relatorios/`, `handoffs/` | outros módulos | Sem relação direta encontrada; ficam |
| **Parecem obsoletos — decisão do Gelson** | — | O modo "Outros projetos" da Precificação (código, 5.2.10 item 5); `aprovarComoOwner`/`isOwner` (5.3.10 item 2). O `salvarParametrosFiscais` e o `salvarRegra` **sem tela** (5.1.10 item 1 e 5.5.10 item 2) não são obsoletos: são lacunas |

## PC-12 Benefícios trocados com os outros módulos

- **Recebido de Quadros de Comando (04/11/2026, texto em `14_quadros_comando.md` PC-12, Art. 49):** (a) o Omie repete a linha do item com **quantidade 0** — somar por código e ignorar o zero antes de contar linhas ou unidades; (b) **metro e peça nunca se somam** — total por unidade de medida; (c) a caixa de uma tabela longa deve ter a **altura da janela**, para a barra de rolagem lateral ficar à vista; (d) função de banco nova se testa **numa transação que se desfaz**, incluindo um usuário ativo **sem** a alçada (a recusa por "sem sessão" não prova a trava de alçada); (e) a **observação do item** do pedido do Omie (`pcp_pedido_itens.obs_item`) guarda o que a proposta mostra dentro do item. **Conferido** (04/11/2026).
- **Recebido de Geral (`01_geral.md`):** a regra de numeração e o molde; a cadeia de etapas e as telas Prazos & Pendências e Central de Decisões (PC-3); a fila `fluxo_pendentes` (PC-7).
- **Recebido de CRM (`02_crm.md`):** a comissão manual do lead (PC-4).
- **Recebido de Cadastros (`03_cadastros_mestres.md`):** a leitura paginada de 1.000 em 1.000 (aplicável a `pcp_pedidos` na Emissão de NF: 5.4.10 item 1); o aviso para registro inexistente por link.
- **Recebido de Comercial | Pré-venda (`04_comercial_pre_venda.md`):** as regras de preço (PC-5 de lá), a trava e o destrave, a proposta que nasce da aprovação; o achado de listas cortadas.
- **Recebido de Engenharia & Produto (01/11/2026, texto em `08_engenharia_produto.md` PC-12):** o painel dos três avais está no pé de 8.1 e o selo do Aval Engenharia só olha desenhos **não excluídos**; a publicação da ficha no Omie não passa pela Precificação (PC-5 do 8). Dois marcadores do mesmo fato (etapa × `omie_publicado_em`): vale procurar pares assim no Financeiro.
- **Recebido de Obras & Instalação (01/11/2026, texto em `09_obras_instalacao.md` PC-12):** o checklist de documentos do Dossiê (9.1.5) pergunta o **valor da ART em R$** ao anexar e o repassa a `anexarDocumento`; **Não verificado** para onde esse valor vai (custo real da cotação?). A ART por obra (9.6) é outro fluxo, sem valor em reais, com a Juliana marcando o boleto como pago (alçada `art.confirmar_pagamento`).
- **Recebido de Entrega & Documentação (01/11/2026, texto em `10_entrega_documentacao.md` PC-12):** nada específico de Financeiro & Preços; vale o bloco do `01_geral.md`. Os avisos de evento (`_evt_modulo_etapa`) mandam ao "Financeiro" só as chaves `PRECIFICACAO`, `AGUARDA_BOLETO`, `AVAL_PAGAMENTO`, `FIN_SCORE`, `FIN_AVAL_VENDA`, `CEO_APROVOU` e `OWNER_APROVOU`, todas existentes no motor. **Conferido** no 10 (PC-7).
- **Recebido de Parceiros & Instaladores (01/11/2026, texto em `11_parceiros_instaladores.md` PC-12):** o valor de **tabela** da mão de obra (Atualização de Custos, 5.1) é só referência do preço combinado com o montador (11.4); o custo real da cotação é lançado quando o instalador **assina** o Contrato (11.3.6); "Pagamentos a Instaladores" aparece com o rótulo "Financeiro" no caminho do topo, mas é do 11. **Conferido** no código, 01/11/2026.
- **Recebido de Logística Interna (01/11/2026, texto em `12_logistica_interna.md` PC-12):** o **custo em ordem** do Almoxarifado (custo médio do Omie → custo pelas compras → custo manual estimado, 12.1.6) alimenta o lucro dos relatórios do PCP; a Emissão de NF (5.4) é lida pela Expedição como "faturado" e a trava da NF vive no banco (12.2.8). **Conferido** no código, 01/11/2026.
- **Recebido de Fabricação (01/11/2026, texto em `13_fabricacao.md` PC-12):** o lucro dos Relatórios do PCP (13.12) é bruto sobre materiais, com custo efetivo e aviso de custo incompleto; a hora-homem só sai por Edge Function para `pcp.ver_hh`, com fator de encargos 1 (decisão do Financeiro pendente). **Herdado.**
- **Recebido de Administração (01/11/2026, texto em `15_administracao.md` PC-12):** a aba **Parâmetros** de Configurações mostra câmbio R$ 5,18 e margens fixas **no código**, que **não** são lidas pelo motor de preço; os números reais moram no 5 (14.2.8). **Conferido** no código.
- **Recebido de Suprimentos & Importação (31/10/2026, texto em `07_suprimentos_importacao.md` PC-12):** a P.I. soma itens + taxas na moeda dela e as transferências entre P.I. entram na % paga; o frete vencedor do embarque vai em **USD** (BRL só se não há USD). Não existe câmbio central: cada tela usa o seu (`CambioAPI`, `cambio_diario`, cotação digitada na P.I.) — vale decidir uma fonte única com o Financeiro (7.PC-5). O **Aval de Pagamento** e a P.I. se ligam pelo gate de compra.
- **Recebido de Contratos & Jurídico (31/10/2026, texto em `06_contratos_juridico.md` PC-12):** o Aval Jurídico (tela 6.2) é o segundo dos três avais da compra; **não** trava nada quando reprovado, só mostra o selo (6.2.8), o que combina com o achado de 5.3.10 item 3 (reprovar só muda o selo). A restrição daquela tela usa um perfil que o seletor não oferece; as telas deste módulo usam `financeiro` e `admin`, que existem no `ROLE_MAP` (**Conferido**).
- **Doado** (acrescentado na mesma sessão aos outros documentos, no tema certo, texto completo aqui):
  - **A Geral (PC-9) e a todos: o gatilho de mudança de status sem vocabulário único.** O KPI de comissões do Dashboard conta `'Aguardando'` e o motor grava `'Aguardando aprovação'`: o mesmo conceito com três grafias (5.5.10 item 1). Vale conferir outros KPIs que comparam status por texto.
  - **A Geral (1.1 e PC-6): botão de aprovação sem conferir quem aprova.** O padrão "Aprovar (diretoria)" e "Dar Aval" é do navegador: a alçada existe no catálogo e não é conferida (5.5.3, 5.3.3). É o mesmo achado de 4.2.3.
  - **A todos: botão que parece ação e só muda status.** "Pagar" em Comissões não paga; "Reprovar" no Aval não bloqueia nada. A tela deveria dizer o que o botão realmente faz.
  - **Ao Comercial | Pré-venda (4.1.10 e 4.5): a regra de origem da venda** alimenta a comissão (5.5.7); campo vazio no Formulário vira erro no Financeiro.
- **Pedidos de mudança de código** que estes benefícios sugerem ficam como pendência; nenhuma linha de código foi alterada.
- **Recebido de Serviços (01/11/2026, texto em `16_servicos.md` PC-2):** todo alerta com destinatário também vira WhatsApp pelo gi-avisos; para chegar certo, título curto com o essencial na frente, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos. O Copiloto em uso é o da VPS e **não lê** `vp_copiloto_docs`: o "ajuste por UPDATE sem redeploy" citado neste documento só valia para a Edge Function antiga `vp-copiloto`, removida em 01/11/2026 (`16_servicos.md` S3.5, divergência D1). **Conferido.**
