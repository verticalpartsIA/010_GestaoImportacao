# Integração — Prancha de Instalação VerticalParts

Esta página **não coleta dados**. Ela só **desenha**. Todos os valores vêm do
formulário que já existe no site (Dados do Cliente/Obra + Dados do Equipamento).

## Como injetar o payload

Três formas, em ordem de prioridade. Escolha a que encaixar no site.

**1. Variável global (mais simples)** — defina antes de carregar `app-prancha.jsx`:

```html
<script>window.VP_PROJETO = { /* payload */ };</script>
```

**2. Query string** — JSON em base64, útil para abrir a prancha em nova aba:

```
Projeto Tecnico.html?dados=eyJlcXVpcGFtZW50byI6...
```

**3. postMessage** — para a prancha embutida em iframe. Re-renderiza ao receber:

```js
iframe.contentWindow.postMessage({ tipo: 'vp:projeto', dados: payload }, '*');
```

## Contrato

Tudo é opcional: o que não vier usa o padrão de referência em `esquema.js` (`DEMO`).
Faça o merge só do que o formulário tiver — é fusão profunda.

```js
{
  documento: {
    revisao, data, escala, unidade,
    numeroProposta, numeroSerie,
    codigoEquipamento,   // null → derivado: VP-{sigla tipo}-{kg}-{paradas}-{percurso}
    revisadoPor, aprovadoPor, motivoRevisao1, motivoRevisao2
  },
  cliente: {
    nomeRazaoSocial, cnpj,
    endereco: { logradouro, cep, cidade, uf }
  },
  equipamento: {
    identificador, quantidadeIdentica,
    tipo,              // ← decidido pelo USUÁRIO. Nada fixo. Compõe a sigla do código.
    modelo, normaProjeto,
    capacidadeKg, capacidadePassageiros,
    velocidade,        // número, em m/s
    paradas,
    casaDeMaquinas,    // "Superior" | "Inferior" | "Lateral" | "Sem casa de máquinas"
    agrupamento, portaOposta
  },
  poco: { profundidade, viga },              // S
  pavimentos: [                              // de baixo para cima
    { rotulo, distancia, porta, parada, viga }
  ],
  caixa: {
    tipoEstrutura,
    largura,        // HW
    profundidade,   // HD
    percurso,       // P — null → soma das distâncias (exceto a última)
    ultimaAltura    // K — null → distância do último pavimento
  },
  cabina: { largura, profundidade, altura, tetoFalso, piso, corrimao },   // CW CD CH
  portas: {
    tipoAbertura, modelo,
    largura, altura,               // OP  OPH
    soleiraLargura, soleiraAltura, // SOW SOH
    acabCabina, acabPavimento, classeCortaFogo
  },
  casaMaquinas: { largura, profundidade, altura, alturaLivre, folga, ganchoCapacidade },
  eletrico: {
    tensaoPrincipal, tensaoIluminacao, fases,
    potenciaMotor, correnteNominal,
    disjuntorForca, disjuntorIluminacao,
    secaoForca, secaoIluminacao, potenciaIluminacao,
    controle, efeitoTracao, modeloMotor
  },
  engenharia: {                    // preenchido pela Engenharia, não pelo vendedor
    guiaCabina, guiaContrapeso,
    contrapeso: { posicao, largura },   // "traseiro" | "lateral" | "nenhum"
    distanciaMaxSuportes, primeiroSuporte, ultimoSuporte,
    reacoes: { R, R1, R2, R3, R4, R5, U, V },   // null → "----"
    percursoMaximo, pavimentosMaximo
  },
  botoeiras: { cop, lop },
  opcionais: { ard, camera, anuncioVoz, exigenciasEspeciais }
}
```

### Regras derivadas (em `esquema.js → resolve()`)

| Derivado | Regra |
|---|---|
| `percurso` | `caixa.percurso`, senão soma das `distancia` de todos os pavimentos menos o último |
| `K` (última altura) | `caixa.ultimaAltura`, senão a `distancia` do último pavimento |
| `alturaTotal` | `S + percurso + K` |
| `paradas` | `equipamento.paradas`, senão contagem de pavimentos com `parada !== false` |
| `portas` | contagem de pavimentos com `porta` preenchida |
| `codigo` | `VP-{sigla do tipo}-{kg}-{paradas 2 díg}-{percurso}` |
| `semCasaMaquinas` | verdadeiro se `casaDeMaquinas` contiver "sem casa" — folha 3 se adapta |

### Mapeamento a partir dos formulários existentes

| Campo do formulário | Caminho no payload |
|---|---|
| Nome / Razão Social | `cliente.nomeRazaoSocial` |
| CNPJ | `cliente.cnpj` |
| Logradouro / CEP / Cidade / UF | `cliente.endereco.*` |
| Identificador (E1, E2…) | `equipamento.identificador` |
| Tipo | `equipamento.tipo` |
| Modelo | `equipamento.modelo` |
| Norma de projeto | `equipamento.normaProjeto` |
| Capacidade (kg) / (passageiros) | `equipamento.capacidadeKg` / `capacidadePassageiros` |
| Velocidade (m/s) | `equipamento.velocidade` |
| Paradas | `equipamento.paradas` |
| Descrição dos pavimentos | `pavimentos[]` (estruturar: rótulo + distância + porta) |
| Casa de máquinas | `equipamento.casaDeMaquinas` |
| Porta oposta / múltiplas entradas | `equipamento.portaOposta` + `pavimentos[].porta` |
| Tipo de estrutura da caixa | `caixa.tipoEstrutura` |
| Caixa largura / profundidade | `caixa.largura` / `caixa.profundidade` |
| Percurso / altura de viagem | `caixa.percurso` |
| Última altura / overhead | `caixa.ultimaAltura` |
| Profundidade do poço | `poco.profundidade` |
| Cabina largura / prof. / altura | `cabina.*` |
| Teto falso / Piso / Corrimão | `cabina.tetoFalso` / `piso` / `corrimao` |
| Tipo de abertura | `portas.tipoAbertura` |
| Porta largura / altura | `portas.largura` / `portas.altura` |
| Acabamentos / Classe corta-fogo | `portas.*` |
| Tensão principal / iluminação | `eletrico.tensaoPrincipal` / `tensaoIluminacao` |
| Botoeira COP / LOP | `botoeiras.cop` / `lop` |
| ARD / Câmera / Anúncio de voz | `opcionais.*` |

`documento.*` e `engenharia.*` não vêm do vendedor — são preenchidos pela
Engenharia (nº de série, reações de apoio, guias, aprovações).

## Folhas geradas

1. Seção do eixo vertical + tabela de informações dos andares
2. Plano do poço (planta da caixa)
3. Plano do piso superior / casa de máquinas
4. Porta de pavimento
5. Diagrama unifilar
6. Especificações, siglas e notas de obra

O carimbo é idêntico nas 6 folhas e lê sempre de `documento`, `cliente` e `engenharia.reacoes`.
