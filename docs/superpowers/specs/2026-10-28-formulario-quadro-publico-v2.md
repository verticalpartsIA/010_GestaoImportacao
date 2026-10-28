# Formulário público do Quadro de Comando — v2 (28/10/2026)

Pedido do Gelson: o link público (`/formulario-quadro-comando-publico.html`) deixa de pedir dado que o modelo já define, ganha perguntas guiadas (COP, LOP, porta oposta, portas, máquina de tração) e o hub ganha o código de cada item escolhido.

## Decisões (confirmadas no chat, 28/10)
1. **Modelos no link público, sem código VPEL na tela:** 7,5 kW 220 V · 7,5 kW 380 V · 15 kW 220 V · 15 kW 380 V · 30 kW 380 V. O código sai só por mapeamento interno (`pcp_quadro_variante`): 702a, 735a, 710a, 704a, 709b. 37 kW (708b) e 30 kW 220 V não entram.
2. **Somem do link:** potência do motor, tensão do motor, corrente nominal, atendimento e aplicação (o modelo já define; o campo "HP" era gravado como kW). **Fica** a tensão da rede do prédio (avisa se for diferente da do modelo).
3. **Perguntas novas:**
   - COP: sim/não, display e cor.
   - LOP: material (espelho em vidro ou aço escovado), 1 ou 2 furos/botões nos intermediários, com/sem display, logo da empresa (upload).
   - Porta oposta: sim/não e **quais paradas** ela atende. Total de LOP = frente + oposta (10+10 = 20; 10+5 = 15).
   - Portas (cabina/pavimento) e Máquina de Tração: o cliente marca, aparece a lista do Omie (portas ~33 modelos, `VPMAC` 25 modelos); **sem escolher um modelo não avança** ("escolha um modelo ou remova a seleção").
4. **Hub (aba Escopo):** cada item pedido ganha lista suspensa com os códigos do Omie (`importacao_varejo_produtos`), quantidade e **sugestão automática** do código; o vendedor confirma ou troca. O BOM passa a incluir esses itens com o código escolhido; item pedido sem código vira pendência no aviso.
5. **Códigos que ainda não chegaram ao PCP (702a, 704a, 735a):** sincronizar o cadastro do Omie e só então trocar `pcp_quadro_variante`; até lá vale o que já existe (702b/704b) e a lista fixa.

## Contrato público → Edge Function `capturar-lead-quadro-comando`
- `variante_quadro` ∈ {7.5_220, 7.5_380, 15_220, 15_380, 30_380}; `tensao_rede`.
- `acessorios_chaves[]` (inclui `portas` e `maquina_tracao`), `cop_display`, `ind_cor`, `lop_material`, `lop_botoes`, `lop_display`, `logo_cliente` + `logo_upload {nome,tipo,dados(base64)}` (≤ 2 MB; vai para o bucket `engenharia`, o base64 **não** fica gravado).
- `porta_oposta` ('sim'|'nao') + `porta_oposta_paradas[]`; `porta_cabina_codigo`/`porta_pavimento_codigo`; `maquina_codigo`.
- Catálogo para a página: `POST {acao:'catalogo'}` → `{maquinas, portas_cabina, portas_pavimento}` (só código e descrição; mesma limitação de taxa).

## Fora de escopo
Sem migration. LOP em face traseira com 1 só parada continua sem botoeira (regra atual do motor). Não mexe em Precificação/Proposta.
