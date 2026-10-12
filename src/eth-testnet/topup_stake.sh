#!/usr/bin/env bash
# Top up a group of genesis validators on a running Kurtosis devnet.
#
# Genesis assigns every validator the same balance (validator_balance in params).
# These validators use compounding credentials (0x02), so a later deposit to the
# same pubkey increases that validator's stake. Proposer selection reads
# effective_balance, which this devnet caps at 2048 ETH.
#
# Deposits go out one validator at a time. process_pending_deposits applies a
# queued deposit only after that deposit's slot is finalized and the full amount
# fits in the activation churn; anything behind an unfinalized deposit stays
# queued. The next validator is funded only after this one's beacon balance
# reaches the target. A second transaction at a nonce that is still pending is
# rejected as replacement-underpriced, so an in-flight deposit is waited on
# instead of being sent again.
#
# The mnemonic and prefunded key are the public ethereum-package devnet defaults.
# Override them with VALIDATOR_MNEMONIC and PREFUNDED_PRIVATE_KEY.

set -euo pipefail

COUNT=5
TARGET_ETH=2048
ENCLAVE=""
DRY_RUN=0
# 0 means the per-validator wait is estimated from follow distance, finalization, and churn.
WAIT_SECONDS=0
EL_SERVICE="el-1-geth-lighthouse"
CL_SERVICE="cl-1-lighthouse-geth"
MNEMONIC="${VALIDATOR_MNEMONIC:-giant issue aisle success illegal bike spike question tent bar rely arctic volcano long crawl hungry vocal artwork sniff fantasy very lucky have athlete}"
PRIVATE_KEY="${PREFUNDED_PRIVATE_KEY:-bcdf20249abf0ed6d944c0288fad489e33f66b3960d9e6229c1cd214ed3bbe31}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [ENCLAVE] [options]

After the devnet is up, deposit extra stake onto the first validators so their
balances are much larger than the rest.

Validators are topped up one at a time. The script submits one deposit, waits
until that deposit is finalized and the beacon balance reaches the target, then
funds the next validator.

Options:
  --count N            How many validators to top up, starting at index 0 (default: 5)
  --target-eth ETH     Balance each of them should reach, in ETH (default: 2048, the effective-balance cap)
  --enclave NAME       Kurtosis enclave. If omitted and only one enclave is running, that one is used
  --el-service NAME    Execution client service (default: el-1-geth-lighthouse)
  --cl-service NAME    Beacon service (default: cl-1-lighthouse-geth)
  --dry-run            Print the deposits and estimate gas, do not send them
  --wait               Accepted so older commands still run. Waiting is always on
  --wait-seconds N     Per-validator limit while the beacon applies a deposit
                       (default: estimated from follow distance, finalization, and churn)
  -h, --help           Show this help

The beacon queues a deposit after ETH1_FOLLOW_DISTANCE execution blocks, then
applies it only once its slot is finalized and the full amount fits in the
activation churn.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --count)
      COUNT="$2"
      shift 2
      ;;
    --target-eth)
      TARGET_ETH="$2"
      shift 2
      ;;
    --enclave)
      ENCLAVE="$2"
      shift 2
      ;;
    --el-service)
      EL_SERVICE="$2"
      shift 2
      ;;
    --cl-service)
      CL_SERVICE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --wait)
      # Waiting for each validator is unconditional.
      shift
      ;;
    --wait-seconds)
      WAIT_SECONDS="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "${ENCLAVE}" ]]; then
        ENCLAVE="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if ! [[ "${COUNT}" =~ ^[1-9][0-9]*$ ]]; then
  echo "--count must be a positive integer" >&2
  exit 1
fi
if ! [[ "${TARGET_ETH}" =~ ^[1-9][0-9]*$ ]]; then
  echo "--target-eth must be a positive whole number of ETH" >&2
  exit 1
fi
if ! [[ "${WAIT_SECONDS}" =~ ^[0-9]+$ ]]; then
  echo "--wait-seconds must be a non-negative integer" >&2
  exit 1
fi

for cmd in kurtosis curl python3 docker cast; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Required command not found: ${cmd}" >&2
    exit 1
  fi
done

if [[ -z "${ENCLAVE}" ]]; then
  mapfile -t running < <(kurtosis enclave ls | awk 'NR > 1 && $3 == "RUNNING" { print $2 }')
  if [[ ${#running[@]} -eq 1 ]]; then
    ENCLAVE="${running[0]}"
  elif [[ ${#running[@]} -eq 0 ]]; then
    echo "No running Kurtosis enclave. Start one with ./run_network.sh first." >&2
    exit 1
  else
    echo "Several enclaves are running. Pass one with --enclave." >&2
    printf '  %s\n' "${running[@]}" >&2
    exit 1
  fi
fi

normalize_url() {
  local raw="$1"
  raw="${raw%$'\r'}"
  raw="${raw%/}"
  if [[ "${raw}" != http://* && "${raw}" != https://* ]]; then
    raw="http://${raw}"
  fi
  printf '%s\n' "${raw}"
}

EL_URL="$(normalize_url "$(kurtosis port print "${ENCLAVE}" "${EL_SERVICE}" rpc)")"
BEACON_URL="$(normalize_url "$(kurtosis port print "${ENCLAVE}" "${CL_SERVICE}" http)")"

echo "Enclave:  ${ENCLAVE}"
echo "EL RPC:   ${EL_URL}"
echo "Beacon:   ${BEACON_URL}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

curl -fsS "${BEACON_URL}/eth/v1/config/spec" -o "${WORKDIR}/spec.json"

python3 - "${WORKDIR}/spec.json" "${TARGET_ETH}" <<'PY'
import json
import sys

def as_int(value):
    if isinstance(value, str):
        return int(value, 16) if value.startswith("0x") else int(value)
    return int(value)

spec = json.load(open(sys.argv[1]))["data"]
target_eth = int(sys.argv[2])
cap_gwei = as_int(spec["MAX_EFFECTIVE_BALANCE_ELECTRA"])
cap_eth = cap_gwei // 1_000_000_000
if target_eth > cap_eth:
    sys.exit(
        f"--target-eth {target_eth} is above the effective-balance cap of {cap_eth} ETH. "
        "Extra balance above that cap does not change proposer weight."
    )
try:
    min_churn = as_int(spec["MIN_PER_EPOCH_CHURN_LIMIT_ELECTRA"])
    max_churn = as_int(spec["MAX_PER_EPOCH_ACTIVATION_EXIT_CHURN_LIMIT"])
except KeyError as exc:
    sys.exit(f"Beacon spec is missing {exc.args[0]}. Electra churn limits are required.")
increment = as_int(spec.get("EFFECTIVE_BALANCE_INCREMENT", 1_000_000_000))
# On this devnet total-active/quotient is below the floor, so the applied churn
# is min(min_per_epoch, max_per_epoch) rounded down to 1 ETH.
churn = min(min_churn, max_churn)
churn -= churn % increment
if churn <= 0:
    sys.exit("Electra activation churn from the beacon spec is 0.")
slots = as_int(spec.get("SLOTS_PER_EPOCH", 32))
seconds = as_int(spec.get("SECONDS_PER_SLOT", 12))
open(sys.argv[1] + ".env", "w").write(
    "\n".join(
        [
            f"FORK_VERSION={spec['GENESIS_FORK_VERSION']}",
            f"DEPOSIT={spec['DEPOSIT_CONTRACT_ADDRESS']}",
            f"MIN_DEPOSIT_GWEI={spec['MIN_DEPOSIT_AMOUNT']}",
            f"FOLLOW_DISTANCE={spec['ETH1_FOLLOW_DISTANCE']}",
            f"CAP_ETH={cap_eth}",
            f"SLOTS_PER_EPOCH={slots}",
            f"SECONDS_PER_SLOT={seconds}",
            f"CHURN_GWEI={churn}",
        ]
    )
    + "\n"
)
PY

# shellcheck disable=SC1091
source "${WORKDIR}/spec.json.env"

CHAIN_ID="$(cast chain-id --rpc-url "${EL_URL}")"
python3 - "${CHAIN_ID}" <<'PY'
import sys

chain_id = int(sys.argv[1])
public = {1, 11155111, 17000, 560048, 59144}
if chain_id in public:
    sys.exit(f"Refusing to send deposits to public chain id {chain_id}.")
PY

SENDER="$(cast wallet address --private-key "${PRIVATE_KEY}")"
SENDER_BALANCE="$(cast balance --rpc-url "${EL_URL}" "${SENDER}")"

format_gwei() {
  python3 - "$1" <<'PY'
import sys
print(f"{int(sys.argv[1]) / 1_000_000_000:.4f}")
PY
}

snapshot_validator() {
  python3 - \
    "${BEACON_URL}" \
    "${EL_URL}" \
    "$1" \
    "${TARGET_ETH}" \
    "${MIN_DEPOSIT_GWEI}" \
    "${SENDER}" \
    "${DEPOSIT}" \
    "${FOLLOW_DISTANCE}" \
    "${SLOTS_PER_EPOCH}" \
    "${WORKDIR}/deposit-log-cache.json" <<'PY' >"${WORKDIR}/snapshot.env"
import json
import sys
import time
import urllib.error
import urllib.request

(
    beacon,
    el,
    index,
    target_eth,
    min_deposit,
    sender,
    deposit,
    _follow,
    slots,
    cache_path,
) = sys.argv[1:]
index = int(index)
target = int(target_eth) * 1_000_000_000
min_deposit = int(min_deposit)
slots = int(slots)
sender_l = sender.lower()
deposit_topic = "0x649bbc62d0e31342afea4e5cd82d4049e7e1ee912fc0889aa790803be39038c5"

def as_int(value):
    if isinstance(value, str):
        return int(value, 16) if value.startswith("0x") else int(value)
    return int(value)

def norm_key(value):
    return value.lower().removeprefix("0x")

def get(url):
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:500]
        raise SystemExit(f"GET {url} failed ({exc.code}): {detail}") from exc

indexing_incomplete = False

def rpc(method, params):
    global indexing_incomplete
    for attempt in range(6):
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
        request = urllib.request.Request(el, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.load(response)
        error = payload.get("error")
        if error and "transaction indexing is in progress" in str(error).lower():
            indexing_incomplete = True
            if attempt + 1 < 6:
                time.sleep(2)
                continue
            # Receipt and transaction lookups fail until geth finishes indexing.
            # Leave the sender unknown so this poll does not send a second deposit.
            if method == "eth_getTransactionByHash":
                return None
            raise RuntimeError(f"{method}: {error}")
        if error:
            raise RuntimeError(f"{method}: {error}")
        return payload.get("result")
    raise RuntimeError(f"{method}: transaction indexing is in progress")

body = get(f"{beacon}/eth/v1/beacon/states/head/validators/{index}")["data"]
balance = as_int(body["balance"])
validator = body["validator"]
pubkey = validator["pubkey"].lower()
if not pubkey.startswith("0x"):
    pubkey = "0x" + pubkey
creds = validator["withdrawal_credentials"]
address = "0x" + creds[-40:]
need = max(0, target - balance)
if 0 < need < min_deposit:
    need = min_deposit
pubkey_norm = norm_key(pubkey)

pending_gwei = 0
pending_slot = 0
seen_pending = False
for item in get(f"{beacon}/eth/v1/beacon/states/head/pending_deposits").get("data") or []:
    if norm_key(item["pubkey"]) != pubkey_norm:
        continue
    amount = as_int(item["amount"])
    slot = as_int(item["slot"])
    pending_gwei += amount
    if not seen_pending or slot < pending_slot:
        pending_slot = slot
        seen_pending = True

finality = get(f"{beacon}/eth/v1/beacon/states/head/finality_checkpoints")["data"]["finalized"]
finalized_epoch = as_int(finality["epoch"])
finalized_slot = finalized_epoch * slots
head_slot = as_int(get(f"{beacon}/eth/v1/beacon/headers/head")["data"]["header"]["message"]["slot"])
head_block = as_int(rpc("eth_blockNumber", []))
confirmed = as_int(rpc("eth_getTransactionCount", [sender, "latest"]))
pending_nonce = as_int(rpc("eth_getTransactionCount", [sender, "pending"]))

try:
    cache = json.load(open(cache_path))
except (FileNotFoundError, json.JSONDecodeError):
    cache = {"last": -1, "deposits": []}

def decode_bytes_at(data, offset):
    length = int.from_bytes(data[offset:offset + 32], "big")
    return data[offset + 32:offset + 32 + length]

def fetch_logs(start, end):
    if start > end:
        return []
    try:
        return rpc("eth_getLogs", [{
            "fromBlock": hex(start),
            "toBlock": hex(end),
            "address": deposit,
            "topics": [deposit_topic],
        }]) or []
    except Exception as exc:
        message = str(exc).lower()
        range_limited = any(word in message for word in ("range", "too many", "too large", "limit", "exceed"))
        if end > start and range_limited:
            mid = (start + end) // 2
            return fetch_logs(start, mid) + fetch_logs(mid + 1, end)
        raise

start = int(cache.get("last", -1)) + 1
if start <= head_block:
    if head_block - start > 1000:
        print(f"Scanning deposit logs in blocks {start}..{head_block}", file=sys.stderr)
    for log in fetch_logs(start, head_block):
        raw = log.get("data") or "0x"
        data = bytes.fromhex(raw.removeprefix("0x"))
        if len(data) < 32 * 5:
            continue
        offsets = [int.from_bytes(data[i * 32:(i + 1) * 32], "big") for i in range(5)]
        try:
            log_pubkey = "0x" + decode_bytes_at(data, offsets[0]).hex()
            amount = int.from_bytes(decode_bytes_at(data, offsets[2]), "little")
            block = as_int(log["blockNumber"])
        except (ValueError, IndexError):
            continue
        cache["deposits"].append({
            "pubkey": log_pubkey.lower(),
            "amount": amount,
            "block": block,
            "hash": log.get("transactionHash", ""),
            "sender": None,
        })
    cache["last"] = head_block

missing = [
    item for item in cache["deposits"]
    if item.get("sender") is None and norm_key(item["pubkey"]) == pubkey_norm and item.get("hash")
]
for item in missing:
    tx = rpc("eth_getTransactionByHash", [item["hash"]])
    if not tx or not tx.get("from"):
        continue
    item["sender"] = tx["from"].lower()

json.dump(cache, open(cache_path, "w"))
sender_gwei = 0
newest = 0
unresolved = 0
for item in cache["deposits"]:
    if norm_key(item["pubkey"]) != pubkey_norm:
        continue
    if item.get("sender") is None:
        unresolved = 1
        continue
    if item.get("sender") == sender_l:
        sender_gwei += int(item["amount"])
        newest = max(newest, int(item["block"]))

print(f"BALANCE_GWEI={balance}")
print(f"NEED_GWEI={need}")
print(f"WEI={need * 1_000_000_000}")
print(f"PUBKEY={pubkey}")
print(f"WITHDRAWAL_ADDRESS={address}")
print(f"INDEX={index}")
print(f"PENDING_GWEI={pending_gwei}")
print(f"PENDING_SLOT={pending_slot}")
print(f"FINALIZED_EPOCH={finalized_epoch}")
print(f"FINALIZED_SLOT={finalized_slot}")
print(f"HEAD_SLOT={head_slot}")
print(f"HEAD_BLOCK={head_block}")
print(f"CONFIRMED_NONCE={confirmed}")
print(f"PENDING_NONCE={pending_nonce}")
print(f"SENDER_DEPOSIT_GWEI={sender_gwei}")
print(f"NEWEST_DEPOSIT_BLOCK={newest}")
print(f"UNRESOLVED_DEPOSIT={unresolved}")
PY
  # shellcheck disable=SC1091
  source "${WORKDIR}/snapshot.env"
}

# True (return 0) when a deposit for this validator must finish before another is sent.
deposit_is_unsettled() {
  if [[ "${PENDING_GWEI}" != "0" ]]; then
    return 0
  fi
  if [[ "${PENDING_NONCE}" -gt "${CONFIRMED_NONCE}" ]]; then
    return 0
  fi
  if [[ "${UNRESOLVED_DEPOSIT}" == "1" ]]; then
    return 0
  fi
  if [[ "${SENDER_DEPOSIT_GWEI}" == "0" ]]; then
    return 1
  fi
  # A top-up larger than the current balance is still absent from the beacon.
  if [[ "${BALANCE_GWEI}" -lt "${SENDER_DEPOSIT_GWEI}" ]]; then
    return 0
  fi
  local age=0
  if [[ "${HEAD_BLOCK}" -ge "${NEWEST_DEPOSIT_BLOCK}" ]]; then
    age=$((HEAD_BLOCK - NEWEST_DEPOSIT_BLOCK))
  fi
  local window=$((FOLLOW_DISTANCE + SLOTS_PER_EPOCH * 2))
  if [[ "${age}" -le "${window}" ]]; then
    return 0
  fi
  return 1
}

print_wait_status() {
  local balance_eth
  balance_eth="$(format_gwei "${BALANCE_GWEI}")"
  if [[ "${UNRESOLVED_DEPOSIT}" == "1" ]]; then
    echo "Validator ${INDEX}: ${balance_eth} ETH. A deposit is on chain, but the execution client is still indexing transactions."
    return
  fi
  if [[ "${PENDING_NONCE}" -gt "${CONFIRMED_NONCE}" ]]; then
    if [[ "${HEAD_BLOCK}" == "0" ]]; then
      echo "Validator ${INDEX}: ${balance_eth} ETH. Deposit is in the mempool (nonce ${CONFIRMED_NONCE}). Execution block is still 0, so it cannot be mined yet."
    else
      echo "Validator ${INDEX}: ${balance_eth} ETH. Deposit transaction is in the mempool (nonce ${CONFIRMED_NONCE}, head block ${HEAD_BLOCK}). Waiting for it to be mined."
    fi
    return
  fi
  if [[ "${PENDING_GWEI}" != "0" ]]; then
    local pending_eth
    pending_eth="$(format_gwei "${PENDING_GWEI}")"
    if [[ "${PENDING_SLOT}" -gt "${FINALIZED_SLOT}" ]]; then
      echo "Validator ${INDEX}: ${balance_eth} ETH, ${pending_eth} ETH queued at slot ${PENDING_SLOT}. Finalized slot is ${FINALIZED_SLOT} (epoch ${FINALIZED_EPOCH}, head slot ${HEAD_SLOT}). Waiting for finalization."
    else
      echo "Validator ${INDEX}: ${balance_eth} ETH, ${pending_eth} ETH is finalized (slot ${PENDING_SLOT} <= ${FINALIZED_SLOT}). Waiting for churn to apply it."
    fi
    return
  fi
  if [[ "${SENDER_DEPOSIT_GWEI}" != "0" ]]; then
    echo "Validator ${INDEX}: ${balance_eth} ETH. Execution deposit of $(format_gwei "${SENDER_DEPOSIT_GWEI}") ETH was mined in block ${NEWEST_DEPOSIT_BLOCK} (head ${HEAD_BLOCK}). Waiting for the beacon to queue it."
    return
  fi
  echo "Validator ${INDEX}: ${balance_eth} ETH. Waiting for the deposit to be applied (head slot ${HEAD_SLOT})."
}

validator_timeout_seconds() {
  if [[ "${WAIT_SECONDS}" != "0" ]]; then
    printf '%s\n' "${WAIT_SECONDS}"
    return
  fi
  python3 - "${NEED_GWEI}" "${CHURN_GWEI}" "${FOLLOW_DISTANCE}" "${SLOTS_PER_EPOCH}" "${SECONDS_PER_SLOT}" <<'PY'
import sys
need, churn, follow, slots, sec = (int(arg) for arg in sys.argv[1:])
epochs = (need + churn - 1) // churn + 4
blocks = follow + epochs * slots
# Follow distance plus finalization and churn, doubled for slow blocks.
print(blocks * sec * 2 + 600)
PY
}

load_deposit_calldata() {
  python3 - "${WORKDIR}/deposit-${INDEX}.json" <<'PY' >"${WORKDIR}/deposit.env"
import json
import sys
item = json.load(open(sys.argv[1]))[0]
amount = int(item["value"])
print(f"DEPOSIT_PUBKEY={item['pubkey']}")
print(f"DEPOSIT_CREDS={item['withdrawal_credentials']}")
print(f"DEPOSIT_SIG={item['signature']}")
print(f"DEPOSIT_ROOT={item['deposit_data_root']}")
print(f"DEPOSIT_WEI={amount * 1_000_000_000}")
PY
  # shellcheck disable=SC1091
  source "${WORKDIR}/deposit.env"
}

build_deposit() {
  docker run --rm protolambda/eth2-val-tools:latest deposit-data \
    --validators-mnemonic "${MNEMONIC}" \
    --source-min "${INDEX}" \
    --source-max "$((INDEX + 1))" \
    --amount "${NEED_GWEI}" \
    --fork-version "${FORK_VERSION}" \
    --withdrawal-credentials-type 0x02 \
    --withdrawal-address "${WITHDRAWAL_ADDRESS}" \
    --as-json-list >"${WORKDIR}/deposit-${INDEX}.json"

  python3 - "${WORKDIR}/deposit-${INDEX}.json" "${PUBKEY}" "${INDEX}" "${NEED_GWEI}" <<'PY'
import json
import sys

item = json.load(open(sys.argv[1]))[0]
expected = sys.argv[2].lower().removeprefix("0x")
got = item["pubkey"].lower().removeprefix("0x")
index = sys.argv[3]
need = sys.argv[4]
if got != expected:
    sys.exit(
        f"Validator {index} pubkey from the mnemonic does not match the beacon chain.\n"
        f"  mnemonic: 0x{got}\n"
        f"  beacon:   0x{expected}\n"
        "Set VALIDATOR_MNEMONIC to the mnemonic this enclave was created with."
    )
if str(item["value"]) != need:
    sys.exit(f"Deposit tool returned amount {item['value']}, expected {need}.")
PY
  load_deposit_calldata
}

# Geth returns this until its transaction indexer finishes. The deposit can already
# be in the mempool; asking for the receipt must be retried rather than treated as fatal.
wait_for_receipt() {
  local hash="$1"
  local receipt="$2"
  local deadline=$((SECONDS + 600))
  local noticed=0
  while [[ "${SECONDS}" -lt "${deadline}" ]]; do
    if cast receipt "${hash}" --rpc-url "${EL_URL}" --json >"${receipt}" 2>"${WORKDIR}/receipt.err"; then
      return 0
    fi
    if [[ "${noticed}" == "0" ]]; then
      if grep -qi "transaction indexing is in progress" "${WORKDIR}/receipt.err"; then
        echo "Validator ${INDEX}: execution client is still indexing transactions. Waiting for the receipt of ${hash}."
      else
        echo "Validator ${INDEX}: waiting for ${hash} to be mined."
      fi
      noticed=1
    fi
    sleep "${POLL_SECONDS:-12}"
  done
  {
    echo "Timed out waiting for receipt of ${hash}."
    cat "${WORKDIR}/receipt.err"
  } >"${WORKDIR}/send.err"
  return 1
}

# Send the deposit signed in deposit-${INDEX}.json. Optional args: max-fee-wei priority-fee-wei.
send_deposit() {
  local nonce="$1"
  local receipt="${WORKDIR}/receipt-${INDEX}.json"
  local cmd=(
    cast send "${DEPOSIT}"
    "deposit(bytes,bytes,bytes,bytes32)"
    "0x${DEPOSIT_PUBKEY}"
    "0x${DEPOSIT_CREDS}"
    "0x${DEPOSIT_SIG}"
    "0x${DEPOSIT_ROOT}"
    --value "${DEPOSIT_WEI}"
    --private-key "${PRIVATE_KEY}"
    --rpc-url "${EL_URL}"
    --nonce "${nonce}"
    --async
  )
  if [[ -n "${2:-}" ]]; then
    cmd+=(--gas-price "$2" --priority-gas-price "$3")
  fi
  if ! "${cmd[@]}" >"${WORKDIR}/txhash.txt" 2>"${WORKDIR}/send.err"; then
    return 1
  fi
  if ! TX_HASH="$(python3 - "${WORKDIR}/txhash.txt" <<'PY'
import re
import sys
text = open(sys.argv[1]).read()
match = re.search(r"0x[0-9a-fA-F]{64}", text)
if not match:
    sys.exit(text)
print(match.group(0))
PY
)"; then
    echo "cast send did not return a transaction hash." >"${WORKDIR}/send.err"
    cat "${WORKDIR}/txhash.txt" >>"${WORKDIR}/send.err"
    return 1
  fi
  echo "  validator ${INDEX} submitted ${TX_HASH}"
  wait_for_receipt "${TX_HASH}" "${receipt}" || return 1
  if ! TX_HASH="$(python3 - "${receipt}" "${INDEX}" <<'PY'
import json
import sys
receipt = json.load(open(sys.argv[1]))
status = receipt.get("status")
tx = receipt.get("transactionHash")
if status not in ("0x1", 1, "1"):
    sys.exit(f"Deposit transaction for validator {sys.argv[2]} failed: {tx} status {status}")
print(tx)
PY
)"; then
    echo "Deposit receipt for validator ${INDEX} was not successful." >"${WORKDIR}/send.err"
    return 1
  fi
}

replace_underpriced() {
  local gas_price bumped_fee priority
  gas_price="$(cast gas-price --rpc-url "${EL_URL}")"
  bumped_fee=$((gas_price * 2))
  if [[ "${bumped_fee}" -lt 2000000000 ]]; then
    bumped_fee=2000000000
  fi
  priority=1000000000
  if [[ "${priority}" -ge "${bumped_fee}" ]]; then
    priority=$((bumped_fee / 2))
  fi
  if [[ ! -f "${WORKDIR}/deposit-${INDEX}.json" ]]; then
    build_deposit
  else
    load_deposit_calldata
  fi
  echo "Validator ${INDEX}: replacing pending nonce ${CONFIRMED_NONCE} with a higher fee."
  if send_deposit "${CONFIRMED_NONCE}" "${bumped_fee}" "${priority}"; then
    echo "  validator ${INDEX} tx ${TX_HASH}"
    return 0
  fi
  echo "Replacement was not accepted. Waiting for nonce ${CONFIRMED_NONCE} to be mined." >&2
  cat "${WORKDIR}/send.err" >&2
  return 0
}

echo "Sender:   ${SENDER}"
echo "Chain id: ${CHAIN_ID}"
python3 - "${SENDER_BALANCE}" <<'PY'
import sys
print(f"Balance:  {int(sys.argv[1]) / 1e18:.4f} ETH")
PY
echo "Target:   ${TARGET_ETH} ETH for validators 0..$((COUNT - 1)) (effective-balance cap ${CAP_ETH} ETH)"
echo "Churn:    $(format_gwei "${CHURN_GWEI}") ETH per epoch after a deposit's slot is finalized"
echo "Order:    one validator at a time. The next deposit is sent only after this balance reaches ${TARGET_ETH} ETH."

POLL_SECONDS="${SECONDS_PER_SLOT}"

for ((index = 0; index < COUNT; index++)); do
  snapshot_validator "${index}"
  balance_eth="$(format_gwei "${BALANCE_GWEI}")"
  if [[ "${NEED_GWEI}" == "0" ]]; then
    echo "Validator ${INDEX} already has ${balance_eth} ETH; skipping."
    continue
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    if deposit_is_unsettled; then
      print_wait_status
      echo "  dry-run: no new deposit would be sent."
      continue
    fi
    echo "Validator ${INDEX}: ${balance_eth} ETH -> deposit $(format_gwei "${NEED_GWEI}") ETH"
    build_deposit
    gas="$(
      cast estimate --rpc-url "${EL_URL}" --from "${SENDER}" "${DEPOSIT}" \
        "deposit(bytes,bytes,bytes,bytes32)" \
        "0x${DEPOSIT_PUBKEY}" \
        "0x${DEPOSIT_CREDS}" \
        "0x${DEPOSIT_SIG}" \
        "0x${DEPOSIT_ROOT}" \
        --value "${DEPOSIT_WEI}"
    )"
    echo "  validator ${INDEX} dry-run gas estimate: ${gas}"
    continue
  fi

  validator_timeout="$(validator_timeout_seconds)"
  deadline=$((SECONDS + validator_timeout))
  if deposit_is_unsettled; then
    echo "Validator ${INDEX}: ${balance_eth} ETH. A deposit is already in progress. Waiting up to ${validator_timeout}s for the balance to reach ${TARGET_ETH} ETH."
  else
    echo "Validator ${INDEX}: ${balance_eth} ETH -> deposit $(format_gwei "${NEED_GWEI}") ETH. Waiting up to ${validator_timeout}s for finalization before the next validator."
  fi

  bumped=0
  mempool_since=""
  mempool_head=""
  while true; do
    snapshot_validator "${index}"
    if [[ "${NEED_GWEI}" == "0" ]]; then
      echo "Validator ${INDEX} reached $(format_gwei "${BALANCE_GWEI}") ETH."
      break
    fi
    if [[ "${SECONDS}" -ge "${deadline}" ]]; then
      echo "Validator ${INDEX} did not reach ${TARGET_ETH} ETH within ${validator_timeout}s (balance $(format_gwei "${BALANCE_GWEI}") ETH)." >&2
      echo "Later validators were not funded. Re-run the same command to continue." >&2
      exit 1
    fi

    if [[ "${PENDING_NONCE}" -gt "${CONFIRMED_NONCE}" ]]; then
      if [[ -z "${mempool_since}" ]]; then
        mempool_since="${SECONDS}"
        mempool_head="${HEAD_BLOCK}"
      fi
      waited=$((SECONDS - mempool_since))
      # Only replace a pending transaction after blocks have actually moved.
      # A quiet mempool on block 0 is waiting for the chain, not underpriced.
      if [[ "${bumped}" == "0" && "${waited}" -ge "$((SECONDS_PER_SLOT * 8))" && "${HEAD_BLOCK}" -gt "${mempool_head}" ]]; then
        bumped=1
        replace_underpriced
        mempool_since=""
        mempool_head=""
        sleep "${POLL_SECONDS}"
        continue
      fi
      print_wait_status
      sleep "${POLL_SECONDS}"
      continue
    fi
    mempool_since=""

    if deposit_is_unsettled; then
      print_wait_status
      sleep "${POLL_SECONDS}"
      continue
    fi

    build_deposit
    snapshot_validator "${index}"
    if [[ "${NEED_GWEI}" == "0" ]]; then
      echo "Validator ${INDEX} reached $(format_gwei "${BALANCE_GWEI}") ETH."
      break
    fi
    if deposit_is_unsettled; then
      print_wait_status
      sleep "${POLL_SECONDS}"
      continue
    fi

    have="$(cast balance --rpc-url "${EL_URL}" "${SENDER}")"
    python3 - "${DEPOSIT_WEI}" "${have}" "${INDEX}" <<'PY'
import sys
need, have, index = sys.argv[1:]
if int(need) >= int(have):
    sys.exit(f"Sender does not have enough ETH for validator {index}.")
PY

    if send_deposit "${PENDING_NONCE}"; then
      echo "  validator ${INDEX} tx ${TX_HASH}"
      sleep "${POLL_SECONDS}"
      continue
    fi

    if grep -qi "transaction indexing is in progress\|Timed out waiting for receipt" "${WORKDIR}/send.err"; then
      echo "Validator ${INDEX}: execution client is still indexing transactions or the deposit is not mined yet. Waiting."
      sleep "${POLL_SECONDS}"
      continue
    fi

    if grep -qi "replacement transaction underpriced\|already known\|nonce too low" "${WORKDIR}/send.err"; then
      if [[ "${bumped}" == "0" ]]; then
        bumped=1
        replace_underpriced
      else
        echo "Validator ${INDEX}: still waiting for nonce ${CONFIRMED_NONCE} to be mined."
      fi
      sleep "${POLL_SECONDS}"
      continue
    fi

    echo "Deposit transaction for validator ${INDEX} failed:" >&2
    cat "${WORKDIR}/send.err" >&2
    exit 1
  done
done

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "Dry run only. Re-run without --dry-run to submit the deposits."
  exit 0
fi

echo "Validators 0..$((COUNT - 1)) have beacon balances of at least ${TARGET_ETH} ETH."
