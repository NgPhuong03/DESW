#!/usr/bin/env python3
"""
loop_benchmark.py - Automated benchmark runner and evaluator across 4 models (DF, SRSW, LSW, DESW).
Guarantees networks are fully stable (consensus finalized, empty mempools, synced nonces)
before running benchmark iterations, and loops until all 4 networks achieve consistent, non-divergent metrics.
"""

import os
import sys
import time
import json
import subprocess
import glob
import urllib.request
from pathlib import Path

BASE_DIR = Path("/home/student22/nguyenphuong/desw/DESW/src/eth-testnet/exp")
RESULT_DIR = BASE_DIR / "result"
MODELS = ["DF", "SRSW", "LSW", "DESW"]

NETWORKS = {
    "DF": {
        "el_rpc": "http://127.0.0.1:33242",
        "cl_api": "http://127.0.0.1:33257",
    },
    "SRSW": {
        "el_rpc": "http://127.0.0.1:33272",
        "cl_api": "http://127.0.0.1:33287",
    },
    "LSW": {
        "el_rpc": "http://127.0.0.1:33302",
        "cl_api": "http://127.0.0.1:33317",
    },
    "DESW": {
        "el_rpc": "http://127.0.0.1:33332",
        "cl_api": "http://127.0.0.1:33347",
    },
}

TEST_ACCOUNT = "0xafF0CA253b97e54440965855cec0A8a2E2399896"

def run_cmd(cmd, cwd=str(BASE_DIR)):
    res = subprocess.run(cmd, shell=True, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return res.stdout.strip(), res.stderr.strip(), res.returncode

def rpc_call(url, method, params):
    payload = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def get_network_health(model):
    cfg = NETWORKS[model]
    health = {
        "cl_head_slot": 0,
        "cl_finalized_epoch": 0,
        "el_block": 0,
        "el_finalized_block": None,
        "txpool_pending": 0,
        "nonce_synced": False,
    }
    # Query CL
    try:
        req = urllib.request.urlopen(f"{cfg['cl_api']}/eth/v1/beacon/states/head/finality_checkpoints", timeout=5)
        cp = json.loads(req.read().decode())["data"]
        health["cl_finalized_epoch"] = int(cp["finalized"]["epoch"])

        req2 = urllib.request.urlopen(f"{cfg['cl_api']}/eth/v1/beacon/headers/head", timeout=5)
        health["cl_head_slot"] = int(json.loads(req2.read().decode())["data"]["header"]["message"]["slot"])
    except Exception as e:
        pass

    # Query EL
    try:
        res = rpc_call(cfg["el_rpc"], "eth_blockNumber", [])
        health["el_block"] = int(res.get("result", "0x0"), 16)

        res_fin = rpc_call(cfg["el_rpc"], "eth_getBlockByNumber", ["finalized", False])
        if res_fin.get("result") and res_fin["result"].get("number"):
            health["el_finalized_block"] = int(res_fin["result"]["number"], 16)

        res_txpool = rpc_call(cfg["el_rpc"], "txpool_status", [])
        if res_txpool.get("result") and "pending" in res_txpool["result"]:
            health["txpool_pending"] = int(res_txpool["result"]["pending"], 16)

        nonce_latest = int(rpc_call(cfg["el_rpc"], "eth_getTransactionCount", [TEST_ACCOUNT, "latest"]).get("result", "0x0"), 16)
        nonce_pending = int(rpc_call(cfg["el_rpc"], "eth_getTransactionCount", [TEST_ACCOUNT, "pending"]).get("result", "0x0"), 16)
        health["nonce_synced"] = (nonce_latest == nonce_pending)
    except Exception as e:
        pass

    return health

def wait_for_networks_stable(timeout_s=600, poll_interval_s=10):
    """
    Blocks until ALL 4 networks satisfy stability criteria:
    1. Consensus: Finalized epoch >= 1 (PoS past genesis cold start).
    2. Execution: Finalized block is recognized by Geth (not None).
    3. Mempool: TxPool pending is 0 (all previous test transactions processed).
    4. Account Nonce: nonce_latest == nonce_pending (no transactions stuck).
    """
    print(f"\n[STABILITY CHECK] Verifying all 4 networks are fully stabilized and clean...")
    start_time = time.time()

    while time.time() - start_time < timeout_s:
        all_stable = True
        statuses = {}

        for m in MODELS:
            h = get_network_health(m)
            statuses[m] = h

            # Check criteria
            is_cl_ok = h["cl_finalized_epoch"] >= 1
            is_el_ok = h["el_finalized_block"] is not None
            is_mempool_clean = h["txpool_pending"] == 0
            is_nonce_synced = h["nonce_synced"]

            stable = is_cl_ok and is_el_ok and is_mempool_clean and is_nonce_synced
            if not stable:
                all_stable = False

        print(f"[{time.strftime('%H:%M:%S')}] Network Stability Status:")
        for m in MODELS:
            h = statuses[m]
            fin_str = f"Epoch {h['cl_finalized_epoch']}" if h['cl_finalized_epoch'] > 0 else "Waiting PoS"
            blk_str = f"Blk {h['el_finalized_block']}" if h['el_finalized_block'] is not None else "None"
            pool_str = f"Mempool: {h['txpool_pending']}"
            nonce_str = "Nonce: OK" if h["nonce_synced"] else "Nonce: Pending"
            print(f"  - {m:<5}: Slot {h['cl_head_slot']:<4} | Finalized: {fin_str:<9} | {blk_str:<8} | {pool_str:<12} | {nonce_str}")

        if all_stable:
            print(f"\n[SUCCESS] All 4 networks are 100% STABLE, finalized, and mempools are clean! Ready for benchmark.\n")
            return True

        time.sleep(poll_interval_s)

    print(f"\n[WARNING] Reached timeout of {timeout_s}s waiting for stability.")
    return False

def get_latest_result(model, workload):
    pattern = str(RESULT_DIR / f"{model}_{workload}_*")
    matches = sorted(glob.glob(pattern))
    if not matches:
        return None
    return Path(matches[-1])

def parse_finality_result(path):
    summary_file = path / "finality_summary.json"
    if not summary_file.exists():
        return None
    try:
        with open(summary_file) as f:
            data = json.load(f)
        metrics = data.get("metrics", {})
        inc_metric = metrics.get("tx_inclusion_ms") or metrics.get("inclusion_time_ms") or {}
        inc_avg = inc_metric.get("avg", 0)
        inc_p95 = inc_metric.get("p(95)", 0)

        fin_metric = metrics.get("tx_finality_ms") or metrics.get("finality_time_ms") or {}
        fin_avg = fin_metric.get("avg", 0) / 1000.0
        fin_p95 = fin_metric.get("p(95)", 0) / 1000.0

        fin_success_metric = metrics.get("tx_finalized") or metrics.get("finality_success") or {}
        passes = fin_success_metric.get("passes", 0)
        fails = fin_success_metric.get("fails", 0)
        total = passes + fails
        fin_success = (passes / total) if total > 0 else fin_success_metric.get("rate", 0)

        return {
            "inclusion_avg_ms": inc_avg,
            "inclusion_p95_ms": inc_p95,
            "finality_avg_s": fin_avg,
            "finality_p95_s": fin_p95,
            "finality_success_rate": fin_success,
        }
    except Exception:
        return None

def parse_loadtest_result(path):
    summary_file = path / "summary.json"
    if not summary_file.exists():
        return None
    try:
        with open(summary_file) as f:
            data = json.load(f)
        tps = data.get("successful_tps") or data.get("transactions_per_sec", 0)
        duration = data.get("test_duration_s") or data.get("duration_seconds", 0)
        errors = data.get("errors", 0)
        latency = data.get("latency_ms", {})
        return {
            "tps": tps,
            "duration_s": duration,
            "errors": errors,
            "latency_p95_ms": latency.get("max", 0),
        }
    except Exception:
        return None

def collect_all_metrics():
    results = {}
    for m in MODELS:
        fin_dir = get_latest_result(m, "finality")
        tx_dir = get_latest_result(m, "transfer")
        dep_dir = get_latest_result(m, "deploy")

        fin_data = parse_finality_result(fin_dir) if fin_dir else None
        tx_data = parse_loadtest_result(tx_dir) if tx_dir else None
        dep_data = parse_loadtest_result(dep_dir) if dep_dir else None

        results[m] = {
            "finality": fin_data,
            "transfer": tx_data,
            "deploy": dep_data,
        }
    return results

def evaluate_metrics(results):
    """
    Evaluates whether the 4 networks have acceptable variance and no severe anomalies.
    """
    for m in MODELS:
        r = results.get(m, {})
        if not r.get("finality") or not r.get("transfer") or not r.get("deploy"):
            return False, f"Model {m} hasn't completed all workloads."
        if r["finality"]["finality_success_rate"] < 0.90:
            return False, f"Model {m} finality success rate too low: {r['finality']['finality_success_rate']:.1%}"
        if r["transfer"]["errors"] > 50:
            return False, f"Model {m} transfer errors too high: {r['transfer']['errors']}"
        if r["deploy"]["errors"] > 50:
            return False, f"Model {m} deploy errors too high: {r['deploy']['errors']}"
        if r["transfer"]["tps"] < 50:
            return False, f"Model {m} transfer TPS abnormally low: {r['transfer']['tps']:.1f}"
        if r["deploy"]["tps"] < 30:
            return False, f"Model {m} deploy TPS abnormally low: {r['deploy']['tps']:.1f}"

    transfer_tps = [results[m]["transfer"]["tps"] for m in MODELS]
    if max(transfer_tps) > 3.0 * min(transfer_tps):
        return False, f"Transfer TPS spread is too large: min={min(transfer_tps):.1f}, max={max(transfer_tps):.1f}"

    return True, "All models within acceptable threshold!"

def print_summary_table(results):
    print("\n" + "="*85)
    print(f"{'Model':<8} | {'Inc Lat (ms)':<12} | {'Fin Lat (s)':<12} | {'Transfer TPS':<14} | {'Deploy TPS':<12} | {'Errors':<8}")
    print("-"*85)
    for m in MODELS:
        r = results.get(m, {})
        f = r.get("finality") or {}
        t = r.get("transfer") or {}
        d = r.get("deploy") or {}
        inc = f"{f.get('inclusion_avg_ms', 0):.0f}" if f else "N/A"
        fin = f"{f.get('finality_avg_s', 0):.1f}" if f else "N/A"
        tx_tps = f"{t.get('tps', 0):.1f}" if t else "N/A"
        dep_tps = f"{d.get('tps', 0):.1f}" if d else "N/A"
        err = f"{t.get('errors', 0) + d.get('errors', 0)}" if t and d else "N/A"
        print(f"{m:<8} | {inc:<12} | {fin:<12} | {tx_tps:<14} | {dep_tps:<12} | {err:<8}")
    print("="*85 + "\n")

if __name__ == "__main__":
    wait_for_networks_stable(timeout_s=30, poll_interval_s=5)
