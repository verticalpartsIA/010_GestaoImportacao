# Revisões comerciais — decisões de 22/10 (projeto × proposta, cláusulas em vermelho) e status da Etapa 1

Data: 22/10/2026. Estudo feito em leitura; nada aplicado em produção.

## 1. Respostas fechadas
1. **Mudança técnica numa revisão aprovada**: só reabre o Projeto de Instalação se a revisão for **de projeto**. Preço, pagamento, prazo, acabamentos e textos **não mexem no projeto**. Se o Jurídico do cliente pedir mudança ou inclusão de cláusula, **o texto alterado/incluído sai em vermelho**, para saber que o documento foi mexido.
2. Gestor Comercial aprova **toda** revisão antes do envio.
3. SLA interno para analisar o pedido do cliente: **12 horas úteis** (substitui as 8 h do `02-`).

## 2. Projeto × acabamento (decisão 1)
A categoria "Técnico" do diff (`02-` §6) se divide em duas:
| Categoria | Campos (lista inicial, a validar com a Engenharia) | Efeito |
|---|---|---|
| **Projeto** | quantidade e códigos dos equipamentos, modelo, tração, capacidade (kg), paradas/andares/portas, percurso, velocidade, dimensões da caixa de corrida/poço/fosso, da cabine e da porta, casa de máquinas | reabre o **Aval Engenharia**: o Projeto de Instalação assinado deixa de valer para a revisão; precisa novo Projeto e nova assinatura |
| **Acabamento** | material/modelo da cabine, piso, teto, painel, botoeiras, acabamento de portas | **não** mexe no projeto |
Levantamento: os campos de dimensão já existem na herança (`dimensoesCaixa`, `dimensoesCabine`) e na tela da Engenharia (poço, fosso, cabine, porta, paradas, velocidade, capacidade, percurso).
Regras:
- Sem mudança de **Projeto**, o Projeto assinado continua valendo e o Aval Engenharia **não** reabre.
- Com mudança de Projeto: a Engenharia sobe novo Projeto de Instalação; o anterior fica marcado como substituído (`projetos_elevador_desenhos.substituido_por_id`, coluna nova) e o `AvalEngenhariaStore` passa a ignorar os substituídos. Gate de compra fica fechado até a nova assinatura. Se a compra ao fornecedor já começou, aviso obrigatório à Importação.
- O ID-TAG continua sem assinatura.

## 3. Cláusulas alteradas ou incluídas em vermelho
### O que existe hoje (estudo)
- **Contrato de Venda**: o texto vem fixo da minuta no `contrato-venda-engine.js` (`buildContract`); só a cláusula 1.1 tem complemento livre. **Não existe hoje como alterar nem incluir cláusula**, e o documento é remontado a cada abertura (inclusive em `/assinar`), então qualquer mudança precisa morar em `form_state`.
- **Proposta**: tem textos editáveis de natureza contratual (cláusula de reajuste cambial, faturamento, taxas incluídas/excluídas, responsabilidades, infraestrutura).
- O PDF vetorial (`contrato-venda-reactpdf`) e a Proposta só conhecem `<b>`, `<i>`, `<u>`; **não há suporte a cor** em trecho de texto — entra com a mudança.

### Desenho proposto
**Regra**: vermelho = trecho que **diverge do texto padrão da VerticalParts**. Aparece na pré-visualização, na página `/assinar`, no PDF e no PDF assinado (transparência: o cliente vê exatamente o que mudou).
- Sobreposições guardadas em `form_state.clausulasAlteradas` do contrato (entram no hash da assinatura): `{ id, tipo: alterada | incluida | suprimida, ancora (para inclusão), texto_html, texto_padrao (snapshot), motivo, solicitacao_id, por, em, aprovado_juridico_por/em }`.
- **Alterada**: o texto novo no lugar, em vermelho. **Incluída**: nova cláusula depois da âncora, **numerada com sufixo** (`3.4-A`) para não renumerar a minuta nem quebrar remissões ("vide 2.8"), toda em vermelho. **Suprimida**: linha em vermelho "Cláusula X suprimida por acordo entre as partes".
- Aviso fixo no início do documento quando houver alteração: "Trechos em vermelho divergem da minuta padrão VerticalParts."
- Acessibilidade/impressão: vermelho (#C00000) **+ sublinhado pontilhado**, para sobreviver à impressão em preto e branco.
- Selo **"⚑ Minuta alterada (N cláusulas)"** na lista de contratos, no painel, no Aval Jurídico e na revisão.
- **Quem pode**: só o Jurídico da VerticalParts (alçada nova `contrato-venda.alterar_clausula`). O vendedor apenas registra o pedido (solicitação, trilha jurídica). Cada alteração exige aprovação do Jurídico antes do envio e vira evento auditável.
- **Proposta**: mesma ideia, restrita aos textos contratuais acima: vermelho quando o texto difere do padrão em vigor.
- Contrato já assinado ou sem alteração: nada muda (lista vazia = documento idêntico ao de hoje).
- Se o contrato já foi enviado e o cliente pede alteração, aplica-se a regra da letra: novo documento. **Proposta**: revisão do contrato antes da assinatura usa **letra** (`VPCV-0955-A`); o sufixo numérico (`-2`) continua reservado ao aditivo depois de assinado.
- **Áreas blindadas**: mexe em `assinar-app.jsx`, no bundle de PDF do contrato e no motor do contrato. Só com sua confirmação explícita.

## 4. Status da Etapa 1 (banco)
**Pronto no papel e em arquivo; nada aplicado em produção.**
- Migration: `supabase/migrations/20261022100000_revisoes_comerciais_etapa1.sql` (aditiva, idempotente).
- Testes: `supabase/tests/revisoes/` — `bash supabase/tests/revisoes/run-local.sh` sobe um Postgres 16 descartável, aplica a migration **duas vezes** e roda 16 grupos de teste + concorrência. **Resultado em 22/10: todos passaram.**
- O teste achou e corrigiu um defeito de desenho: `proposta_tokens` só seria preenchida no backfill; agora um gatilho a mantém em dia.
- Cobertura dos testes: letras (A…Z, AA); tipo normalizado (`Elevador de Passageiros` = `elevador`); criar A, B e C (C a partir da original, nada se perde); idempotência; base em rascunho recusada; permissões; vigência (enviada, aprovada, revisão aprovada, contrato assinado → pendente de aditivo); reativação (só com alçada, link novo, antigo não assinável, bloqueio com contrato assinado); pedido de revisão pós-aprovação sem trocar status; solicitações por trilha; validação por trilha; alinhamento; exclusão protegida; eventos append-only; papéis `anon`/`authenticated`; duas criações simultâneas (`A` e `B`).
- **Não coberto**: os testes rodam num esqueleto, não no schema real. Falta ensaiar na produção dentro de uma transação desfeita (interação com `vp_valores_guarda` e `trg_avais_abrir_na_proposta`), o que exige seu `CONFIRMO` na ferramenta do banco.

## 5. Pendências
- Seu **"pode aplicar"** para a Etapa 1 no banco (primeiro o ensaio desfeito; só depois a aplicação).
- Validar com a Engenharia a lista de campos de **Projeto** (§2).
- Confirmar a proposta de **letra** para revisão de contrato antes da assinatura (§3).
