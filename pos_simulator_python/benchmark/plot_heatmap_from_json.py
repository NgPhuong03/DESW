#!/usr/bin/env python3
"""
Plot DESW heatmaps from a JSON results file (same logic as desw_p_sensitivity.py)

This script expects a JSON file with the following structure (like the provided sample):
{
  "grid": {
    "0.0": {
      "0.6": { "final_gini_mean": ..., "final_gini_std": ... },
      "0.7": { ... },
      ...
    },
    "0.1": { ... },
    ...
  },
  "pmin_list": [0.0, 0.1, ...],
  "pmax_list": [0.6, 0.7, ...]
}

Usage examples:
  python plot_heatmap_from_json.py --json results/desw_p_sensitivity_YYYYMMDD_HHMMSS.json
  python plot_heatmap_from_json.py --json results/xxx.json --vmin 0.29 --vmax 0.32 --threshold 0.305 --cmap viridis --std-cmap Reds
"""

import os
import json
import argparse
from datetime import datetime
from typing import Dict, Any

import numpy as np
import matplotlib.pyplot as plt


def _get_cell(grid: Dict[str, Any], pmin: float, pmax: float) -> Dict[str, Any] | None:
    """Retrieve a cell from grid handling string/float keys robustly."""
    # Handle both float and string keys in JSON
    pmink = pmin if pmin in grid else str(pmin)
    row = grid.get(pmink)
    if row is None:
        # Try approximate match for float string formatting issues
        for k in grid.keys():
            try:
                if abs(float(k) - pmin) < 1e-9:
                    row = grid[k]
                    break
            except Exception:
                continue
        if row is None:
            return None

    pmaxk = pmax if pmax in row else str(pmax)
    cell = row.get(pmaxk)
    if cell is None:
        for k in row.keys():
            try:
                if abs(float(k) - pmax) < 1e-9:
                    cell = row[k]
                    break
            except Exception:
                continue
    return cell


def plot_heatmap(
    results: Dict[str, Any],
    title: str,
    out_path: str,
    vmin: float = 0.28,
    vmax: float = 0.33,
    color_threshold: float = 0.305,
    cmap: str = "viridis",
):
    pmin_list = results["pmin_list"]
    pmax_list = results["pmax_list"]
    grid = results["grid"]

    # Build matrices for final_gini_mean and std
    mat = np.full((len(pmin_list), len(pmax_list)), np.nan)
    mat_std = np.full((len(pmin_list), len(pmax_list)), np.nan)

    for i, pmin in enumerate(pmin_list):
        for j, pmax in enumerate(pmax_list):
            cell = _get_cell(grid, pmin, pmax)
            if cell:
                mat[i, j] = cell.get("final_gini_mean", np.nan)
                mat_std[i, j] = cell.get("final_gini_std", np.nan)

    plt.figure(figsize=(12, 8))

    im = plt.imshow(mat, origin="lower", aspect="auto", cmap=cmap, vmin=vmin, vmax=vmax)

    # Discrete ticks matching the tested values
    plt.xticks(ticks=range(len(pmax_list)), labels=[f"{v:.1f}" for v in pmax_list])
    plt.yticks(ticks=range(len(pmin_list)), labels=[f"{v:.1f}" for v in pmin_list])

    # Add text annotations for values and std
    for i in range(len(pmin_list)):
        for j in range(len(pmax_list)):
            if not np.isnan(mat[i, j]):
                color = "white" if mat[i, j] > color_threshold else "black"
                plt.text(
                    j,
                    i,
                    f"{mat[i, j]:.3f}",
                    ha="center",
                    va="center",
                    color=color,
                    fontsize=12,
                    fontweight="bold",
                )
                if not np.isnan(mat_std[i, j]):
                    plt.text(
                        j,
                        i + 0.3,
                        f"±{mat_std[i, j]:.3f}",
                        ha="center",
                        va="center",
                        color=color,
                        fontsize=10,
                        fontweight="bold",
                    )

    plt.colorbar(im, label="Final Gini (mean; lower is better)")
    plt.xlabel("pmax")
    plt.ylabel("pmin")
    plt.title(title)
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, bbox_inches="tight")
    print(f"Saved heatmap: {out_path}")


def plot_std_heatmap(
    results: Dict[str, Any],
    title: str,
    out_path: str,
    cmap: str = "Reds",
):
    pmin_list = results["pmin_list"]
    pmax_list = results["pmax_list"]
    grid = results["grid"]

    mat_std = np.full((len(pmin_list), len(pmax_list)), np.nan)
    for i, pmin in enumerate(pmin_list):
        for j, pmax in enumerate(pmax_list):
            cell = _get_cell(grid, pmin, pmax)
            if cell:
                mat_std[i, j] = cell.get("final_gini_std", np.nan)

    plt.figure(figsize=(12, 8))
    im = plt.imshow(mat_std, origin="lower", aspect="auto", cmap=cmap)
    plt.xticks(ticks=range(len(pmax_list)), labels=[f"{v:.1f}" for v in pmax_list])
    plt.yticks(ticks=range(len(pmin_list)), labels=[f"{v:.1f}" for v in pmin_list])

    # Annotate std values
    for i in range(len(pmin_list)):
        for j in range(len(pmax_list)):
            if not np.isnan(mat_std[i, j]):
                color = "white" if mat_std[i, j] > 0.01 else "black"
                plt.text(
                    j,
                    i,
                    f"{mat_std[i, j]:.3f}",
                    ha="center",
                    va="center",
                    color=color,
                    fontsize=12,
                    fontweight="bold",
                )

    plt.colorbar(im, label="Standard Deviation of Final Gini")
    plt.xlabel("pmax")
    plt.ylabel("pmin")
    plt.title(title)
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, bbox_inches="tight")
    print(f"Saved std heatmap: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Plot DESW heatmaps from JSON results")
    parser.add_argument("--json", required=False, help="Path to JSON results file")
    parser.add_argument(
        "--out-dir",
        default=None,
        help="Output directory for figures (default: alongside JSON in results/)",
    )
    parser.add_argument(
        "--tag",
        default=None,
        help="Custom tag to include in output filenames (default: timestamp)",
    )
    parser.add_argument(
        "--vmin", type=float, default=0.28, help="Heatmap lower bound (vmin)"
    )
    parser.add_argument(
        "--vmax", type=float, default=0.33, help="Heatmap upper bound (vmax)"
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.305,
        help="Annotation color threshold (white if value > threshold)",
    )
    parser.add_argument(
        "--cmap", default="viridis", help="Colormap for mean heatmap (default: viridis)"
    )
    parser.add_argument(
        "--std-cmap", default="Reds", help="Colormap for std heatmap (default: Reds)"
    )
    parser.add_argument(
        "--title",
        default="DESW Final Gini (mean) vs (pmin, pmax)",
        help="Title for mean heatmap",
    )
    parser.add_argument(
        "--std-title",
        default="DESW Final Gini Standard Deviation vs (pmin, pmax)",
        help="Title for std heatmap",
    )
    parser.add_argument(
        "--no-std", action="store_true", help="Skip plotting the std heatmap"
    )

    args = parser.parse_args()

    # Default to the attached example JSON if not provided
    if not args.json:
        args.json = os.path.join(
            os.path.dirname(__file__),
            "results_heatmap",
            "test.json",
        )
        print(f"Sử dụng file JSON mặc định: {args.json}")

    if not os.path.isfile(args.json):
        raise SystemExit(
            f"Không tìm thấy file JSON: {args.json}. Vui lòng chỉnh lại đường dẫn trong code hoặc dùng --json."
        )

    with open(args.json, "r", encoding="utf-8") as f:
        results = json.load(f)

    # Determine output directory
    if args.out_dir:
        out_dir = args.out_dir
    else:
        json_dir = os.path.dirname(os.path.abspath(args.json))
        # default to the same results directory as the JSON
        out_dir = (
            json_dir
            if os.path.basename(json_dir) == "results_heatmap"
            else os.path.join(json_dir, "results_heatmap")
        )
    os.makedirs(out_dir, exist_ok=True)

    tag = args.tag or datetime.now().strftime("%Y%m%d_%H%M%S")

    heatmap_path = os.path.join(out_dir, f"desw_gini_heatmap_from_json_{tag}.png")
    plot_heatmap(
        results,
        f"{args.title}\n(Values shown: mean ± std over 10 runs)",
        heatmap_path,
        vmin=0.28,
        vmax=0.33,
        color_threshold=args.threshold,
        cmap=args.cmap,
    )

    if not args.no_std:
        std_heatmap_path = os.path.join(
            out_dir, f"desw_gini_std_heatmap_from_json_{tag}.png"
        )
        plot_std_heatmap(
            results,
            f"{args.std_title}\n(Standard deviation)",
            std_heatmap_path,
            cmap=args.std_cmap,
        )


if __name__ == "__main__":
    main()
