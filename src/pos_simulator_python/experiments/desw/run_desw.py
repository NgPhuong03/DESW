#!/usr/bin/env python3
"""
DESW PoS Experiment
Experiment with the DESW (Dynamic Exponential Stake Weighting) algorithm
"""

import sys
import os
import random
import csv
from datetime import datetime

import numpy as np
import matplotlib.pyplot as plt

# Add src and experiments to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "src"))
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from parameters import Parameters, PoS, Distribution, NewEntry
from utils import generate_peers, gini
from detailed_tracker import simulate_with_detailed_tracking
from experiment_utils import get_experiment_config


def run_desw_experiment(starting_gini=0.3, n_epochs=20000, pmin=0.1, pmax=0.6):
    """Run DESW PoS experiment"""
    print("DESW PoS EXPERIMENT")
    print("=" * 50)
    print(f"pmin={pmin}, pmax={pmax}")

    joins = [(5000, 10000), (15000, 50000)]

    # Set parameters
    params = Parameters(
        n_epochs=n_epochs,
        proof_of_stake=PoS.DESW,
        initial_stake_volume=30000,
        initial_distribution=Distribution.RANDOM,
        n_peers=5000,
        n_corrupted=50,
        p_fail=0.3,
        p_join=0.001,
        p_leave=0.001,
        join_amount=NewEntry.NEW_MAX,
        penalty_percentage=0.3,
        reward=20.0,
        use_dynamic_reward=True,
        scheduled_joins=joins,
        scheduled_sybil_attacks=None,
        p_sybil=0.0,
        min_sybil_size=2,
        max_sybil_size=5,
    )

    # Generate initial stakes
    stakes = generate_peers(
        params.n_peers,
        params.initial_stake_volume,
        params.initial_distribution,
        starting_gini,
    )

    # Create corrupted peers
    corrupted = random.sample(range(params.n_peers), params.n_corrupted)

    print(
        f"Initial Gini: {gini(stakes):.3f}, Peers: {len(stakes)}, Epochs: {params.n_epochs}"
    )

    # Run simulation with detailed tracking (pmin/pmax are module-level in simulator)
    (
        gini_history,
        peers_history,
        nakamoto_history,
        hhi_history,
        nakamoto_liveness_history,
        nakamoto_liveness_pct_history,
        nakamoto_safety_history,
        nakamoto_safety_pct_history,
        theil_history,
        zipf_history,
        palma_history,
        shannon_history,
        _,
        _,
        _,
        _,
    ) = simulate_with_detailed_tracking(
        stakes.copy(), corrupted.copy(), params, compute_shapley=False
    )

    final_gini = gini_history[-1]
    final_nakamoto = nakamoto_history[-1]
    final_nakamoto_liveness = nakamoto_liveness_history[-1]
    final_nakamoto_safety = nakamoto_safety_history[-1]
    final_hhi = hhi_history[-1]
    final_zipf = zipf_history[-1]

    print("=== Final metrics (last epoch) ===")
    print(f"  Final Gini: {final_gini:.4f}")
    print(f"  Final Nakamoto: {final_nakamoto}")
    print(f"  Final Nakamoto Liveness: {final_nakamoto_liveness}")
    print(f"  Final Nakamoto Safety: {final_nakamoto_safety}")
    print(f"  Final HHI: {final_hhi:.4f}")
    print(f"  Final Zipf: {final_zipf:.4f}")


if __name__ == "__main__":
    cfg = get_experiment_config()

    if isinstance(cfg, tuple):
        starting_gini, n_epochs = cfg
        pmin = 0.1
        pmax = 0.6
    else:
        starting_gini = cfg.get("starting_gini", 0.3)
        n_epochs = cfg.get("n_epochs", 20000)
        pmin = cfg.get("pmin", 0.1)
        pmax = cfg.get("pmax", 0.6)

    run_desw_experiment(
        starting_gini=starting_gini,
        n_epochs=n_epochs,
        pmin=pmin,
        pmax=pmax,
    )
