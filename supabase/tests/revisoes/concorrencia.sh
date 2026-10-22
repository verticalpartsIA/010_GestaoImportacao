#!/usr/bin/env bash
# Duas criações simultâneas sobre a mesma família: não pode haver letra repetida nem erro de índice único.
PORT="${1:-54399}"; P="psql -h /tmp -p $PORT -U postgres -d t -v ON_ERROR_STOP=1 -q -X -t -A"
$P <<'SQL'
insert into perfis (email, nome, nivel) values ('conc@x','Conc','Vendedor') on conflict do nothing;
insert into propostas (numero_documento, numero_cotacao, proposal_type, status, sent_at, vendedor_id, token)
select 'VPPR-0999', 999, 'elevador', 'enviada', now(), id, 'tok0999aaaaaaaaaa' from perfis where email = 'conc@x';
SQL
# sessão 1 segura o lock por 3 s; sessão 2 começa 1 s depois e precisa esperar
( $P -c "select set_config('request.jwt.claims','{\"email\":\"conc@x\"}',false)" -c "begin" \
     -c "select proposta_criar_revisao((select id from propostas where numero_documento='VPPR-0999'),'Concorrente numero um aqui',null,'conc-1')->>'revisao_codigo'" \
     -c "select pg_sleep(3)" -c "commit" > /tmp/conc1.out 2>&1 ) &
sleep 1
( $P -c "select set_config('request.jwt.claims','{\"email\":\"conc@x\"}',false)" \
     -c "select proposta_criar_revisao((select id from propostas where numero_documento='VPPR-0999'),'Concorrente numero dois aqui',null,'conc-2')->>'revisao_codigo'" > /tmp/conc2.out 2>&1 ) &
wait
C1=$(grep -E '^[A-Z]+$' /tmp/conc1.out | tail -1); C2=$(grep -E '^[A-Z]+$' /tmp/conc2.out | tail -1)
echo "sessão 1 -> $C1 | sessão 2 -> $C2"
[ "$C1" = "A" ] && [ "$C2" = "B" ] || { echo "FALHOU: concorrência (esperado A e B)"; cat /tmp/conc1.out /tmp/conc2.out; exit 1; }
N=$($P -c "select count(distinct revisao_codigo) from propostas where numero_cotacao=999 and revisao_indice>0")
[ "$N" = "2" ] || { echo "FALHOU: letras repetidas"; exit 1; }
echo "CONCORRÊNCIA OK"
