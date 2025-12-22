#!/usr/bin/env python3
"""
Quick Test Script - Chạy nhanh để test

Chạy simulation nhỏ (1000 epochs) để test nhanh functionality
"""

import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "src"))

from compare_weighted_desw_sybil import SybilComparisonSimulator
from parameters import PoS


def main():
    """Quick test với parameters nhỏ"""
    print("=" * 70)
    print("QUICK TEST - WEIGHTED vs DESW (1000 epochs)")
    print("=" * 70)

    # Small config for quick testing
    CONFIG = {
        "n_epochs": 1000,  # Giảm xuống 1000 epochs
        "n_peers": 20,  # Giảm số peers
        "n_corrupted": 2,
        "initial_stake_volume": 5000.0,
        "starting_gini": 0.3,
        "reward": 20.0,
        "target_entity_id": 0,
        "sybil_epoch": 500,  # Sybil ở giữa
        "num_splits": 3,
    }

    print("\nCấu hình test (small):")
    for key, value in CONFIG.items():
        print(f"  {key}: {value}")

    # Test WEIGHTED
    print("\n" + "=" * 70)
    print("Testing WEIGHTED PoS...")
    print("=" * 70)

    simulator_weighted = SybilComparisonSimulator(consensus_type=PoS.WEIGHTED, **CONFIG)

    result_weighted = simulator_weighted.compare_scenarios()

    # Test DESW
    print("\n" + "=" * 70)
    print("Testing DESW PoS...")
    print("=" * 70)

    simulator_desw = SybilComparisonSimulator(consensus_type=PoS.DESW, **CONFIG)

    result_desw = simulator_desw.compare_scenarios()

    # Quick comparison
    print("\n" + "=" * 70)
    print("QUICK COMPARISON RESULTS")
    print("=" * 70)

    weighted_comp = result_weighted["comparison"]
    desw_comp = result_desw["comparison"]

    print(f"\nWEIGHTED:")
    print(f"  No Sybil:  {weighted_comp['selections_no_sybil']} selections")
    print(f"  With Sybil: {weighted_comp['selections_with_sybil']} selections")
    print(
        f"  Change:     {weighted_comp['difference']:+d} ({weighted_comp['percentage_change']:+.2f}%)"
    )

    print(f"\nDESW:")
    print(f"  No Sybil:  {desw_comp['selections_no_sybil']} selections")
    print(f"  With Sybil: {desw_comp['selections_with_sybil']} selections")
    print(
        f"  Change:     {desw_comp['difference']:+d} ({desw_comp['percentage_change']:+.2f}%)"
    )

    # Determine which is more resistant
    print(f"\n{'='*70}")
    if abs(weighted_comp["percentage_change"]) < abs(desw_comp["percentage_change"]):
        print("✓ WEIGHTED shows better sybil resistance in this test")
    elif abs(desw_comp["percentage_change"]) < abs(weighted_comp["percentage_change"]):
        print("✓ DESW shows better sybil resistance in this test")
    else:
        print("✓ Both consensus show similar sybil resistance")

    print(f"{'='*70}")
    print("\n✓ Quick test completed!")
    print("\nNOTE: Đây chỉ là test nhanh với 1000 epochs.")
    print("Để có kết quả chính xác hơn, chạy:")
    print("  - compare_weighted_desw_sybil.py (10000 epochs, 2 consensus)")
    print("  - multi_scenario_comparison.py (10000 epochs, 5 scenarios)")


if __name__ == "__main__":
    main()
