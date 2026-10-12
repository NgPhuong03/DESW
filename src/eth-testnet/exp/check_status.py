#!/usr/bin/env python3
import json
import urllib.request

nets = [
  ("DF", 33242, 33257),
  ("SRSW", 33272, 33287),
  ("LSW", 33302, 33317),
  ("DESW", 33332, 33347)
]

def rpc(port, method, params=None):
    if params is None:
        params = []
    try:
        url = f"http://127.0.0.1:{port}"
        payload = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.load(resp)
            return data.get("result")
    except Exception as e:
        return f"err: {e}"

def cl(port, path):
    try:
        url = f"http://127.0.0.1:{port}{path}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.load(resp)
            return data.get("data")
    except Exception as e:
        return None

print(f"{'Network':<8} | {'Slot':<6} | {'Epoch':<6} | {'Finalized Epoch':<16} | {'Block':<8} | {'Finalized Block':<16} | {'TxPool Pending'}")
print("-" * 88)

for name, el_p, cl_p in nets:
    cur_block = rpc(el_p, "eth_blockNumber")
    fin_block = rpc(el_p, "eth_getBlockByNumber", ["finalized", False])
    fin_num = fin_block.get("number") if isinstance(fin_block, dict) else fin_block
    txp = rpc(el_p, "txpool_status")
    
    cl_head = cl(cl_p, "/eth/v1/beacon/headers/head")
    cl_fin = cl(cl_p, "/eth/v1/beacon/states/head/finality_checkpoints")
    
    slot = cl_head.get("header", {}).get("message", {}).get("slot") if cl_head else "N/A"
    epoch = str(int(slot) // 32) if str(slot).isdigit() else "N/A"
    fin_epoch = cl_fin.get("finalized", {}).get("epoch") if cl_fin else "N/A"
    
    cb_dec = str(int(cur_block, 16)) if str(cur_block).startswith("0x") else str(cur_block)
    fb_dec = str(int(fin_num, 16)) if str(fin_num).startswith("0x") else str(fin_num)
    pending = txp.get("pending", "0") if isinstance(txp, dict) else "N/A"
    
    print(f"{name:<8} | {str(slot):<6} | {epoch:<6} | {str(fin_epoch):<16} | {cb_dec:<8} | {fb_dec:<16} | {pending}")
