#!/usr/bin/env python3
"""Pre-sign a small set of ETH transfers for a k6 finality benchmark.

Use only on a private/dev network with a dedicated funded account.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

from eth_account import Account


RPC_URL = os.environ.get("RPC_URL", "").strip()
PRIVATE_KEY = os.environ.get("PRIVATE_KEY", "").strip()
if not RPC_URL or not PRIVATE_KEY:
    sys.exit("Set RPC_URL and PRIVATE_KEY first (source .env with set -a).")

count = int(sys.argv[1]) if len(sys.argv) > 1 else 50
if not 1 <= count <= 100:
    sys.exit("Transaction count must be between 1 and 100")


def rpc(method, params=None):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method,
                          "params": params or []}).encode()
    req = urllib.request.Request(RPC_URL, data=payload,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as response:
        data = json.load(response)
    if data.get("error") or data.get("result") is None:
        raise RuntimeError(f"{method} failed: {data}")
    return data["result"]


account = Account.from_key(PRIVATE_KEY)
address = account.address
chain_id = int(rpc("eth_chainId"), 16)
nonce_latest = int(rpc("eth_getTransactionCount", [address, "latest"]), 16)
nonce_pending = int(rpc("eth_getTransactionCount", [address, "pending"]), 16)
if nonce_latest != nonce_pending:
    sys.exit(f"Sender account already has pending transactions "
             f"(latest nonce={nonce_latest}, pending nonce={nonce_pending}). "
             "Wait until drained or use a dedicated funded key.")

price_env = os.environ.get("GAS_PRICE_WEI", "").strip()
gas_price = int(price_env) if price_env else int(rpc("eth_gasPrice"), 16)
if gas_price <= 0:
    sys.exit("Invalid gas price; set GAS_PRICE_WEI to a positive number")

balance = int(rpc("eth_getBalance", [address, "latest"]), 16)
needed = count * 21000 * gas_price
if balance < needed:
    sys.exit(f"Insufficient balance: {balance} wei, need at least {needed} wei")

raw_txs = []
for i in range(count):
    tx = {
        "chainId": chain_id,
        "nonce": nonce_pending + i,
        "gas": 21000,
        "gasPrice": gas_price,
        "to": address,
        "value": 0,
    }
    signed = Account.sign_transaction(tx, PRIVATE_KEY)
    raw = signed.raw_transaction.hex()
    raw_txs.append({"nonce": tx["nonce"], "raw": "0x" + (raw[2:] if raw.startswith("0x") else raw)})

if len(sys.argv) > 2:
    out_arg = Path(sys.argv[2])
    out = out_arg / "finality_txs.json" if out_arg.is_dir() else out_arg
else:
    out = Path(__file__).with_name("finality_txs.json")

out.write_text(json.dumps(raw_txs, indent=2) + "\n")
out.chmod(0o600)

print(f"Prepared {count} signed transfers for chain {chain_id}")
print(f"Sender: {address}")
print(f"Nonces: {nonce_pending}..{nonce_pending + count - 1}")
print(f"Gas price: {gas_price} wei")
print(f"File: {out}")
print("No transactions have been broadcast yet. Run k6 to send them.")
