#!/usr/bin/env bash
# SessionStart hook for Claude Code cloud sessions: installs dependencies and brings up the local
# PostgreSQL test database, so tests, scripts/ci-local.sh and the agent team work on a fresh
# machine. Local machines are left alone. PostgreSQL problems only warn; they never block a session.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
log="${TMPDIR:-/tmp}/guildhall-session-start.log"
db_name=guildhall_test

cd "$project_dir"
if ! pnpm install >"$log" 2>&1; then
  echo "session-start: pnpm install failed (log: $log)" >&2
  tail -n 20 "$log" >&2
  exit 1
fi

as_postgres() { (cd / && runuser -u postgres -- "$@"); }

# Prints one status line; returns non-zero with the reason when the database is not usable.
ensure_postgres() {
  command -v pg_lsclusters >/dev/null || { echo "pg_lsclusters not found"; return 1; }
  local version="" cluster="" status=""
  read -r version cluster _ status _ < <(pg_lsclusters --no-header | head -n 1) || true
  [ -n "$version" ] || { echo "no PostgreSQL cluster"; return 1; }
  case "$status" in
    online*) ;;
    *) pg_ctlcluster "$version" "$cluster" start >>"$log" 2>&1 ||
      { echo "pg_ctlcluster $version $cluster start failed"; return 1; } ;;
  esac
  as_postgres psql -qtA -c "ALTER USER postgres PASSWORD 'postgres'" >>"$log" 2>&1 ||
    { echo "could not set the postgres password"; return 1; }
  if [ "$(as_postgres psql -qtA -c "SELECT 1 FROM pg_database WHERE datname = '$db_name'" 2>>"$log")" != "1" ]; then
    as_postgres createdb "$db_name" >>"$log" 2>&1 || { echo "createdb $db_name failed"; return 1; }
  fi
  echo "postgres $version online, $db_name ready"
}

if postgres_status=$(ensure_postgres); then
  echo "session-start: dependencies installed, $postgres_status"
else
  echo "session-start: dependencies installed; warning: $postgres_status (log: $log)." \
    "See the local-ci skill to start PostgreSQL by hand."
fi
