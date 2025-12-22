#!/usr/bin/env python3
"""
DESW p-range sensitivity experiment
Chạy cùng một kịch bản nhiều lần với (pmin, pmax) khác nhau để phân tích độ nhạy.
Sinh heatmap (final_gini) và line-chart tùy chọn.
"""

import os
import sys
import random
import numpy as np
import matplotlib.pyplot as plt
import json
import time
from datetime import datetime
from typing import Dict, List, Tuple

from scipy.stats import f

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from parameters import Parameters, PoS, Distribution, NewEntry
import simulator as sim  # to set sim.pmin / sim.pmax dynamically
from simulator import simulate
from utils import generate_peers, gini


def run_single_experiment(
    params: Parameters, stakes: List[float], corrupted: List[int]
) -> Dict:
    """Run a single DESW experiment and return metrics like benchmark_algorithms.py"""
    # Create parameter copy with specific algorithm (giống desw_experiment.py)
    test_params = Parameters(
        n_epochs=params.n_epochs,
        proof_of_stake=PoS.DESW,
        initial_stake_volume=params.initial_stake_volume,
        initial_distribution=params.initial_distribution,
        n_peers=params.n_peers,
        n_corrupted=params.n_corrupted,
        p_fail=params.p_fail,
        p_join=params.p_join,
        p_leave=params.p_leave,
        join_amount=params.join_amount,
        penalty_percentage=params.penalty_percentage,
        reward=params.reward,
        scheduled_joins=params.scheduled_joins,
    )

    # print(f"gini ban dau: {gini(stakes):.3f}")
    # print(f"params ban dau: {params}")
    # print(f"params test: {test_params}")

    # Create copies to avoid modifying original data (giống desw_experiment.py)
    test_stakes = stakes.copy()
    test_corrupted = corrupted.copy()

    start_time = time.time()
    # Không cần Shapley cho sensitivity này, tắt cho nhanh
    gini_history, peers_history, nakamoto_history, *_ = simulate(
        stakes, corrupted, test_params, compute_shapley=False
    )
    end_time = time.time()
    print(f"gini cuoi: {gini_history[-1]:.3f}")
    print(f"nakamoto cuoi: {nakamoto_history[-1]:.1f}")

    return {
        "starting_gini": gini(stakes),
        "final_gini": gini_history[-1],
        "final_nakamoto": nakamoto_history[-1],
        "final_peers": peers_history[-1],
        "execution_time": end_time - start_time,
    }


def calculate_statistics(results: List[Dict]) -> Dict:
    """Aggregate multiple DESW runs statistics, mirroring benchmark_algorithms.py fields"""
    final_gini_values = [r["final_gini"] for r in results]
    final_nakamoto_values = [r["final_nakamoto"] for r in results]
    final_peers_values = [r["final_peers"] for r in results]
    execution_times = [r["execution_time"] for r in results]

    return {
        "num_runs": len(results),
        "starting_gini": results[0]["starting_gini"],
        "final_gini_mean": float(np.mean(final_gini_values)),
        "final_gini_std": float(np.std(final_gini_values)),
        "final_gini_min": float(np.min(final_gini_values)),
        "final_gini_max": float(np.max(final_gini_values)),
        "final_nakamoto_mean": float(np.mean(final_nakamoto_values)),
        "final_nakamoto_std": float(np.std(final_nakamoto_values)),
        "final_nakamoto_min": int(np.min(final_nakamoto_values)),
        "final_nakamoto_max": int(np.max(final_nakamoto_values)),
        "final_peers_mean": float(np.mean(final_peers_values)),
        "final_peers_std": float(np.std(final_peers_values)),
        "final_peers_min": int(np.min(final_peers_values)),
        "final_peers_max": int(np.max(final_peers_values)),
        "execution_time_mean": float(np.mean(execution_times)),
        "execution_time_std": float(np.std(execution_times)),
        "execution_time_total": float(np.sum(execution_times)),
    }


def sweep_p_ranges(
    pmin_list: List[float],
    pmax_list: List[float],
    base_params: Parameters,
    stakes: List[float],
    corrupted: List[int],
    runs_per_point: int = 3,
) -> Dict:
    results = {"grid": {}, "pmin_list": pmin_list, "pmax_list": pmax_list}
    for pmin in pmin_list:
        results["grid"][pmin] = {}
        for pmax in pmax_list:
            if pmax <= pmin:
                results["grid"][pmin][pmax] = None
                continue

            # Set simulator global pmin/pmax (uncomment để test sensitivity)
            sim.pmin = pmin
            sim.pmax = pmax
            print(f"Cap minmax trong code la pmin: {pmin}, pmax: {pmax}")

            runs: List[Dict] = []
            for _ in range(runs_per_point):
                run_out = run_single_experiment(base_params, stakes, corrupted)
                runs.append(run_out)
                print(
                    f"Gini: {run_out['final_gini']:.3f} | Nakamoto: {run_out['final_nakamoto']:.1f}"
                )

            cell_stats = calculate_statistics(runs)
            results["grid"][pmin][pmax] = cell_stats
    return results


def plot_heatmap(results: Dict, title: str, out_path: str):
    pmin_list = results["pmin_list"]
    pmax_list = results["pmax_list"]
    # build matrix for final_gini_mean
    mat = np.full((len(pmin_list), len(pmax_list)), np.nan)
    for i, pmin in enumerate(pmin_list):
        for j, pmax in enumerate(pmax_list):
            cell = results["grid"][pmin].get(pmax)
            if cell:
                mat[i, j] = cell["final_gini_mean"]

    plt.figure(figsize=(10, 7))
    # If only one value along an axis, avoid identical limits by using index-based axes
    use_index_axes = (len(pmin_list) == 1) or (len(pmax_list) == 1)
    if use_index_axes:
        im = plt.imshow(mat, origin="lower", aspect="auto", cmap="viridis")
        plt.xticks(
            ticks=list(range(len(pmax_list))), labels=[f"{v:.2f}" for v in pmax_list]
        )
        plt.yticks(
            ticks=list(range(len(pmin_list))), labels=[f"{v:.2f}" for v in pmin_list]
        )
    else:
        im = plt.imshow(
            mat,
            origin="lower",
            aspect="auto",
            extent=[min(pmax_list), max(pmax_list), min(pmin_list), max(pmin_list)],
            cmap="viridis",
        )
    plt.colorbar(im, label="Final Gini (mean)")
    plt.xlabel("pmax")
    plt.ylabel("pmin")
    plt.title(title)
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, bbox_inches="tight")
    print(f"Saved heatmap: {out_path}")


def plot_lines(results: Dict, fixed_pmin_list: List[float], out_dir: str, tag: str):
    pmax_list = results["pmax_list"]
    for pmin in fixed_pmin_list:
        if pmin not in results["grid"]:
            continue
        ys = []
        xs = []
        for pmax in pmax_list:
            cell = results["grid"][pmin].get(pmax)
            if cell:
                xs.append(pmax)
                ys.append(cell["final_gini_mean"])
        if xs:
            plt.figure(figsize=(10, 6))
            plt.plot(xs, ys, marker="o")
            plt.xlabel("pmax")
            plt.ylabel("Final Gini (mean)")
            plt.title(f"Final Gini vs pmax (pmin={pmin:.2f})")
            plt.grid(True, alpha=0.3)
            fname = os.path.join(out_dir, f"desw_gini_line_pmin_{pmin:.2f}_{tag}.png")
            plt.tight_layout()
            plt.savefig(fname, dpi=300, bbox_inches="tight")
            print(f"Saved line-chart: {fname}")


def test_baseline(
    pmin_list: List[float],
    pmax_list: List[float],
    params: Parameters,
    stakes: List[float],
    corrupted: List[int],
    runs: int = 10,
) -> Dict:
    """Test baseline DESW without setting pmin/pmax (giống desw_experiment.py)"""
    print(f"\nTesting baseline DESW (no pmin/pmax setting)...")

    baseline_results = []
    for i in range(runs):
        print(f"  Baseline run {i+1}/{runs}")
        result = run_single_experiment(params, stakes, corrupted)
        baseline_results.append(result)
        print(f"Final Gini: {result['final_gini']:.3f}")
        print(f"Final Nakamoto: {result['final_nakamoto']:.1f}")

    baseline_stats = calculate_statistics(baseline_results)
    print(
        f"  Baseline Final Gini: {baseline_stats['final_gini_mean']:.3f} ± {baseline_stats['final_gini_std']:.3f}"
    )
    print(
        f"  Baseline Final Nakamoto: {baseline_stats['final_nakamoto_mean']:.1f} ± {baseline_stats['final_nakamoto_std']:.1f}"
    )

    return baseline_stats


def main():
    print("DESW (pmin, pmax) Sensitivity Experiment")
    print("=" * 60)
    start_time = datetime.now()
    random.seed(42)
    np.random.seed(42)

    scheduled_joins = []

    # Scenario (giữ giống kịch bản chuẩn, có thể chỉnh nhanh tại đây)
    params = Parameters(
        n_epochs=20000,
        proof_of_stake=PoS.DESW,
        initial_stake_volume=50000.0,
        initial_distribution=Distribution.RANDOM,
        n_peers=10000,
        n_corrupted=500,
        p_fail=0.5,
        p_join=0.005,
        p_leave=0.005,
        join_amount=NewEntry.NEW_RANDOM,
        penalty_percentage=0.5,
        reward=50.0,
        scheduled_joins=scheduled_joins,
    )

    # Dữ liệu ban đầu dùng chung (giống desw_experiment.py)
    stakes = generate_peers(
        params.n_peers,
        params.initial_stake_volume,
        params.initial_distribution,
        0.5,  # starting_gini
    )
    corrupted = random.sample(range(params.n_peers), params.n_corrupted)

    print(f"Initial Gini: {gini(stakes):.3f}")
    print(f"Peers: {len(stakes)}, Corrupted: {len(corrupted)}")
    print(f"Epochs: {params.n_epochs}")

    # Lưới pmin/pmax
    pmin_list = [0.0, 0.1, 0.2, 0.3, 0.4]
    pmax_list = [0.6, 0.7, 0.8, 0.9, 1.0]

    baseline_stats = test_baseline(
        pmin_list, pmax_list, params, stakes, corrupted, runs=3
    )

    print(f"\nGrid sizes: |pmin|={len(pmin_list)}, |pmax|={len(pmax_list)}")

    results = sweep_p_ranges(
        pmin_list, pmax_list, params, stakes, corrupted, runs_per_point=10
    )

    # Lưu kết quả + vẽ
    out_dir = os.path.join(os.path.dirname(__file__), "results")
    os.makedirs(out_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    json_path = os.path.join(out_dir, f"desw_p_sensitivity_{ts}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Saved results: {json_path}")

    heatmap_path = os.path.join(out_dir, f"desw_gini_heatmap_{ts}.png")
    plot_heatmap(results, "DESW Final Gini (mean) vs (pmin, pmax)", heatmap_path)

    plot_lines(results, fixed_pmin_list=[0.0, 0.1], out_dir=out_dir, tag=ts)

    # So sánh kết quả
    print("\n" + "=" * 80)
    print("COMPARISON RESULTS:")
    print("=" * 80)
    print(
        f"{'Test Type':<20} {'Final Gini':<15} {'Final Nakamoto':<15} {'Execution Time':<15}"
    )
    print("-" * 80)

    # Baseline results (không set pmin/pmax)
    print(
        f"{'Baseline (no pmin/pmax)':<20} "
        f"{baseline_stats['final_gini_mean']:.3f}±{baseline_stats['final_gini_std']:.3f}   "
        f"{baseline_stats['final_nakamoto_mean']:.1f}±{baseline_stats['final_nakamoto_std']:.1f}        "
        f"{baseline_stats['execution_time_total']:.3f}s"
    )

    # Sensitivity results (có set pmin/pmax)
    if results["grid"] and 0.0 in results["grid"] and 1.0 in results["grid"][0.0]:
        sens_stats = results["grid"][0.0][1.0]
        print(
            f"{'Sensitivity (pmin=0,pmax=1)':<20} "
            f"{sens_stats['final_gini_mean']:.3f}±{sens_stats['final_gini_std']:.3f}   "
            f"{sens_stats['final_nakamoto_mean']:.1f}±{sens_stats['final_nakamoto_std']:.1f}        "
            f"{sens_stats['execution_time_total']:.3f}s"
        )

        # Tính chênh lệch
        gini_diff = sens_stats["final_gini_mean"] - baseline_stats["final_gini_mean"]
        nakamoto_diff = (
            sens_stats["final_nakamoto_mean"] - baseline_stats["final_nakamoto_mean"]
        )
        print(f"\nDifferences:")
        print(f"  Gini difference: {gini_diff:+.3f}")
        print(f"  Nakamoto difference: {nakamoto_diff:+.1f}")

    time_taken = datetime.now() - start_time
    print(f"\nTime taken: {time_taken} seconds")

    print("\nCompleted sensitivity experiment.")


if __name__ == "__main__":
    main()
