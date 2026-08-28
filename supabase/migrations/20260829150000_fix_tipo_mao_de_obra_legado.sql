/* ============================================================
   Bug em produção: "Salvar rascunho" no Formulário de Elevadores falhava
   com "violates check constraint formularios_elevador_tipo_mao_de_obra_check"
   pra qualquer formulário que ainda tivesse o valor ANTIGO de
   tipo_mao_de_obra ('local'/'sao_paulo'/'sem_mao_de_obra' — pergunta "onde
   é a mão de obra"). A migration de 28/08 (20260828130000) trocou o
   significado do campo pra "quem instala" (verticalparts/cliente) e criou
   a nova constraint como NOT VALID — o que só pula a validação em massa
   das linhas já existentes, mas o Postgres AINDA valida a constraint em
   qualquer UPDATE numa linha com valor antigo, mesmo que o update não
   toque em tipo_mao_de_obra. É por isso que salvar um formulário como
   FE-MTAI087O (valor antigo 'sao_paulo') quebrava.

   Não existe mapeamento automático correto — "onde é a mão de obra" e
   "quem instala" são perguntas diferentes, então zeramos o campo em vez
   de adivinhar um valor. UI mostra "Instalação Será" em branco até o
   vendedor escolher de novo — não bloqueia salvar rascunho (só é
   obrigatório pra enviar/submeter), e as 3 linhas afetadas já estão como
   status='enviado' há tempo, sem prejuízo em reabrir e confirmar.
   ============================================================ */

update public.formularios_elevador
  set tipo_mao_de_obra = null
  where tipo_mao_de_obra is not null and tipo_mao_de_obra not in ('verticalparts', 'cliente');

-- Revalida a constraint pra valer de vez (sem NOT VALID) — agora que não
-- sobra nenhuma linha com valor fora do domínio novo.
alter table public.formularios_elevador
  validate constraint formularios_elevador_tipo_mao_de_obra_check;
