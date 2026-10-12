#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# run_one.sh – Run benchmarks for a specific testnet network model in isolation
#
# Syntax:
#   ./run_one.sh <MODEL>                    # Run finality + transfer + deploy
#   ./run_one.sh <MODEL> transfer           # Run transfer only
#   ./run_one.sh <MODEL> deploy             # Run deploy only
#   ./run_one.sh <MODEL> finality           # Run finality only
#   ./run_one.sh <MODEL> transfer finality  # Run transfer + finality
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NETWORKS_FILE="$SCRIPT_DIR/networks.env"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <MODEL> [workload...]" >&2
  echo "Examples: $0 DF" >&2
  echo "          $0 DESW transfer finality" >&2
  exit 1
fi

TARGET_MODEL="$1"
shift

case "$TARGET_MODEL" in
  Baseline|DF|SRSW|LSW|DESW) ;;
  *) echo "Error: Invalid MODEL '$TARGET_MODEL'. Choose: Baseline, DF, SRSW, LSW, DESW" >&2; exit 1 ;;
esac

declare -a WORKLOADS=()
if [[ "$#" -eq 0 ]]; then
  WORKLOADS=(finality transfer deploy)
else
  for arg in "$@"; do
    case "$arg" in
      transfer|deploy|finality) WORKLOADS+=("$arg") ;;
      *) echo "Error: Invalid workload '$arg' (choose: transfer, deploy, finality)" >&2; exit 1 ;;
    esac
  done
fi

FINALITY_COUNT="${FINALITY_COUNT:-50}"

if [[ ! -f "$NETWORKS_FILE" ]]; then
  echo "Error: File $NETWORKS_FILE not found" >&2
  exit 1
fi

# Locate network configuration from networks.env
found=0
target_rpc=""
target_pk=""
target_enclave=""

while IFS='|' read -r model enclave rpc_url private_key; do
  [[ -z "$model" || "$model" == \#* ]] && continue
  model="$(echo "$model" | xargs)"
  if [[ "$model" == "$TARGET_MODEL" ]]; then
    found=1
    target_enclave="$(echo "$enclave" | xargs)"
    target_rpc="$(echo "$rpc_url" | xargs)"
    target_pk="$(echo "$private_key" | xargs)"
    break
  fi
done < "$NETWORKS_FILE"

if [[ "$found" -eq 0 ]]; then
  echo "Error: Configuration for model '$TARGET_MODEL' not found in networks.env" >&2
  exit 1
fi

# Check RPC endpoint connectivity
if ! curl -sf --max-time 5 "$target_rpc" \
    -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
    >/dev/null 2>&1; then
  echo "Error: Cannot connect to RPC at $target_rpc (network $TARGET_MODEL)" >&2
  exit 1
fi

# Create a dedicated environment file for this model to allow safe concurrent execution
MODEL_ENV="$SCRIPT_DIR/.env.${TARGET_MODEL}"
cat > "$MODEL_ENV" <<EOF
RPC_URL='${target_rpc}'
PRIVATE_KEY='${target_pk}'
MODEL='${TARGET_MODEL}'
EOF

export ENV_FILE="$MODEL_ENV"
export MODEL="$TARGET_MODEL"
export RPC_URL="$target_rpc"
export PRIVATE_KEY="$target_pk"

# Activate Python virtual environment if available
if [[ -f "$SCRIPT_DIR/.venv/bin/activate" ]]; then
  source "$SCRIPT_DIR/.venv/bin/activate"
elif [[ -f "$HOME/nguyenphuong/exp/.venv/bin/activate" ]]; then
  source "$HOME/nguyenphuong/exp/.venv/bin/activate"
fi

echo "═══════════════════════════════════════════════════════════════════"
echo "  Benchmarking network: $TARGET_MODEL ($target_enclave)"
echo "  RPC URL: $target_rpc"
echo "  Workloads: ${WORKLOADS[*]}"
echo "═══════════════════════════════════════════════════════════════════"

failed=0
for wl in "${WORKLOADS[@]}"; do
  echo ""
  echo "▶ [${TARGET_MODEL}] Starting $wl ..."
  local_status=0

  case "$wl" in
    transfer)
      bash "$SCRIPT_DIR/run_transfer.sh" || local_status=$?
      ;;
    deploy)
      bash "$SCRIPT_DIR/run_deploy.sh" || local_status=$?
      ;;
    finality)
      bash "$SCRIPT_DIR/run_finality.sh" "$FINALITY_COUNT" || local_status=$?
      ;;
  esac

  if [[ "$local_status" -ne 0 ]]; then
    echo "✗ [${TARGET_MODEL}] $wl failed (exit code: $local_status)" >&2
    ((failed+=1))
  else
    echo "✓ [${TARGET_MODEL}] $wl completed successfully"
  fi
done

# Clean up temporary model env file
rm -f "$MODEL_ENV"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
if [[ "$failed" -gt 0 ]]; then
  echo "  [${TARGET_MODEL}] Completed with $failed failure(s). Check logs in result/."
  exit 1
else
  echo "  [${TARGET_MODEL}] All benchmark workloads completed successfully!"
  echo "  Results saved to: $SCRIPT_DIR/result/"
fi
