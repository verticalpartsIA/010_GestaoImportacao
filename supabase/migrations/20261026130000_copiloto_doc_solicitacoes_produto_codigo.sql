-- Copiloto VP: tela Solicitação de Produto — "Código" (prefixo opcional, no lugar de Categoria (SKU)). Só dados em vp_copiloto_docs — sem redeploy da função.
insert into public.vp_copiloto_docs (id, tipo, titulo, conteudo, atualizado_em)
values ('rota:solicitacoes-produto', 'rota', 'Solicitação de Produto', $doc$
TELA: Solicitação de Produto (Engenharia/Comercial).

Aqui entram os produtos que a VerticalParts AINDA NÃO FORNECE. Quem pede (qualquer setor, não precisa ser técnico) conta o que precisa; a Engenharia completa os detalhes técnicos depois. Quanto mais informação o solicitante der (site de referência, fotos, marca, modelo, contato do cliente), melhor para a Engenharia e para a Compra. Fluxo: qualquer setor preenche e clica "ENVIAR PARA ENGENHARIA" → a Engenharia é avisada automaticamente e faz a análise/desenho → quando pronto, a Importação (Bianca) é avisada pra avaliar → vira Ficha Técnica de produto. Dados fiscais, NCM e código do produto NÃO são preenchidos aqui: o setor responsável preenche depois.

IMPORTANTE — como se referir aos campos: cite SEMPRE o rótulo exatamente como aparece na tela (ex.: "Foi um pedido de um cliente específico?", "Código") — nunca o nome interno da variável. O usuário não sabe e não precisa saber que existe um nome de campo por trás do rótulo.

SÓ DOIS CAMPOS SÃO OBRIGATÓRIOS: "Tipo de Equipamento" (já vem preenchido) e "O que você precisa?". TODO O RESTO É OPCIONAL — inclusive o "Código", o "Site de referência da peça" e os dois campos de Part Number. Não insista em campo opcional; pergunte, e se o usuário não souber, siga em frente.

CAMPOS DO FORMULÁRIO DE NOVA SOLICITAÇÃO, na ordem em que aparecem:

1) "Tipo de cadastro" — escolha entre duas opções (já vem "Peças e equipamentos"):
   - "Peças e equipamentos" (para revenda / uso em equipamentos);
   - "Insumo, consumo, matéria-prima ou ativo" (uso interno).
   Se escolher o insumo, os campos "Referência", "Marca do produto" e "Nº de série / ID TAG do equipamento" desaparecem e a lista de "Família do produto (sugerida)" troca para famílias de insumo (ATIVO, USO E CONSUMO, INSUMOS, MATÉRIA PRIMA, EPI, LIMPEZA, INFORMÁTICA, COPA). Trocar o tipo limpa a família já escolhida.
2) "Tipo de Equipamento" — Elevador, Escada Rolante ou Esteira.
3) "Código (opcional)" — lista com só o PREFIXO do código do produto no Omie (ex.: VPER, VPEL, VPB, VPMP, VPIN, VPKIT e os demais prefixos VP ativos); começa em "Ainda não sei". O número NÃO é escolhido aqui: quando a Ficha Técnica for publicada, o sistema procura o último código do prefixo no Omie e usa o próximo livre (ex.: se o último VPER for 999, o novo será VPER-1000). Hoje a geração automática funciona para VPEL, VPER, VPB e VPMP; nos outros prefixos a Engenharia informa o código completo na Ficha. Quem pede não precisa saber o número — só ajuda dizer se será uma peça de escada/esteira (VPER), de elevador (VPEL), insumo etc.

CABEÇALHO DO PRODUTO
4) "O que você precisa?" — texto livre, em palavras simples. Obrigatório.
5) "Descrição (nome comercial)" — nome comercial conforme sairá na nota.
6) "Referência" — qual equipamento o produto pode ser utilizado (só em peças e equipamentos).
7) "Marca do produto" (só em peças) e "Modelo / Part Number".
8) "Unidade de medida" — lista (Barra, Chapa, Caixa, Jogo, Kit, Metro, Peça, Par, Rolo, Unidade etc.) e "Família do produto (sugerida)" — lista que depende do tipo de cadastro.

APLICAÇÃO DO PRODUTO
9) "Função / Finalidade" e "Material de composição".

REFERÊNCIAS E CONTATOS
10) "Site de referência da peça (opcional)" — link do fabricante, catálogo ou marketplace onde a peça foi vista. Ajuda muito a Compra a achar a peça.
11) "Contato do fornecedor (opcional)" — nome/telefone/e-mail do fornecedor, se já tiver.
12) "Observações / detalhes adicionais (opcional)".
13) "Nº de série / ID TAG do equipamento" (só em peças).

DADOS COMPLEMENTARES
14) "Local de compra do produto" (Nacional ou Importada), "Lead time (dias)" (dias para o material chegar na VP), "Característica", "Part Number", "Cor" e "Aplicação" (Escadas ou Esteiras Rolantes / Elevadores / Outra).

FOTOS DO PRODUTO (opcionais; a foto principal ajuda muito)
15) "1. Foto principal", "2. Foto das laterais do produto", "3. Foto do verso do produto" — uma imagem em cada. Mais "Outras imagens ou PDFs do produto (opcional)" para anexar vários arquivos.

CLIENTE
16) "Foi um pedido de um cliente específico?" — checkbox que é o GATILHO de um bloco condicional.

VALIDAÇÃO COMERCIAL
17) "Solicitante" e "E-mail" — já vêm preenchidos com quem está logado.
18) "Sugestão de estoque mínimo" — lista (1, 5, 10, 15, 30, 120, 135). Só depois de escolher aparece "Justifique a sugestão de estoque mínimo".

CAMPOS CONDICIONAIS (só aparecem depois de um clique) — regra de negócio importante: marcar a checkbox "Foi um pedido de um cliente específico?" revela 4 campos:
  - "Cliente (opcional)" e "Indústria (opcional)";
  - "WhatsApp do cliente (opcional)" — a Engenharia pode chamar o cliente para entender melhor a aplicação do produto;
  - "Outro contato do cliente (opcional)" — e-mail, telefone fixo etc.
**Se a checkbox continuar DESMARCADA, qualquer coisa digitada nesses campos é DESCARTADA ao enviar.** Se o usuário te der nome, WhatsApp ou contato de um cliente, marque também a checkbox "Foi um pedido de um cliente específico?" — senão os dados somem silenciosamente. Sempre pergunte "foi um pedido de algum cliente específico?" antes de preencher esses campos.

DEPOIS DE ENVIAR: a solicitação nasce com o status "NOVO", ganha um número (formato SOL-AAAAMMDD-#####) e vai para a fila da Engenharia. Ciclo de status que aparece como selo na listagem (o solicitante só ACOMPANHA): NOVO → EM ANALISE → AGUARDANDO DESENHO → PRONTO (Importação é avisada) → CONVERTIDO EM FICHA (virou Ficha Técnica). Na tela de detalhe aparecem todos os campos preenchidos, e o WhatsApp do cliente vira link para abrir a conversa.

Você pode conduzir a conversa perguntando os dados um de cada vez e preencher a solicitação inteira (mesmas regras gerais de "mode fill"): comece pelo "O que você precisa?", pergunte primeiro se é "Peças e equipamentos" ou insumo, e peça o site de referência e fotos como sugestão (não como exigência).
$doc$, now())
on conflict (id) do update set conteudo = excluded.conteudo, titulo = excluded.titulo, atualizado_em = now();
