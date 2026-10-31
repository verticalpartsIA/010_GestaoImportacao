# Embarques de Importação — formulário de edição sempre visível (31/10/2026)

Tela: `/gestao-importacao/embarques-importacao` · arquivo `src/embarques-importacao.jsx`. Sem documento de módulo em `docs/modulos/` para Embarques, por isso os passos ficam aqui.

## 01 Specify
- **Problema:** clicar em "Editar" num cartão de embarque abre o formulário no topo da página; quem está rolado para baixo na lista não vê nada acontecer.
- **RF-01:** o cartão em edição fica destacado (borda e fundo amarelos + "✎ Em edição no formulário acima").
- **RF-02:** ao abrir o formulário (Editar ou Novo embarque), a tela rola suavemente até ele.
- **RF-03:** a aba do formulário continua na URL (`useRouteTab`, PR #1156) — sem mudança.
- **RN-01:** nada muda em vínculo com P.I., rastreio, frete, aduana ou containers.
- **Fora do escopo:** regras de negócio; abrir um embarque pela URL (limite já conhecido).
- **Aceite:** CR-01 rolando até o fim da lista e clicando em Editar, a tela sobe até o formulário; CR-02 o cartão em edição aparece destacado.

## 02 Clarify
- **C-01 — abordagem de UI:** [DECISÃO DO USUÁRIO, 31/10/2026] **Opção A** — manter o formulário no topo + rolagem suave + destaque do cartão. (Gaveta lateral e janela central descartadas.) Nenhum item aberto.

## 03 Plan
- Mesmo padrão já usado em Cadastros (`cadastros.jsx`): `formRef` no contêiner do formulário + `useEffect([showForm, editing])` chamando `scrollIntoView({ behavior: 'smooth', block: 'start' })`. Funciona qualquer que seja o elemento que rola (janela ou área principal).
- `EICard` recebe `ativo` (`showForm && editing.id === e.id`).
- `index.html`: `embarques-importacao.jsx` v19 → v20.

## 04 Tasks
| ID | Tarefa | Arquivo | Atende |
|---|---|---|---|
| T-01 | `formRef` + rolagem ao abrir | `src/embarques-importacao.jsx` | RF-02 |
| T-02 | Destaque do cartão em edição | `src/embarques-importacao.jsx` | RF-01 |
| T-03 | Cache-busting | `index.html` | Constituição |

## 05 Analyze
RF-01→T-02, RF-02→T-01, RF-03 mantido. Só apresentação; nenhuma regra, store ou banco tocado. **APROVADO.**

## 06 Implement
T-01, T-02 e T-03 feitos. Validado por Babel, `npm test` e `check-cache-bust`. Não testado com clique real no navegador.
