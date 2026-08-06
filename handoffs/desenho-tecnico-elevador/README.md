# Prancha de Instalação — material de referência (não integrado)

Estes arquivos **não são consumidos pelo app** — nenhum HTML do site os carrega. É só
o motor de desenho (protótipo do Claude Design) guardado aqui pra não se perder,
enquanto a integração real fica pra depois. Ver plano completo na issue
[#188](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/188).

## Conteúdo

- `esquema.js` — contrato de dados (payload) + derivações (percurso, código do
  equipamento, etc.). Já genérico: `equipamento.tipo` não é fixo em hidráulico.
- `prancha.jsx` / `folhas-a.jsx` / `folhas-b.jsx` — as 6 folhas do desenho (corte
  do poço, planta do poço, planta da casa de máquinas, porta de pavimento,
  diagrama unifilar, especificações/notas).
- `app-prancha.jsx` — shell que lê o payload herdado (`window.VP_PROJETO`, query
  string em base64, ou `postMessage`) e monta as folhas.
- `INTEGRACAO.md` — contrato de payload e mapeamento campo-a-campo com o
  Formulário de Elevadores já existente no site.

## O que foi descartado do bundle original

O bundle trazia também um "VP-H330 Configurador" (configurador estilo Schindler
Plan, específico pro modelo hidráulico 330A) — fora de escopo por decisão do
usuário ("deixa o modelo vir do formulário, pode ser MRL, Cargueiro..."). Esses
arquivos (`app.jsx`, `data.js`, `drawing.jsx`, `form.jsx`, `sections.jsx`,
`report.jsx`) não foram copiados pra cá.

## Quando for integrar

Não copiar estes arquivos cru pro `src/`. Adaptar pro padrão real do site:
primitivos `Card`/`Button` já existentes, PDF via `html2canvas`+`jsPDF` (mesmo
mecanismo já usado em Ficha Técnica e Proposta) em vez do componente `<doc-page>`
do bundle original (que não foi copiado — é boilerplate genérico de paginação do
Claude Design, não lógica nossa).
