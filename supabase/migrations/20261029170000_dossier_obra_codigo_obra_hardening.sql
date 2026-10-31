-- Endurecimento do codigo_obra (migration 20261029150000), a partir de 2
-- achados REAIS do Codex Review no PR #1149 (verificados antes de corrigir):
--
-- 1) dossier_obra_calcular_codigo era SECURITY DEFINER sem REVOKE — o app
--    inteiro fala com o banco pela chave publicável (anon), e por padrão o
--    Postgres concede EXECUTE a PUBLIC em função nova. Qualquer um podia
--    chamar a função direto via RPC (sem nunca gravar um dossiê), gastando
--    números de obra_legada_numero_seq à toa e rodando uma consulta a
--    dossier_obra com o privilégio do definer. Corrigido: revoga de
--    public/anon/authenticated — o trigger continua funcionando (quem chama
--    a função por dentro do trigger SECURITY DEFINER é o dono da função,
--    que nunca perde o próprio EXECUTE).
--
-- 2) Uma obra LEGADA (sem cotação, ganhou VPNI-OB####) que depois é ligada a
--    uma cotação de verdade (ex.: DossierStore.criarDeProposta adotando o
--    dossiê de um Lead já existente) nunca trocava para o código nativo
--    VPNI-<cotação> — a trava "uma vez gravado, não muda" também travava
--    esse caso, que é diferente de uma correção administrativa: aqui o
--    negócio mudou de estado de verdade (a obra que era avulsa virou uma
--    cotação real), e o cálculo ao vivo da tela (codigoPaiGrupo) sempre
--    preferiu numero_cotacao quando existe — o valor persistido ficaria
--    divergente do que a tela mostraria se calculasse na hora. Corrigido:
--    ganhar (ou trocar) numero_cotacao recalcula para o código nativo antes
--    de aplicar a trava geral.

revoke all on function public.dossier_obra_calcular_codigo(text, text, text, text, text, text, integer)
  from public, anon, authenticated;

create or replace function public.dossier_obra_fixa_codigo() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.codigo_obra is null then
    new.codigo_obra := public.dossier_obra_calcular_codigo(
      new.id, new.client_name, new.city, new.state,
      new.endereco_logradouro, new.endereco_numero, new.numero_cotacao);
  elsif new.numero_cotacao is not null
        and (old.numero_cotacao is null or old.numero_cotacao is distinct from new.numero_cotacao)
        and new.codigo_obra is distinct from ('VPNI-' || lpad(new.numero_cotacao::text, 4, '0')) then
    -- a obra ganhou (ou trocou) o Nº de cotação depois de já ter um código
    -- legado — vira o código nativo, como se a cotação já existisse desde
    -- o início (mesma regra de codigoPaiGrupo no front).
    new.codigo_obra := 'VPNI-' || lpad(new.numero_cotacao::text, 4, '0');
  elsif old.codigo_obra is not null and new.codigo_obra is distinct from old.codigo_obra then
    -- trava: fora dos dois casos acima, uma vez gravado não muda.
    new.codigo_obra := old.codigo_obra;
  end if;
  return new;
end;
$$;
