#!/usr/bin/env python3
"""
Simple example illustrating the Python implementation of the PoS Simulator
Compare 6 PoS algorithms with 2 metrics: Gini and Nakamoto Coefficient
"""

import sys
import os
import random
import numpy as np
import matplotlib.pyplot as plt
import json

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from parameters import Parameters, PoS, Distribution, NewEntry
from simulator import simulate
from utils import generate_peers, gini, HHI_coefficient
from experiment_utils import save_results_to_json, save_plot, create_and_save_plot
from detailed_tracker import simulate_with_detailed_tracking
import csv
from datetime import datetime
from collections import defaultdict


# SCHEDULED JOIN SETUP - Edit directly here
# Example: [(5000, 50000), (10000, 30000)] -> At epoch 5000 a validator joins with 50k stake, at epoch 10000 joins with 30k stake
SCHEDULED_JOINS = [
    # (5000, 10000),
    # (15000, 50000),
]

SCHEDULED_SYBIL_ATTACKS = [(500, 0, 3)]


def get_scheduled_joins():
    """Return the configured join schedule"""
    if SCHEDULED_JOINS:
        for epoch, stake in SCHEDULED_JOINS:
            print(f"   • Epoch {epoch}: Validator join with stake {stake:,.0f}")
        return SCHEDULED_JOINS
    else:
        print("\nNo join schedule configured.")
        return None


def get_scheduled_sybil_attacks():
    """Return and display the configured Sybil attack schedule"""
    if SCHEDULED_SYBIL_ATTACKS:
        print("\nScheduled Sybil Attacks:")
        for epoch, entity_id, num_splits in SCHEDULED_SYBIL_ATTACKS:
            print(
                f"   • Epoch {epoch}: Entity {entity_id} sẽ split thành {num_splits} validators"
            )
        return SCHEDULED_SYBIL_ATTACKS
    else:
        print("\nNo Sybil attack schedule configured.")
        return None


def calculate_reward_summary(detailed_peer_data):
    """
    Tính tổng reward cho mỗi peer/validator từ detailed_peer_data

    Args:
        detailed_peer_data: List of lists, mỗi inner list chứa dicts của peers tại một epoch

    Returns:
        Dictionary mapping validator_index -> {
            'total_reward': float,
            'times_selected': int,
            'final_stake': float,
            'entity_id': int,
            'is_corrupted': bool
        }
    """
    reward_summary = defaultdict(
        lambda: {
            "total_reward": 0.0,
            "times_selected": 0,
            "final_stake": 0.0,
            "entity_id": -1,
            "is_corrupted": False,
        }
    )

    # Duyệt qua tất cả epochs
    for epoch_data in detailed_peer_data:
        for peer_data in epoch_data:
            validator_idx = peer_data["validator_index"]

            # Cộng reward (có thể âm nếu bị penalty)
            reward_summary[validator_idx]["total_reward"] += peer_data[
                "reward_received"
            ]

            # Đếm số lần được chọn
            if peer_data["is_selected"]:
                reward_summary[validator_idx]["times_selected"] += 1

            # Lưu thông tin cuối cùng (epoch cuối sẽ ghi đè)
            reward_summary[validator_idx]["final_stake"] = peer_data["stake"]
            reward_summary[validator_idx]["entity_id"] = peer_data["entity_id"]
            reward_summary[validator_idx]["is_corrupted"] = peer_data["is_corrupted"]

    return dict(reward_summary)


def export_reward_summary(reward_summary, filename):
    """
    Export tổng reward của từng peer ra file CSV

    Args:
        reward_summary: Dictionary từ calculate_reward_summary()
        filename: Tên file CSV để lưu
    """
    # Sắp xếp theo entity_id tăng dần
    sorted_rewards = sorted(reward_summary.items(), key=lambda x: x[1]["entity_id"])

    with open(filename, "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = [
            "validator_index",
            "entity_id",
            "total_reward",
            "times_selected",
            "final_stake",
            "is_corrupted",
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        for validator_idx, data in sorted_rewards:
            writer.writerow(
                {
                    "validator_index": validator_idx,
                    "entity_id": data["entity_id"],
                    "total_reward": f"{data['total_reward']:.6f}",
                    "times_selected": data["times_selected"],
                    "final_stake": f"{data['final_stake']:.6f}",
                    "is_corrupted": data["is_corrupted"],
                }
            )

    print(f"\n✓ Đã export reward summary ra file: {filename}")
    print(f"  - Tổng số peers: {len(sorted_rewards)}")
    # Tìm peer có reward cao nhất
    highest_reward_peer = max(sorted_rewards, key=lambda x: x[1]["total_reward"])
    print(
        f"  - Peer có reward cao nhất: Validator {highest_reward_peer[0]} (Entity {highest_reward_peer[1]['entity_id']}) với {highest_reward_peer[1]['total_reward']:.2f}"
    )
    print(
        f"  - Peer được chọn nhiều nhất: Validator {max(sorted_rewards, key=lambda x: x[1]['times_selected'])[0]} với {max(sorted_rewards, key=lambda x: x[1]['times_selected'])[1]['times_selected']} lần"
    )


def run_single_experiment(
    pos_algorithm, experiment_name, starting_gini=0.3, scheduled_joins=None
):
    """Run a single experiment with the specified PoS algorithm"""
    print(f"Running {experiment_name}")

    # Common parameters
    params = Parameters(
        n_epochs=10000,
        proof_of_stake=pos_algorithm,
        initial_stake_volume=5000.0,
        initial_distribution=Distribution.RANDOM,
        n_peers=1000,
        n_corrupted=50,
        p_fail=0.5,
        p_join=0.001,
        p_leave=0.001,
        join_amount=NewEntry.NEW_RANDOM,
        penalty_percentage=0.5,
        reward=20.0,
        scheduled_joins=scheduled_joins,
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

    print(f"  Initial Gini: {gini(stakes):.3f}")
    print(f"  Peers: {len(stakes)}, Corrupted: {len(corrupted)}")

    # Create filename for plots and exports
    filename = experiment_name.lower().replace(" ", "_").replace(":", "")

    # Run simulation with detailed tracking to capture rewards
    print("  Running simulation with detailed tracking...")
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
        shapley_gini_liveness_history,
        shapley_gini_safety_history,
        shapley_gini_correlation_history,
        detailed_peer_data,
    ) = simulate_with_detailed_tracking(stakes.copy(), corrupted.copy(), params)

    # Calculate average values
    avg_gini = np.mean(gini_history) if gini_history else 0
    avg_nakamoto = np.mean(nakamoto_history) if nakamoto_history else 0
    avg_peers = np.mean(peers_history) if peers_history else 0
    avg_hhi = np.mean(hhi_history) if hhi_history else 0
    avg_nakamoto_liveness = (
        np.mean(nakamoto_liveness_history) if nakamoto_liveness_history else 0
    )
    avg_nakamoto_liveness_pct = (
        np.mean(nakamoto_liveness_pct_history) if nakamoto_liveness_pct_history else 0
    )
    avg_nakamoto_safety = (
        np.mean(nakamoto_safety_history) if nakamoto_safety_history else 0
    )
    avg_nakamoto_safety_pct = (
        np.mean(nakamoto_safety_pct_history) if nakamoto_safety_pct_history else 0
    )
    avg_theil = np.mean(theil_history) if theil_history else 0
    avg_zipf = np.mean(zipf_history) if zipf_history else 0
    palma_filtered = (
        [x for x in palma_history if x != float("inf") and x is not None]
        if palma_history
        else []
    )
    avg_palma = np.mean(palma_filtered) if palma_filtered else 0
    avg_shannon = np.mean(shannon_history) if shannon_history else 0
    avg_shapley_gini_liveness = (
        np.mean(shapley_gini_liveness_history) if shapley_gini_liveness_history else 0
    )
    avg_shapley_gini_safety = (
        np.mean(shapley_gini_safety_history) if shapley_gini_safety_history else 0
    )
    avg_shapley_gini_correlation = (
        np.mean(shapley_gini_correlation_history)
        if shapley_gini_correlation_history
        else 0
    )

    print(f"  Final Gini: {gini_history[-1]:.3f} (Avg: {avg_gini:.3f})")
    print(f"  Final Nakamoto: {nakamoto_history[-1]} (Avg: {avg_nakamoto:.2f})")
    print(f"  Final Peers: {peers_history[-1]} (Avg: {avg_peers:.2f})")
    print(f"  Final HHI: {hhi_history[-1]:.3f} (Avg: {avg_hhi:.3f})")

    # Calculate reward summary for each peer
    print("  Calculating reward summary...")
    reward_summary = calculate_reward_summary(detailed_peer_data)

    # Export reward summary to CSV
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    reward_csv_filename = f"{filename}_rewards_{timestamp}.csv"
    reward_csv_path = os.path.join("results", reward_csv_filename)
    os.makedirs("results", exist_ok=True)
    export_reward_summary(reward_summary, reward_csv_path)

    # Plot 1: Gini Coefficient
    plt.figure(figsize=(12, 8))
    plt.plot(gini_history, linewidth=2, color="blue", alpha=0.8)
    plt.title(f"{experiment_name} - Gini Coefficient", fontsize=16, fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("Gini Coefficient")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    save_plot("", f"{filename}_gini.png", " Gini")
    plt.show()

    # Plot 2: Nakamoto Coefficient
    plt.figure(figsize=(12, 8))
    plt.plot(nakamoto_history, linewidth=2, color="red", alpha=0.8)
    plt.title(
        f"{experiment_name} - Nakamoto Coefficient", fontsize=16, fontweight="bold"
    )
    plt.xlabel("Epoch")
    plt.ylabel("Nakamoto Coefficient")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    save_plot("", f"{filename}_nakamoto.png", " Nakamoto")
    plt.show()

    # Plot 3: Peers Count
    plt.figure(figsize=(12, 8))
    plt.plot(peers_history, linewidth=2, color="green", alpha=0.8)
    plt.title(f"{experiment_name} - Peers Count", fontsize=16, fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("Number of Peers")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    save_plot("", f"{filename}_peers.png", " Peers Count")
    # plt.show()

    # Plot 4: HHI Coefficient
    plt.figure(figsize=(12, 8))
    plt.plot(hhi_history, linewidth=2, color="orange", alpha=0.8)
    plt.title(f"{experiment_name} - HHI Coefficient", fontsize=16, fontweight="bold")
    plt.xlabel("Epoch")
    plt.ylabel("HHI Coefficient")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    save_plot("", f"{filename}_hhi.png", " HHI Coefficient")
    plt.show()

    # Save data
    result = {
        "gini_history": gini_history,
        "nakamoto_history": nakamoto_history,
        "hhi_history": hhi_history,
        "peers_history": peers_history,
        "starting_gini": starting_gini,
        "final_gini": gini_history[-1],
        "final_nakamoto": nakamoto_history[-1],
        "final_peers": peers_history[-1],
        "final_hhi": hhi_history[-1],
        "avg_gini": avg_gini,
        "avg_nakamoto": avg_nakamoto,
        "avg_peers": avg_peers,
        "avg_hhi": avg_hhi,
        "avg_nakamoto_liveness": avg_nakamoto_liveness,
        "avg_nakamoto_liveness_pct": avg_nakamoto_liveness_pct,
        "avg_nakamoto_safety": avg_nakamoto_safety,
        "avg_nakamoto_safety_pct": avg_nakamoto_safety_pct,
        "avg_theil": avg_theil,
        "avg_zipf": avg_zipf,
        "avg_palma": avg_palma,
        "avg_shannon": avg_shannon,
        "avg_shapley_gini_liveness": avg_shapley_gini_liveness,
        "avg_shapley_gini_safety": avg_shapley_gini_safety,
        "avg_shapley_gini_correlation": avg_shapley_gini_correlation,
        "shapley_gini_liveness_history": shapley_gini_liveness_history,
        "shapley_gini_safety_history": shapley_gini_safety_history,
        "shapley_gini_correlation_history": shapley_gini_correlation_history,
    }
    # Convert to format compatible with experiment_utils
    results_for_save = {
        "experiment_result": {
            "starting_gini": result["starting_gini"],
            "final_gini": result["final_gini"],
            "final_nakamoto": result["final_nakamoto"],
            "final_peers": result["final_peers"],
            "final_hhi": result["final_hhi"],
            "avg_gini": result["avg_gini"],
            "avg_nakamoto": result["avg_nakamoto"],
            "avg_peers": result["avg_peers"],
            "avg_hhi": result["avg_hhi"],
        }
    }
    save_results_to_json(results_for_save, f"{filename}_data.json", "")

    return result


def run_experiment_1():
    """Experiment 1: WEIGHTED PoS"""
    scheduled_joins = get_scheduled_joins()
    return run_single_experiment(
        PoS.WEIGHTED, "Experiment 1: WEIGHTED PoS", scheduled_joins=scheduled_joins
    )


def run_experiment_2():
    """Experiment 2: OPPOSITE_WEIGHTED PoS"""
    scheduled_joins = get_scheduled_joins()
    return run_single_experiment(
        PoS.OPPOSITE_WEIGHTED,
        "Experiment 2: OPPOSITE_WEIGHTED PoS",
        scheduled_joins=scheduled_joins,
    )


def run_experiment_3():
    """Experiment 3: GINI_STABILIZED PoS"""
    scheduled_joins = get_scheduled_joins()
    return run_single_experiment(
        PoS.GINI_STABILIZED,
        "Experiment 3: GINI_STABILIZED PoS",
        scheduled_joins=scheduled_joins,
    )


def run_experiment_4():
    """Experiment 4: LOG_WEIGHTED PoS"""
    scheduled_joins = get_scheduled_joins()
    return run_single_experiment(
        PoS.LOG_WEIGHTED,
        "Experiment 4: LOG_WEIGHTED PoS",
        scheduled_joins=scheduled_joins,
    )


def run_experiment_5():
    """Experiment 5: DESW PoS"""
    scheduled_joins = get_scheduled_joins()
    return run_single_experiment(
        PoS.DESW, "Experiment 5: DESW PoS", scheduled_joins=scheduled_joins
    )


def run_experiment_6():
    """Experiment 6: SRSW_WEIGHTED PoS"""
    scheduled_joins = get_scheduled_joins()
    return run_single_experiment(
        PoS.SRSW_WEIGHTED,
        "Experiment 6: SRSW_WEIGHTED PoS",
        scheduled_joins=scheduled_joins,
    )


def run_comparison_experiment():
    """Experiment 7: Compare all 6 PoS algorithms"""
    print("Compare all 6 PoS algorithms")
    print("=" * 50)

    # Ask for scheduled joins for this experiment
    scheduled_joins = get_scheduled_joins()

    # Display scheduled Sybil attacks
    get_scheduled_sybil_attacks()

    # Common parameters for all algorithms
    base_params = {
        "n_epochs": 20000,
        "initial_stake_volume": 5000.0,
        "initial_distribution": Distribution.RANDOM,
        "n_peers": 1000,
        "n_corrupted": 20,
        "initial_gini": 0.3,
        "p_fail": 0.1,
        "p_join": 0.0001,
        "p_leave": 0.0001,
        "join_amount": NewEntry.NEW_RANDOM,
        "penalty_percentage": 0.5,
        "reward": 20.0,
        "scheduled_sybil_attacks": SCHEDULED_SYBIL_ATTACKS,
    }

    # Generate stakes and corrupted peers (use the same data for all)
    stakes_original = generate_peers(
        base_params["n_peers"],
        base_params["initial_stake_volume"],
        base_params["initial_distribution"],
        base_params["initial_gini"],
    )
    corrupted = random.sample(range(base_params["n_peers"]), base_params["n_corrupted"])

    print(f"Initial Gini coefficient: {gini(stakes_original):.3f}")
    print(f"Number of peers: {len(stakes_original)}")
    print(f"Number of corrupted peers: {len(corrupted)}")
    print()

    # Dictionary to store results for each algorithm
    algorithms = {
        "WEIGHTED": PoS.WEIGHTED,
        # "OPPOSITE_WEIGHTED": PoS.OPPOSITE_WEIGHTED,
        # "GINI_STABILIZED": PoS.GINI_STABILIZED,
        "LOG_WEIGHTED": PoS.LOG_WEIGHTED,
        "DESW": PoS.DESW,
        "SRSW_WEIGHTED": PoS.SRSW_WEIGHTED,
    }

    results = {}
    colors = {
        "WEIGHTED": "blue",
        # "OPPOSITE_WEIGHTED": "red",
        # "GINI_STABILIZED": "green",
        "LOG_WEIGHTED": "purple",
        "DESW": "brown",
        "SRSW_WEIGHTED": "orange",
    }

    # Run simulation for each algorithm
    for name, pos_type in algorithms.items():
        print(f"Running {name} simulation...")

        # Create a copy of base_params and remove keys that will be overridden
        params_dict = {
            k: v
            for k, v in base_params.items()
            if k not in ["proof_of_stake", "scheduled_joins"]
        }
        params = Parameters(
            **params_dict, proof_of_stake=pos_type, scheduled_joins=scheduled_joins
        )
        stakes = stakes_original.copy()

        # Use detailed tracking to capture rewards
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
            shapley_gini_liveness_history,
            shapley_gini_safety_history,
            shapley_gini_correlation_history,
            detailed_peer_data,
        ) = simulate_with_detailed_tracking(stakes.copy(), corrupted.copy(), params)

        # Calculate reward summary
        reward_summary = calculate_reward_summary(detailed_peer_data)

        # Calculate average values
        n_epochs = len(gini_history)
        avg_gini = np.mean(gini_history) if gini_history else 0
        avg_nakamoto = np.mean(nakamoto_history) if nakamoto_history else 0
        avg_peers = np.mean(peers_history) if peers_history else 0
        avg_hhi = np.mean(hhi_history) if hhi_history else 0
        avg_nakamoto_liveness = (
            np.mean(nakamoto_liveness_history) if nakamoto_liveness_history else 0
        )
        avg_nakamoto_liveness_pct = (
            np.mean(nakamoto_liveness_pct_history)
            if nakamoto_liveness_pct_history
            else 0
        )
        avg_nakamoto_safety = (
            np.mean(nakamoto_safety_history) if nakamoto_safety_history else 0
        )
        avg_nakamoto_safety_pct = (
            np.mean(nakamoto_safety_pct_history) if nakamoto_safety_pct_history else 0
        )
        avg_theil = np.mean(theil_history) if theil_history else 0
        avg_zipf = np.mean(zipf_history) if zipf_history else 0
        palma_filtered = (
            [x for x in palma_history if x != float("inf") and x is not None]
            if palma_history
            else []
        )
        avg_palma = np.mean(palma_filtered) if palma_filtered else 0
        avg_shannon = np.mean(shannon_history) if shannon_history else 0
        avg_shapley_gini_liveness = (
            np.mean(shapley_gini_liveness_history)
            if shapley_gini_liveness_history
            else 0
        )
        avg_shapley_gini_safety = (
            np.mean(shapley_gini_safety_history) if shapley_gini_safety_history else 0
        )
        avg_shapley_gini_correlation = (
            np.mean(shapley_gini_correlation_history)
            if shapley_gini_correlation_history
            else 0
        )

        results[name] = {
            "gini_history": gini_history,
            "nakamoto_history": nakamoto_history,
            "hhi_history": hhi_history,
            "peers_history": peers_history,
            "final_gini": gini_history[-1],
            "final_nakamoto": nakamoto_history[-1],
            "final_peers": peers_history[-1],
            "final_hhi": hhi_history[-1],
            "avg_gini": avg_gini,
            "avg_nakamoto": avg_nakamoto,
            "avg_peers": avg_peers,
            "avg_hhi": avg_hhi,
            "avg_nakamoto_liveness": avg_nakamoto_liveness,
            "avg_nakamoto_liveness_pct": avg_nakamoto_liveness_pct,
            "avg_nakamoto_safety": avg_nakamoto_safety,
            "avg_nakamoto_safety_pct": avg_nakamoto_safety_pct,
            "avg_theil": avg_theil,
            "avg_zipf": avg_zipf,
            "avg_palma": avg_palma,
            "avg_shannon": avg_shannon,
            "avg_shapley_gini_liveness": avg_shapley_gini_liveness,
            "avg_shapley_gini_safety": avg_shapley_gini_safety,
            "avg_shapley_gini_correlation": avg_shapley_gini_correlation,
            "shapley_gini_liveness_history": shapley_gini_liveness_history,
            "shapley_gini_safety_history": shapley_gini_safety_history,
            "shapley_gini_correlation_history": shapley_gini_correlation_history,
            "reward_summary": reward_summary,
        }

        print(f"  Final Gini: {gini_history[-1]:.3f} (Avg: {avg_gini:.3f})")
        print(f"  Final Nakamoto: {nakamoto_history[-1]} (Avg: {avg_nakamoto:.2f})")
        print(f"  Final Peers: {peers_history[-1]} (Avg: {avg_peers:.2f})")
        print(f"  Final HHI: {hhi_history[-1]:.3f} (Avg: {avg_hhi:.3f})")

        # Export reward summary for this algorithm
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        reward_csv_filename = f"comparison_{name.lower()}_rewards_{timestamp}.csv"
        reward_csv_path = os.path.join("results", reward_csv_filename)
        os.makedirs("results", exist_ok=True)
        export_reward_summary(reward_summary, reward_csv_path)

    # Plot 1: Gini Coefficient Comparison
    plt.figure(figsize=(12, 8))
    for name, result in results.items():
        plt.plot(
            result["gini_history"],
            label=name,
            linewidth=2,
            color=colors[name],
            alpha=0.8,
        )

    plt.title(
        "Gini Coefficient Evolution - All PoS Algorithms",
        fontsize=16,
        fontweight="bold",
    )
    plt.xlabel("Epoch")
    plt.ylabel("Gini Coefficient")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    save_plot("", "gini_comparison.png", " Gini")
    plt.show()

    # Plot 2: Nakamoto Coefficient Comparison
    plt.figure(figsize=(12, 8))
    for name, result in results.items():
        plt.plot(
            result["nakamoto_history"],
            label=name,
            linewidth=2,
            color=colors[name],
            alpha=0.8,
        )

    plt.title(
        "Nakamoto Coefficient Evolution - All PoS Algorithms",
        fontsize=16,
        fontweight="bold",
    )
    plt.xlabel("Epoch")
    plt.ylabel("Nakamoto Coefficient")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    save_plot("", "nakamoto_comparison.png", " Nakamoto")
    plt.show()

    # Detailed stats - Final values
    print("\nFINAL COMPARISON RESULTS:")
    print("-" * 70)
    print(
        f"{'Algorithm':<20} {'Final Gini':<12} {'Final Nakamoto':<15} {'Final Peers':<12} {'Final HHI':<12}"
    )
    print("-" * 70)

    for name, result in results.items():
        print(
            f"{name:<20} {result['final_gini']:<12.3f} {result['final_nakamoto']:<15} {result['final_peers']:<12} {result['final_hhi']:<12.3f}"
        )

    # Average values
    print("\nAVERAGE COMPARISON RESULTS (across all epochs):")
    print("-" * 70)
    print(
        f"{'Algorithm':<20} {'Avg Gini':<12} {'Avg Nakamoto':<15} {'Avg Peers':<12} {'Avg HHI':<12}"
    )
    print("-" * 70)

    for name, result in results.items():
        print(
            f"{name:<20} {result['avg_gini']:<12.3f} {result['avg_nakamoto']:<15.2f} {result['avg_peers']:<12.2f} {result['avg_hhi']:<12.3f}"
        )

    # Save data
    save_results_to_json(results, "all_pos_comparison_data.json", "")

    print("\nComparison completed!")
    return results


def main():
    """Run PoS Simulator experiment"""
    print("PoS Simulator - Compare 6 Proof-of-Stake Algorithms")
    print("=" * 60)

    # Set random seed for reproducibility
    random.seed(42)
    np.random.seed(42)

    print("Results will be saved in the results/ folder (created automatically)")

    try:
        while True:
            print("\nChoose an experiment:")
            print("1. Experiment 1: WEIGHTED PoS")
            print("2. Experiment 2: OPPOSITE_WEIGHTED PoS")
            print("3. Experiment 3: GINI_STABILIZED PoS")
            print("4. Experiment 4: LOG_WEIGHTED PoS")
            print("5. Experiment 5: DESW PoS")
            print("6. Experiment 6: SRSW_WEIGHTED PoS")
            print("7. Compare all 6 algorithms")
            print("8. Exit")

            choice = input("\nEnter choice (1-9): ").strip()

            if choice == "1":
                print("\n" + "=" * 60)
                run_experiment_1()
            elif choice == "2":
                print("\n" + "=" * 60)
                run_experiment_2()
            elif choice == "3":
                print("\n" + "=" * 60)
                run_experiment_3()
            elif choice == "4":
                print("\n" + "=" * 60)
                run_experiment_4()
            elif choice == "5":
                print("\n" + "=" * 60)
                run_experiment_5()
            elif choice == "6":
                print("\n" + "=" * 60)
                run_experiment_6()
            elif choice == "7":
                print("\n" + "=" * 60)
                run_comparison_experiment()
            elif choice == "8":
                print("Goodbye!")
                break
            else:
                print("Invalid choice. Please try again.")

        print("\n" + "=" * 60)
        print("All experiments completed successfully!")

    except Exception as e:
        print(f"Error during execution: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    main()
