#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -z "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "SOURCE_DATABASE_URL is required." >&2
  exit 1
fi

RUN_ID="${OPS11_RUN_ID:-ops11-$(date -u +%Y%m%dT%H%M%SZ)}"
BACKUP_ROOT="${OPS11_BACKUP_ROOT:-/backup}"
OUT_DIR="${BACKUP_ROOT}/${RUN_ID}"
DUMP_PATH="${OUT_DIR}/production-pg18.dump"
ARCHIVE_LIST_PATH="${OUT_DIR}/archive-list.txt"
REPORT_JSON_PATH="${OUT_DIR}/production-pg18-backup-restore-report.json"
REPORT_MD_PATH="${OUT_DIR}/production-pg18-backup-restore-report.md"
LOCAL_PORT="${OPS11_LOCAL_PG_PORT:-55432}"
LOCAL_DB="ops11_restore"
PGDATA="/tmp/ops11-pgdata"

mkdir -p "${OUT_DIR}" /tmp/ops11-summary
chmod 0700 "${OUT_DIR}" /tmp/ops11-summary

json_escape() {
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a;N;$!ba;s/\n/\\n/g'
}

json_value() {
  printf '%s' "$1" | json_escape
}

run_source_sql() {
  psql "${SOURCE_DATABASE_URL}" -X -v ON_ERROR_STOP=1 -At -c "$1"
}

run_restore_sql() {
  psql -h 127.0.0.1 -p "${LOCAL_PORT}" -U postgres -d "${LOCAL_DB}" \
    -X -v ON_ERROR_STOP=1 -At -c "$1"
}

write_table_counts() {
  local target="$1"
  local file="$2"
  local tables
  if [[ "${target}" == "source" ]]; then
    tables="$(run_source_sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'onetime' AND table_type = 'BASE TABLE' ORDER BY table_name")"
  else
    tables="$(run_restore_sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'onetime' AND table_type = 'BASE TABLE' ORDER BY table_name")"
  fi

  : > "${file}"
  while IFS= read -r table_name; do
    [[ -n "${table_name}" ]] || continue
    if [[ ! "${table_name}" =~ ^[A-Za-z0-9_]+$ ]]; then
      echo "Unsafe table identifier discovered: ${table_name}" >&2
      exit 1
    fi
    local count
    if [[ "${target}" == "source" ]]; then
      count="$(run_source_sql "SELECT count(*)::text FROM onetime.\"${table_name}\"")"
    else
      count="$(run_restore_sql "SELECT count(*)::text FROM onetime.\"${table_name}\"")"
    fi
    printf '%s\t%s\n' "${table_name}" "${count}" >> "${file}"
  done <<< "${tables}"
}

schema_count() {
  local target="$1"
  local sql="$2"
  if [[ "${target}" == "source" ]]; then
    run_source_sql "${sql}"
  else
    run_restore_sql "${sql}"
  fi
}

write_ledger() {
  local target="$1"
  local file="$2"
  local sql="SELECT id || E'\t' || checksum FROM onetime.schema_migrations ORDER BY id"
  if [[ "${target}" == "source" ]]; then
    run_source_sql "${sql}" > "${file}"
  else
    run_restore_sql "${sql}" > "${file}"
  fi
}

schema_migrations_exists() {
  local target="$1"
  local sql="SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'onetime' AND table_name = 'schema_migrations'"
  if [[ "${target}" == "source" ]]; then
    run_source_sql "${sql}"
  else
    run_restore_sql "${sql}"
  fi
}

schema_migration_count() {
  local target="$1"
  if [[ "$(schema_migrations_exists "${target}")" == "0" ]]; then
    printf '0'
    return
  fi
  schema_count "${target}" "SELECT count(*)::text FROM onetime.schema_migrations"
}

schema_latest_migration() {
  local target="$1"
  if [[ "$(schema_migrations_exists "${target}")" == "0" ]]; then
    printf ''
    return
  fi
  schema_count "${target}" "SELECT COALESCE(max(id), '') FROM onetime.schema_migrations"
}

write_optional_ledger() {
  local target="$1"
  local file="$2"
  if [[ "$(schema_migrations_exists "${target}")" == "0" ]]; then
    : > "${file}"
    return
  fi
  write_ledger "${target}" "${file}"
}

sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}

start_local_pg18() {
  rm -rf "${PGDATA}"
  mkdir -p "${PGDATA}"
  chown -R postgres:postgres "${PGDATA}"
  su postgres -c "initdb -D '${PGDATA}' --auth-local=trust --auth-host=trust" >/tmp/ops11-initdb.log
  su postgres -c "pg_ctl -D '${PGDATA}' -o '-h 127.0.0.1 -p ${LOCAL_PORT}' -w start" \
    >/tmp/ops11-pgctl-start.log
}

stop_local_pg18() {
  if [[ -d "${PGDATA}" ]]; then
    su postgres -c "pg_ctl -D '${PGDATA}' -m fast -w stop" >/tmp/ops11-pgctl-stop.log 2>&1 || true
  fi
}

trap stop_local_pg18 EXIT

SOURCE_VERSION="$(run_source_sql "SELECT version()")"
SOURCE_VERSION_NUM="$(run_source_sql "SELECT current_setting('server_version_num')")"
SOURCE_EXTENSIONS="$(run_source_sql "SELECT extname || '=' || extversion FROM pg_extension ORDER BY extname")"
SOURCE_COLLATION_COUNT="$(run_source_sql "SELECT count(*)::text FROM pg_collation")"
PG_DUMP_VERSION="$(pg_dump --version)"
PG_RESTORE_VERSION="$(pg_restore --version)"

pg_dump "${SOURCE_DATABASE_URL}" -Fc --no-owner --no-acl -f "${DUMP_PATH}"
pg_restore -l "${DUMP_PATH}" > "${ARCHIVE_LIST_PATH}"

start_local_pg18
createdb -h 127.0.0.1 -p "${LOCAL_PORT}" -U postgres "${LOCAL_DB}"
pg_restore -h 127.0.0.1 -p "${LOCAL_PORT}" -U postgres -d "${LOCAL_DB}" \
  --no-owner --no-acl --exit-on-error "${DUMP_PATH}"

SOURCE_TABLES="$(schema_count source "SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'onetime' AND table_type = 'BASE TABLE'")"
RESTORE_TABLES="$(schema_count restore "SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'onetime' AND table_type = 'BASE TABLE'")"
SOURCE_INDEXES="$(schema_count source "SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'onetime'")"
RESTORE_INDEXES="$(schema_count restore "SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'onetime'")"
SOURCE_CONSTRAINTS="$(schema_count source "SELECT count(*)::text FROM information_schema.table_constraints WHERE table_schema = 'onetime'")"
RESTORE_CONSTRAINTS="$(schema_count restore "SELECT count(*)::text FROM information_schema.table_constraints WHERE table_schema = 'onetime'")"
SOURCE_SEQUENCES="$(schema_count source "SELECT count(*)::text FROM information_schema.sequences WHERE sequence_schema = 'onetime'")"
RESTORE_SEQUENCES="$(schema_count restore "SELECT count(*)::text FROM information_schema.sequences WHERE sequence_schema = 'onetime'")"
SOURCE_MIGRATION_TABLE_PRESENT="$(schema_migrations_exists source)"
RESTORE_MIGRATION_TABLE_PRESENT="$(schema_migrations_exists restore)"
SOURCE_MIGRATIONS="$(schema_migration_count source)"
RESTORE_MIGRATIONS="$(schema_migration_count restore)"
SOURCE_LATEST_MIGRATION="$(schema_latest_migration source)"
RESTORE_LATEST_MIGRATION="$(schema_latest_migration restore)"

write_table_counts source /tmp/ops11-summary/source-row-counts.tsv
write_table_counts restore /tmp/ops11-summary/restore-row-counts.tsv
write_optional_ledger source /tmp/ops11-summary/source-ledger.tsv
write_optional_ledger restore /tmp/ops11-summary/restore-ledger.tsv

SOURCE_ROW_HASH="$(sha256_file /tmp/ops11-summary/source-row-counts.tsv)"
RESTORE_ROW_HASH="$(sha256_file /tmp/ops11-summary/restore-row-counts.tsv)"
SOURCE_LEDGER_HASH="$(sha256_file /tmp/ops11-summary/source-ledger.tsv)"
RESTORE_LEDGER_HASH="$(sha256_file /tmp/ops11-summary/restore-ledger.tsv)"
DUMP_SHA256="$(sha256_file "${DUMP_PATH}")"
DUMP_SIZE_BYTES="$(wc -c < "${DUMP_PATH}" | tr -d ' ')"
ARCHIVE_LIST_ENTRIES="$(grep -cve '^[[:space:]]*$' "${ARCHIVE_LIST_PATH}")"

STATUS="passed"
HARD_FAILURES=()
[[ "${SOURCE_TABLES}" == "${RESTORE_TABLES}" ]] || HARD_FAILURES+=("table_count_mismatch")
[[ "${SOURCE_INDEXES}" == "${RESTORE_INDEXES}" ]] || HARD_FAILURES+=("index_count_mismatch")
[[ "${SOURCE_CONSTRAINTS}" == "${RESTORE_CONSTRAINTS}" ]] || HARD_FAILURES+=("constraint_count_mismatch")
[[ "${SOURCE_SEQUENCES}" == "${RESTORE_SEQUENCES}" ]] || HARD_FAILURES+=("sequence_count_mismatch")
[[ "${SOURCE_MIGRATION_TABLE_PRESENT}" == "${RESTORE_MIGRATION_TABLE_PRESENT}" ]] || HARD_FAILURES+=("migration_table_presence_mismatch")
[[ "${SOURCE_MIGRATIONS}" == "${RESTORE_MIGRATIONS}" ]] || HARD_FAILURES+=("migration_row_count_mismatch")
[[ "${SOURCE_LATEST_MIGRATION}" == "${RESTORE_LATEST_MIGRATION}" ]] || HARD_FAILURES+=("latest_migration_mismatch")
[[ "${SOURCE_ROW_HASH}" == "${RESTORE_ROW_HASH}" ]] || HARD_FAILURES+=("row_count_hash_mismatch")
[[ "${SOURCE_LEDGER_HASH}" == "${RESTORE_LEDGER_HASH}" ]] || HARD_FAILURES+=("migration_ledger_hash_mismatch")

if (( ${#HARD_FAILURES[@]} > 0 )); then
  STATUS="failed"
fi

extensions_json="["
first_extension=1
while IFS= read -r extension; do
  [[ -n "${extension}" ]] || continue
  if (( first_extension == 0 )); then
    extensions_json+=", "
  fi
  extensions_json+="\"$(json_value "${extension}")\""
  first_extension=0
done <<< "${SOURCE_EXTENSIONS}"
extensions_json+="]"

failures_json="["
for failure in "${HARD_FAILURES[@]}"; do
  if [[ "${failures_json}" != "[" ]]; then
    failures_json+=", "
  fi
  failures_json+="\"${failure}\""
done
failures_json+="]"

cat > "${REPORT_JSON_PATH}" <<JSON
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "run_id": "$(json_value "${RUN_ID}")",
  "database_service": "Postgres-j9Pi",
  "environment": {
    "postgres_server_version": "$(json_value "${SOURCE_VERSION}")",
    "postgres_server_version_num": "$(json_value "${SOURCE_VERSION_NUM}")",
    "pg_dump_version": "$(json_value "${PG_DUMP_VERSION}")",
    "pg_restore_version": "$(json_value "${PG_RESTORE_VERSION}")",
    "extensions": ${extensions_json},
    "collation_count": ${SOURCE_COLLATION_COUNT}
  },
  "dump": {
    "path": "$(json_value "${DUMP_PATH}")",
    "format": "custom",
    "no_owner": true,
    "no_acl": true,
    "size_bytes": ${DUMP_SIZE_BYTES},
    "sha256": "${DUMP_SHA256}",
    "archive_list_entries": ${ARCHIVE_LIST_ENTRIES}
  },
  "restore": {
    "restored_database": "${LOCAL_DB}",
    "schema_summary_source": {
      "table_count": ${SOURCE_TABLES},
      "index_count": ${SOURCE_INDEXES},
      "constraint_count": ${SOURCE_CONSTRAINTS},
      "sequence_count": ${SOURCE_SEQUENCES},
      "migration_table_present": ${SOURCE_MIGRATION_TABLE_PRESENT},
      "migration_rows": ${SOURCE_MIGRATIONS},
      "latest_migration": "$(json_value "${SOURCE_LATEST_MIGRATION}")",
      "table_row_count_hash": "${SOURCE_ROW_HASH}",
      "migration_ledger_hash": "${SOURCE_LEDGER_HASH}"
    },
    "schema_summary_restored": {
      "table_count": ${RESTORE_TABLES},
      "index_count": ${RESTORE_INDEXES},
      "constraint_count": ${RESTORE_CONSTRAINTS},
      "sequence_count": ${RESTORE_SEQUENCES},
      "migration_table_present": ${RESTORE_MIGRATION_TABLE_PRESENT},
      "migration_rows": ${RESTORE_MIGRATIONS},
      "latest_migration": "$(json_value "${RESTORE_LATEST_MIGRATION}")",
      "table_row_count_hash": "${RESTORE_ROW_HASH}",
      "migration_ledger_hash": "${RESTORE_LEDGER_HASH}"
    }
  },
  "verdict": {
    "status": "${STATUS}",
    "hard_failures": ${failures_json},
    "external_mutations": {
      "production_database": false,
      "railway": true,
      "providers": false,
      "sends": false
    }
  }
}
JSON

cat > "${REPORT_MD_PATH}" <<MD
# OPS-11 Production PostgreSQL 18 Native Backup/Restore

Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

Run ID: ${RUN_ID}

Database service: Postgres-j9Pi

PostgreSQL server: ${SOURCE_VERSION}

pg_dump: ${PG_DUMP_VERSION}

pg_restore: ${PG_RESTORE_VERSION}

## Dump

- Format: custom
- No owner: true
- No ACL: true
- Size bytes: ${DUMP_SIZE_BYTES}
- SHA-256: ${DUMP_SHA256}
- Archive list entries: ${ARCHIVE_LIST_ENTRIES}
- Private backup path: ${DUMP_PATH}

## Restore Verification

- Restored database: ${LOCAL_DB}
- Table counts: source=${SOURCE_TABLES}, restored=${RESTORE_TABLES}
- Index counts: source=${SOURCE_INDEXES}, restored=${RESTORE_INDEXES}
- Constraint counts: source=${SOURCE_CONSTRAINTS}, restored=${RESTORE_CONSTRAINTS}
- Sequence counts: source=${SOURCE_SEQUENCES}, restored=${RESTORE_SEQUENCES}
- Migration table present: source=${SOURCE_MIGRATION_TABLE_PRESENT}, restored=${RESTORE_MIGRATION_TABLE_PRESENT}
- Migration rows: source=${SOURCE_MIGRATIONS}, restored=${RESTORE_MIGRATIONS}
- Latest migration: source=${SOURCE_LATEST_MIGRATION}, restored=${RESTORE_LATEST_MIGRATION}
- Row-count hash: source=${SOURCE_ROW_HASH}, restored=${RESTORE_ROW_HASH}
- Migration-ledger hash: source=${SOURCE_LEDGER_HASH}, restored=${RESTORE_LEDGER_HASH}

Verdict: ${STATUS}

External mutations: production_database=false, railway=true, providers=false, sends=false.
MD

echo "OPS11_PROD_PG18_PROOF_REPORT_START"
cat "${REPORT_JSON_PATH}"
echo "OPS11_PROD_PG18_PROOF_REPORT_END"
printf 'OPS11_PROD_PG18_PROOF_REPORT_JSON='
tr -d '\n' < "${REPORT_JSON_PATH}"
printf '\n'

if [[ "${STATUS}" != "passed" ]]; then
  exit 1
fi
