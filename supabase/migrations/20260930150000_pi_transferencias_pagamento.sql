-- Transferência de pagamento entre P.I.s: pagamento feito numa P.I. que quitava outra.
alter table public.pi_importacao
  add column if not exists transferencias_pagamento jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
