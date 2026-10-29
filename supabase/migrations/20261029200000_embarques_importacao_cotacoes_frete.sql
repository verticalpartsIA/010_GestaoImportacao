-- Cotações de frete marítimo do embarque (até 4): agente do cadastro, taxas, prazos, anexos, envio por e-mail, vencedor.
alter table public.embarques_importacao add column if not exists cotacoes_frete jsonb not null default '[]'::jsonb;
comment on column public.embarques_importacao.cotacoes_frete is 'Até 4 cotações de frete marítimo (agente do cadastro de fornecedores, taxas, transit/free time, anexos, envio por e-mail, vencedor).';
