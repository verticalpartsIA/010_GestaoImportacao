-- somar_dias_uteis: sem janela fixa (p_n*2+30) que podia devolver NULL; procura até achar o dia útil pedido
-- (teto de 10 anos para nunca ficar em laço) e falha com erro claro se o calendário não tiver dia útil suficiente.
create or replace function public.somar_dias_uteis(p_ini date, p_n integer)
returns date language plpgsql stable as $$
declare d date := p_ini; falta integer := p_n; limite date := p_ini + 3650;
begin
  if p_n is null or p_n < 0 then raise exception 'p_n precisa ser >= 0'; end if;
  while falta > 0 loop
    d := d + 1;
    if d > limite then raise exception 'Calendário sem dia útil suficiente a partir de %', p_ini; end if;
    if extract(isodow from d) < 6
       and not exists (select 1 from public.calendario_feriados f where f.data = d and f.ativo and f.conta_no_sla) then
      falta := falta - 1;
    end if;
  end loop;
  return d;
end $$;
