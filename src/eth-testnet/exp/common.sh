#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Configure RPC_URL, PRIVATE_KEY, MODEL." >&2
  exit 1
fi

source "$ENV_FILE"

GAS_PRICE_WEI="${GAS_PRICE_WEI:-1000000000}"
if [[ ! "$GAS_PRICE_WEI" =~ ^[1-9][0-9]*$ ]]; then
  echo "GAS_PRICE_WEI must be a positive integer in wei." >&2
  exit 1
fi

: "${RPC_URL:?Set RPC_URL in .env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
: "${MODEL:?Set MODEL in .env}"

case "$MODEL" in
  Baseline|DF|SRSW|LSW|DESW) ;;
  *) echo "MODEL must be Baseline, DF, SRSW, LSW, or DESW." >&2; exit 1 ;;
esac

if ! command -v polycli >/dev/null 2>&1; then
  echo "polycli is not installed or not on PATH." >&2
  exit 1
fi

RESULT_DIR="$SCRIPT_DIR/result"
mkdir -p "$RESULT_DIR"

run_loadtest() {
  local mode="$1"
  local workload="$2"
  local -a fee_args=()
  if [[ -n "$GAS_PRICE_WEI" ]]; then
    fee_args=(--gas-price "$GAS_PRICE_WEI")
  fi

  local timestamp
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local run_dir="$RESULT_DIR/${MODEL}_${workload}_${timestamp}"
  mkdir -p "$run_dir"

  polycli version > "$run_dir/polycli-version.txt" 2>&1 || true
  printf 'model=%s\nworkload=%s\nrpc_url=%s\nlegacy=true\nrequests=2000\nrate_limit=200\nconcurrency=30\nmode=%s\n' \
    "$MODEL" "$workload" "$RPC_URL" "$mode" > "$run_dir/config.txt"
  printf 'gas_price_wei=%s\n' "${GAS_PRICE_WEI:-automatic}" >> "$run_dir/config.txt"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$run_dir/started-at.txt"
  echo "Running $MODEL / $workload load test..."
  echo "Output directory: $run_dir"

  local status=0
  polycli loadtest \
    --rpc-url "$RPC_URL" \
    --legacy \
    --verbosity 700 \
    --requests 2000 \
    --rate-limit 200 \
    --concurrency 30 \
    --mode "$mode" \
    --private-key "$PRIVATE_KEY" \
    "${fee_args[@]}" \
    2>&1 | tee >(awk '/\* Results/,/Finished/' > "$run_dir/summary.raw.txt") || status=$?

  if [[ -f "$SCRIPT_DIR/format_summary.py" ]]; then
    python3 "$SCRIPT_DIR/format_summary.py" "$run_dir" "$MODEL" "$workload" || true
  fi

  date -u +%Y-%m-%dT%H:%M:%SZ > "$run_dir/finished-at.txt"
  printf '%s\n' "$status" > "$run_dir/exit-code.txt"

  echo "Completed. All results saved in: $run_dir"
  return "$status"
}
