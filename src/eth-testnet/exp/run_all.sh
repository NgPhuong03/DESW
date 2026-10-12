#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# run_all.sh – Run benchmarks for all testnet networks configured in networks.env
#
# Requirements:
#   1. All Kurtosis networks are RUNNING (kurtosis enclave ls).
#   2. networks.env is configured with RPC endpoints and private keys.
#
# Syntax:
#   ./run_all.sh                      # Run finality + transfer + deploy for all
#   ./run_all.sh transfer             # Run transfer loadtest only
#   ./run_all.sh deploy               # Run deploy loadtest only
#   ./run_all.sh finality             # Run finality benchmark only
#   ./run_all.sh transfer finality    # Run transfer + finality
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NETWORKS_FILE="$SCRIPT_DIR/networks.env"

if [[ ! -f "$NETWORKS_FILE" ]]; then
  echo "Error: Missing networks.env file" >&2
  echo "  cp networks.env.example networks.env" >&2
  echo "  Then fill in RPC_URL and PRIVATE_KEY for each network." >&2
  exit 1
fi

# ── Parse workloads from command-line arguments ──────────────────────────────
declare -a WORKLOADS=()
if [[ "$#" -eq 0 ]]; then
  WORKLOADS=(finality transfer deploy)
else
  for arg in "$@"; do
    case "$arg" in
      transfer|deploy|finality) WORKLOADS+=("$arg") ;;
      *) echo "Error: Invalid workload: $arg (choose: transfer, deploy, finality)" >&2; exit 1 ;;
    esac
  done
fi

FINALITY_COUNT="${FINALITY_COUNT:-50}"

# ── Tool checks ──────────────────────────────────────────────────────────────
for wl in "${WORKLOADS[@]}"; do
  case "$wl" in
    transfer|deploy)
      if ! command -v polycli >/dev/null 2>&1; then
        echo "Error: polycli is not installed or not on PATH." >&2; exit 1
      fi ;;
    finality)
      if ! command -v k6 >/dev/null 2>&1; then
        echo "Error: k6 is not installed or not on PATH." >&2; exit 1
      fi ;;
  esac
done

# ── Activate Python virtual environment ──────────────────────────────────────
if [[ -f "$SCRIPT_DIR/.venv/bin/activate" ]]; then
  source "$SCRIPT_DIR/.venv/bin/activate"
elif [[ -f "$HOME/nguyenphuong/exp/.venv/bin/activate" ]]; then
  source "$HOME/nguyenphuong/exp/.venv/bin/activate"
fi

# ── Count total networks ─────────────────────────────────────────────────────
total_networks=0
while IFS='|' read -r model enclave rpc_url private_key; do
  [[ -z "$model" || "$model" == \#* ]] && continue
  ((total_networks+=1))
done < "$NETWORKS_FILE"

if [[ "$total_networks" -eq 0 ]]; then
  echo "Error: No networks found in networks.env" >&2
  exit 1
fi

echo "═══════════════════════════════════════════════════════════════════"
echo "  Benchmarking all ${total_networks} testnet networks"
echo "  Workloads: ${WORKLOADS[*]}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

network_idx=0
failed=0

while IFS='|' read -r model enclave rpc_url private_key; do
  # Skip empty lines and comments
  [[ -z "$model" || "$model" == \#* ]] && continue
  model="$(echo "$model" | xargs)"
  enclave="$(echo "$enclave" | xargs)"
  rpc_url="$(echo "$rpc_url" | xargs)"
  private_key="$(echo "$private_key" | xargs)"

  ((network_idx+=1))
  echo ""
  echo "┌─────────────────────────────────────────────────────────────────"
  echo "│ [$network_idx/$total_networks] Network: $model (enclave: $enclave)"
  echo "│ RPC: $rpc_url"
  echo "└─────────────────────────────────────────────────────────────────"

  # Check if RPC endpoint is responding
  if ! curl -sf --max-time 5 "$rpc_url" \
      -H 'Content-Type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
      >/dev/null 2>&1; then
    echo "Warning: Cannot connect to RPC at $rpc_url - Skipping $model." >&2
    ((failed+=1))
    continue
  fi

  echo ""
  echo "▶ Running benchmark for $model ..."
  local_status=0
  bash "$SCRIPT_DIR/run_one.sh" "$model" "${WORKLOADS[@]}" || local_status=$?

  if [[ "$local_status" -ne 0 ]]; then
    echo "✗ Benchmark for $model failed (exit code: $local_status)" >&2
    ((failed+=1))
  else
    echo "✓ Benchmark for $model completed successfully"
  fi

done < "$NETWORKS_FILE"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
if [[ "$failed" -gt 0 ]]; then
  echo "  Completed with $failed failure(s). Check logs in result/."
  exit 1
else
  echo "  All benchmarks completed successfully!"
  echo "  Results directory: $SCRIPT_DIR/result/"
fi
echo "═══════════════════════════════════════════════════════════════════"
