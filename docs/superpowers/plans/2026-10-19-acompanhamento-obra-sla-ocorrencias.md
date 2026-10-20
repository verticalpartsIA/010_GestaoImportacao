# Acompanhamento de Obra — data real da etapa, SLA, ocorrências e link do cliente

Plano (19/10/2026). Nada disto está construído. Cada fase vira PR próprio; migrations só com "Confirmo" do usuário.

## Contexto medido (19/10/2026)
- 10 obras com marcações, 96 itens marcados, 130 fotos, 48 lançamentos.
- A data gravada (`flegado_em`) é a do ENVIO. A data do EXIF das fotos é igual à do envio nas 96 marcações (foto tirada na hora de enviar), logo nenhuma fonte atual diz quando a etapa terminou.
- Obras quase completas: 7 a 23 dias úteis no total (DOS-M050, M011, M048, M012). Mediana ~12. Tamanhos de elevador misturados.
- GPS no EXIF: 3 de 130 fotos. Aparelhos: Xiaomi 95, Samsung 30, Realme 5.

## Fase 1 — Data real da etapa (base de tudo) — FEITA em 19/10/2026 (coluna concluido_em, RPC, campo no link do montador, correção pelo operador)
- Coluna nova `acompanhamento_obra_status.concluido_em` (date). O link do montador pede, ao marcar cada item, "Dia em que concluiu" (padrão: hoje; não aceita data futura nem anterior ao início da obra).
- Mantém `flegado_em` (envio) como está. O SLA usa `concluido_em`; sem ele, cai em `flegado_em`.
- Operador (alçada `instalacao.editar_status_obra`) pode corrigir `concluido_em`, com log em `vp_logs`.
- Backfill: `concluido_em = data do EXIF` quando existir (hoje coincide com o envio); não inventar datas.
- Atualizar `public_diario_obter` e a função de gravação do lançamento para levar o campo.

## Fase 2 — Calendário de dias úteis — FEITA em 19/10/2026 (tabela calendario_feriados 2026-2028, dias_uteis, somar_dias_uteis, src/calendario-uteis.js)
- Tabela `calendario_feriados` (data, descrição, abrangência: nacional / SP).
- Função `dias_uteis(data_ini, data_fim)` descontando fim de semana e feriados. Feriado ponte entra como linha manual.
- O mês com mais feriados fica mais longo sozinho; a gordura NÃO cobre calendário.

## Fase 3 — SLA por fase
- Fases: Preparação (itens 1–2), Mecânica da caixa (3–8), Portas e cabina (9–11), Elétrica (12–15), Testes e acabamento (16–17).
- Tabela `sla_etapas_obra` com versão e vigência: tipo de equipamento, fase, prazo em dias úteis, gordura %, vigente_de, vigente_ate.
- Prazo inicial = percentil 75 das obras concluídas, medido com `concluido_em`; gordura inicial sugerida 20% (a confirmar).
- Semáforo por fase: verde dentro do prazo, amarelo dentro da gordura, vermelho acima.
- Revisão periódica: recalcular com mais obras e gravar nova versão, sem apagar a anterior.
- Segmentar por capacidade e paradas só quando houver ~15–20 obras concluídas.

## Fase 4 — Ocorrências da obra ("Contratempos")
- Tabelas `acompanhamento_obra_ocorrencias` (dossier_id, tipo, grupo, responsavel, inicio, fim, impacto, dias_atraso, descricao, fotos, resolvido, aprovada_em/por, criado_por) e `acompanhamento_obra_ocorrencia_tipos` (lista editável).
- Tipos de partida: infraestrutura (falta de energia, falta de água, água no poço, acesso bloqueado), civil do cliente (fechamento dos marcos, adequação civil, grauteamento por bloco oco, poço fora de prumo/medida, casa de máquinas não pronta), obra (sem andaime, falta de material, chuva, outra empreiteira no poço, falta de liberação), segurança (condição insegura, falta de EPI/ancoragem), equipamento (peça faltando/danificada, divergência de projeto) e "Outro" livre.
- Montador só cria e marca resolvida; operador corrige/apaga. Foto obrigatória como nas etapas.
- Ocorrência de responsabilidade do cliente ou do clima PAUSA o relógio do SLA e soma dias ao prazo de entrega. Não altera o percentual do checklist.
- Sem aprovação por ocorrência: o cliente vê tudo assim que recebe o link do cliente, e o link é vivo.
- Previsão de entrega vem do Contrato; sem contrato com data, não se calcula atraso de prazo.

## Fase 5 — Link do cliente (vivo, só leitura)
- Token novo por dossiê (separado do token do montador), gerado e enviado pelo usuário desktop; registra quem enviou, quando e para quem.
- Função de leitura `public_acompanhamento_cliente_obter(token)`: progresso ponderado, etapas com data e foto, ocorrências aprovadas, previsão original x atual.
- Página baseada em `status-obra.html`; atualiza a cada poucos minutos. Revogável; validade a definir.

## Fase 0 — Só foto da câmera (decisão do usuário, 19/10/2026) — FEITA (PR #981)
Motivo: já apareceram obras com fotos de outras obras (imagem da galeria).
- O botão "Anexar foto" abre direto a câmera. Galeria/arquivos não são aceitos; tentativa de enviar da galeria mostra aviso.
- Camada 1 (apresentação): `<input type="file" accept="image/*" capture="environment">`. Em parte dos aparelhos o navegador ainda oferece a galeria; por isso a camada 2.
- Camada 2 (garantia): captura dentro da própria página com `getUserMedia` (vídeo da câmera traseira → quadro desenhado em canvas → JPEG). Não existe caminho para arquivo guardado. Exige HTTPS e permissão de câmera.
- Camada 3 (conferência): ao receber o arquivo, ler o EXIF; foto com `DateTimeOriginal` ausente ou com mais de ~10 min de diferença em relação ao momento do envio é recusada com aviso. Na captura por canvas (sem EXIF) o servidor carimba data/hora do envio e a localização.
- Cada foto grava: carimbo de data/hora, aparelho, e (se o montador permitir) latitude/longitude, na linha da marcação. Foto sem localização continua válida, mas aparece como "sem localização".
- Impacta o link do montador (`diario-obra-app.jsx`) e a ocorrência (mesma regra).

## Decisões (19/10/2026)
1. Data de entrega prevista: vem dos Contratos. Obras antigas ainda não têm; as novas terão. Obra antiga sem data mostra "previsão não informada" e não calcula atraso de prazo.
2. Visibilidade para o cliente: não há aprovação por ocorrência. O cliente passa a ver tudo no momento em que o link chega a ele (o usuário desktop envia o link, marcando-o como "cliente").
3. O link do cliente é vivo: sem validade; mostra qualquer avanço ou ocorrência nova que o montador registrar depois. Revogável pelo desktop.
4. Gordura inicial: 20%.
5. Geolocalização no envio do montador: sim (permissão do aparelho). Só 3 de 130 fotos têm GPS hoje.

## Riscos e cuidados
- `acompanhamento_obra_itens` é compartilhada por todas as obras; mudar peso/itens muda o % de todas (já feito em 19/10 com Confirmo).
- Funções públicas por token, nunca leitura direta das tabelas. Seguir o padrão de `public_diario_obter`.
- Subir `?v=` de todo arquivo editado em `index.html`/`diario-obra.html`/`status-obra.html`.
