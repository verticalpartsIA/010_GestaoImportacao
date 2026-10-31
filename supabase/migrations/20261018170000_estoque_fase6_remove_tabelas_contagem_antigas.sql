-- Estoque — fase 6: contagem única em importacao_varejo_contagem(+_hist) (fase 3). As tabelas antigas estavam vazias e sem
-- views/funções/FKs dependentes (conferido em 18/10/2026). pcp_produtos.endereco FICA (espelho de endereço, etiquetas ainda leem).
drop table if exists public.pcp_estoque_contagens;
drop table if exists public.pcp_estoque_fisico;
