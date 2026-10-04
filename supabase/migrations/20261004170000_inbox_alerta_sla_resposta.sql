-- Inbox · alerta de e-mail SEM RESPOSTA em 2 horas úteis (04/10/2026, pedido do usuário: "SLA de respostas sempre 2 horas").
-- O que conta: e-mail de ENTRADA dos últimos 7 dias que PEDE resposta (classificação do robô: exige_resposta = sim), que não é
-- automático/spam, não foi excluído e ainda não tem resposta nossa. "Hora útil" = seg–sex, 08h–18h (Brasília) — escolha minha, o
-- usuário só disse "2 horas"; para mudar, ajuste inbox_horas_comerciais.
-- Quem é avisado: nível 1 (2 h) o RESPONSÁVEL (atribuído, senão o dono); sem responsável, os líderes do departamento indicado pela
-- classificação. Nível 2 (4 h) o CHEFE do responsável (colaboradores_vpsistema.manager_id). Um aviso por pessoa/nível/e-mail
-- (id determinístico, sem repetir). Resolve sozinho quando o e-mail é respondido, excluído ou marcado como spam.
-- "Respondido" = existe e-mail NOSSO de saída depois dele com In-Reply-To = Message-ID dele, ou enviado ao mesmo remetente depois.
-- Só lê emails_projeto/colaboradores e grava em alertas — não toca send-email/read-inbox/vínculo (área blindada).

create or replace function public.inbox_horas_comerciais(p_ini timestamptz, p_fim timestamptz) returns numeric
language sql stable set search_path = public as $$
  select coalesce(sum(extract(epoch from greatest(least(p_fim, t.d_fim) - greatest(p_ini, t.d_ini), interval '0')) / 3600.0), 0)
  from (
    select ((g.dia::date + time '08:00') at time zone 'America/Sao_Paulo') as d_ini,
           ((g.dia::date + time '18:00') at time zone 'America/Sao_Paulo') as d_fim
      from generate_series((p_ini at time zone 'America/Sao_Paulo')::date, (p_fim at time zone 'America/Sao_Paulo')::date, interval '1 day') as g(dia)
     where extract(isodow from g.dia) < 6
  ) t
$$;

create or replace function public.inbox_alertar_sem_resposta(simular boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record; v_n int := 0; v_novos int := 0; v_lista jsonb := '[]'::jsonb;
  v_depto text; v_dest text; v_nivel int; v_id text; v_nome text;
begin
  -- 1) resolve avisos de e-mails que já foram respondidos / excluídos / viraram spam
  if not simular then
    update public.alertas a set resolved = true
     where starts_with(a.id, 'inbox-sla-') and not a.resolved
       and not exists (
         select 1 from public.emails_projeto e
          where e.id::text = substring(a.id from 11 for 36) and e.excluido_em is null and e.spam_em is null
            and not exists (
              select 1 from public.emails_projeto s
               where s.direcao = 'saida' and s.excluido_em is null
                 and coalesce(s.data_mensagem, s.criado_em) > coalesce(e.data_mensagem, e.criado_em)
                 and ((e.message_id is not null and s.in_reply_to = e.message_id)
                      or exists (select 1 from jsonb_array_elements_text(s.para) p where lower(p) = lower(e.de_email)))));
  end if;

  -- 2) e-mails que pedem resposta há mais de 2 horas úteis
  for r in
    select e.id, e.assunto, e.de_email, e.de_nome, e.ia_departamento,
           lower(coalesce(e.atribuido_a, e.dono_email)) as resp,
           public.inbox_horas_comerciais(coalesce(e.data_mensagem, e.criado_em), now()) as horas
      from public.emails_projeto e
     where e.direcao = 'entrada' and e.excluido_em is null and e.spam_em is null
       and coalesce(e.data_mensagem, e.criado_em) > now() - interval '7 days'
       and coalesce(e.ia_assunto, '') <> 'automatico_spam'
       and coalesce((e.ia_decisao -> 'exige_resposta' ->> 'resposta')::boolean, false)
       and public.inbox_horas_comerciais(coalesce(e.data_mensagem, e.criado_em), now()) >= 2
       and not exists (
         select 1 from public.emails_projeto s
          where s.direcao = 'saida' and s.excluido_em is null
            and coalesce(s.data_mensagem, s.criado_em) > coalesce(e.data_mensagem, e.criado_em)
            and ((e.message_id is not null and s.in_reply_to = e.message_id)
                 or exists (select 1 from jsonb_array_elements_text(s.para) p where lower(p) = lower(e.de_email))))
  loop
    v_n := v_n + 1;
    v_nivel := case when r.horas >= 4 then 2 else 1 end;
    v_depto := case r.ia_departamento
      when 'importacao' then 'Jurídico/Importação/Suprimentos' when 'juridico' then 'Jurídico/Importação/Suprimentos'
      when 'comercial' then 'Comercial' when 'pos_venda' then 'Comercial'
      when 'financeiro' then 'Adm/Financeiro' when 'engenharia' then 'Engenharia' else 'Comercial' end;
    v_lista := v_lista || jsonb_build_object('email', r.id, 'assunto', left(r.assunto, 60), 'horas', round(r.horas, 1), 'responsavel', r.resp, 'nivel', v_nivel);

    -- nível 1: responsável, ou (sem responsável) líderes do departamento; nível 2: acrescenta o chefe do responsável
    for v_dest in
      select distinct lower(x) from (
        select r.resp as x where r.resp is not null
        union all
        select c.email from public.colaboradores_vpsistema c
         where r.resp is null and c.is_active and c.is_department_lead and c.departamento = v_depto
        union all
        select m.email from public.colaboradores_vpsistema c
          join public.colaboradores_vpsistema m on m.id = c.manager_id
         where v_nivel = 2 and r.resp is not null and lower(c.email) = r.resp and m.is_active
      ) q where x is not null
    loop
      v_id := 'inbox-sla-' || r.id::text || '-' || v_nivel || '-' || left(md5(v_dest), 6);
      if simular then continue; end if;
      v_nome := coalesce(nullif(r.de_nome, ''), r.de_email);
      insert into public.alertas (id, level, title, sub, module, resolved, rota, destinatario_email)
      values (v_id, 'warning',
              case when v_nivel = 2 then 'Sem resposta há mais de 4 horas úteis' else 'Sem resposta há mais de 2 horas úteis' end,
              left(coalesce(r.assunto, '(sem assunto)') || ' · de ' || v_nome || case when r.resp is null then ' · sem responsável' else ' · responsável ' || r.resp end, 480),
              'Inbox', false, '/geral/inbox', v_dest)
      on conflict (id) do nothing;
      if found then v_novos := v_novos + 1; end if;
    end loop;
  end loop;
  return jsonb_build_object('sem_resposta', v_n, 'avisos_novos', v_novos, 'itens', v_lista);
end $$;

-- Só o banco (cron) executa; o navegador não.
revoke all on function public.inbox_alertar_sem_resposta(boolean) from public, anon, authenticated;

-- a cada 15 min, seg–sex (a própria função só considera horário comercial); minutos escalonados para não bater com os outros crons
do $$ begin perform cron.unschedule(jobid) from cron.job where jobname = 'inbox-alerta-sem-resposta'; end $$;
select cron.schedule('inbox-alerta-sem-resposta', '7,22,37,52 11-21 * * 1-5', $$ select public.inbox_alertar_sem_resposta(false) $$);
