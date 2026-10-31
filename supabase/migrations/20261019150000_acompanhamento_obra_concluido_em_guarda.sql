-- Regra no banco para a data real de conclusão: não pode ser depois do dia do envio (flegado_em, fuso de São Paulo)
-- nem mais de 60 dias antes dele. O navegador também valida, mas a gravação é direta na tabela.
create or replace function public.acompanhamento_obra_status_valida_concluido_em()
returns trigger language plpgsql as $$
declare dia_envio date;
begin
  if NEW.concluido_em is null then return NEW; end if;
  if TG_OP = 'UPDATE' and NEW.concluido_em is not distinct from OLD.concluido_em then return NEW; end if;
  if NEW.flegado is not true or NEW.flegado_em is null then
    raise exception 'Data de conclusão só vale para etapa marcada como feita.' using errcode = '23514';
  end if;
  dia_envio := (NEW.flegado_em at time zone 'America/Sao_Paulo')::date;
  if NEW.concluido_em > dia_envio then
    raise exception 'A data de conclusão (%) não pode ser depois do dia do envio (%).', NEW.concluido_em, dia_envio using errcode = '23514';
  end if;
  if NEW.concluido_em < dia_envio - 60 then
    raise exception 'A data de conclusão (%) não pode ser de mais de 60 dias antes do envio (%).', NEW.concluido_em, dia_envio using errcode = '23514';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_acompanhamento_obra_status_concluido_em on public.acompanhamento_obra_status;
create trigger trg_acompanhamento_obra_status_concluido_em
  before insert or update on public.acompanhamento_obra_status
  for each row execute function public.acompanhamento_obra_status_valida_concluido_em();
