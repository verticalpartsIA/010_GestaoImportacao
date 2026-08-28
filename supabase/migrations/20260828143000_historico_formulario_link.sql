-- "Abrir no Formulário" (Controle de Cotações) ressuscita uma cotação da
-- planilha legada (cotacoes_elevador_historico) como um Formulário de
-- verdade (formularios_elevador), com Nº de cotação novo. Os dois links
-- abaixo marcam essa conversão nos dois sentidos: `formulario_id` evita
-- reconverter/duplicar num segundo clique na mesma linha da planilha;
-- `origem_historico_id` deixa o Formulário novo rastreável até a cotação
-- histórica que lhe deu origem.
alter table public.cotacoes_elevador_historico add column if not exists formulario_id text references public.formularios_elevador(id);
alter table public.formularios_elevador add column if not exists origem_historico_id uuid references public.cotacoes_elevador_historico(id);
