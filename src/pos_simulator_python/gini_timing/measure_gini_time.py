#!/usr/bin/env python3
"""
Đo thời gian tính chỉ số Gini theo số lượng peer và kiểu phân phối stake khác nhau

Kết quả sẽ được in ra màn hình và lưu vào JSON/CSV trong thư mục results/ cùng cấp.
"""

import os
import sys
import json
import time
import random
import numpy as np
import statistics
from datetime import datetime

# Add src to path (one level up from gini_timing -> src)
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from timing_utils import gini_with_timing  # noqa: E402


def generate_stakes(num_peers: int, pattern: str, scale: float = 1_000_000.0) -> list:
    """Tạo danh sách stake theo mẫu phân phối.

    pattern:
      - "uniform": tất cả bằng nhau
      - "random": random uniform trong [1, scale]
    """
    if num_peers <= 0:
        return []

    if pattern == "uniform":
        return [scale for _ in range(num_peers)]

    if pattern == "random":
        return [float(np.random.uniform(1.0, scale)) for _ in range(num_peers)]

    # Các mẫu phân phối khác đã được loại bỏ theo yêu cầu

    # fallback
    return [float(np.random.uniform(1.0, scale)) for _ in range(num_peers)]


def benchmark_gini_time(
    peer_sizes: list,
    patterns: list,
    iterations_per_case: int = 50,
):
    """Đo thời gian tính Gini cho các cấu hình khác nhau."""
    results = {}

    for n in peer_sizes:
        results[n] = {}
        for pattern in patterns:
            exec_times = []
            gini_values = []

            # Chuẩn bị dataset cố định cho fairness giữa iterations
            stakes = generate_stakes(n, pattern)

            for _ in range(iterations_per_case):
                g, t = gini_with_timing(stakes)

                exec_times.append(t)
                gini_values.append(g)

            results[n][pattern] = {
                "mean_time": statistics.mean(exec_times) if exec_times else 0.0,
                "std_time": (
                    statistics.stdev(exec_times) if len(exec_times) > 1 else 0.0
                ),
                "min_time": min(exec_times) if exec_times else 0.0,
                "max_time": max(exec_times) if exec_times else 0.0,
                "median_time": statistics.median(exec_times) if exec_times else 0.0,
                "mean_gini": statistics.mean(gini_values) if gini_values else 0.0,
                "std_gini": (
                    statistics.stdev(gini_values) if len(gini_values) > 1 else 0.0
                ),
                "iterations": iterations_per_case,
            }

            print(
                f"Peers={n:<6} Pattern={pattern:<9} "
                f"MeanTime={results[n][pattern]['mean_time']:.3f}s "
                f"Std={results[n][pattern]['std_time']:.3f}s "
                f"MeanGini={results[n][pattern]['mean_gini']:.3f}"
            )

    return results


def ensure_results_dir() -> str:
    base_dir = os.path.dirname(__file__)
    results_dir = os.path.join(base_dir, "results")
    os.makedirs(results_dir, exist_ok=True)
    return results_dir


def save_results(results: dict):
    results_dir = ensure_results_dir()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    tag = "original"

    # Round all numeric values to 3 decimals before saving
    rounded = {}
    for n, patterns in results.items():
        rounded[str(n)] = {}
        for pattern, stats in patterns.items():
            rounded_stats = {}
            for k, v in stats.items():
                if isinstance(v, (int,)):
                    rounded_stats[k] = v
                elif isinstance(v, float):
                    rounded_stats[k] = round(v, 3)
                else:
                    rounded_stats[k] = v
            rounded[str(n)][pattern] = rounded_stats

    # Save CSV (long format) - only one file format as requested
    csv_path = os.path.join(results_dir, f"gini_time_{tag}_{ts}.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(
            "peers,pattern,mean_time,std_time,min_time,max_time,median_time,mean_gini,std_gini,iterations\n"
        )
        for n, patterns in rounded.items():
            for pattern, stats in patterns.items():
                f.write(
                    f"{n},{pattern},{stats['mean_time']:.3f},{stats['std_time']:.3f},{stats['min_time']:.3f},{stats['max_time']:.3f},{stats['median_time']:.3f},{stats['mean_gini']:.3f},{stats['std_gini']:.3f},{stats['iterations']}\n"
                )
    print(f"Saved CSV: {csv_path}")


def main():
    # Cấu hình mặc định
    random.seed(42)
    np.random.seed(42)

    peer_sizes = [10000, 100000, 1000000, 10000000]
    patterns = ["uniform", "random"]
    iterations_per_case = 50


    original_results = benchmark_gini_time(peer_sizes, patterns, iterations_per_case)
    save_results(original_results)


if __name__ == "__main__":
    main()
