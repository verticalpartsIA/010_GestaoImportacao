-- Bucket privado pra anexar o documento/imagem de cada certificação
-- (NR-10, NR-35, ASO, PCMSO, PGR) de um parceiro instalador. Mesmo padrão
-- de policies dos outros buckets do projeto (formulario-elevador-anexos,
-- cotacao-fornecedor-anexos): sem restrição por path, acesso controlado
-- só pelo app (uso interno, sem isolamento por usuário nessas tabelas).
insert into storage.buckets (id, name, public)
values ('parceiros-instaladores-anexos', 'parceiros-instaladores-anexos', false)
on conflict (id) do nothing;

create policy "parceiros_anexos_insert" on storage.objects
  for insert with check (bucket_id = 'parceiros-instaladores-anexos');

create policy "parceiros_anexos_select" on storage.objects
  for select using (bucket_id = 'parceiros-instaladores-anexos');

create policy "parceiros_anexos_update" on storage.objects
  for update using (bucket_id = 'parceiros-instaladores-anexos')
  with check (bucket_id = 'parceiros-instaladores-anexos');

create policy "parceiros_anexos_delete" on storage.objects
  for delete using (bucket_id = 'parceiros-instaladores-anexos');
