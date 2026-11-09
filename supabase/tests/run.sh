#!/usr/bin/env bash
# Builds a throwaway database from the real migrations and runs the SQL tests against it.
# Usage: PGHOST=... PGPORT=... PGUSER=... PGPASSWORD=... supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."          # -> supabase/
DB=ts_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
export PGDATABASE=$DB
P="psql -v ON_ERROR_STOP=1 -q"

$P -f tests/prelude.sql
$P -f schema.sql
for f in $(ls migrations/*.sql | sort); do
  echo "apply $f"
  # pg_net is a Supabase-only extension: replaced by the stub in prelude.sql
  sed -e '/create extension if not exists pg_net/d' "$f" | $P -f -
done

echo "== constraint and security tests"
$P -o /dev/null -f tests/bookings.test.sql
echo 'SQL tests passed'

echo "== concurrency: 8 sessions book the same dates at once, exactly one may win"
$P -f tests/race_setup.sql
for i in 1 2 3 4 5 6 7 8; do
  ( $P -t -A -c "select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'guest$i@test.dev'), false);
                 set role authenticated;
                 select public.create_booking((select id from public.listings where title = 'Race listing'), current_date + 40, current_date + 43, 1);" \
      >/tmp/race_$i.out 2>&1 && echo ok || echo fail ) > /tmp/race_$i.res &
done
wait
WON=$(cat /tmp/race_*.res | grep -c '^ok$' || true)
echo "winners: $WON"
[ "$WON" = "1" ] || { echo "FAIL: expected exactly 1 successful booking, got $WON"; exit 1; }
echo "all database tests passed"
