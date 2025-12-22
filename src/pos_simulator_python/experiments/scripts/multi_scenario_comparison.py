#!/usr/bin/env python3
"""
Multi-Scenario Comparison: WEIGHTED vs DESW

Chạy nhiều kịch bản khác nhau với các thông số khác nhau:
- Số lượng splits khác nhau (2, 3, 5, 10)
- Timing khác nhau (sybil sớm vs sybil muộn)
- Target entities khác nhau (validator giàu vs nghèo)

Tất cả đều có 2 phiên bản: với/không sybil attack
"""

import sys
import os
import random
import numpy as np
import pandas as pd
import json
from datetime import datetime
from typing import Dict, List, Tuple
import copy

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "src"))

from parameters import Parameters, PoS, Distribution, NewEntry
from utils import generate_peers, gini
from detailed_tracker import simulate_with_detailed_tracking


class MultiScenarioComparison:
    """Class để chạy nhiều scenarios và so sánh"""

    def __init__(
        self,
        n_epochs: int = 10000,
        n_peers: int = 50,
        n_corrupted: int = 5,
        initial_stake_volume: float = 5000.0,
        starting_gini: float = 0.3,
        reward: float = 20.0,
    ):
        self.n_epochs = n_epochs
        self.n_peers = n_peers
        self.n_corrupted = n_corrupted
        self.initial_stake_volume = initial_stake_volume
        self.starting_gini = starting_gini
        self.reward = reward

        # Generate base stakes (sẽ reuse cho tất cả scenarios)
        random.seed(42)
        np.random.seed(42)
        self.base_stakes = generate_peers(
            n_peers, initial_stake_volume, Distribution.RANDOM, starting_gini
        )
        self.base_corrupted = random.sample(range(n_peers), n_corrupted)

        # Tìm validators giàu nhất và nghèo nhất
        stakes_with_idx = [(i, stake) for i, stake in enumerate(self.base_stakes)]
        stakes_sorted = sorted(stakes_with_idx, key=lambda x: x[1], reverse=True)
        self.richest_validator = stakes_sorted[0][0]
        self.poorest_validator = stakes_sorted[-1][0]

        print(f"\nStake Distribution:")
        print(
            f"  Richest validator (ID {self.richest_validator}): {stakes_sorted[0][1]:.2f}"
        )
        print(
            f"  Poorest validator (ID {self.poorest_validator}): {stakes_sorted[-1][1]:.2f}"
        )

    def run_single_scenario(
        self,
        consensus_type: PoS,
        scenario_name: str,
        target_entity_id: int,
        sybil_epoch: int,
        num_splits: int,
        with_sybil: bool,
    ) -> Dict:
        """Chạy một scenario duy nhất"""

        scheduled_sybil = []
        if with_sybil:
            scheduled_sybil = [(sybil_epoch, target_entity_id, num_splits)]

        params = Parameters(
            n_epochs=self.n_epochs,
            proof_of_stake=consensus_type,
            initial_stake_volume=self.initial_stake_volume,
            initial_distribution=Distribution.RANDOM,
            n_peers=self.n_peers,
            n_corrupted=self.n_corrupted,
            p_fail=0.5,
            p_join=0.0,
            p_leave=0.0,
            join_amount=NewEntry.NEW_RANDOM,
            penalty_percentage=0.5,
            reward=self.reward,
            scheduled_joins=[],
            scheduled_sybil_attacks=scheduled_sybil,
        )

        # Run simulation
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
            shapley_gini_liveness_final,
            shapley_gini_safety_final,
            shapley_gini_correlation_final,
            detailed_peer_data,
        ) = simulate_with_detailed_tracking(
            self.base_stakes.copy(), self.base_corrupted.copy(), params
        )

        # Analyze selection counts
        selection_by_entity = {}
        for epoch_data in detailed_peer_data:
            for peer in epoch_data:
                if peer["is_selected"]:
                    entity_id = peer["entity_id"]
                    selection_by_entity[entity_id] = (
                        selection_by_entity.get(entity_id, 0) + 1
                    )

        target_selections = selection_by_entity.get(target_entity_id, 0)

        return {
            "scenario_name": scenario_name,
            "consensus_type": consensus_type.name,
            "with_sybil": with_sybil,
            "target_entity_id": target_entity_id,
            "sybil_epoch": sybil_epoch,
            "num_splits": num_splits,
            "target_selections": target_selections,
            "total_epochs": self.n_epochs,
            "selection_percentage": (target_selections / self.n_epochs * 100),
            "final_gini": gini_history[-1] if gini_history else 0,
            "final_nakamoto": nakamoto_history[-1] if nakamoto_history else 0,
            "detailed_peer_data": detailed_peer_data,
        }

    def compare_scenario(
        self,
        consensus_types: List[PoS],
        scenario_name: str,
        target_entity_id: int,
        sybil_epoch: int,
        num_splits: int,
    ) -> Dict:
        """So sánh một scenario cho nhiều consensus types"""

        print(f"\n{'='*70}")
        print(f"SCENARIO: {scenario_name}")
        print(f"{'='*70}")
        print(f"  Target Entity: {target_entity_id}")
        print(f"  Sybil Epoch: {sybil_epoch}")
        print(f"  Num Splits: {num_splits}")

        results = {}

        for consensus_type in consensus_types:
            print(f"\n  Đang chạy {consensus_type.name}...")

            # Run without sybil
            result_no_sybil = self.run_single_scenario(
                consensus_type,
                scenario_name,
                target_entity_id,
                sybil_epoch,
                num_splits,
                with_sybil=False,
            )

            # Run with sybil
            result_with_sybil = self.run_single_scenario(
                consensus_type,
                scenario_name,
                target_entity_id,
                sybil_epoch,
                num_splits,
                with_sybil=True,
            )

            # Calculate comparison
            selections_no_sybil = result_no_sybil["target_selections"]
            selections_with_sybil = result_with_sybil["target_selections"]
            difference = selections_with_sybil - selections_no_sybil
            percentage_change = (
                (difference / selections_no_sybil * 100)
                if selections_no_sybil > 0
                else 0
            )

            results[consensus_type.name] = {
                "no_sybil": result_no_sybil,
                "with_sybil": result_with_sybil,
                "comparison": {
                    "selections_no_sybil": selections_no_sybil,
                    "selections_with_sybil": selections_with_sybil,
                    "difference": difference,
                    "percentage_change": percentage_change,
                },
            }

            print(
                f"    Không Sybil: {selections_no_sybil} lần ({result_no_sybil['selection_percentage']:.2f}%)"
            )
            print(
                f"    Có Sybil:    {selections_with_sybil} lần ({result_with_sybil['selection_percentage']:.2f}%)"
            )
            print(f"    Chênh lệch:  {difference:+d} lần ({percentage_change:+.2f}%)")

        return {
            "scenario_name": scenario_name,
            "results": results,
        }

    def run_all_scenarios(self, consensus_types: List[PoS]) -> Dict:
        """Chạy tất cả scenarios"""

        all_scenarios = {}

        # Scenario 1: Validator giàu nhất, split sớm
        all_scenarios["rich_early_split"] = self.compare_scenario(
            consensus_types,
            "Rich Validator - Early Split",
            target_entity_id=self.richest_validator,
            sybil_epoch=2000,
            num_splits=3,
        )

        # Scenario 2: Validator giàu nhất, split muộn
        all_scenarios["rich_late_split"] = self.compare_scenario(
            consensus_types,
            "Rich Validator - Late Split",
            target_entity_id=self.richest_validator,
            sybil_epoch=8000,
            num_splits=3,
        )

        # Scenario 3: Validator nghèo nhất, split giữa
        all_scenarios["poor_mid_split"] = self.compare_scenario(
            consensus_types,
            "Poor Validator - Mid Split",
            target_entity_id=self.poorest_validator,
            sybil_epoch=5000,
            num_splits=3,
        )

        # Scenario 4: Validator giàu, nhiều splits
        all_scenarios["rich_many_splits"] = self.compare_scenario(
            consensus_types,
            "Rich Validator - Many Splits",
            target_entity_id=self.richest_validator,
            sybil_epoch=5000,
            num_splits=10,
        )

        # Scenario 5: Validator giàu, ít splits
        all_scenarios["rich_few_splits"] = self.compare_scenario(
            consensus_types,
            "Rich Validator - Few Splits",
            target_entity_id=self.richest_validator,
            sybil_epoch=5000,
            num_splits=2,
        )

        return all_scenarios


def save_all_results(all_scenarios: Dict, output_dir: str = "results/multi_scenario"):
    """Lưu tất cả kết quả"""
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Save summary CSV
    summary_rows = []
    for scenario_name, scenario_data in all_scenarios.items():
        for consensus_name, consensus_data in scenario_data["results"].items():
            comp = consensus_data["comparison"]
            summary_rows.append(
                {
                    "scenario": scenario_data["scenario_name"],
                    "consensus": consensus_name,
                    "selections_no_sybil": comp["selections_no_sybil"],
                    "selections_with_sybil": comp["selections_with_sybil"],
                    "difference": comp["difference"],
                    "percentage_change": comp["percentage_change"],
                }
            )

    df_summary = pd.DataFrame(summary_rows)
    summary_path = os.path.join(output_dir, f"multi_scenario_summary_{timestamp}.csv")
    df_summary.to_csv(summary_path, index=False)
    print(f"\n✓ Đã lưu Summary CSV: {summary_path}")

    # Save detailed JSON (without peer data to reduce size)
    json_data = copy.deepcopy(all_scenarios)
    for scenario_name, scenario_data in json_data.items():
        for consensus_name, consensus_data in scenario_data["results"].items():
            consensus_data["no_sybil"].pop("detailed_peer_data", None)
            consensus_data["with_sybil"].pop("detailed_peer_data", None)

    json_path = os.path.join(output_dir, f"multi_scenario_detailed_{timestamp}.json")
    with open(json_path, "w") as f:
        json.dump(json_data, f, indent=2)
    print(f"✓ Đã lưu Detailed JSON: {json_path}")

    # Save individual CSVs for each scenario (optional)
    for scenario_name, scenario_data in all_scenarios.items():
        for consensus_name, consensus_data in scenario_data["results"].items():
            # Save with sybil CSV
            with_sybil_data = consensus_data["with_sybil"]["detailed_peer_data"]
            csv_path = os.path.join(
                output_dir,
                f"{scenario_name}_{consensus_name}_WITH_SYBIL_{timestamp}.csv",
            )
            save_peer_data_to_csv(with_sybil_data, csv_path)

    print(f"✓ Đã lưu tất cả CSV files vào: {output_dir}")


def save_peer_data_to_csv(detailed_peer_data: List[Dict], output_path: str):
    """Lưu peer data ra CSV"""
    rows = []
    for epoch_data in detailed_peer_data:
        rows.extend(epoch_data)
    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)


def print_final_comparison(all_scenarios: Dict):
    """In bảng so sánh cuối cùng"""
    print(f"\n{'#'*70}")
    print("BẢNG SO SÁNH TỔNG HỢP")
    print(f"{'#'*70}\n")

    print(
        f"{'Scenario':<35} {'Consensus':<12} {'No Sybil':<12} {'With Sybil':<12} {'Change':<15}"
    )
    print("-" * 90)

    for scenario_name, scenario_data in all_scenarios.items():
        for consensus_name, consensus_data in scenario_data["results"].items():
            comp = consensus_data["comparison"]
            print(
                f"{scenario_data['scenario_name']:<35} "
                f"{consensus_name:<12} "
                f"{comp['selections_no_sybil']:<12} "
                f"{comp['selections_with_sybil']:<12} "
                f"{comp['difference']:+5d} ({comp['percentage_change']:+.2f}%)"
            )
        print()


def main():
    """Main function"""
    print("=" * 70)
    print("MULTI-SCENARIO COMPARISON: WEIGHTED vs DESW")
    print("=" * 70)

    # Configuration
    CONFIG = {
        "n_epochs": 10000,
        "n_peers": 50,
        "n_corrupted": 5,
        "initial_stake_volume": 5000.0,
        "starting_gini": 0.3,
        "reward": 20.0,
    }

    print("\nCấu hình chung:")
    for key, value in CONFIG.items():
        print(f"  {key}: {value}")

    # Consensus types to compare
    consensus_types = [PoS.WEIGHTED, PoS.DESW]

    # Create comparator
    comparator = MultiScenarioComparison(**CONFIG)

    # Run all scenarios
    all_scenarios = comparator.run_all_scenarios(consensus_types)

    # Print final comparison
    print_final_comparison(all_scenarios)

    # Save results
    save_all_results(all_scenarios)

    print("\n" + "=" * 70)
    print("HOÀN THÀNH!")
    print("=" * 70)


if __name__ == "__main__":
    main()
