# 05 — Analyze

- **Ordem de publicação:** sem a migration `20261026110000`, "Enviar para Engenharia" falha (colunas inexistentes). Aplicar a migration **antes** de publicar o front.
- **Dados antigos:** solicitações existentes ficam com `tipo_cadastro='pecas'` e `dados_cadastro={}`; o detalhe só mostra o que existe.
- **Alertas da Engenharia** (`_notificarEngenharia`) não mudam.
- **Copiloto:** a função cai no `ROUTE_DOCS` do código se o banco não responde; o repo e o banco ficam com o mesmo texto. Redeploy da função não é necessário (e exigiria baixar a versão de produção antes).
- **Risco baixo:** nenhuma área blindada tocada; nenhuma obrigatoriedade nova; anexos antigos (sem `slot`) continuam na lista livre.
- **Tutorial** da tela (se existir) fica desatualizado — regenerar pela sessão de tutoriais, não editar à mão.
- **Não testado** com clique real ainda.
