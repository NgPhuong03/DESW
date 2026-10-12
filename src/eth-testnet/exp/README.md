# Ethereum Testnet Performance Benchmarking (`exp`)

Benchmarking suite for measuring transaction throughput, smart contract deployment, and block finality latency across Proof-of-Stake (PoS) testnet variants:
- **Baseline / DF**
- **SRSW**
- **LSW**
- **DESW**

All results, logs, and analytics are automatically organized inside the [`result/`](file:///home/student22/nguyenphuong/desw/DESW/src/eth-testnet/exp/result) directory.

---

## 1. Prerequisites

### A. Polycli (Load Testing)
Install `polycli` (from [0xPolygon/polygon-cli](https://github.com/0xPolygon/polygon-cli)):
```bash
git clone https://github.com/0xPolygon/polygon-cli.git
cd polygon-cli
git checkout v0.1.121
make install
export PATH="$HOME/go/bin:$PATH"
polycli version
```

### B. k6 (Finality Benchmarking)
Install the `k6` load testing tool:
```bash
curl -fsSL https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install -y k6
```

### C. Python Environment
Install `eth-account` and dependencies for transaction signing:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install eth-account web3
```

---

## 2. Configuration (`networks.env`)

Configure your testnet RPC endpoints and funded private keys in [`networks.env`](file:///home/student22/nguyenphuong/desw/DESW/src/eth-testnet/exp/networks.env):

```bash
cp networks.env.example networks.env
```

Format: `MODEL|ENCLAVE_NAME|RPC_URL|PRIVATE_KEY`
```env
DF|my-df-net|http://127.0.0.1:32864|c5114526e042343c6d1899cad05e1c00ba588314de9b96929914ee0df18d46b2
SRSW|my-srsw-net|http://127.0.0.1:32894|c5114526e042343c6d1899cad05e1c00ba588314de9b96929914ee0df18d46b2
LSW|my-lsw-net|http://127.0.0.1:32924|c5114526e042343c6d1899cad05e1c00ba588314de9b96929914ee0df18d46b2
DESW|my-desw-net|http://127.0.0.1:32954|c5114526e042343c6d1899cad05e1c00ba588314de9b96929914ee0df18d46b2
```

---

## 3. Network Stabilization & Health Verification

> [!IMPORTANT]
> **Allow 10–15 minutes (approx. 2–3 epochs) after starting the testnets before launching benchmarks.**
>
> In an Ethereum PoS network, validators need time to establish peer connections, propose blocks, and transition through the initial epochs to produce the first **Finalized Checkpoint** under Casper FFG. Initiating benchmarks prematurely may cause transaction rejection or finality test timeouts.

You can verify the readiness of all 4 testnets using the included status check script:
```bash
python3 check_status.py
```

**Checklist before benchmarking:**
- [x] **Slot & Epoch**: Actively incrementing (Slot > 64, Epoch >= 2).
- [x] **Finalized Epoch**: Successfully advanced past Genesis (not `N/A`).
- [x] **TxPool Pending**: Empty (`0`), indicating the network is idle and ready for load testing.

---

## 4. Running Benchmarks

### Option A: Run a Single Network (`run_one.sh`)
Run tests for a specific network model:
```bash
# Run all workloads (transfer + deploy + finality)
./run_one.sh DESW

# Or specify specific workloads
./run_one.sh DESW transfer
./run_one.sh DESW finality
./run_one.sh DESW transfer finality
```

### Option B: Run All Networks Sequentially (`run_all.sh`)
Iterate through all networks configured in `networks.env`:
```bash
# Run all workloads across all networks
./run_all.sh

# Run only transfer workload across all networks
./run_all.sh transfer

# Run only finality workload across all networks
./run_all.sh finality
```

### Option C: Run All Networks in Parallel (tmux)
Run each testnet benchmark concurrently in independent tmux sessions:
```bash
tmux new-session -d -s df -c "$(pwd)" "./run_one.sh DF; bash"
tmux new-session -d -s srsw -c "$(pwd)" "./run_one.sh SRSW; bash"
tmux new-session -d -s lsw -c "$(pwd)" "./run_one.sh LSW; bash"
tmux new-session -d -s desw -c "$(pwd)" "./run_one.sh DESW; bash"

# Attach to inspect a session
tmux attach -t desw    # Detach with: Ctrl+B then D

# List active sessions
tmux ls

# Terminate all sessions
tmux kill-server
```

---

## 5. Benchmark Workloads & Outputs

| Workload | Runner | Description | Primary Outputs |
| :--- | :--- | :--- | :--- |
| **Transfer** | `run_transfer.sh` | 2,000 ETH transfers at 200 tx/s | `config.txt`, `started-at.txt`, `finished-at.txt`, `exit-code.txt` |
| **Deploy** | `run_deploy.sh` | 2,000 contract deployments at 200 tx/s | `config.txt`, `started-at.txt`, `finished-at.txt`, `exit-code.txt` |
| **Finality** | `run_finality.sh` | 10 pre-signed transactions tracked to PoS finality | `finality_summary.json`, `finality_txs.json`, `exit-code.txt` |

*Note: Heavy raw `.log` files are not written to disk to prevent storage bloat. All load testing progress is streamed directly to stdout in the terminal / tmux session.*

---

## 6. Directory Structure

```
exp/
├── networks.env          # Testnet endpoints & keys
├── networks.env.example  # Configuration template
├── check_status.py       # Multi-network status & finality checker
├── run_one.sh            # Benchmark runner for a single model
├── run_all.sh            # Benchmark runner across all models
├── run_transfer.sh       # Transfer workload script (polycli)
├── run_deploy.sh         # Deployment workload script (polycli)
├── run_finality.sh       # Block finality workload script (k6)
├── common.sh             # Shared load testing utilities
├── prepare_finality.py   # Pre-signs test transactions
├── finality.js           # k6 test script for finality verification
├── README.md             # Documentation
└── result/               # Output directories
    ├── <MODEL>_transfer_<TIMESTAMP>/
    ├── <MODEL>_deploy_<TIMESTAMP>/
    └── <MODEL>_finality_<TIMESTAMP>/
```
