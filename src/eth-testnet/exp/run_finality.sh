#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env and configure RPC_URL, PRIVATE_KEY, MODEL." >&2
  exit 1
fi

source "$ENV_FILE"
: "${RPC_URL:?Set RPC_URL in .env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
: "${MODEL:?Set MODEL in .env}"

COUNT="${1:-50}"

case "$MODEL" in
  Baseline|DF|SRSW|LSW|DESW) ;;
  *) echo "MODEL must be Baseline, DF, SRSW, LSW, or DESW." >&2; exit 1 ;;
esac

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed or not on PATH." >&2
  exit 1
fi

RESULT_DIR="$SCRIPT_DIR/result"
mkdir -p "$RESULT_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="$RESULT_DIR/${MODEL}_finality_${timestamp}"
mkdir -p "$run_dir"

echo "Running $MODEL finality test ($COUNT transactions)..."
echo "Output directory: $run_dir"

# Activate python virtualenv if available
if [[ -f "$SCRIPT_DIR/.venv/bin/activate" ]]; then
  source "$SCRIPT_DIR/.venv/bin/activate"
elif [[ -f "$HOME/nguyenphuong/exp/.venv/bin/activate" ]]; then
  source "$HOME/nguyenphuong/exp/.venv/bin/activate"
fi

# 1. Generate pre-signed transactions directly into run_dir
export RPC_URL PRIVATE_KEY
python3 "$SCRIPT_DIR/prepare_finality.py" "$COUNT" "$run_dir/finality_txs.json"

# 2. Run k6 benchmark and export results into run_dir
local_status=0
k6 run \
  --summary-export "$run_dir/finality_summary.json" \
  -e RPC_URL="$RPC_URL" \
  -e TXS_FILE="$run_dir/finality_txs.json" \
  "$SCRIPT_DIR/finality.js" || local_status=$?

printf '%s\n' "$local_status" > "$run_dir/exit-code.txt"
date -u +%Y-%m-%dT%H:%M:%SZ > "$run_dir/finished-at.txt"

echo "Finality test completed with exit code $local_status."
echo "All results saved in: $run_dir"
exit "$local_status"
