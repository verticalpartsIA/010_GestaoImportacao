-- Pendências/acabamento passa a valer 4%, tirado de Braquetes (8), Guias (9) e Máquina (9). Soma segue 100.
update acompanhamento_obra_itens set peso = 8 where tipo_equipamento = 'elevador' and texto = 'Braquetes';
update acompanhamento_obra_itens set peso = 9 where tipo_equipamento = 'elevador' and texto = 'Guias';
update acompanhamento_obra_itens set peso = 9 where tipo_equipamento = 'elevador' and texto = 'Máquina / limitador';
update acompanhamento_obra_itens set peso = 4 where tipo_equipamento = 'elevador' and texto = 'Pendências / acabamento';
