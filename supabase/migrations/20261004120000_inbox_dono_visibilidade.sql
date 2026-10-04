-- Inbox · fase 1 (04/10/2026): DONO do e-mail + permissões do módulo "inbox" (Administração › Alçadas).
-- Regras decididas com o usuário: o dono é o LOGIN de quem enviou; a resposta que chega herda o dono do e-mail que ela responde;
-- sem isso, o dono da cotação; sem nada disso, "sem dono" (fila de triagem). Quem vê o dos outros é configurado por pessoa
-- (alçadas inbox.ver_todos / ver_equipe / ver_departamento / ver_area_* / triagem / excluir_de_outros).
-- COMEÇA LIBERADO PARA TODOS (comportamento de hoje: quem tem acesso vê tudo); o administrador desmarca depois.
-- ADITIVO: colunas novas + 2 gatilhos + linhas em alcadas_capacidade. Não altera read-inbox nem o vínculo/matching.
-- Limite honesto: é organização na tela (como Formulários); isolamento real depende da issue #571.

alter table public.emails_projeto
  add column if not exists dono_email text,
  add column if not exists dono_origem text;     -- 'login' | 'resposta' | 'cotacao' | null (sem dono)
create index if not exists emails_projeto_dono_idx on public.emails_projeto (dono_email);

create or replace function public.emails_projeto_dono() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dono text; v_orig text;
begin
  begin
    if new.dono_email is not null then return new; end if;                 -- UPDATE: dono já definido não muda
    if new.direcao = 'saida' and nullif(trim(coalesce(new.enviado_por, '')), '') is not null then
      v_dono := lower(trim(new.enviado_por)); v_orig := 'login';
    elsif new.direcao = 'entrada' and new.in_reply_to is not null then
      select p.dono_email into v_dono from public.emails_projeto p
       where p.message_id = new.in_reply_to and p.direcao = 'saida' and p.dono_email is not null limit 1;
      if v_dono is not null then v_orig := 'resposta'; end if;
    end if;
    if v_dono is null and new.numero_cotacao is not null then
      select lower(f.created_by) into v_dono from public.formularios_elevador f where f.numero_cotacao = new.numero_cotacao limit 1;
      if v_dono is not null then v_orig := 'cotacao'; end if;
    end if;
    new.dono_email := v_dono; new.dono_origem := v_orig;
  exception when others then null;     -- o dono nunca pode impedir o e-mail de ser gravado
  end;
  return new;
end $$;
drop trigger if exists trg_emails_projeto_dono on public.emails_projeto;
create trigger trg_emails_projeto_dono before insert on public.emails_projeto
  for each row execute function public.emails_projeto_dono();
-- Vínculo manual depois (UPDATE de numero_cotacao) também pode definir o dono, se ainda não houver.
drop trigger if exists trg_emails_projeto_dono_upd on public.emails_projeto;
create trigger trg_emails_projeto_dono_upd before update of numero_cotacao on public.emails_projeto
  for each row when (new.dono_email is null and new.numero_cotacao is not null) execute function public.emails_projeto_dono();

-- Carga inicial: e-mails antigos ganham o dono da cotação (melhor estimativa; enviado_por nunca foi gravado antes).
update public.emails_projeto e set dono_email = lower(f.created_by), dono_origem = 'cotacao'
  from public.formularios_elevador f
 where e.dono_email is null and e.numero_cotacao is not null and f.numero_cotacao = e.numero_cotacao and f.created_by is not null;
update public.emails_projeto e set dono_email = p.dono_email, dono_origem = 'resposta'
  from public.emails_projeto p
 where e.dono_email is null and e.direcao = 'entrada' and e.in_reply_to is not null
   and p.message_id = e.in_reply_to and p.direcao = 'saida' and p.dono_email is not null;

-- Permissões do módulo "inbox" para todos os perfis ativos (comportamento de hoje preservado).
insert into public.alcadas_capacidade (perfil_id, modulo, capacidade, concedido_por)
select p.id, 'inbox', c, 'sistema (04/10/2026 — Inbox começa liberado: todos veem tudo; o administrador desmarca)'
  from public.perfis p
 cross join unnest(array['ver', 'criar', 'editar', 'excluir', 'ver_todos', 'excluir_de_outros', 'triagem']) c
 where p.ativo
on conflict (perfil_id, modulo, capacidade) do nothing;
