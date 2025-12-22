#!/usr/bin/env python3
"""
WEIGHTED PoS Experiment
Experiment with the WEIGHTED Proof-of-Stake algorithm
"""

import sys
import os
import random
import numpy as np
import csv
import matplotlib.pyplot as plt
from datetime import datetime

# Add src and experiments to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "src"))
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from parameters import Parameters, PoS, Distribution, NewEntry
from utils import generate_peers, gini
from detailed_tracker import simulate_with_detailed_tracking
from experiment_utils import (
    get_experiment_config,
)


def run_weighted_experiment(starting_gini=0.3, n_epochs=20000):
    """Run WEIGHTED PoS experiment"""
    print("WEIGHTED PoS EXPERIMENT")
    print("=" * 50)

    # Set parameters
    params = Parameters(
        n_epochs=n_epochs,
        initial_stake_volume=10000,
        initial_distribution=Distribution.RANDOM,
        n_peers=100,
        n_corrupted=5,
        p_fail=0.5,
        p_join=0.001,
        p_leave=0.001,
        join_amount=NewEntry.NEW_MAX,
        penalty_percentage=0.5,
        reward=20.0,
        use_dynamic_reward=True,
        scheduled_joins=None,
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

    # Run simulation with detailed tracking
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

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    results_dir = os.path.join(os.path.dirname(__file__), "..", "results")
    os.makedirs(results_dir, exist_ok=True)

    csv_filename = os.path.join(results_dir, f"weighted_results_{timestamp}.csv")
    with open(csv_filename, "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = [
            "epoch",
            "gini",
            "nakamoto",
            "nakamoto_liveness",
            "nakamoto_safety",
            "hhi",
            "zipf",
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        for epoch in range(len(gini_history)):
            writer.writerow(
                {
                    "epoch": epoch,
                    "gini": f"{gini_history[epoch]:.6f}",
                    "nakamoto": int(nakamoto_history[epoch]),
                    "nakamoto_liveness": int(nakamoto_liveness_history[epoch]),
                    "nakamoto_safety": int(nakamoto_safety_history[epoch]),
                    "hhi": f"{hhi_history[epoch]:.6f}",
                    "zipf": f"{zipf_history[epoch]:.6f}",
                }
            )

    print(f"✓ Saved results to: {csv_filename}")
    print(f"  Final Gini: {gini_history[-1]:.4f}")
    print(f"  Final Nakamoto: {nakamoto_history[-1]}")
    print(f"  Final Nakamoto Liveness: {nakamoto_liveness_history[-1]}")
    print(f"  Final Nakamoto Safety: {nakamoto_safety_history[-1]}")
    print(f"  Final HHI: {hhi_history[-1]:.4f}")
    print(f"  Final Zipf: {zipf_history[-1]:.4f}")

    base_filename = f"weighted_{timestamp}"

    # Plot 1: Gini Coefficient
    plt.figure(figsize=(12, 8))
    plt.plot(gini_history, linewidth=2, color="blue", alpha=0.8)
    plt.title("WEIGHTED PoS - Gini Coefficient", fontsize=16, fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("Gini Coefficient")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    gini_plot_path = os.path.join(results_dir, f"{base_filename}_gini.png")
    plt.savefig(gini_plot_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"✓ Saved Gini plot: {gini_plot_path}")
    plt.figure(figsize=(12, 8))
    plt.plot(nakamoto_history, linewidth=2, color="red", alpha=0.8)
    plt.title("WEIGHTED PoS - Nakamoto Coefficient", fontsize=16, fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("Nakamoto Coefficient")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    nakamoto_plot_path = os.path.join(results_dir, f"{base_filename}_nakamoto.png")
    plt.savefig(nakamoto_plot_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"✓ Saved Nakamoto plot: {nakamoto_plot_path}")
    plt.figure(figsize=(12, 8))
    plt.plot(nakamoto_liveness_history, linewidth=2, color="green", alpha=0.8)
    plt.title("WEIGHTED PoS - Nakamoto Liveness", fontsize=16, fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("Nakamoto Liveness")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    liveness_plot_path = os.path.join(
        results_dir, f"{base_filename}_nakamoto_liveness.png"
    )
    plt.savefig(liveness_plot_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"✓ Saved Nakamoto Liveness plot: {liveness_plot_path}")
    plt.figure(figsize=(12, 8))
    plt.plot(nakamoto_safety_history, linewidth=2, color="purple", alpha=0.8)
    plt.title("WEIGHTED PoS - Nakamoto Safety", fontsize=16, fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("Nakamoto Safety")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    safety_plot_path = os.path.join(results_dir, f"{base_filename}_nakamoto_safety.png")
    plt.savefig(safety_plot_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"✓ Saved Nakamoto Safety plot: {safety_plot_path}")
    plt.figure(figsize=(12, 8))
    plt.plot(hhi_history, linewidth=2, color="orange", alpha=0.8)
    plt.title("WEIGHTED PoS - HHI Coefficient", fontsize=16, fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("HHI Coefficient")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    hhi_plot_path = os.path.join(results_dir, f"{base_filename}_hhi.png")
    plt.savefig(hhi_plot_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"✓ Saved HHI plot: {hhi_plot_path}")
    plt.figure(figsize=(12, 8))
    plt.plot(zipf_history, linewidth=2, color="brown", alpha=0.8)
    plt.title("WEIGHTED PoS - Zipf Coefficient", fontsize=16, fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("Zipf Coefficient")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    zipf_plot_path = os.path.join(results_dir, f"{base_filename}_zipf.png")
    plt.savefig(zipf_plot_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"✓ Saved Zipf plot: {zipf_plot_path}")

    return {
        "csv_file": csv_filename,
        "plots": {
            "gini": gini_plot_path,
            "nakamoto": nakamoto_plot_path,
            "nakamoto_liveness": liveness_plot_path,
            "nakamoto_safety": safety_plot_path,
            "hhi": hhi_plot_path,
            "zipf": zipf_plot_path,
        },
        "final_gini": float(gini_history[-1]),
        "final_nakamoto": int(nakamoto_history[-1]),
        "final_nakamoto_liveness": int(nakamoto_liveness_history[-1]),
        "final_nakamoto_safety": int(nakamoto_safety_history[-1]),
        "final_hhi": float(hhi_history[-1]),
        "final_zipf": float(zipf_history[-1]),
    }


def main():
    """Run WEIGHTED PoS experiment"""
    # Set random seed for reproducibility
    random.seed(42)
    np.random.seed(42)

    try:
        # Get configuration from user
        starting_gini, n_epochs = get_experiment_config()

        # Run experiment
        result = run_weighted_experiment(starting_gini, n_epochs)

        print(f"\n✓ Experiment completed!")
        print(f"  CSV file: {result['csv_file']}")
        print(f"  Plots saved:")
        for plot_name, plot_path in result["plots"].items():
            print(f"    - {plot_name}: {plot_path}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    main()
