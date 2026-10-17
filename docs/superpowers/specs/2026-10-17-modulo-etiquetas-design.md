# Módulo de Etiquetas do Hub (VP Gestão) — spec de design

Data: 2026-10-17 · Status: **rascunho para revisão do Gelson** · Nenhum código foi escrito.
Issue de origem: `010_GestaoImportacao#862` (geração de etiquetas do VP Estoque).
Fonte de pesquisa: documentação do WMS Senior 8.12 (páginas e subpáginas listadas na seção 2).

## 1. Objetivo

Criar, dentro do hub, um módulo para **projetar, cadastrar, gerar e reimprimir** as etiquetas da VerticalParts, no mesmo espírito do Gerenciador de Etiquetas da Senior, mas sem depender de ferramenta externa (TIBCO/Jaspersoft).

Resultado esperado:
1. Catálogo de modelos de etiqueta, cada um com **propósito, tamanho, campos e fonte de dados**.
2. Geração em **PDF em tamanho real (mm)**, com QR Code e Code 128, pronto para qualquer impressora térmica de etiquetas.
3. **Editor visual** para ajustar o layout de um modelo (posição, tamanho e fonte dos campos), sem mexer no padrão.
4. **Histórico** de impressões e reimpressão com motivo.
5. Respeitar o contrato já definido com o app de estoque (spec do app, item 3.4).

## 2. O que foi pesquisado (e o que não foi possível ver)

### 2.1 Páginas e subpáginas lidas
Páginas principais (todas lidas, texto e imagens):
- `layouts-de-etiquetas/modelos-etiquetas` — 45 grupos de modelos, 124 imagens baixadas e as principais vistas.
- `gestao-de-etiqueta/gerenciador-de-etiquetas` — a ferramenta de cadastro.
- `etiqueta/como-usar-o-tibco` — edição do layout (6 imagens vistas).

Subpáginas (links embutidos) lidas:
- `rastreabilidade-por-lpn` (LPN e Gerenciador de Paletes).
- `cad-imp-padr-sku` (impressão automática de etiqueta SKU).
- `picking-volume-coleta` (etiquetas de volume).

Subpáginas **identificadas mas não abertas** (podem ter detalhe útil, mas são de WMS completo): `danfe-simplificado`, `devolucao-fornecedor-vendor-return`, `personalizacao-produtos-colmeia`, `rastr-padr-awb-total-express`, `line-haul`, `gest-coleta-sem-mov-estoque`, `codigo-rota-cep`, `entidade-estrangeira`, e os cadastros de Configuração de Onda, Geral, Armazém e Depositante.

### 2.2 Limites da pesquisa
- Muita documentação da Senior está em **imagem ou GIF**: os 3 vídeos do TIBCO e a lista de campos protegidos de cada etiqueta (`$F{...}`) não puderam ser lidos.
- O portal do cliente da Senior (`cliente.senior.com.br`) exige login, não foi acessado. Os arquivos modelo `.jrxml` ficam lá e **não temos acesso a eles**.
- Os campos de cada etiqueta foram deduzidos das **imagens de exemplo**, não de especificação.

## 3. Como a Senior resolve (modelo mental)

### 3.1 Três camadas
1. **Modelo (layout):** um arquivo JRXML do JasperReports, com tamanho de página, elementos de texto, código de barras e imagens. Os dados entram como `$F{NOME}` (ex.: `$F{BARRA}`, `$F{CODPRODUTO}`, `$F{EMBALAGEM}`). O usuário pode **mover ou apagar** elementos, mas existe uma lista de campos que **não podem ser removidos** do arquivo (o sistema valida).
2. **Tipo de etiqueta:** a "categoria" funcional (ex.: Local, Lote, Volume, Remanejamento). Cada tipo define quais campos de dados existem. A descrição da etiqueta é **única por tipo**.
3. **Associação à tela/configuração:** cada tela do WMS lista no botão "Impressos" os modelos **ativados** para ela, e algumas configurações escolhem o modelo padrão (ex.: modelo de etiqueta de lote na Configuração Geral).

### 3.2 O Gerenciador de Etiquetas
- **Copiar Etiqueta:** escolhe tipo + modelo → baixa o JRXML → edita no TIBCO → envia de volta com **Descrição**, **Arquivo**, **Fonte de Dados** (`Consulta SQL` ou `REST JSON`) e URL (só no REST).
- **Alterar / Excluir:** só para etiquetas criadas por cópia.
- **Ativar / Desativar:** define se o modelo aparece nas telas. Vale também para os modelos padrão.
- **Regras:** padrão não se edita nem exclui; descrição única por tipo; o arquivo precisa corresponder ao tipo; etiqueta de volume personalizada em retrato.
- **Não documentado:** reimpressão com motivo, histórico de quem imprimiu, status por etiqueta (a única exceção é o Gerenciador de Paletes LPN, que tem status e etapa).

### 3.3 Conceitos de operação que valem copiar
- **LPN (palete):** identificação única do palete, com **etapa** (recebimento, estoque, expedição, inventário, remanejamento, inutilizada) e **status** (disponível, em uso, processada, bloqueada). A etiqueta LPN mostra código de barras, o texto "LPN", o número com zeros à esquerda e o rodapé do sistema. O código pode ser externo (alfanumérico, até 38 caracteres).
- **Dígito verificador (DV) no endereço:** o Local Modelo 1 com DV imprime o código (ex.: `09-021-1-01`) e abaixo `DV: 353`. Serve para detectar digitação errada de endereço. O Modelo 8 imprime vários endereços numa folha, cada um com seu DV.
- **Impressão automática ao gerar:** se existe impressora/modelo definido, imprime sozinho; senão gera e avisa.
- **Reimpressão** como ação explícita nas telas.

## 4. O que cada etiqueta da Senior mostra (lido nas imagens)

| Etiqueta | Campos visíveis na imagem de exemplo | Propósito |
|---|---|---|
| **Local de armazenagem** (Modelo 1) | Code 128 + texto do endereço (`09-020-1-01`), opcional `DV: 353` | Identifica a posição no porta-palete |
| **Local Modelo 8** (150×100) | Até 3–8 blocos: DV, Code 128, texto, divisórias; cabeçalho com nome do armazém | Imprimir endereços em lote |
| **Lote** (Modelo 1) | Título, Code 128 do nº do lote, Lote, Estado (BOM/Danificado…), OR, Cód. Prod., Cód. Ref., Qtde, descrição, série/IMEI, Endereço, Lote Ind., Data Entrada, depositante, rodapé | Identifica a carga que chegou |
| **Lote** (variante com validade) | + Qtde Recebida, Qtde Disponível, Vencimento | Controle de validade |
| **Ordem de Recebimento (SKU)** | Faixa preta com armazém, QR/barras da OR, Entrada, NF, Produto, 2º código de barras, tipo, unidade, depositante | Etiqueta de recebimento por item |
| **Produtos Danificados** | Título, barras da OR, Remetente, Data Entrada, Estado, Depositante | Retém material danificado |
| **Remanejamento** | Armazém, barras do nº, Origem, Destino, descrição do produto, Qtde | Movimento entre endereços |
| **LPN** | Barras, "LPN", número, rodapé | Identifica palete |
| **Identificação de Onda** | Nº da onda, barras, título, data, NF, destinatário, regiões | Agrupa pedidos separados |
| **Volume de Entrega** (100×100) | Transportadora, NF, remetente, destinatário com endereço, volume "1/1", observação, 2 barras (volume e EAN), produto, quantidade | Etiqueta do volume expedido |

## 5. É possível criar algo idêntico no hub?

**Sim, na essência. Não, em fidelidade total ao produto da Senior.** Detalhe:

### 5.1 O que dá para igualar
| Recurso da Senior | Equivalente no hub | Dificuldade |
|---|---|---|
| Catálogo de modelos por tipo | Tabela `etiqueta_modelos` + tipos fixos | Baixa |
| Ativar/desativar por tela | Campo `ativo` + lista por tela (`etiqueta_vinculos`) | Baixa |
| Copiar modelo para personalizar | Duplicar modelo padrão em um modelo "da empresa" | Baixa |
| Padrão não editável | Flag `padrao` + política de acesso | Baixa |
| Campos de dados `$F{...}` | **Dicionário de campos por tipo** (ex.: `{codigo}`, `{descricao}`, `{endereco}`) | Média |
| Tamanho exato em mm | PDF com página em mm (já usamos `react-pdf` em `pdf-bundle/`) | Média |
| Code 128 e QR Code | Desenho vetorial gerado na hora (SVG no PDF) | Média |
| Reimpressão e histórico | Tabela `etiqueta_impressoes` (a Senior não documenta; é melhoria) | Baixa |
| Impressão automática com impressora | **Não igual** (ver 5.2) | Alta |

### 5.2 O que não dá para igualar (e a alternativa)
- **TIBCO/Jaspersoft:** é uma ferramenta de desktop que exige instalar software e conhecer relatórios. **Não recomendo copiar.** O editor do hub fará o mesmo papel dentro do navegador, com campos fixos e posição ajustável.
- **WMS CONNECTOR (impressão silenciosa):** a Senior usa um programa local instalado que imprime direto na impressora sem abrir janela. No hub, a impressão passa pelo **navegador** (abrir o PDF e imprimir com o diálogo do sistema). Impressão sem diálogo exigiria um agente local ou o QZ Tray (pago em produção) — fica como **fase futura**, se o diálogo incomodar.
- **Consulta SQL / REST como fonte de dados livre:** perigoso no nosso modelo de segurança. Cada tipo terá **fontes de dados fixas e revisadas** (funções do banco), não SQL digitado pelo usuário.

### 5.3 Conclusão
Podemos entregar, **com a mesma ideia e melhor controle**: modelos por tipo, campos protegidos por tipo, cópia para personalizar, ativar/desativar, reimpressão com histórico e geração em mm. A maior diferença é a impressão: no começo é pelo navegador.

## 6. Etiquetas da VerticalParts — catálogo proposto

Cada etiqueta tem um **tipo** (código interno), **propósito**, **dados** e **QR/barras**. Tamanhos são provisórios, definidos pela impressora (pergunta 11.1).

### 6.1 Já definidas (contrato do app de estoque)
| Tipo | Propósito | QR / barras | Dados |
|---|---|---|---|
| `ENDERECO` | Identifica uma posição do porta-palete. Bipada para informar onde se contou, guardou ou separou | QR `END:R2A4` (e Code 128 do mesmo texto) | Código (`R2A4`), rua, vão, nível, lado (esquerda/direita), DV opcional |
| `ITEM` | Cola-se na peça ou caixa para identificar o produto | QR **e** Code 128 com o `codigo` exato | Código, descrição, unidade, família, endereço sugerido |

Regra de contrato: o texto do QR do item é exatamente o código do produto; qualquer outro formato exige comentário na issue #862 antes de mudar.

### 6.2 Propostas novas
| Tipo | Propósito | Equivalente Senior | Prioridade |
|---|---|---|---|
| `RECEBIMENTO` | Marca a carga que chegou: embarque/P.I./NF, fornecedor, data, quantidade, item. Alimenta a fila de conferência | Ordem de Recebimento + Lote | Alta |
| `SEPARACAO` | Identifica o pedido de venda do Omie e o volume "n/N" na área `EXP` | Identificação de Separação + Volume | Alta |
| `AVARIA` | Retém o que chegou danificado ou aguarda decisão | Produtos Danificados | Média |
| `PALETE` | Identifica um palete inteiro, com conteúdo e etapa | LPN | Só se vocês paletizam |
| `IDTAG_EQUIPAMENTO` | Identifica cada elevador (ex.: `VPEL-EL0985-1`), o mesmo código das propostas/precificações | — | A confirmar |
| `OP_QUADRO` | Identifica a OP do PCP e o nº de série do quadro de comando (exigido na Qualidade do MES) | Ordem de Serviço | A confirmar |
| `ENDERECO_LOTE` | Folha com vários endereços para imprimir e colar de uma vez | Local Modelo 8 | Média |

### 6.3 Fora do escopo (não traz valor agora)
GS1-128, INMETRO, cartão de presente, crachá, DANFE simplificado (a NF sai do Omie), rastreio de transportadora (depende de contrato).

## 7. Layouts propostos

Tamanhos de partida (a validar com a impressora). Unidades em mm. Fonte sans-serif; texto grande em negrito.

### 7.1 `ENDERECO` — viga do porta-palete (100 × 35)
```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓   R2A4                  ◄ ESQ    │
│ ▓ QR ▓   Rua 2 · Vão A · Nível 4        │
│ ▓▓▓▓▓   END:R2A4        DV 353         │
│          |||||||||||| Code 128          │
└─────────────────────────────────────────┘
```
- Código em corpo ≥ 20 pt (leitura a 1 m).
- Seta indica o lado da rua (níveis ímpares = esquerda, pares = direita).
- Variante `EXP`: sem rua/vão/nível, texto "ÁREA DE EXPEDIÇÃO".

### 7.2 `ITEM` (70 × 40)
```
┌──────────────────────────────┐
│ ▓▓▓▓   VPEL-156              │
│ ▓QR▓   Rolete Poly-V 6PK     │
│ ▓▓▓▓   UN · Família VPEL     │
│ |||||||||||||| Code 128      │
└──────────────────────────────┘
```
- Variante com endereço sugerido (campo opcional).

### 7.3 `RECEBIMENTO` (100 × 60)
```
┌────────────────────────────────────────┐
│ ▓▓▓▓▓ ENTRADA 17/10/2026               │
│ ▓ QR ▓ Embarque 146 · P.I. SCVP260522-2 │
│ ▓▓▓▓▓ Fornecedor: Ningbo Senchen       │
│ VPEL-156  Rolete Poly-V   Qtd: 40 UN   │
│ NF: 11082199        Conf.: ___ /___    │
└────────────────────────────────────────┘
```

### 7.4 `SEPARACAO` / volume (100 × 100)
```
┌──────────────────────────────┐
│ PEDIDO 30570     VOL 2 / 5   │
│ Cliente: AKAI KB MAGAZINE    │
│ ▓▓▓▓▓   Destino: EXP         │
│ ▓ QR ▓   Separado por: Tiago │
│ ▓▓▓▓▓   17/10/2026 14:32     │
│ |||||||||||| Code 128        │
└──────────────────────────────┘
```

### 7.5 `AVARIA` (100 × 60), `PALETE` (80 × 60), `IDTAG_EQUIPAMENTO`, `OP_QUADRO`
Mesma grade: faixa de título, QR à esquerda, 3–4 linhas de dados e rodapé com data/usuário. Detalhe fechado só depois de decidir quais entram (pergunta 11.3).

## 8. Modelo de dados

Todas as tabelas **nascem fechadas** (RLS ligada, sem acesso anon; leitura só para usuário ativo; escrita por alçada), conforme o plano #571.

### 8.1 Tabelas
- `etiqueta_tipos` — catálogo fixo: `codigo` (ex. `ENDERECO`), `nome`, `proposito`, `qr_padrao` (formato do conteúdo do QR), `campos` (dicionário de campos disponíveis, com `obrigatorio` e `exemplo`).
- `etiqueta_modelos` — `id`, `tipo`, `nome` (**único por tipo**), `largura_mm`, `altura_mm`, `orientacao`, `layout` (jsonb: lista de elementos), `padrao` (bool, não editável), `ativo`, `copiado_de`, `criado_por`.
- `etiqueta_vinculos` — `tela` (ex. `almoxarifado.enderecos`), `modelo_id`, `ativo`, `padrao_da_tela`. Equivale ao "Impressos" da Senior.
- `etiqueta_impressoes` — `id`, `modelo_id`, `tipo`, `referencia` (código do item/endereço/pedido), `dados` (jsonb com o que foi impresso), `quantidade`, `usuario`, `motivo` (obrigatório em reimpressão), `impresso_em`. **Insert-only.**
- Opcional (fase 3): `etiqueta_paletes` com `etapa` e `status` (copiado do LPN).

### 8.2 Elemento do layout (jsonb)
```
{ "tipo": "texto|qr|code128|linha|logo|imagem",
  "campo": "{codigo}" | null, "texto": "fixo" | null,
  "x": 4, "y": 6, "w": 30, "h": 8,        // mm
  "fonte": 10, "negrito": true, "alinhamento": "esq|centro|dir",
  "obrigatorio": true }                    // campo protegido do tipo
```
- Elementos marcados `obrigatorio` pelo tipo **não podem ser apagados** (mesma regra da Senior); podem mudar de posição.
- Um modelo só salva se passar na **validação**: dentro da página, campos existem no dicionário do tipo, QR e barras com conteúdo válido.

### 8.3 Fontes de dados
Funções do banco **uma por tipo**, só leitura, que devolvem as linhas para imprimir (ex.: `etiqueta_dados_endereco(codigos[])`, `etiqueta_dados_item(codigos[])`, `etiqueta_dados_separacao(pedido)`). Nada de SQL livre.

## 9. Geração e impressão

### 9.1 Pipeline
1. Usuário escolhe o tipo, o modelo, o conjunto (ex.: ruas 2–3, ou os itens de um embarque) e a quantidade.
2. O hub chama a função de dados e monta as páginas.
3. O PDF é gerado **no navegador** com o mesmo padrão de `pdf-bundle/` (react-pdf), página em mm, uma etiqueta por página (ou N por folha, para o modelo em lote).
4. Pré-visualização na tela → botão **Imprimir** (diálogo do navegador).
5. A impressão grava uma linha em `etiqueta_impressoes`.

### 9.2 Códigos de barras e QR
- **Code 128:** codificação própria simples (tabela de padrões), desenhada como retângulos SVG no PDF.
- **QR Code:** biblioteca pequena (calcula a matriz de módulos) empacotada no bundle, desenhada em SVG. Nível de correção M ou superior; tamanho mínimo do módulo respeitando a impressora (203 dpi ≈ 0,125 mm por ponto).
- **Dígito verificador de endereço:** campo opcional do tipo `ENDERECO`, calculado de forma determinística a partir do código (a definir, pergunta 11.7); entra no texto, não no QR.

### 9.3 Impressoras
- Etiquetas térmicas aceitam PDF pelo driver do sistema. O PDF deve sair **sem margem** e na escala 100%.
- Teste de calibração: uma página com régua e QR de teste.
- Impressão silenciosa (sem diálogo) e ZPL ficam para a fase 4, se necessário.

## 10. Telas do módulo no hub

Local sugerido: **Logística Interna › Etiquetas** (rota nova `etiquetas`), alçada própria.

1. **Gerar etiquetas:** tipo → modelo → seleção (filtros por rua/família/pedido/embarque) → pré-visualização → imprimir.
2. **Modelos:** lista por tipo (padrão e da empresa), ativar/desativar, copiar, editar, excluir (só os da empresa).
3. **Editor visual:** quadro em mm com elementos arrastáveis, painel de propriedades, lista de campos disponíveis e indicação dos protegidos. Pré-visualização com dados de exemplo.
4. **Histórico:** quem imprimiu, o quê, quando; reimpressão com motivo.
5. **Endereços** (reaproveita `estoque_enderecos`): impressão em lote por rua, com contador das etiquetas já impressas.

### 10.1 Alçadas (módulo `etiquetas`)
- `ver`, `imprimir`, `reimprimir` (exige motivo), `editar_modelos`, `administrar` (modelos padrão e vínculos). Administrador passa em tudo.

### 10.2 Integrações com o que já existe
- `estoque_enderecos` → etiqueta `ENDERECO`.
- `pcp_produtos` e catálogo de estoque → etiqueta `ITEM`.
- Fila de separação (`estoque_separacao`) → etiqueta `SEPARACAO`.
- Embarque/P.I. → etiqueta `RECEBIMENTO`.
- MES/OP → etiqueta `OP_QUADRO` (se aprovada).
- App de estoque: **nenhuma mudança de contrato** (QR do item e `END:`); a validação do endereço (`estoque_endereco_normalizar`) continua igual.

## 11. Decisões pendentes (do Gelson)

1. **Impressora:** modelo, resolução (203/300 dpi), largura do rolo, e se é térmica direta ou transferência. Define os tamanhos finais.
2. **Tamanho do endereço:** viga horizontal ou quadrado maior? Distância de leitura pelo celular.
3. **Quais etiquetas entram na 1ª entrega?** Sugestão: `ENDERECO`, `ITEM`, `ENDERECO_LOTE`; depois `RECEBIMENTO` e `SEPARACAO`.
4. **`IDTAG_EQUIPAMENTO` e `OP_QUADRO`:** são etiquetas que vocês querem?
5. **Foto na etiqueta de item:** ajuda ou polui? (padrão: sem foto)
6. **Quem imprime e quem reimprime:** só almoxarifes ou qualquer pessoa com alçada?
7. **Dígito verificador no endereço:** vale a pena? Se sim, qual regra (soma ponderada do código, 3 dígitos, como o exemplo da Senior)?
8. **Palete/LPN:** vocês paletizam e rastreiam palete? Se não, `PALETE` fica de fora.
9. **Editor visual:** é importante já na 1ª entrega, ou começamos só com os modelos padrão e a cópia com ajustes simples (posição/fonte), deixando o arrastar para depois?

## 12. Faseamento proposto (sem código até aprovar)

- **Fase 1 — Núcleo:** tabelas, tipos fixos, geração em PDF de `ENDERECO` e `ITEM` (modelos padrão), pré-visualização, impressão pelo navegador, histórico. Teste de calibração.
- **Fase 2 — Lote e recebimento:** `ENDERECO_LOTE`, `RECEBIMENTO`, `SEPARACAO`; reimpressão com motivo.
- **Fase 3 — Personalização:** cópia de modelos, editor visual, ativar/desativar por tela, campos protegidos.
- **Fase 4 — Opcional:** `AVARIA`, `PALETE`, `IDTAG_EQUIPAMENTO`, `OP_QUADRO`; impressão silenciosa; ZPL.

## 13. Verificação (antes de declarar pronto)

- PDF impresso em **papel real**: medir com régua (tolerância de 0,5 mm) e ler o QR/barras com o app de estoque, com celular e com leitor Bluetooth.
- Testes unitários: Code 128 (dígito de controle), QR com `END:R2A4`, dicionário de campos, regra de campo protegido.
- RLS (SQL): usuário sem alçada não imprime, não edita modelo, não apaga histórico.
- E2E: gerar, imprimir e reimprimir com motivo; modelo da empresa não altera o padrão.

## 14. Riscos

- **Impressora desconhecida:** tamanhos e qualidade de QR dependem dela.
- **Leitura de QR a distância:** prever teste de campo no galpão (altura da viga, luz).
- **Fidelidade ao layout da Senior:** os modelos deles não estão disponíveis; copiamos a **ideia** (campos e propósito), não o arquivo.
- **Custos de biblioteca de QR no bundle:** pequeno, mas precisa ser testado no iOS.
