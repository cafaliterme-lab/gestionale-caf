#!/usr/bin/env bash
# Esegue i test dello schema su un database Postgres vuoto.
# Uso: tests/db/run.sh "postgresql://postgres@localhost:5432/postgres"
set -euo pipefail
URL="${1:?indica la connessione a un Postgres di prova}"
DIR="$(cd "$(dirname "$0")" && pwd)"
DB="protocollo_test_$$"
psql "$URL" -qc "create database $DB" >/dev/null
trap 'psql "$URL" -qc "drop database if exists $DB" >/dev/null' EXIT
TEST_URL="${URL%/*}/$DB"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/supabase-stub.sql" >/dev/null
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/../../supabase/migrations/001_schema.sql" >/dev/null
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/test.sql"
