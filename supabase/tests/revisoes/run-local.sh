#!/usr/bin/env bash
# Sobe um Postgres 16 descartável, aplica stub + migration (DUAS vezes: idempotência) e roda os testes.
# Uso: bash supabase/tests/revisoes/run-local.sh   (como root; usa o usuário "postgres" do sistema)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$DIR/../../.." && pwd)"
BIN=/usr/lib/postgresql/16/bin; DATA=/var/lib/postgresql/revtest; PORT=54399
cp "$DIR/stub-local.sql" "$DIR/stub-avais.sql" "$DIR/etapa1.sql" "$DIR/etapa2-avais.sql" "$DIR/concorrencia.sh" /tmp/ 2>/dev/null || true
cp "$REPO/supabase/migrations/20261022190000_avais_por_revisao.sql" /tmp/rev-avais.sql
cp "$REPO/supabase/migrations/20261022100000_revisoes_comerciais_etapa1.sql" /tmp/rev-migration.sql
chmod 644 /tmp/stub-local.sql /tmp/stub-avais.sql /tmp/etapa1.sql /tmp/etapa2-avais.sql /tmp/rev-migration.sql /tmp/rev-avais.sql
su postgres -c "rm -rf $DATA && $BIN/initdb -D $DATA -A trust >/dev/null && $BIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp -c fsync=off' -l $DATA/log -w start >/dev/null"
trap 'su postgres -c "$BIN/pg_ctl -D '$DATA' -m immediate stop >/dev/null" || true' EXIT
P="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -X"
su postgres -c "$P -c 'create database t' postgres"
for f in stub-local rev-migration rev-migration etapa1; do echo ">> $f"; su postgres -c "$P -d t -f /tmp/$f.sql"; done
for f in stub-avais rev-avais rev-avais etapa2-avais; do echo ">> $f"; su postgres -c "$P -d t -f /tmp/$f.sql"; done
echo ">> concorrencia"; su postgres -c "bash /tmp/concorrencia.sh $PORT"
echo "TUDO OK"
