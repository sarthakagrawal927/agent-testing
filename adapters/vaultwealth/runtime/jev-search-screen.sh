#!/bin/sh
set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SUMMARY="$ROOT/artifacts/jev-search-screen-$(date +%s).jsonl"

for run_index in 2 3 4 5; do
  probe_log="$ROOT/artifacts/jev-probe-${run_index}-$(date +%s).log"
  node "$ROOT/probe.mjs" >"$probe_log" 2>&1 &
  probe_pid=$!
  ready=0
  attempt=0
  while [ "$attempt" -lt 80 ]; do
    if curl -fsS --max-time 1 http://127.0.0.1:18792/json/version >/dev/null 2>&1; then
      ready=1
      break
    fi
    attempt=$((attempt + 1))
    sleep 0.1
  done
  if [ "$ready" -ne 1 ]; then
    printf '{"run":%s,"status":"browser_not_ready","probe_log":"%s"}\n' "$run_index" "$probe_log" >>"$SUMMARY"
    kill -TERM "$probe_pid" 2>/dev/null || true
    wait "$probe_pid" 2>/dev/null || true
    continue
  fi
  daemon="jev-vault-screen-${run_index}-$$"
  env BU_NAME="$daemon" BU_CDP_URL=http://127.0.0.1:18792 BH_TAB_MARKER=0 \
    uv run --project "$ROOT/tools/jev-ultrafast" browser-harness <<'PY' >/dev/null
print(page_info())
PY
  env BU_NAME="$daemon" BU_CDP_URL=http://127.0.0.1:18792 BH_TAB_MARKER=0 BH_REQUIRE_EXISTING_DAEMON=1 \
    uv run --project "$ROOT/tools/jev-ultrafast" python "$ROOT/jev-vault-search.py"
  status=$?
  printf '{"run":%s,"exit_status":%s,"probe_log":"%s"}\n' "$run_index" "$status" "$probe_log" >>"$SUMMARY"
  kill -TERM "$probe_pid" 2>/dev/null || true
  wait "$probe_pid" 2>/dev/null || true
done

printf '%s\n' "$SUMMARY"
