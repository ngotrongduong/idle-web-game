#!/usr/bin/env bash
# Runs the same checks as .github/workflows/ci.yml on a developer machine or agent container.
#
#   scripts/ci-local.sh            full pipeline (needs PostgreSQL + a Playwright Chromium)
#   scripts/ci-local.sh --quick    lint, Prettier, typecheck, unit tests (PostgreSQL tests run if reachable)
#   scripts/ci-local.sh --no-e2e   full pipeline without the six browser E2Es
#   scripts/ci-local.sh --install  run `pnpm install --frozen-lockfile` first
#   scripts/ci-local.sh --help     this text
#
# Environment:
#   DATABASE_URL       defaults to the CI database postgresql://postgres:postgres@127.0.0.1:5432/guildhall_test
#   GUILDHALL_BROWSER  defaults to "chromium" (Playwright's bundled browser); CI uses the Chrome channel
#
# Ports 3001 (server), 5173 (web) and 5174 (golden page) must be free: a stale dev server would make
# the E2Es test old code.
set -euo pipefail

cd "$(dirname "$0")/.."

QUICK=0
E2E=1
INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --no-e2e) E2E=0 ;;
    --install) INSTALL=1 ;;
    -h | --help)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown option: $arg (see --help)" >&2
      exit 2
      ;;
  esac
done

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/guildhall_test}"
case "$DATABASE_URL" in
  */guildhall_test | */guildhall_test\?*) ;;
  *) echo "warning: DATABASE_URL is not a guildhall_test database; migrations, tests and E2E guests will write to it" >&2 ;;
esac
export GUILDHALL_BROWSER="${GUILDHALL_BROWSER:-chromium}"
LOG_DIR="${TMPDIR:-/tmp}/guildhall-ci"
mkdir -p "$LOG_DIR"

BG_PIDS=()
cleanup() {
  for pid in "${BG_PIDS[@]:-}"; do
    [ -n "$pid" ] || continue
    # Background jobs run in their own process group (setsid), so tsx/vite children die too.
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  done
  BG_PIDS=()
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_bg() {
  local log=$1
  shift
  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" >"$log" 2>&1 &
  else
    "$@" >"$log" 2>&1 &
  fi
  BG_PIDS+=("$!")
}

wait_for_url() {
  local url=$1
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "timed out waiting for $url" >&2
  return 1
}

port_busy() {
  # Any TCP listener counts, not only HTTP servers.
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

STEP_RESULTS=()
SKIPPED=0
skip() {
  STEP_RESULTS+=("skip $1")
  SKIPPED=1
}
step() {
  local name=$1
  shift
  local started=$SECONDS
  echo
  echo "::: $name"
  if "$@"; then
    STEP_RESULTS+=("ok   $name ($((SECONDS - started))s)")
  else
    STEP_RESULTS+=("FAIL $name ($((SECONDS - started))s)")
    summary
    echo "ci-local: FAILED at '$name' (logs in $LOG_DIR)" >&2
    exit 1
  fi
}

summary() {
  echo
  echo "::: summary"
  printf '  %s\n' "${STEP_RESULTS[@]}"
}

database_reachable() {
  (cd apps/server && node -e '
    const { Client } = require("pg");
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
    client.connect().then(() => client.end()).then(() => process.exit(0), () => process.exit(1));
  ') >/dev/null 2>&1
}

migrate_twice() {
  # Migrations re-run on every deploy; a second pass must be a no-op.
  pnpm --filter @idle/server db:migrate && pnpm --filter @idle/server db:migrate
}

golden_battle() {
  local log="$LOG_DIR/golden-vite.log"
  start_bg "$log" pnpm --filter @idle/web exec vite ../../packages/game-core --host 127.0.0.1 --port 5174 --strictPort
  wait_for_url http://127.0.0.1:5174/browser-golden.html || {
    cat "$log"
    return 1
  }
  pnpm --filter @idle/inspect golden:battle
  local status=$?
  cleanup
  return $status
}

browser_e2e() {
  local server_log="$LOG_DIR/e2e-server.log" web_log="$LOG_DIR/e2e-web.log"
  start_bg "$server_log" pnpm --filter @idle/server exec tsx src/index.ts
  start_bg "$web_log" pnpm --filter @idle/web exec vite --host 127.0.0.1 --port 5173 --strictPort
  if ! wait_for_url http://127.0.0.1:3001/health || ! wait_for_url http://127.0.0.1:5173/; then
    tail -n 50 "$server_log" "$web_log"
    return 1
  fi
  local status=0
  for script in e2e:dungeon e2e:promotion e2e:equipment e2e:auto-sell e2e:buildings e2e:language; do
    echo "--- $script"
    if ! pnpm --filter @idle/inspect "$script"; then
      status=1
      tail -n 50 "$server_log"
      break
    fi
  done
  cleanup
  return $status
}

docker_compose_config() {
  docker compose -f infra/docker-compose.yml config --quiet
}

if [ "$INSTALL" -eq 1 ]; then
  step "install (frozen lockfile)" pnpm install --frozen-lockfile
elif [ ! -d node_modules ]; then
  echo "node_modules missing; run with --install" >&2
  exit 1
fi

if database_reachable; then
  HAVE_DB=1
else
  HAVE_DB=0
  if [ "$QUICK" -eq 0 ]; then
    cat >&2 <<EOF
PostgreSQL is not reachable at DATABASE_URL=$DATABASE_URL
Start one, for example:
  docker run -d --name guildhall-test-db -p 5432:5432 \\
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=guildhall_test postgres:16-alpine
or run with --quick to skip the database-backed steps.
EOF
    exit 1
  fi
  echo "PostgreSQL not reachable: --quick run skips migrations and PostgreSQL integration tests"
  unset DATABASE_URL
  skip "migrations and PostgreSQL integration tests (database not reachable)"
fi

if [ "$QUICK" -eq 0 ]; then
  for port in 3001 5173 5174; do
    if port_busy "$port"; then
      echo "port $port is already in use; stop the running dev server first" >&2
      exit 1
    fi
  done
fi

if [ "$HAVE_DB" -eq 1 ]; then step "migrate test database (twice)" migrate_twice; fi
step "lint" pnpm lint
step "format check" pnpm format:check
step "typecheck" pnpm typecheck
step "test" pnpm test

if [ "$QUICK" -eq 0 ]; then
  step "economy balance report" pnpm --filter @idle/sim sim:economy
  step "chromium golden battle" golden_battle
  if [ "$E2E" -eq 1 ]; then
    step "browser E2E (dungeon, promotion, equipment, auto-sell, buildings, language)" browser_e2e
  else
    skip "browser E2E (--no-e2e)"
  fi
  step "build" pnpm build
  if command -v docker >/dev/null 2>&1; then
    step "docker compose config" docker_compose_config
  else
    skip "docker compose config (docker not installed; CI still runs it)"
  fi
fi

summary
if [ "$QUICK" -eq 1 ]; then
  echo "ci-local: quick checks passed (not the full CI pipeline)"
elif [ "$SKIPPED" -eq 1 ]; then
  echo "ci-local: passed with skipped steps (see summary); not equivalent to CI"
else
  echo "ci-local: full pipeline passed"
fi
