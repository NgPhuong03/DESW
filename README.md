# DESW

This repository contains the **research implementation** used in our research paper: **""**.

The codebase includes a comprehensive PoS (Proof-of-Stake) simulation framework, real-world blockchain analysis tools, and a web-based analyzer application. This setup enables reproducibility of our experimental results and facilitates further research in PoS consensus mechanism optimization and decentralization analysis.

## 🔬 Key Research Contributions

**DESW (Dynamic Exponential Stake Weighting)**: A novel PoS consensus algorithm that dynamically adjusts validator selection probabilities based on stake distribution, aiming to improve decentralization metrics while maintaining network security and efficiency.

**Multi-Algorithm Comparison Framework**: Comprehensive simulation and benchmarking framework comparing DESW against traditional PoS algorithms (Weighted, Log-Weighted/LSW, Square-Root-Stake-Weighted/SRSW) across various decentralization metrics including Gini coefficient, Nakamoto coefficient, HHI, and more.

**Real-World Blockchain Analysis**: Automated analysis pipeline for extracting and evaluating decentralization metrics from multiple live blockchain networks (Ethereum, Aptos, Axelar, Celestia, Celo, Injective, Polygon, Sui), enabling empirical validation of theoretical findings.

**PoS-Analyzer Web Tool**: An interactive web application for visualizing simulation results, comparing algorithm performance, and analyzing decentralization trends across different stake distributions and network conditions.

## 📋 Table of Contents

- [Project Overview](#project-overview)
  - [PoS Simulator](#pos-simulator)
  - [Real-World Analysis](#real-world-analysis)
  - [PoS-Analyzer Tools](#pos-analyzer-tools)
  - [Ethereum Testnet Implementation](#ethereum-testnet-implementation)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
  - [PoS Simulator](#pos-simulator-1)
  - [Real-World Analysis](#real-world-analysis-1)
  - [PoS-Analyzer Web Tool](#pos-analyzer-web-tool)
  - [Ethereum Testnet](#ethereum-testnet)
- [Configuration](#configuration)
- [Decentralization Metrics](#decentralization-metrics)
- [Project Structure](#project-structure)
- [Additional Documentation](#additional-documentation)

<a id="project-overview"></a>

## Project Overview

<a id="pos-simulator"></a>

### PoS Simulator

The PoS Simulator (`src/pos_simulator_python/`) provides a flexible Python-based framework for simulating various Proof-of-Stake consensus algorithms:

- **Multiple PoS Algorithms**: Supports Weighted, Log-Weighted (LSW), Square-Root-Stake-Weighted (SRSW), DESW, and baseline algorithms
- **Comprehensive Metrics**: Calculates Gini coefficient, Nakamoto coefficient (liveness & safety), HHI coefficient, Zipf coefficient,...
- **Dynamic Simulation**: Models peer joining/leaving, sybil attacks, stake dynamics, and reward distribution
- **Benchmarking Tools**: Automated benchmarking and comparison across algorithms with configurable parameters
- **Visualization**: Generates heatmaps, comparison charts, and performance plots

<a id="real-world-analysis"></a>

### Real-World Analysis

The Real-World Analysis tool (`src/RealWorld-Analysis/`) enables empirical validation by analyzing live blockchain networks:

- **Multi-Chain Support**: Fetches validator data from Ethereum, Aptos, Axelar, Celestia, Celo, Injective, Polygon, and Sui
- **Decentralization Metrics**: Computes comprehensive decentralization metrics for each blockchain
- **Comparative Analysis**: Generates comparison visualizations across multiple chains and time periods
- **Data Persistence**: Stores historical validator data and analysis results for trend analysis
- **Automated Reporting**: Produces CSV reports and visualization charts for research documentation

<a id="pos-analyzer-tools"></a>

### PoS-Analyzer Tools

The PoS-Analyzer web application (`src/srcDemo/`) provides an interactive interface for simulation and analysis:

- **Frontend**: React-based UI with Chart.js and Recharts for interactive visualizations
- **Backend**: Node.js/Express API with MongoDB for storing simulation results and configurations
- **Simulation Management**: Create, run, and compare PoS simulations with custom parameters
- **Result Visualization**: Interactive charts and graphs for analyzing algorithm performance
- **Export Capabilities**: Download simulation results and metrics for further analysis

<a id="ethereum-testnet-implementation"></a>

### Ethereum Testnet Implementation

The Ethereum testnet setup (`src/eth-testnet/`) includes implementations of different PoS variants:

- **Lighthouse Clients**: Rust-based Ethereum consensus clients modified for DESW, LSW, and SRSW algorithms
- **Dora Explorers**: Go-based blockchain explorers customized for each PoS variant
- **Network Orchestration**: Docker-based deployment scripts for running multi-node testnets
- **Parameter Configuration**: YAML-based configuration files for different PoS profiles

<a id="getting-started"></a>

## 🚀 Getting Started

<a id="prerequisites"></a>

### Prerequisites

Before setting up the project, ensure you have the following installed:

**System Requirements:**

- Python 3.8 or higher
- Node.js v16 or higher
- Git
- Docker and Docker Compose (for testnet setup)
- Rust toolchain (for Lighthouse clients)
- Go 1.19+ (for Dora explorers)

**Memory Requirements:**

- 8GB+ RAM recommended for simulations
- 16GB+ RAM for running Ethereum testnet

<a id="installation"></a>

### 📦 Installation

1. **Clone the Repository**

   ```bash
   git clone <repository-url>
   cd DESW
   ```

2. **Install PoS Simulator Dependencies**

   ```bash
   cd src/pos_simulator_python
   pip install -r requirements.txt
   ```

3. **Install Real-World Analysis Dependencies**

   ```bash
   cd ../RealWorld-Analysis
   pip install -r requirements.txt
   ```

4. **Install PoS-Analyzer Backend**

   ```bash
   cd ../srcDemo/backend
   npm install
   ```

5. **Install PoS-Analyzer Frontend**

   ```bash
   cd ../frontend
   npm install
   ```

6. **Verify Installation**

   ```bash
   python --version
   node --version
   docker --version
   ```

<a id="usage"></a>

## 💻 Usage

<a id="pos-simulator-1"></a>

### PoS Simulator

#### Running Basic Simulations

Navigate to the simulator directory:

```bash
cd src/pos_simulator_python
```

Run a simple simulation experiment:

```bash
python experiments/comparison.py
```

#### Running Benchmark Experiments

Execute comprehensive algorithm benchmarks:

```bash
cd benchmark
python benchmark_algorithms.py
```

This will generate comparison results in `benchmark/results/` directory.

<a id="real-world-analysis-1"></a>

### Real-World Analysis

#### Fetching Validator Data

Run the main analysis script to fetch validator data from all supported blockchains:

```bash
cd src/RealWorld-Analysis
python main.py
```

This will:

- Fetch validator data for all configured blockchains
- Save data to `data/` directory with timestamp
- Display progress and completion status

#### Analyzing Metrics

Calculate decentralization metrics for a specific date:

```python
from analysis.metrics import BlockchainDecentralizationMetrics

# Calculate metrics for a specific date
metrics = BlockchainDecentralizationMetrics.calculate_metrics("19122025")
```

#### Generating Visualizations

Generate comparison charts:

```python
from analysis.metrics import BlockchainDecentralizationMetrics

# Generate Gini index comparison
BlockchainDecentralizationMetrics.plot_gini_comparison("19122025")

# Generate Nakamoto coefficient comparison
BlockchainDecentralizationMetrics.plot_nakamoto_comparison("19122025")

# Generate HHI comparison
BlockchainDecentralizationMetrics.plot_hhi_comparison("19122025")
```

<a id="pos-analyzer-web-tool"></a>

### PoS-Analyzer Web Tool

#### Starting the Backend

```bash
cd src/srcDemo/backend
npm run dev
```

The backend API will run on `http://localhost:5000` (or port specified in environment variables).

#### Starting the Frontend

```bash
cd src/srcDemo/frontend
npm start
```

The frontend will run on `http://localhost:3000` and automatically open in your browser.

#### Using the Web Interface

1. Navigate to the web application
2. Create a new simulation with custom parameters
3. Select PoS algorithms to compare
4. Configure stake distribution and network parameters
5. Run simulation and view results
6. Export results for further analysis

<a id="ethereum-testnet"></a>

### Ethereum Testnet

#### Building Docker Images

Build Lighthouse and Dora images for all variants:

```bash
cd src/eth-testnet

# Build Lighthouse clients
./build_lighthouses.sh

# Build Dora explorers
./build_doras.sh
```

#### Running a Testnet

Start a testnet with a specific PoS profile:

```bash
./run_network.sh DESW my-testnet-name
# or
./run_network.sh LSW my-testnet-name
# or
./run_network.sh SRSW my-testnet-name
```

This will:

- Start Lighthouse validators with the specified PoS algorithm
- Deploy Dora explorer instances
- Configure network parameters from `params/` directory
- Display network status and endpoints

#### Cleaning Up

Remove all Docker containers and images:

```bash
./cleanup_images.sh
```

<a id="configuration"></a>

## ⚙️ Configuration

### PoS Simulator Configuration

Modify simulation default parameters in `src/pos_simulator_python/src/parameters.py`:

```python
@dataclass
class Parameters:
    pos: PoS = PoS.DESW
    distribution: Distribution = Distribution.GINI
    num_peers: int = 100
    simulation_steps: int = 1000
    # ... other parameters
```

### Real-World Analysis Configuration

Configure blockchain endpoints and API keys in individual chain modules (`src/RealWorld-Analysis/chains/`):

```python
# Example: chains/ethereum.py
class Ethereum:
    RPC_ENDPOINT = "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
    # ... other configuration
```

### PoS-Analyzer Configuration

Backend configuration via environment variables (see `src/srcDemo/backend/env.example`):

```bash
MONGODB_URI=mongodb://localhost:27017/pos-analyzer=
PORT=5000
CORS_ORIGIN=http://localhost:3000
DUNE_API_KEY = Hwnorwbb
```

### Testnet Configuration

Modify testnet parameters in YAML files (`src/eth-testnet/params/`):

- `paramsDESW.yaml` - DESW algorithm parameters
- `paramsLSW.yaml` - Log-Weighted algorithm parameters
- `paramsSRSW.yaml` - Square-Root-Stake-Weighted parameters
- `paramsDF.yaml` - Default parameters

<a id="decentralization-metrics"></a>

## 📈 Decentralization Metrics

The PoS Simulator tracks comprehensive metrics for algorithm comparison:

- **Gini Coefficient**: Measures stake distribution inequality (0 = perfect equality, 1 = perfect inequality)
- **Nakamoto Coefficient**: Minimum number of entities controlling >33% (liveness) or >66% (safety) of stake
- **HHI (Herfindahl-Hirschman Index)**: Measures market concentration
- **Zipf Coefficient**: Characterizes power-law distribution in stake allocation

<a id="project-structure"></a>

## 🗂️ Project Structure

```
DESW/
├── src/                           # Main source code directory
│   ├── pos_simulator_python/      # PoS Simulator Python implementation
│   │   ├── src/                   # Core simulator modules
│   │   │   ├── simulator.py       # Main simulation engine
│   │   │   ├── parameters.py      # Parameter definitions
│   │   │   ├── utils.py           # Utility functions and metrics
│   │   │   └── ...
│   │   ├── experiments/           # Experiment scripts
│   │   ├── benchmark/             # Benchmarking tools
│   │   └── requirements.txt       # Python dependencies
│   ├── RealWorld-Analysis/        # Real-world blockchain analysis
│   │   ├── chains/                # Blockchain-specific modules
│   │   ├── analysis/              # Metrics calculation modules
│   │   ├── data/                  # Validator data storage
│   │   ├── results/               # Analysis results and visualizations
│   │   └── main.py                # Get data
│   ├── srcDemo/                   # PoS-Analyzer web application
│   │   ├── backend/               # Node.js backend API
│   │   │   ├── controllers/       # API controllers
│   │   │   ├── models/            # Data models
│   │   │   ├── routes/            # API routes
│   │   │   ├── services/          # Business logic
│   │   │   └── server.js          # Server entry point
│   │   └── frontend/              # React frontend
│   │       ├── src/               # React components
│   │       └── public/            # Static assets
│   └── eth-testnet/               # Ethereum testnet implementation
│       ├── lighthouses/           # Lighthouse client variants
│       ├── doras/                 # Dora explorer variants
│       ├── params/                # Testnet configuration files
│       ├── build_lighthouses.sh   # Build Docker images for Lighthouse consensus clients
│       ├── build_doras.sh         # Build Docker images for Dora blockchain explorers
│       └── run_network.sh         # Network orchestration script
├── README.md                      # Main documentation
└── .gitignore                     # Git ignore patterns
```

<a id="additional-documentation"></a>

## 📚 Additional Documentation

### Research Papers

- **Project Paper**: This project paper will be updated soon.
- **Algorithm Documentation**: Detailed algorithm descriptions and theoretical foundations are available in the research paper.

### External Resources

- [Ethereum Proof-of-Stake Documentation](https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/) - Comprehensive overview of Ethereum's PoS consensus mechanism
- [ethereum-package](https://github.com/ethpandaops/ethereum-package) - A Kurtosis package that deploys a private, portable, and modular Ethereum devnet
- [Lighthouse Documentation](https://lighthouse-book.sigmaprime.io/) - Official documentation for the Lighthouse Ethereum client
- [Dora Explorer](https://github.com/ethpandaops/dora) - Blockchain explorer framework documentation

### Related Projects

- [Original PoS Simulator (Julia)](https://github.com/lorenzorovida/PoS-Simulator) - Original Julia implementation

---

## 👥 Contributor

- 👑 Leader: M.Sc. IT. Võ Tấn Khoa
- 👨‍💻 Members: Luan Thach, Phuong Do
