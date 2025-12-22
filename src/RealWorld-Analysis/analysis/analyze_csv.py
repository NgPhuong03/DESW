#!/usr/bin/env python3
"""
Analyze decentralization metrics from CSV file
Calculate all metrics and save results to CSV
"""

import pandas as pd
import numpy as np
import os
import sys
from datetime import datetime

from coefficient import (
    calculate_gini_coefficient,
    calculate_nakamoto_coefficient,
    calculate_nakamoto_coefficient_liveness,
    calculate_nakamoto_coefficient_safety,
    calculate_hhi_coefficient,
    calculate_theil_index,
    calculate_zipf_coefficient,
    calculate_palma_ratio,
    calculate_shannon_index,
    calculate_gamma_delta,
    calculate_shapley_gini,
)


def analyze_csv_file(
    csv_path,
    col="tokens",
    output_dir=None,
    calculate_shapley=True,
    shapley_samples=1000,
    exclude_unidentified=False,
):
    """
    Analyze CSV file and calculate all decentralization metrics

    Args:
        csv_path: Path to CSV file
        col: Column name containing stake values (default 'tokens')
        output_dir: Directory to save results (default: same directory as CSV)
        calculate_shapley: Whether to calculate Shapley Gini (slow computation)
        shapley_samples: Number of samples for Shapley Gini (default 1000)
        exclude_unidentified: Whether to remove rows with address "Unidentified"

    Returns:
        Dictionary containing all calculated metrics
    """
    print("ANALYZING DECENTRALIZATION METRICS")

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"File not found: {csv_path}")

    print(f"\nReading file: {csv_path}")
    df = pd.read_csv(csv_path)

    if col not in df.columns:
        raise ValueError(f"Column '{col}' does not exist in CSV file")

    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df_clean = df[df[col] > 0].copy()

    if exclude_unidentified and "address" in df_clean.columns:
        before_unidentified_filter = len(df_clean)
        df_clean = df_clean[df_clean["address"] != "Unidentified"].copy()
        unidentified_count = before_unidentified_filter - len(df_clean)
        if unidentified_count > 0:
            print(
                f"  - Removed: {unidentified_count} validators with address = 'Unidentified'"
            )

    removed_count = len(df) - len(df_clean)

    print(f"  - Total validators: {len(df)}")
    print(f"  - Validators with stake > 0: {len(df_clean)}")
    if removed_count > 0:
        print(f"  - Removed: {removed_count} validators (stake = 0 or NaN)")
    print(f"  - Total stake: {df_clean[col].sum():,.0f}")
    print(f"  - Mean stake: {df_clean[col].mean():,.2f}")
    print(f"  - Max stake: {df_clean[col].max():,.0f}")
    print(f"  - Min stake: {df_clean[col].min():,.0f}")

    print(f"\nCalculating metrics...")

    results = {}

    print("  - Calculating Gini Coefficient...")
    gini = calculate_gini_coefficient(df_clean, col)
    results["gini"] = gini
    print(f"    Gini: {gini:.4f}")

    print("  - Calculating Nakamoto Coefficient (50%)...")
    nakamoto = calculate_nakamoto_coefficient(df_clean, col)
    results["nakamoto"] = nakamoto
    print(f"    Nakamoto (50%): {nakamoto}")

    print("  - Calculating Nakamoto Coefficient Liveness (33%)...")
    nakamoto_liveness, nakamoto_liveness_pct = calculate_nakamoto_coefficient_liveness(
        df_clean, col
    )
    results["nakamoto_liveness"] = nakamoto_liveness
    results["nakamoto_liveness_percentage"] = nakamoto_liveness_pct
    print(f"    Nakamoto Liveness: {nakamoto_liveness} ({nakamoto_liveness_pct}%)")

    print("  - Calculating Nakamoto Coefficient Safety (66%)...")
    nakamoto_safety, nakamoto_safety_pct = calculate_nakamoto_coefficient_safety(
        df_clean, col
    )
    results["nakamoto_safety"] = nakamoto_safety
    results["nakamoto_safety_percentage"] = nakamoto_safety_pct
    print(f"    Nakamoto Safety: {nakamoto_safety} ({nakamoto_safety_pct}%)")

    print("  - Calculating HHI Coefficient...")
    hhi = calculate_hhi_coefficient(df_clean, col, normalize=False)
    hhi_normalized = calculate_hhi_coefficient(df_clean, col, normalize=True)
    results["hhi"] = hhi
    results["hhi_normalized"] = hhi_normalized
    print(f"    HHI: {hhi:.4f} (Normalized: {hhi_normalized:.4f})")

    print("  - Calculating Theil Index...")
    theil = calculate_theil_index(df_clean, col)
    results["theil"] = theil
    print(f"    Theil: {theil:.4f}")

    print("  - Calculating Zipf Coefficient...")
    zipf = calculate_zipf_coefficient(df_clean, col)
    results["zipf"] = zipf
    print(f"    Zipf: {zipf:.4f}")

    print("  - Calculating Palma Ratio...")
    palma = calculate_palma_ratio(df_clean, col)
    results["palma"] = palma
    if palma != float("inf"):
        print(f"    Palma: {palma:.4f}")
    else:
        print(f"    Palma: inf")

    print("  - Calculating Shannon Index...")
    shannon = calculate_shannon_index(df_clean, col)
    results["shannon"] = shannon
    print(f"    Shannon: {shannon:.4f}")

    print("  - Calculating Gamma-Delta...")
    gamma_values = [10, 25, 50, 75, 90]
    gamma_delta_results = {}
    for gamma in gamma_values:
        delta = calculate_gamma_delta(df_clean, col, gamma=gamma)
        gamma_delta_results[f"gamma_{gamma}"] = delta
        if delta != float("inf"):
            print(f"    Gamma {gamma}%: {delta:.4f}")
        else:
            print(f"    Gamma {gamma}%: inf")
    results["gamma_delta"] = gamma_delta_results

    if calculate_shapley:
        print("  - Calculating Shapley Gini (may take a few minutes)...")
        try:
            shapley_liveness, shapley_safety, shapley_correlation = (
                calculate_shapley_gini(df_clean, col, num_samples=shapley_samples)
            )
            results["shapley_gini_liveness"] = shapley_liveness
            results["shapley_gini_safety"] = shapley_safety
            results["shapley_gini_correlation"] = shapley_correlation
            print(f"    Shapley Gini Liveness: {shapley_liveness:.4f}")
            print(f"    Shapley Gini Safety: {shapley_safety:.4f}")
            print(f"    Shapley Gini Correlation: {shapley_correlation:.4f}")
        except Exception as e:
            print(f"    ⚠ Error calculating Shapley Gini: {e}")
            results["shapley_gini_liveness"] = None
            results["shapley_gini_safety"] = None
            results["shapley_gini_correlation"] = None
    else:
        results["shapley_gini_liveness"] = None
        results["shapley_gini_safety"] = None
        results["shapley_gini_correlation"] = None

    results["data_info"] = {
        "file_path": csv_path,
        "total_validators": len(df),
        "validators_with_stake": len(df_clean),
        "total_stake": float(df_clean[col].sum()),
        "mean_stake": float(df_clean[col].mean()),
        "max_stake": float(df_clean[col].max()),
        "min_stake": float(df_clean[col].min()),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    if output_dir is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(script_dir, "..", "results")
        output_dir = os.path.abspath(output_dir)

    os.makedirs(output_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(csv_path))[0]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    csv_output_path = os.path.join(output_dir, f"{base_name}_metrics_{timestamp}.csv")

    csv_data = {
        "Metric": [],
        "Value": [],
    }

    csv_data["Metric"].extend(
        [
            "Gini Coefficient",
            "Nakamoto Coefficient (50%)",
            "Nakamoto Coefficient Liveness (33%)",
            "Nakamoto Coefficient Liveness (%)",
            "Nakamoto Coefficient Safety (66%)",
            "Nakamoto Coefficient Safety (%)",
            "HHI",
            "HHI Normalized",
            "Theil Index",
            "Zipf Coefficient",
            "Palma Ratio",
            "Shannon Index",
        ]
    )
    csv_data["Value"].extend(
        [
            f"{gini:.6f}",
            str(nakamoto),
            str(nakamoto_liveness),
            f"{nakamoto_liveness_pct:.2f}%",
            str(nakamoto_safety),
            f"{nakamoto_safety_pct:.2f}%",
            f"{hhi:.6f}",
            f"{hhi_normalized:.6f}",
            f"{theil:.6f}",
            f"{zipf:.6f}",
            f"{palma:.6f}" if palma != float("inf") else "inf",
            f"{shannon:.6f}",
        ]
    )

    for gamma, delta in gamma_delta_results.items():
        gamma_num = gamma.replace("gamma_", "")
        csv_data["Metric"].append(f"Gamma-Delta (gamma={gamma_num}%)")
        csv_data["Value"].append(f"{delta:.6f}" if delta != float("inf") else "inf")

    if results["shapley_gini_liveness"] is not None:
        csv_data["Metric"].extend(
            [
                "Shapley Gini Liveness",
                "Shapley Gini Safety",
                "Shapley Gini Correlation",
            ]
        )
        csv_data["Value"].extend(
            [
                f"{results['shapley_gini_liveness']:.6f}",
                f"{results['shapley_gini_safety']:.6f}",
                f"{results['shapley_gini_correlation']:.6f}",
            ]
        )

    csv_data["Metric"].extend(
        [
            "Total Validators",
            "Validators with Stake > 0",
            "Total Stake",
            "Mean Stake",
            "Max Stake",
            "Min Stake",
        ]
    )
    csv_data["Value"].extend(
        [
            str(results["data_info"]["total_validators"]),
            str(results["data_info"]["validators_with_stake"]),
            f"{results['data_info']['total_stake']:,.0f}",
            f"{results['data_info']['mean_stake']:,.2f}",
            f"{results['data_info']['max_stake']:,.0f}",
            f"{results['data_info']['min_stake']:,.0f}",
        ]
    )

    df_output = pd.DataFrame(csv_data)
    df_output.to_csv(csv_output_path, index=False, encoding="utf-8")
    print(f"\n✓ Results saved to: {csv_output_path}")

    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    print(f"Gini Coefficient: {gini:.4f}")
    print(f"Nakamoto Coefficient (50%): {nakamoto}")
    print(
        f"Nakamoto Coefficient Liveness (33%): {nakamoto_liveness} ({nakamoto_liveness_pct}%)"
    )
    print(
        f"Nakamoto Coefficient Safety (66%): {nakamoto_safety} ({nakamoto_safety_pct}%)"
    )
    print(f"HHI: {hhi:.4f} (Normalized: {hhi_normalized:.4f})")
    print(f"Theil Index: {theil:.4f}")
    print(f"Zipf Coefficient: {zipf:.4f}")
    print(f"Palma Ratio: {palma:.4f}" if palma != float("inf") else f"Palma Ratio: inf")
    print(f"Shannon Index: {shannon:.4f}")

    if calculate_shapley and results["shapley_gini_liveness"] is not None:
        print(f"\nShapley Gini:")
        print(f"  Liveness: {results['shapley_gini_liveness']:.4f}")
        print(f"  Safety: {results['shapley_gini_safety']:.4f}")
        print(f"  Correlation: {results['shapley_gini_correlation']:.4f}")

    print(f"\n{'='*70}")
    print(f"Results saved in: {output_dir}")
    print(f"  - CSV: {os.path.basename(csv_output_path)}")

    return results


def main():
    """Main function to run analysis"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Analyze decentralization metrics from CSV file"
    )
    parser.add_argument("csv_file", type=str, help="Path to CSV file to analyze")
    parser.add_argument(
        "--col",
        type=str,
        default="tokens",
        help="Column name containing stake values (default: 'tokens')",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Directory to save results (default: same directory as CSV)",
    )
    parser.add_argument(
        "--no-shapley",
        action="store_true",
        help="Skip Shapley Gini calculation (slow computation)",
    )
    parser.add_argument(
        "--shapley-samples",
        type=int,
        default=1000,
        help="Number of samples for Shapley Gini (default: 1000)",
    )
    parser.add_argument(
        "--exclude-unidentified",
        action="store_true",
        help="Remove rows with address 'Unidentified'",
    )

    args = parser.parse_args()

    results = analyze_csv_file(
        csv_path=args.csv_file,
        col=args.col,
        output_dir=args.output_dir,
        calculate_shapley=not args.no_shapley,
        shapley_samples=args.shapley_samples,
        exclude_unidentified=args.exclude_unidentified,
    )

    return results


if __name__ == "__main__":

    if len(sys.argv) == 1:

        default_csv = os.path.join(
            os.path.dirname(__file__), "..", "data", "19122025_ethereum.csv"
        )
        if os.path.exists(default_csv):
            print(f"Using default file: {default_csv}")
            results = analyze_csv_file(
                csv_path=default_csv,
                col="tokens",
                calculate_shapley=False,
                exclude_unidentified=True,
            )
        else:
            print("Please provide path to CSV file:")
            print("  python analyze_csv.py <path_to_csv> [--col <column_name>]")
            print("\nOr use:")
            print("  python analyze_csv.py data/04122025_ethereum.csv")
    else:
        main()
