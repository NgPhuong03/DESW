#!/usr/bin/env python3
"""
Visualize results from comparison scripts

Tạo các biểu đồ để so sánh kết quả giữa WEIGHTED và DESW
"""

import pandas as pd
import matplotlib.pyplot as plt
import json
import os
import sys
from pathlib import Path


def plot_selection_comparison(summary_csv_path: str, output_dir: str = None):
    """
    Vẽ biểu đồ so sánh số lần được chọn giữa các scenarios

    Args:
        summary_csv_path: Path to multi_scenario_summary CSV
        output_dir: Directory to save plots
    """
    if output_dir is None:
        output_dir = os.path.dirname(summary_csv_path)

    # Load data
    df = pd.read_csv(summary_csv_path)

    # Create figure with subplots
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle(
        "WEIGHTED vs DESW - Sybil Attack Impact Comparison",
        fontsize=16,
        fontweight="bold",
    )

    # Plot 1: Selections comparison
    ax1 = axes[0, 0]
    scenarios = df["scenario"].unique()
    x = range(len(scenarios))
    width = 0.35

    weighted_no = []
    weighted_with = []
    desw_no = []
    desw_with = []

    for scenario in scenarios:
        w_data = df[(df["scenario"] == scenario) & (df["consensus"] == "WEIGHTED")]
        d_data = df[(df["scenario"] == scenario) & (df["consensus"] == "DESW")]

        weighted_no.append(
            w_data["selections_no_sybil"].values[0] if len(w_data) > 0 else 0
        )
        weighted_with.append(
            w_data["selections_with_sybil"].values[0] if len(w_data) > 0 else 0
        )
        desw_no.append(
            d_data["selections_no_sybil"].values[0] if len(d_data) > 0 else 0
        )
        desw_with.append(
            d_data["selections_with_sybil"].values[0] if len(d_data) > 0 else 0
        )

    x_pos = [i - width / 2 for i in x]
    x_pos2 = [i + width / 2 for i in x]

    ax1.bar(
        x_pos,
        weighted_no,
        width,
        label="WEIGHTED (No Sybil)",
        color="steelblue",
        alpha=0.7,
    )
    ax1.bar(
        x_pos,
        weighted_with,
        width,
        label="WEIGHTED (With Sybil)",
        color="steelblue",
        alpha=1.0,
        bottom=0,
    )
    ax1.bar(x_pos2, desw_no, width, label="DESW (No Sybil)", color="coral", alpha=0.7)
    ax1.bar(
        x_pos2,
        desw_with,
        width,
        label="DESW (With Sybil)",
        color="coral",
        alpha=1.0,
        bottom=0,
    )

    ax1.set_xlabel("Scenario")
    ax1.set_ylabel("Number of Selections")
    ax1.set_title("Selection Count Comparison")
    ax1.set_xticks(x)
    ax1.set_xticklabels(
        [s.replace("Validator - ", "\n") for s in scenarios],
        rotation=45,
        ha="right",
        fontsize=8,
    )
    ax1.legend(fontsize=8)
    ax1.grid(axis="y", alpha=0.3)

    # Plot 2: Percentage change
    ax2 = axes[0, 1]

    weighted_pct = []
    desw_pct = []

    for scenario in scenarios:
        w_data = df[(df["scenario"] == scenario) & (df["consensus"] == "WEIGHTED")]
        d_data = df[(df["scenario"] == scenario) & (df["consensus"] == "DESW")]

        weighted_pct.append(
            w_data["percentage_change"].values[0] if len(w_data) > 0 else 0
        )
        desw_pct.append(d_data["percentage_change"].values[0] if len(d_data) > 0 else 0)

    ax2.bar(x_pos, weighted_pct, width, label="WEIGHTED", color="steelblue")
    ax2.bar(x_pos2, desw_pct, width, label="DESW", color="coral")

    ax2.axhline(y=0, color="black", linestyle="-", linewidth=0.5)
    ax2.set_xlabel("Scenario")
    ax2.set_ylabel("Percentage Change (%)")
    ax2.set_title("Sybil Attack Impact (% Change)")
    ax2.set_xticks(x)
    ax2.set_xticklabels(
        [s.replace("Validator - ", "\n") for s in scenarios],
        rotation=45,
        ha="right",
        fontsize=8,
    )
    ax2.legend()
    ax2.grid(axis="y", alpha=0.3)

    # Plot 3: Absolute difference
    ax3 = axes[1, 0]

    weighted_diff = []
    desw_diff = []

    for scenario in scenarios:
        w_data = df[(df["scenario"] == scenario) & (df["consensus"] == "WEIGHTED")]
        d_data = df[(df["scenario"] == scenario) & (df["consensus"] == "DESW")]

        weighted_diff.append(w_data["difference"].values[0] if len(w_data) > 0 else 0)
        desw_diff.append(d_data["difference"].values[0] if len(d_data) > 0 else 0)

    ax3.bar(x_pos, weighted_diff, width, label="WEIGHTED", color="steelblue")
    ax3.bar(x_pos2, desw_diff, width, label="DESW", color="coral")

    ax3.axhline(y=0, color="black", linestyle="-", linewidth=0.5)
    ax3.set_xlabel("Scenario")
    ax3.set_ylabel("Selection Difference (With - Without)")
    ax3.set_title("Absolute Difference in Selections")
    ax3.set_xticks(x)
    ax3.set_xticklabels(
        [s.replace("Validator - ", "\n") for s in scenarios],
        rotation=45,
        ha="right",
        fontsize=8,
    )
    ax3.legend()
    ax3.grid(axis="y", alpha=0.3)

    # Plot 4: Sybil resistance comparison
    ax4 = axes[1, 1]

    # Lower percentage change = better sybil resistance
    consensus_names = ["WEIGHTED", "DESW"]
    avg_pct_change = [
        df[df["consensus"] == "WEIGHTED"]["percentage_change"].mean(),
        df[df["consensus"] == "DESW"]["percentage_change"].mean(),
    ]

    colors = ["steelblue", "coral"]
    bars = ax4.bar(consensus_names, avg_pct_change, color=colors, alpha=0.7)

    # Add value labels on bars
    for bar, val in zip(bars, avg_pct_change):
        height = bar.get_height()
        ax4.text(
            bar.get_x() + bar.get_width() / 2.0,
            height,
            f"{val:.2f}%",
            ha="center",
            va="bottom",
            fontweight="bold",
        )

    ax4.set_ylabel("Average Percentage Change (%)")
    ax4.set_title("Average Sybil Attack Impact\n(Lower = Better Resistance)")
    ax4.grid(axis="y", alpha=0.3)

    # Thêm annotation
    winner = "DESW" if avg_pct_change[1] < avg_pct_change[0] else "WEIGHTED"
    ax4.text(
        0.5,
        max(avg_pct_change) * 0.5,
        f"Winner: {winner}\n(Better Sybil Resistance)",
        ha="center",
        fontsize=12,
        bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.5),
    )

    plt.tight_layout()

    # Save plot
    output_path = os.path.join(output_dir, "sybil_comparison_plots.png")
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    print(f"\n✓ Đã lưu biểu đồ: {output_path}")

    plt.show()


def print_summary_table(summary_csv_path: str):
    """In bảng tóm tắt từ CSV"""
    df = pd.read_csv(summary_csv_path)

    print("\n" + "=" * 90)
    print("BẢNG TÓM TẮT KẾT QUẢ")
    print("=" * 90)

    print(
        f"\n{'Scenario':<40} {'Consensus':<12} {'No Sybil':<12} {'With Sybil':<12} {'Change':<15}"
    )
    print("-" * 90)

    for _, row in df.iterrows():
        print(
            f"{row['scenario']:<40} "
            f"{row['consensus']:<12} "
            f"{row['selections_no_sybil']:<12} "
            f"{row['selections_with_sybil']:<12} "
            f"{row['difference']:+5.0f} ({row['percentage_change']:+.2f}%)"
        )

    print("\n" + "=" * 90)
    print("THỐNG KÊ TỔNG HỢP")
    print("=" * 90)

    for consensus in df["consensus"].unique():
        consensus_df = df[df["consensus"] == consensus]
        print(f"\n{consensus}:")
        print(f"  Average % change: {consensus_df['percentage_change'].mean():.2f}%")
        print(f"  Max % change:     {consensus_df['percentage_change'].max():.2f}%")
        print(f"  Min % change:     {consensus_df['percentage_change'].min():.2f}%")
        print(f"  Std dev:          {consensus_df['percentage_change'].std():.2f}%")


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python visualize_results.py <path_to_summary_csv>")
        print("\nExample:")
        print(
            "  python visualize_results.py results/multi_scenario/multi_scenario_summary_20251204_120000.csv"
        )

        # Try to find latest summary file
        results_dir = Path("results/multi_scenario")
        if results_dir.exists():
            csv_files = list(results_dir.glob("multi_scenario_summary_*.csv"))
            if csv_files:
                latest_csv = max(csv_files, key=lambda p: p.stat().st_mtime)
                print(f"\nLatest summary file found: {latest_csv}")
                response = input("Use this file? (y/n): ")
                if response.lower() == "y":
                    summary_csv_path = str(latest_csv)
                else:
                    return
            else:
                print("\nNo summary files found in results/multi_scenario/")
                return
        else:
            print("\nDirectory results/multi_scenario/ not found.")
            return
    else:
        summary_csv_path = sys.argv[1]

    if not os.path.exists(summary_csv_path):
        print(f"Error: File not found: {summary_csv_path}")
        return

    print(f"Đang phân tích file: {summary_csv_path}")

    # Print summary table
    print_summary_table(summary_csv_path)

    # Generate plots
    print("\nĐang tạo biểu đồ...")
    plot_selection_comparison(summary_csv_path)

    print("\n✓ Hoàn thành!")


if __name__ == "__main__":
    main()
