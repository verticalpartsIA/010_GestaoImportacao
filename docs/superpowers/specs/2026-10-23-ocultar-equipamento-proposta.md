# Ocultar / reexibir equipamento individual na Proposta (VPPR-0990) — 23/10/2026

Spec de origem: `CLAUDE_SPEC_SDD_OCULTAR_EQUIPAMENTOS_VPPR0990.md`. Constituição oficial do Spec Kit **não localizada** no repositório; valeram os princípios do spec e o `CLAUDE.md` (propostas enviadas são imutáveis; Destrave só pelo Líder com motivo).

## Decisões (confirmadas pelo usuário)
1. Parcelas são **recalculadas automaticamente** (sinal 40% + iguais, centavo exato) ao ocultar/reexibir.
2. **Bloqueia** ocultar equipamento com pedido de desconto pendente (reexibir é sempre permitido).
3. Quem pode: o **dono da proposta** (`vendedor_id`) ou quem tem a alçada de líder `propostas.destravar_aprovada` (Regiane; Administrador passa). Proposta travada (enviada/visualizada/revisão/aprovada) não permite.
4. Constituição: seguir spec + `CLAUDE.md`.

## Modelo
- Estado: `data_json.elevador.valores.ocultos = ["VPEL-EL0990-2", …]` (código do item = `valores.itens[].id`). Ausente/vazio = tudo visível → propostas antigas não mudam. Sem migração de banco.
- **Nada é apagado**: `itens`, `ativos`, `especificacoes` ficam íntegros. Chave **nunca** é `unidadeId` nem `codigoAtivo` (este pode apontar para outro equipamento do grupo — verificado na 0990).

## Fonte única — `src/proposta-opcoes.js`
- `projetar(d, eq)` → visão comercial (cópia): itens/ativos/especificações (`codigos`, `qtd`, `id`)/perfis sem os ocultos; grupo todo oculto some; sem ocultos devolve o **mesmo objeto**.
- `totalOficial` e `linhasUnitarias` já projetam. `alternarOculto(d, código, ocultar)` valida (opção 90 dias, desconto pendente, código inexistente) e refaz as parcelas. `semEquipamentoVisivel(d)` bloqueia publicar/enviar com zero visíveis (rascunho pode).

## Consumidores (todos leem a projeção)
Editor (`calcularValorTotal`, seção 09, PDF), `PEPreview`, página `/assinar` (`propostaRender` → preview e PDF), `proposta-store` (publicar/enviar recusam zero visíveis; `podeOcultarEquipamento`), Contrato de Venda (`aplicarProposta`) e Contrato do Instalador (ativos). `valor_total` gravado = total visível. Auditoria em `vp_logs` (código, valor, total antes/depois).

## Riscos conhecidos / fora do escopo
- Checagem de permissão é de interface (RLS aberta, issue #571); a trava de status continua em `PropostaStore.salvar`.
- Contrato de Venda já criado antes de ocultar não muda (herdou os itens no nascimento).
- Dashboard financeiro (`dashboard-metrics-financeiro.js`) e Precificação continuam vendo `ativos`/precificação integrais (custo/margem reais).
- Proposta já **publicada**: `versao_publicada` é congelada; ocultar depois exige o destrave do Líder + republicar.

## Testes
`src/proposta-ocultos.test.js` (14). Ensaio manual no navegador com fixture da 0990 só em memória/localStorage (2.153.547,43 → 1.961.472,42 ao ocultar `-2`; reexibir restaura; parcelas somam o total).

## Rollback
Reverter o commit; dados já salvos com `ocultos` continuam no JSON sem efeito (o código antigo ignora o campo).
