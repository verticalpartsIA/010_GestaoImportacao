-- Padrões como na planilha do Financeiro (01/10/2026): IRPJ adicional e comissão de consultoria
-- deixam de nascer preenchidos nas novas precificações (operador digita se precisar).
-- Precificações existentes guardam o próprio snapshot e não mudam.
update public.parametros_fiscais_elevador set irpj_adicional_pct = 0, comissao_consultoria_pct = 0 where id = 'default';
