# 05 · ANALYZE — conflitos, lacunas, riscos

| # | Risco | Tratamento |
|---|---|---|
| 1 | Copiloto da VPS: 20 perguntas/h/pessoa, só leitura, resposta é texto livre (pode não vir em JSON) | Parser tolerante; falha/limite = digitar à mão; comprador sempre revisa; texto de fornecedor tratado como dado |
| 2 | `removerConvite` hoje é DELETE: respostas/decisões podem ter sido perdidas em lotes já mexidos | Conferir cascata das FKs no banco antes da T3; vale daqui para frente |
| 3 | Lote já aprovado antes da mudança tem `requisicoes` Omie | Lote antigo mantém; só lotes novos geram P.I. |
| 4 | P.I. rascunho sem `numero_cotacao` não dispara `PI_CRIADA`/gatilhos | Correto: varejo não é equipamento (CLAUDE.md: P.I. sem Nº é legítima) |
| 5 | Dólar da resposta: PTAX pode falhar | Gravar `null` e usar o do lote, sem bloquear a resposta |
| 6 | Excel importado pelo link público | Só pelo portal com token; validar no servidor (RPC), nunca confiar no arquivo |
| 7 | NPS editado/manipulado | Linhas imutáveis; média usa a última avaliação por lote |
| 8 | Tutoriais (P.I., RFQ, Cotações) desatualizam | Avisar; a sessão de tutoriais regenera |
| 9 | Cache `?v=` | Subir versão de cada arquivo tocado; `check-cache-bust` |
| 10 | Rota antiga `cotacoes-varejo/<lote>` em e-mails/notificações | Redirect mantido |

Lacunas: não conferi no banco quantos lotes reais existem (COTV-0011/0012 são de teste); a causa da quantidade 1 no item 258 é inferida do código (sugestão = 0), não confirmada no dado. Nada implementado.
