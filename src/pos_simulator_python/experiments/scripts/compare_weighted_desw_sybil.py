#!/usr/bin/env python3
"""
Script so sánh WEIGHTED vs DESW PoS với Sybil Attack Analysis

So sánh 2 consensus với cùng parameters:
- WEIGHTED PoS
- DESW PoS

Mỗi kịch bản có 2 phiên bản:
1. Không có sybil attack
2. Có scheduled sybil attack

Mục tiêu: So sánh số lần validator được chọn làm proposer
khi không sybil vs khi sybil (tổng số lần các validator con được chọn)
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

from parameters import Parameters, PoS, Distribution, NewEntry, SType
from utils import generate_peers, gini
from detailed_tracker import simulate_with_detailed_tracking


class SybilComparisonSimulator:
    """Class để chạy và so sánh simulations với/không có sybil attack"""

    def __init__(
        self,
        consensus_type: PoS,
        n_epochs: int = 10000,
        n_peers: int = 1000,
        n_corrupted: int = 20,
        initial_stake_volume: float = 5000.0,
        starting_gini: float = 0.3,
        # Các Parameters khác
        initial_distribution: Distribution = Distribution.RANDOM,
        p_fail: float = 0.5,
        p_join: float = 0.001,
        p_leave: float = 0.001,
        join_amount: NewEntry = NewEntry.NEW_RANDOM,
        penalty_percentage: float = 0.5,
        theta: float = 0.3,
        s_type: SType = SType.LINEAR,
        k: float = 0.001,
        reward: float = 20.0,
        use_dynamic_reward: bool = False,
        p_sybil: float = 0.0,
        min_sybil_size: int = 2,
        max_sybil_size: int = 5,
        # Tham số riêng cho kịch bản Sybil
        target_entity_id: int = 0,  # Entity sẽ thực hiện sybil
        sybil_epoch: int = 1000,  # Epoch thực hiện sybil
        num_splits: int = 5,  # Số lượng splits
    ):
        self.consensus_type = consensus_type
        self.n_epochs = n_epochs
        self.n_peers = n_peers
        self.n_corrupted = n_corrupted
        self.initial_stake_volume = initial_stake_volume
        self.starting_gini = starting_gini
        self.initial_distribution = initial_distribution
        self.p_fail = p_fail
        self.p_join = p_join
        self.p_leave = p_leave
        self.join_amount = join_amount
        self.penalty_percentage = penalty_percentage
        self.theta = theta
        self.s_type = s_type
        self.k = k
        self.reward = reward
        self.use_dynamic_reward = use_dynamic_reward
        self.p_sybil = p_sybil
        self.min_sybil_size = min_sybil_size
        self.max_sybil_size = max_sybil_size
        self.target_entity_id = target_entity_id
        self.sybil_epoch = sybil_epoch
        self.num_splits = num_splits

        # Set random seed cho reproducibility
        random.seed(42)
        np.random.seed(42)

    def create_base_params(self, with_sybil: bool = False) -> Parameters:
        """
        Tạo base Parameters cho simulation.

        Làm giống style của run_weighted.py:
        chỉ set các field chính, còn lại để dùng default trong Parameters.
        """
        scheduled_sybil = None
        if with_sybil:
            scheduled_sybil = [
                (self.sybil_epoch, self.target_entity_id, self.num_splits)
            ]

        return Parameters(
            n_epochs=self.n_epochs,
            proof_of_stake=self.consensus_type,
            initial_stake_volume=self.initial_stake_volume,
            initial_distribution=self.initial_distribution,
            n_peers=self.n_peers,
            n_corrupted=self.n_corrupted,
            p_fail=self.p_fail,
            p_join=self.p_join,
            p_leave=self.p_leave,
            join_amount=self.join_amount,
            penalty_percentage=self.penalty_percentage,
            reward=self.reward,
            use_dynamic_reward=self.use_dynamic_reward,
            scheduled_joins=[],
            scheduled_sybil_attacks=scheduled_sybil,
        )

    def run_simulation(self, with_sybil: bool = False) -> Dict:
        """Chạy simulation và trả về kết quả chi tiết"""
        print(f"\n{'='*70}")
        print(
            f"Chạy {self.consensus_type.name} - {'VỚI' if with_sybil else 'KHÔNG'} Sybil Attack"
        )
        print(f"{'='*70}")

        params = self.create_base_params(with_sybil)

        # Generate initial stakes (cùng seed để giống nhau)
        random.seed(42)
        np.random.seed(42)
        stakes = generate_peers(
            self.n_peers,
            self.initial_stake_volume,
            self.initial_distribution,
            self.starting_gini,
        )

        # Generate corrupted list
        corrupted = random.sample(range(self.n_peers), self.n_corrupted)

        print(f"Initial Gini: {gini(stakes):.3f}")
        print(f"Peers: {len(stakes)}, Corrupted: {len(corrupted)}")
        print(f"Target Entity ID: {self.target_entity_id}")
        if with_sybil:
            print(
                f"Sybil Attack at Epoch {self.sybil_epoch}: Split into {self.num_splits} validators"
            )

        # Run simulation
        print("\nĐang chạy simulation...")
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
        ) = simulate_with_detailed_tracking(stakes.copy(), corrupted.copy(), params)

        print(f"\n✓ Simulation hoàn thành!")

        # Analyze selection counts
        selection_counts = self._analyze_selections(detailed_peer_data, with_sybil)

        return {
            "with_sybil": with_sybil,
            "consensus_type": self.consensus_type.name,
            "gini_history": gini_history,
            "peers_history": peers_history,
            "metrics": {
                "nakamoto": nakamoto_history[-1] if nakamoto_history else 0,
                "hhi": hhi_history[-1] if hhi_history else 0,
                "gini": gini_history[-1] if gini_history else 0,
            },
            "selection_counts": selection_counts,
            "detailed_peer_data": detailed_peer_data,
        }

    def _analyze_selections(
        self, detailed_peer_data: List[Dict], with_sybil: bool
    ) -> Dict:
        """Phân tích số lần được chọn cho target entity"""
        print("\nPhân tích số lần được chọn...")

        selection_by_entity = {}  # {entity_id: count}
        selection_by_validator = {}  # {validator_idx: count}

        for epoch_data in detailed_peer_data:
            for peer in epoch_data:
                if peer["is_selected"]:
                    entity_id = peer["entity_id"]
                    validator_idx = peer["validator_index"]

                    selection_by_entity[entity_id] = (
                        selection_by_entity.get(entity_id, 0) + 1
                    )
                    selection_by_validator[validator_idx] = (
                        selection_by_validator.get(validator_idx, 0) + 1
                    )

        # Tính tổng số lần target entity được chọn (bao gồm cả các validators con nếu có sybil)
        target_entity_selections = selection_by_entity.get(self.target_entity_id, 0)

        print(f"\n  Target Entity ID {self.target_entity_id}:")
        print(f"    Tổng số lần được chọn: {target_entity_selections}")

        if with_sybil:
            # Tìm tất cả validators thuộc target entity
            target_validators = []
            for epoch_data in detailed_peer_data:
                for peer in epoch_data:
                    if peer["entity_id"] == self.target_entity_id:
                        if peer["validator_index"] not in target_validators:
                            target_validators.append(peer["validator_index"])

            print(f"    Số validators (sau sybil): {len(target_validators)}")
            print(f"    Validator indices: {sorted(target_validators)}")

            # In chi tiết số lần mỗi validator con được chọn
            for val_idx in sorted(target_validators):
                count = selection_by_validator.get(val_idx, 0)
                print(f"      Validator {val_idx}: {count} lần")

        return {
            "target_entity_id": self.target_entity_id,
            "total_selections": target_entity_selections,
            "selection_by_entity": selection_by_entity,
            "selection_by_validator": selection_by_validator,
        }

    def compare_scenarios(self) -> Dict:
        """So sánh kịch bản với/không sybil"""
        print(f"\n{'#'*70}")
        print(f"BẮT ĐẦU SO SÁNH: {self.consensus_type.name}")
        print(f"{'#'*70}")

        # Run without sybil
        result_no_sybil = self.run_simulation(with_sybil=False)

        # Run with sybil
        result_with_sybil = self.run_simulation(with_sybil=True)

        # Compare results
        print(f"\n{'='*70}")
        print("SO SÁNH KẾT QUẢ")
        print(f"{'='*70}")

        selections_no_sybil = result_no_sybil["selection_counts"]["total_selections"]
        selections_with_sybil = result_with_sybil["selection_counts"][
            "total_selections"
        ]

        print(f"\nTarget Entity ID: {self.target_entity_id}")
        print(f"  Không có Sybil Attack: {selections_no_sybil} lần được chọn")
        print(f"  Có Sybil Attack:       {selections_with_sybil} lần được chọn")
        print(
            f"  Chênh lệch:            {selections_with_sybil - selections_no_sybil} lần"
        )

        percentage_change = (
            ((selections_with_sybil - selections_no_sybil) / selections_no_sybil * 100)
            if selections_no_sybil > 0
            else 0
        )
        print(f"  Phần trăm thay đổi:    {percentage_change:+.2f}%")

        return {
            "consensus_type": self.consensus_type.name,
            "target_entity_id": self.target_entity_id,
            "sybil_epoch": self.sybil_epoch,
            "num_splits": self.num_splits,
            "results": {
                "no_sybil": result_no_sybil,
                "with_sybil": result_with_sybil,
            },
            "comparison": {
                "selections_no_sybil": selections_no_sybil,
                "selections_with_sybil": selections_with_sybil,
                "difference": selections_with_sybil - selections_no_sybil,
                "percentage_change": percentage_change,
            },
        }


def save_detailed_csv(result: Dict, output_dir: str = "results/sybil_comparison"):
    """Lưu detailed data ra CSV files"""
    os.makedirs(output_dir, exist_ok=True)

    consensus_name = result["consensus_type"]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Save cho scenario không sybil
    no_sybil_data = result["results"]["no_sybil"]["detailed_peer_data"]
    csv_path_no_sybil = os.path.join(
        output_dir, f"{consensus_name}_NO_SYBIL_{timestamp}.csv"
    )
    save_peer_data_to_csv(no_sybil_data, csv_path_no_sybil)
    print(f"\n✓ Đã lưu CSV (NO SYBIL): {csv_path_no_sybil}")

    # Save cho scenario có sybil
    with_sybil_data = result["results"]["with_sybil"]["detailed_peer_data"]
    csv_path_with_sybil = os.path.join(
        output_dir, f"{consensus_name}_WITH_SYBIL_{timestamp}.csv"
    )
    save_peer_data_to_csv(with_sybil_data, csv_path_with_sybil)
    print(f"✓ Đã lưu CSV (WITH SYBIL): {csv_path_with_sybil}")

    # Save comparison summary
    summary_path = os.path.join(
        output_dir, f"{consensus_name}_SUMMARY_{timestamp}.json"
    )
    with open(summary_path, "w") as f:
        # Prepare data for JSON (remove detailed_peer_data to reduce size)
        summary = copy.deepcopy(result)
        summary["results"]["no_sybil"].pop("detailed_peer_data", None)
        summary["results"]["with_sybil"].pop("detailed_peer_data", None)
        json.dump(summary, f, indent=2)
    print(f"✓ Đã lưu Summary JSON: {summary_path}")


def save_peer_data_to_csv(detailed_peer_data: List[Dict], output_path: str):
    """Lưu peer data ra CSV"""
    # Flatten data
    rows = []
    for epoch_data in detailed_peer_data:
        rows.extend(epoch_data)

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)


def main():
    """Main function"""
    print("=" * 70)
    print("SO SÁNH WEIGHTED vs DESW - SYBIL ATTACK ANALYSIS")
    print("=" * 70)

    # Configuration – có thể sửa trực tiếp tất cả Parameters quan trọng ở đây
    CONFIG = {
        # --- Các tham số chính ---
        "n_epochs": 10000,
        "n_peers": 100,
        "n_corrupted": 5,
        "initial_stake_volume": 5000.0,
        "starting_gini": 0.3,
        "initial_distribution": Distribution.RANDOM,  # UNIFORM / GINI / RANDOM
        "reward": 20.0,
        # --- Xác suất & hành vi validator ---
        "p_fail": 0.5,
        "p_join": 0.0,  # 0 = không cho join thêm
        "p_leave": 0.0,  # 0 = không cho rời mạng
        "join_amount": NewEntry.NEW_RANDOM,
        "penalty_percentage": 0.5,
        # --- Tham số cho GINI_STABILIZED (nếu sau này muốn dùng) ---
        "theta": 0.3,
        "s_type": SType.LINEAR,
        "k": 0.001,
        # --- Reward mode ---
        "use_dynamic_reward": False,  # True: dynamic, False: constant
        # --- Tham số Sybil ngẫu nhiên (ngoài scheduled_sybil) ---
        "p_sybil": 0.0,  # 0 = chỉ dùng sybil theo lịch
        "min_sybil_size": 2,
        "max_sybil_size": 5,
        # --- Tham số kịch bản Sybil cụ thể để so sánh ---
        "target_entity_id": 0,  # Entity sẽ thực hiện sybil
        "sybil_epoch": 1000,  # Thực hiện sybil ở giữa chừng
        "num_splits": 5,  # Chia thành 3 validators
    }

    print("\nCấu hình:")
    for key, value in CONFIG.items():
        if isinstance(value, (Distribution, NewEntry, SType, PoS)):
            print(f"  {key}: {value.name}")
        else:
            print(f"  {key}: {value}")

    # List of consensus to compare
    consensus_types = [PoS.WEIGHTED, PoS.DESW]

    all_results = {}

    for consensus_type in consensus_types:
        simulator = SybilComparisonSimulator(consensus_type=consensus_type, **CONFIG)

        result = simulator.compare_scenarios()
        all_results[consensus_type.name] = result

        # Save detailed CSV
        save_detailed_csv(result)

    # Final comparison across consensus types
    print(f"\n{'#'*70}")
    print("SO SÁNH TỔNG QUAN: WEIGHTED vs DESW")
    print(f"{'#'*70}\n")

    for consensus_name, result in all_results.items():
        comp = result["comparison"]
        print(f"{consensus_name}:")
        print(f"  Không Sybil: {comp['selections_no_sybil']} lần")
        print(f"  Có Sybil:    {comp['selections_with_sybil']} lần")
        print(
            f"  Chênh lệch:  {comp['difference']:+d} lần ({comp['percentage_change']:+.2f}%)"
        )
        print()

    print("=" * 70)
    print("HOÀN THÀNH!")
    print("=" * 70)


if __name__ == "__main__":
    main()
