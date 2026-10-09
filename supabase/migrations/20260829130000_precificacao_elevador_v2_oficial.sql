/* ============================================================
   V2 (custo econômico completo) vira o motor oficial — decisão registrada
   em conversa 29/08 (Gelson), sem necessidade de aval formal do
   Financeiro pra essa mudança específica: "aplicar 22% de markup precisa
   ser real", ou seja, sobre o custo completo (mercadoria + instalação +
   frete interno + armazenagem + demais custos operacionais), não só
   sobre a mercadoria como o V1 fazia.

   Muda só o DEFAULT de modo_formacao_preco pra registro novo — não altera
   nenhuma precificação já existente (elas mantêm o que já tinham
   gravado). VPPC-0950 (a única em aberto, status='calculado', ainda não
   aprovada) é ajustada manualmente aqui pra já nascer no modo correto.
   ============================================================ */

alter table public.precificacoes_elevador
  alter column modo_formacao_preco set default 'markup_sobre_custo';

update public.precificacoes_elevador
  set modo_formacao_preco = 'markup_sobre_custo'
  where numero_documento = 'VPPC-0950' and status = 'calculado';
