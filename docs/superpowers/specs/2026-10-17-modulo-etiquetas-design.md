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
- **WMS CONNECTOR (impressão silenciosa):** a Senior usa um programa local instalado que imprime direto na impressora sem abrir janela. No hub, a impressão direta passa por um **adaptador** (Zebra Browser Print, QZ Tray ou WebUSB), com o PDF pelo diálogo do navegador como plano B. Ver 9.4. (Correção: o QZ Tray não é "pago": é de código aberto; o que costuma ser pago é o certificado de assinatura que tira o pop-up de permissão.)
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

### 9.3 Impressoras — decisão do Gelson (17/10/2026)
- **Impressora da casa:** Zebra **ZD220**, rolo de **100 × 50 mm**. Esse é o formato padrão de todas as etiquetas (ver 9.5).
- **Preparar para outras marcas de boa qualidade**, sem reescrever o módulo: Zebra (ZD220, ZD230, ZT421), Elgin (L42 Pro Full) e Argox (OS-214 Plus / OS-2140).
- **Meta de uso:** conectou a impressora, o site a reconhece e imprime. Ver 9.4 para o que isso significa na prática (um navegador sozinho não enxerga impressora).
- O PDF pelo diálogo do navegador continua existindo como **plano B universal** (qualquer impressora com driver), mas não é o caminho principal: perde precisão de QR/barras e exige clicar no diálogo a cada impressão.

### 9.4 Camada de impressão: perfis, linguagens e "plugins" (adaptadores)

**Ideia:** separar três coisas, para trocar uma sem mexer nas outras.
1. **Layout** (o modelo JSON da seção 8.2, em milímetros) — igual para qualquer impressora.
2. **Linguagem da impressora** — um *renderizador* converte o layout em comandos.
3. **Transporte** — um *adaptador* (plugin) leva os comandos até a impressora.

#### 9.4.1 Fatos levantados (fontes na seção 15)
| Impressora | Resolução | Largura máx. | Conexão | Linguagens |
|---|---|---|---|---|
| **Zebra ZD220** | 203 dpi (8 pontos/mm) | 104 mm (4,09") | **USB 2.0** (sem Ethernet no modelo base) | ZPL II e EPL2 |
| **Elgin L42 Pro Full** | 203 dpi (300 opcional) | 108 mm | USB, Ethernet e Serial | EPL, ZPL, PPLA, PPLB (reconhecimento automático, segundo lojas) |
| **Argox OS-214 plus Pro** | 203 dpi | a confirmar | USB e RS-232 | PPLA, PPLB, PPLZ (emulação de ZPL **parcial**; documentação não cita ZPL completo) |
- O rolo 100 × 50 mm cabe nas três (800 × 400 pontos a 203 dpi).
- Dados de lojas/fichas comerciais divergem em detalhes; **a confirmar nos manuais e na bancada**.

#### 9.4.2 Renderizadores (linguagem de comando)
| Renderizador | Atende | Observação |
|---|---|---|
| **ZPL II** (padrão) | Zebra, Elgin | Texto, Code 128 e QR nativos; é a referência |
| **EPL2** | Zebra/Elgin antigas | Só se alguma impressora não aceitar ZPL |
| **PPLB / PPLZ** | Argox | PPLZ lembra o ZPL, mas é um subconjunto; **não assumir compatibilidade total** |
| **TSPL** | TSC e outras | Fase futura |
| **Imagem (raster)** | Qualquer uma | Etiqueta inteira como bitmap de 1 bit, a 203/300 dpi; mais lento e menos nítido, mas funciona em qualquer linguagem |

Cada perfil de impressora escolhe **um renderizador**; o layout não muda.

**Cuidados de ZPL:** acentos e "ç" exigem a página de código UTF-8 (`^CI28`), que **depende do firmware**; se a ZD220 não aceitar, o texto vai como imagem e só as barras/QR ficam nativos. O QR e o Code 128 são sempre nativos (leitura mais confiável que imagem). Largura e comprimento da etiqueta são enviados em toda impressão (`^PW`, `^LL`); sensor de intervalo ou contínuo definido no perfil.

#### 9.4.3 Transportes (adaptadores / "plugins")
Todo adaptador cumpre o mesmo contrato: `detectar()`, `listar()`, `status()`, `enviar(comandos|pdf)`.

| Adaptador | O que é | Instala algo? | Reconhece sozinho? | Pontos de atenção |
|---|---|---|---|---|
| **zebra-browser-print** | Programa gratuito da Zebra que fica no computador; o site conversa com ele em `localhost` (portas 9100/9101) | Sim (1 vez por computador) | **Sim**, lista impressoras Zebra USB/rede | Só Zebra e só ZPL II. A lista oficial **que consegui ler** (guia v1.3) cita ZD410/ZD420/ZD620… e **não cita a ZD220**; pode funcionar, **precisa de teste com a sua** |
| **qz-tray** | Programa de código aberto (LGPL) que fala com **qualquer impressora instalada**, em qualquer marca, com comandos brutos ou PDF | Sim (1 vez por computador) | **Sim**, lista as impressoras do sistema | Sem certificado de assinatura aparece **pop-up de permissão**; impressão 100% silenciosa exige assinatura (planos pagos, ou configurar a própria raiz de confiança, **a confirmar com a QZ**) |
| **webusb** | O próprio navegador (Chrome/Edge) fala com a impressora pela USB | **Não** | Parcial: pede **um clique de autorização**; depois lembra | **No Windows, o driver da impressora costuma bloquear** o acesso (erro "Access denied", relatado para Zebra); contorno exige trocar o driver (WinUSB) |
| **browser-pdf** | Abre o PDF e usa o diálogo de impressão do sistema | Não | Usa a impressora padrão | Plano B; menos preciso; sem status |
| **ponte local própria** (futuro) | Pequeno serviço nosso no computador | Sim | Sim | Só se os de cima não servirem; é manutenção nossa |

**Ponto honesto:** nenhum site, sozinho, descobre uma impressora só porque ela foi ligada na USB. É preciso **um agente local** (Browser Print ou QZ Tray) ou **a autorização de WebUSB**. O que o hub promete é o seguinte: ao abrir a tela de impressoras, o hub **pergunta aos adaptadores presentes**, lista o que cada um enxerga e deixa escolher o padrão; a escolha fica lembrada por computador.

**Impressão pela rede:** o navegador não abre conexão direta com impressora na rede, e o servidor do hub (na Hostinger) não alcança a rede interna do galpão. Impressora de rede (Elgin L42 Pro Full) também passa por agente local ou ponte.

#### 9.4.4 Perfil de impressora (cadastro)
Tabela `etiqueta_impressoras` (uma linha por impressora): `marca`, `modelo`, `dpi` (203/300), `largura_max_mm`, `renderizador` (zpl/epl/pplb/pplz/raster), `adaptador`, `nome_no_sistema` (como o adaptador a chama), `rolo_padrao` (ex.: 100×50), `sensor` (gap/contínuo), `utf8` (aceita acento nativo?), `local`, `ativa`.
- **Perfis de fábrica** (prontos, editáveis): Zebra ZD220 (ZPL II, 203 dpi, 100×50), Zebra ZD230, Zebra ZT421 (203/300 dpi), Elgin L42 Pro Full, Argox OS-214 Plus/2140.
- **Reconhecimento:** o adaptador devolve fabricante/modelo; o hub casa com o perfil de fábrica mais próximo. Se não casar, abre como "impressora genérica" (PDF ou imagem) e pede para escolher um perfil.
- **Padrão por computador:** guardado no navegador do posto (`localStorage`), com cópia no banco por usuário.

#### 9.4.5 Recomendação
1. **Fase 1:** renderizador **ZPL II** e adaptador **zebra-browser-print**, **testados na bancada com a sua ZD220** (primeira tarefa). Se o Browser Print não a enxergar, passamos para o **qz-tray** (aceita qualquer marca; avaliar o pop-up de permissão).
2. **Sempre** manter o **browser-pdf** como plano B.
3. **Elgin e Argox:** perfis prontos; só se tornam "garantidos" depois de teste com a impressora física (pelo menos uma etiqueta impressa e lida).
4. **WebUSB** fica experimental (útil sem instalar, mas arriscado no Windows).

### 9.5 Rolo padrão 100 × 50 mm e o que muda nos layouts
- 100 × 50 mm = **800 × 400 pontos** a 203 dpi. O módulo mínimo do QR/Code 128 será de **3 pontos (≈ 0,37 mm)**; o QR `END:R2A4` cabe com folga em ~16 mm de lado.
- **Todos os tipos nascem em 100 × 50**, para o almoxarife usar **um rolo só**:
  - `ENDERECO`, `ITEM`, `RECEBIMENTO`, `AVARIA`, `IDTAG_EQUIPAMENTO`, `OP_QUADRO`, `PALETE`: cabem em 100 × 50 (as medidas da seção 7 viram **recomendação visual**, valem os 100 × 50).
  - `SEPARACAO` / volume: o layout de 100 × 100 da seção 7.4 **não cabe**; versão compacta em 100 × 50 (pedido, volume n/N, cliente, QR) na fase 1; versão grande só se existir rolo 100 × 100 (pergunta 11.10).
- Para impressão **fora de 100 × 50** (outro rolo): o modelo guarda `largura_mm × altura_mm` e o perfil informa o rolo carregado; o hub avisa se o rolo não confere.
- **Etiqueta de teste de bancada:** régua em mm, QR e Code 128 de teste, bordas e a letra "ç/ã/é", para calibrar e validar acentos.

## 10. Telas do módulo no hub

**Decidido (Gelson, 17/10/2026):** novo item **"Etiquetas"** no grupo **Logística Interna** do menu, **depois de "Expedição"** (último item do grupo). Rota `/logistica/etiquetas`; alçada própria.

- **Posição:** a ordem do grupo segue o fluxo (Almoxarifado → planejamento → produção → Relatórios → Expedição); Etiquetas é ferramenta transversal e fica no fim, sem deslocar nenhum item atual. Nada no código depende da ordem (o menu é uma lista; o teste de telas lê `KNOWN_ROUTES`).
- **Abas (cada uma com URL própria, via `useRouteTab`):** `gerar` (padrão), `modelos`, `historico`. Editor de modelo em `/logistica/etiquetas/modelos/<id>` (`useRotaItem`). Aba nova entra na lista de abas válidas.
- **Quem vê:** todos que fazem parte de **Logística, Almoxarifado, PCP e Expedição**. O menu lateral só filtra por perfil (Comercial, Engenharia, Financeiro, Admin) e **não existe perfil "Logística"**, então o item **não leva `restrict`**; quem entra na tela é decidido pela alçada `etiquetas.ver`, concedida (carga inicial) às pessoas desses quatro departamentos. Quem não tem `ver` e abre o link vê "Você não tem acesso" (mesmo padrão do Inbox). Perfil novo nasce sem a alçada. Administrador passa sempre.
- **A conferir na implementação:** a lista de pessoas dos quatro departamentos (consultar `colaboradores_vpsistema.departamento`) antes de conceder `ver`.
- **Arquivos previstos:** `src/shell.jsx` (menu, título e breadcrumb), `src/router.js` (`KNOWN_ROUTES`), `src/app.jsx` (`case`), `src/colaboradores-admin-store.js` (catálogo de alçadas), novos `src/etiquetas.jsx` e `src/etiquetas-store.js`, `?v=` no `index.html`, `docs/MAPA_DE_ROTAS.md` (via `node scripts/gerar-mapa-rotas.js`).
- **Fase 2:** botão "Imprimir etiqueta" dentro das telas existentes (linha do item no Almoxarifado, pedido na Expedição), abrindo a mesma geração já preenchida (equivalente ao "Impressos" da Senior).

1. **Gerar etiquetas:** tipo → modelo → seleção (filtros por rua/família/pedido/embarque) → pré-visualização → imprimir.
2. **Modelos:** lista por tipo (padrão e da empresa), ativar/desativar, copiar, editar, excluir (só os da empresa).
3. **Editor visual:** quadro em mm com elementos arrastáveis, painel de propriedades, lista de campos disponíveis e indicação dos protegidos. Pré-visualização com dados de exemplo.
4. **Histórico:** quem imprimiu, o quê, quando; reimpressão com motivo.
5. **Endereços** (reaproveita `estoque_enderecos`): impressão em lote por rua, com contador das etiquetas já impressas.

### 10.1 Alçadas (módulo `etiquetas`)
- `ver` (concedida a Logística, Almoxarifado, PCP e Expedição), `imprimir`, `reimprimir` (exige motivo), `editar_modelos`, `administrar` (modelos padrão e vínculos). Administrador passa em tudo.
- Pergunta em aberto: `imprimir` e `reimprimir` também para os quatro departamentos, ou só para os almoxarifes? (ver 11.6)

### 10.2 Integrações com o que já existe
- `estoque_enderecos` → etiqueta `ENDERECO`.
- `pcp_produtos` e catálogo de estoque → etiqueta `ITEM`.
- Fila de separação (`estoque_separacao`) → etiqueta `SEPARACAO`.
- Embarque/P.I. → etiqueta `RECEBIMENTO`.
- MES/OP → etiqueta `OP_QUADRO` (se aprovada).
- App de estoque: **nenhuma mudança de contrato** (QR do item e `END:`); a validação do endereço (`estoque_endereco_normalizar`) continua igual.

## 11. Decisões pendentes (do Gelson)

1. ~~**Impressora**~~ **Respondida:** Zebra ZD220, rolo 100 × 50 mm, preparada para Elgin e Argox (ver 9.3 a 9.5). **Respondido (17/10):** ZD220 **térmica direta** (sem ribbon; etiqueta própria para térmica direta e sensor de intervalo), computador do almoxarife **Windows com Chrome**. Efeito: o WebUSB fica de lado (bloqueio de driver no Windows); o Browser Print suporta Windows e Chrome 75+. O Gelson vai testar o Browser Print na bancada (Fase 0).
2. **Tamanho do endereço:** viga horizontal ou quadrado maior? Distância de leitura pelo celular.
3. **Quais etiquetas entram na 1ª entrega?** Sugestão: `ENDERECO`, `ITEM`, `ENDERECO_LOTE`; depois `RECEBIMENTO` e `SEPARACAO`.
4. **`IDTAG_EQUIPAMENTO` e `OP_QUADRO`:** são etiquetas que vocês querem?
5. **Foto na etiqueta de item:** ajuda ou polui? (padrão: sem foto)
6. **Quem imprime e quem reimprime:** só almoxarifes ou qualquer pessoa com alçada?
7. **Dígito verificador no endereço:** vale a pena? Se sim, qual regra (soma ponderada do código, 3 dígitos, como o exemplo da Senior)?
8. **Palete/LPN:** vocês paletizam e rastreiam palete? Se não, `PALETE` fica de fora.
9. **Editor visual:** é importante já na 1ª entrega, ou começamos só com os modelos padrão e a cópia com ajustes simples (posição/fonte), deixando o arrastar para depois?

## 12. Faseamento proposto (sem código até aprovar)

- **Fase 0 — Bancada (antes de tudo):** com a ZD220 real, testar Zebra Browser Print, QZ Tray e PDF; imprimir a etiqueta de teste (régua, QR, Code 128, acentos) e ler com o celular/leitor do app de estoque. O resultado escolhe o adaptador principal e confirma se a ZD220 aceita UTF-8.
- **Fase 1 — Núcleo:** tabelas (inclui `etiqueta_impressoras`), tipos fixos, renderizador ZPL II e adaptador escolhido na Fase 0, geração de `ENDERECO` e `ITEM` em 100 × 50, pré-visualização, plano B em PDF, histórico.
- **Fase 2 — Lote e recebimento:** `ENDERECO_LOTE`, `RECEBIMENTO`, `SEPARACAO`; reimpressão com motivo.
- **Fase 3 — Personalização:** cópia de modelos, editor visual, ativar/desativar por tela, campos protegidos.
- **Fase 4 — Opcional:** `AVARIA`, `PALETE`, `IDTAG_EQUIPAMENTO`, `OP_QUADRO`; impressão silenciosa; ZPL.

## 13. Verificação (antes de declarar pronto)

- PDF impresso em **papel real**: medir com régua (tolerância de 0,5 mm) e ler o QR/barras com o app de estoque, com celular e com leitor Bluetooth.
- Testes unitários: Code 128 (dígito de controle), QR com `END:R2A4`, dicionário de campos, regra de campo protegido.
- RLS (SQL): usuário sem alçada não imprime, não edita modelo, não apaga histórico.
- E2E: gerar, imprimir e reimprimir com motivo; modelo da empresa não altera o padrão.

## 14. Riscos

- **ZD220 e o Browser Print:** a lista oficial que consegui ler (guia v1.3) não cita a ZD220; só a bancada confirma.
- **Acentos na ZPL:** depende do firmware da impressora; plano B é imprimir o texto como imagem.
- **Elgin e Argox:** a compatibilidade vem de fichas comerciais; o PPLZ da Argox é um subconjunto do ZPL. Só valem como "garantidas" depois de teste físico.
- **Pop-up do QZ Tray** e **bloqueio de driver no WebUSB (Windows)** podem tornar a impressão menos fluida do que o desejado.

- **Impressora desconhecida:** tamanhos e qualidade de QR dependem dela.
- **Leitura de QR a distância:** prever teste de campo no galpão (altura da viga, luz).
- **Fidelidade ao layout da Senior:** os modelos deles não estão disponíveis; copiamos a **ideia** (campos e propósito), não o arquivo.
- **Custos de biblioteca de QR no bundle:** pequeno, mas precisa ser testado no iOS.

## 15. Fontes da pesquisa de impressoras

- Zebra ZD220, ficha técnica oficial (203 dpi, 104 mm, USB 2.0, ZPL II e EPL2): https://prod-www.zebra.com/content/dam/zebra_dam/en/tech-specs/zd220-tech-specs-en-us.pdf
- Zebra Browser Print, guia do usuário v1.3 (SOs, navegadores, impressoras suportadas, ZPL II, portas 9100/9101, USB e rede): https://www.zebra.com/content/dam/zebra_dam/en/guide/portfolio/zebra-browser-print-user-guide-v1-3-en-us.pdf
- QZ Tray, assinatura de mensagens (pop-ups sem assinatura, planos): https://qz.io/wiki/signing
- Elgin L42 Pro Full, fichas de lojas (EPL, ZPL, PPLA, PPLB; 203 dpi; USB/Ethernet/Serial; 108 mm): https://www.kabum.com.br/produto/404780/impressora-termica-de-etiquetas-elgin-l42-pro-full-usb-ethernet-e-serial-preta
- Argox OS-214 Pro / OS-214plus Pro, folheto oficial (PPLA, PPLB, PPLZ; 203 dpi; USB/RS-232): https://argox.com/docfile/brochure/OS-214%20Pro_OS-214plus_Pro_brochure_en_v1.0.pdf
- WebUSB com impressoras Zebra no Windows (erro "Access denied", driver do sistema): https://developer.zebra.com/content/domexception-failed-execute-open-usbdevice-access-denied
- WebZLP (biblioteca WebUSB para EPL/ZPL): https://app.unpkg.com/webzlp@2.0.3/files/README.md
