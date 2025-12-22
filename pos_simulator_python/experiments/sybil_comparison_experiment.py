#!/usr/bin/env python3
"""
Thí nghiệm so sánh WEIGHTED, DESW, LOG_WEIGHTED (LSW), và SRSW_WEIGHTED (SRSW) với Sybil Attack

Mục tiêu:
- So sánh hiệu quả của 4 thuật toán PoS khi có Sybil attack
- Thu thập các chỉ số: Gini, Nakamoto (Liveness, Safety), HHI, Zipf
- Phân tích số lần được chọn của validator thực hiện Sybil attack

Kịch bản:
- Một validator giàu nhất thực hiện Sybil attack tại epoch cụ thể
- So sánh trước/sau Sybil attack
- So sánh giữa WEIGHTED, DESW, LOG_WEIGHTED, và SRSW_WEIGHTED
"""

import sys
import os
import random
import numpy as np
import json
import time
from datetime import datetime
from typing import Dict, List, Tuple

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from parameters import Parameters, PoS, Distribution, NewEntry
from simulator import simulate
from utils import generate_peers, gini
from detailed_tracker import simulate_with_detailed_tracking


def find_richest_entity(stakes: List[float]) -> int:
    """Tìm entity_id của validator giàu nhất"""
    return int(np.argmax(stakes))


def find_poorest_entity(stakes: List[float]) -> int:
    """Tìm entity_id của validator nghèo nhất"""
    return int(np.argmin(stakes))


def analyze_selection_before_after_sybil(
    detailed_peer_data: List[Dict],
    target_entity_id: int,
    sybil_epoch: int,
) -> Dict:
    """
    Phân tích số lần được chọn của target entity trước/sau Sybil attack

    Args:
        detailed_peer_data: Dữ liệu chi tiết từ simulate_with_detailed_tracking
        target_entity_id: Entity ID cần phân tích
        sybil_epoch: Epoch xảy ra Sybil attack

    Returns:
        Dictionary với thống kê selection counts
    """
    selections_before = 0
    selections_after = 0
    epochs_before = 0
    epochs_after = 0

    for epoch_idx, epoch_data in enumerate(detailed_peer_data):
        epoch_number = epoch_idx + 1  # epoch starts from 1

        # Đếm số lần target entity được chọn trong epoch này
        epoch_selections = sum(
            1
            for peer in epoch_data
            if peer["entity_id"] == target_entity_id and peer["is_selected"]
        )

        if epoch_number < sybil_epoch:
            selections_before += epoch_selections
            epochs_before += 1
        elif epoch_number >= sybil_epoch:
            selections_after += epoch_selections
            epochs_after += 1

    # Tính average selections per epoch
    avg_before = selections_before / epochs_before if epochs_before > 0 else 0
    avg_after = selections_after / epochs_after if epochs_after > 0 else 0

    return {
        "target_entity_id": target_entity_id,
        "sybil_epoch": sybil_epoch,
        "total_selections_before_sybil": selections_before,
        "total_selections_after_sybil": selections_after,
        "epochs_before": epochs_before,
        "epochs_after": epochs_after,
        "avg_selections_per_epoch_before": round(avg_before, 4),
        "avg_selections_per_epoch_after": round(avg_after, 4),
        "change_in_avg_selections": round(avg_after - avg_before, 4),
        "percentage_change": (
            round((avg_after - avg_before) / avg_before * 100, 2)
            if avg_before > 0
            else None
        ),
    }


def run_single_experiment(
    algorithm: PoS,
    algorithm_name: str,
    params: Parameters,
    stakes: List[float],
    corrupted: List[int],
    target_entity_id: int,
    sybil_epoch: int,
    seed: int = 42,
) -> Dict:
    """
    Chạy một thí nghiệm với thuật toán cụ thể

    Args:
        algorithm: Thuật toán PoS
        algorithm_name: Tên thuật toán (để hiển thị)
        params: Parameters chung
        stakes: Initial stakes (sẽ được copy)
        corrupted: Corrupted peers (sẽ được copy)
        target_entity_id: Entity ID thực hiện Sybil
        sybil_epoch: Epoch thực hiện Sybil
        seed: Random seed để đảm bảo reproducibility

    Returns:
        Dictionary chứa tất cả metrics và selection analysis
    """
    print(f"\nChạy thí nghiệm với {algorithm_name}...")

    # Reset seed để đảm bảo cả 2 thuật toán dùng cùng random state
    random.seed(seed)
    np.random.seed(seed)

    # Tạo parameter copy với thuật toán cụ thể
    test_params = Parameters(
        n_epochs=params.n_epochs,
        proof_of_stake=algorithm,
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
        use_dynamic_reward=params.use_dynamic_reward,
        scheduled_joins=params.scheduled_joins,
        scheduled_sybil_attacks=params.scheduled_sybil_attacks,
        p_sybil=params.p_sybil,
        min_sybil_size=params.min_sybil_size,
        max_sybil_size=params.max_sybil_size,
    )

    # Tạo copies để tránh modify original data
    # QUAN TRỌNG: Cả 2 thuật toán phải dùng CÙNG một bộ stakes và corrupted ban đầu
    test_stakes = stakes.copy()
    test_corrupted = corrupted.copy()

    # Chạy simulation với detailed tracking
    start_time = time.time()
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
        test_stakes,
        test_corrupted,
        test_params,
        compute_shapley=False,
        shapley_samples=1000,
    )
    end_time = time.time()

    # Phân tích selection counts trước/sau Sybil
    selection_analysis = analyze_selection_before_after_sybil(
        detailed_peer_data, target_entity_id, sybil_epoch
    )

    # Tính metrics tại các milestone quan trọng
    # Epoch trước Sybil (epoch trước đó 1 epoch)
    pre_sybil_idx = max(0, sybil_epoch - 2)
    # Epoch sau Sybil (ngay sau khi Sybil xảy ra)
    post_sybil_idx = min(sybil_epoch, len(gini_history) - 1)
    # Epoch cuối
    final_idx = len(gini_history) - 1

    result = {
        "algorithm": algorithm_name,
        "starting_gini": gini(stakes),
        # Metrics trước Sybil
        "pre_sybil_gini": gini_history[pre_sybil_idx],
        "pre_sybil_nakamoto": nakamoto_history[pre_sybil_idx],
        "pre_sybil_nakamoto_liveness": nakamoto_liveness_history[pre_sybil_idx],
        "pre_sybil_nakamoto_liveness_pct": nakamoto_liveness_pct_history[pre_sybil_idx],
        "pre_sybil_nakamoto_safety": nakamoto_safety_history[pre_sybil_idx],
        "pre_sybil_nakamoto_safety_pct": nakamoto_safety_pct_history[pre_sybil_idx],
        "pre_sybil_hhi": hhi_history[pre_sybil_idx],
        "pre_sybil_zipf": zipf_history[pre_sybil_idx],
        "pre_sybil_peers": peers_history[pre_sybil_idx],
        # Metrics ngay sau Sybil
        "post_sybil_gini": gini_history[post_sybil_idx],
        "post_sybil_nakamoto": nakamoto_history[post_sybil_idx],
        "post_sybil_nakamoto_liveness": nakamoto_liveness_history[post_sybil_idx],
        "post_sybil_nakamoto_liveness_pct": nakamoto_liveness_pct_history[
            post_sybil_idx
        ],
        "post_sybil_nakamoto_safety": nakamoto_safety_history[post_sybil_idx],
        "post_sybil_nakamoto_safety_pct": nakamoto_safety_pct_history[post_sybil_idx],
        "post_sybil_hhi": hhi_history[post_sybil_idx],
        "post_sybil_zipf": zipf_history[post_sybil_idx],
        "post_sybil_peers": peers_history[post_sybil_idx],
        # Metrics tại epoch cuối
        "final_gini": gini_history[final_idx],
        "final_nakamoto": nakamoto_history[final_idx],
        "final_nakamoto_liveness": nakamoto_liveness_history[final_idx],
        "final_nakamoto_liveness_pct": nakamoto_liveness_pct_history[final_idx],
        "final_nakamoto_safety": nakamoto_safety_history[final_idx],
        "final_nakamoto_safety_pct": nakamoto_safety_pct_history[final_idx],
        "final_hhi": hhi_history[final_idx],
        "final_zipf": zipf_history[final_idx],
        "final_theil": theil_history[final_idx],
        "final_peers": peers_history[final_idx],
        # Selection analysis (số lần được chọn)
        "selection_analysis": selection_analysis,
        # Thời gian thực thi
        "execution_time": round(end_time - start_time, 3),
    }

    print(f"  ✓ Hoàn thành trong {result['execution_time']:.2f}s")
    print(f"  - Final Gini: {result['final_gini']:.4f}")
    print(f"  - Final Nakamoto: {result['final_nakamoto']:.1f}")
    print(
        f"  - Selections before Sybil: {selection_analysis['avg_selections_per_epoch_before']:.4f}/epoch"
    )
    print(
        f"  - Selections after Sybil: {selection_analysis['avg_selections_per_epoch_after']:.4f}/epoch"
    )
    print(f"  - Change: {selection_analysis['change_in_avg_selections']:+.4f}")

    return result


def run_sybil_comparison_experiment(
    n_epochs: int = 10000,
    n_peers: int = 500,
    sybil_epoch: int = 5000,
    num_splits: int = 5,
    target_type: str = "richest",  # "richest", "poorest", "random", hoặc entity_id (int)
    save_results: bool = True,
):
    """
    Chạy thí nghiệm so sánh WEIGHTED, DESW, LOG_WEIGHTED, và SRSW_WEIGHTED với Sybil attack

    Args:
        n_epochs: Số epochs
        n_peers: Số validators ban đầu
        sybil_epoch: Epoch thực hiện Sybil attack
        num_splits: Số validators sau khi split
        target_type: Loại validator thực hiện Sybil attack
            - "richest": Validator giàu nhất (mặc định)
            - "poorest": Validator nghèo nhất
            - "random": Random validator
            - entity_id (int): Chỉ định cụ thể entity_id (ví dụ: 0, 1, 2, ...)
        save_results: Có lưu kết quả ra file JSON không
    """
    print("=" * 80)
    print(
        "THÍ NGHIỆM SO SÁNH WEIGHTED vs DESW vs LOG_WEIGHTED vs SRSW_WEIGHTED VỚI SYBIL ATTACK"
    )
    print("=" * 80)

    # Set seed cho reproducibility
    # QUAN TRỌNG: Seed này sẽ được dùng cho cả 2 thuật toán để đảm bảo so sánh công bằng
    experiment_seed = 42
    random.seed(experiment_seed)
    np.random.seed(experiment_seed)

    # Tham số chung
    params = Parameters(
        n_epochs=n_epochs,
        initial_stake_volume=10000.0,
        initial_distribution=Distribution.RANDOM,
        n_peers=n_peers,
        n_corrupted=0,  # Tắt corrupted để tập trung vào Sybil
        p_fail=0.0,
        p_join=0.0,  # Mạng đóng để isolate tác động của Sybil
        p_leave=0.0,
        join_amount=NewEntry.NEW_RANDOM,
        penalty_percentage=0.0,
        reward=20.0,
        use_dynamic_reward=False,
        scheduled_joins=None,
        scheduled_sybil_attacks=None,  # Sẽ set sau
        p_sybil=0.0,  # Chỉ dùng scheduled
        min_sybil_size=2,
        max_sybil_size=5,
    )

    # Generate initial stakes
    stakes_original = generate_peers(
        params.n_peers,
        params.initial_stake_volume,
        params.initial_distribution,
        0.5,  # Initial gini (random distribution)
    )

    corrupted_original = []  # Không có corrupted

    # Chọn validator thực hiện Sybil attack
    if isinstance(target_type, int):
        # Chỉ định cụ thể entity_id
        target_entity_id = target_type
        target_description = f"Entity ID {target_entity_id} (specified)"
    elif target_type.lower() == "richest":
        # Validator giàu nhất
        target_entity_id = find_richest_entity(stakes_original)
        target_description = f"Richest (ID={target_entity_id})"
    elif target_type.lower() == "poorest":
        # Validator nghèo nhất
        target_entity_id = find_poorest_entity(stakes_original)
        target_description = f"Poorest (ID={target_entity_id})"
    elif target_type.lower() == "random":
        # Random validator
        target_entity_id = random.randint(0, len(stakes_original) - 1)
        target_description = f"Random (ID={target_entity_id})"
    else:
        raise ValueError(
            f"target_type phải là 'richest', 'poorest', 'random', hoặc entity_id (int), nhận được: {target_type}"
        )

    # Set scheduled Sybil attack
    scheduled_sybil_attacks = [(sybil_epoch, target_entity_id, num_splits)]
    params.scheduled_sybil_attacks = scheduled_sybil_attacks

    print(f"\nTham số thí nghiệm:")
    print(f"  - Số epochs: {n_epochs}")
    print(f"  - Số validators ban đầu: {n_peers}")
    print(f"  - Initial Gini: {gini(stakes_original):.4f}")
    print(f"  - Initial stake volume: {params.initial_stake_volume}")
    print(f"  - Network type: Closed (no join/leave)")
    print(f"  - Dynamic reward: {params.use_dynamic_reward}")
    print(f"  - Random seed: {experiment_seed} (dùng chung cho cả 2 thuật toán)")
    print(f"\nSybil Attack:")
    print(f"  - Target entity: {target_description}")
    print(f"  - Target initial stake: {stakes_original[target_entity_id]:.2f}")
    print(f"  - Sybil epoch: {sybil_epoch}")
    print(f"  - Split into: {num_splits} validators")
    print(
        f"\n⚠️  LƯU Ý: Cả 4 thuật toán (WEIGHTED, DESW, LOG_WEIGHTED, SRSW_WEIGHTED) sẽ dùng:"
    )
    print(f"  - Cùng initial stakes và corrupted peers")
    print(f"  - Cùng random seed ({experiment_seed})")
    print(f"  - Cùng scheduled_sybil_attacks")
    print(f"  → Đảm bảo so sánh công bằng!")
    print()

    # Danh sách thuật toán cần test
    algorithms = [
        (PoS.WEIGHTED, "WEIGHTED (Baseline)"),
        (PoS.DESW, "DESW"),
        (PoS.LOG_WEIGHTED, "LOG_WEIGHTED (LSW)"),
        (PoS.SRSW_WEIGHTED, "SRSW_WEIGHTED (SRSW)"),
    ]

    results = {}
    total_start_time = time.time()

    # Chạy thí nghiệm cho từng thuật toán
    # QUAN TRỌNG: Cả 4 thuật toán dùng CÙNG seed, CÙNG stakes_original, CÙNG corrupted_original
    for algorithm, algorithm_name in algorithms:
        result = run_single_experiment(
            algorithm,
            algorithm_name,
            params,
            stakes_original,  # Cùng initial stakes
            corrupted_original,  # Cùng corrupted peers
            target_entity_id,
            sybil_epoch,
            seed=experiment_seed,  # Cùng seed để đảm bảo random events giống nhau
        )
        results[algorithm.name] = result

    total_end_time = time.time()
    total_execution_time = total_end_time - total_start_time

    # In kết quả so sánh
    print("\n" + "=" * 80)
    print("KẾT QUẢ SO SÁNH")
    print("=" * 80)

    print("\n1. METRICS TRƯỚC SYBIL (Pre-Sybil):")
    print(
        f"  {'Metric':<25} {'WEIGHTED':<15} {'DESW':<15} {'LOG_WEIGHTED':<15} {'SRSW_WEIGHTED':<15}"
    )
    print(f"  {'-'*85}")
    for metric in [
        "gini",
        "nakamoto",
        "nakamoto_liveness",
        "nakamoto_safety",
        "hhi",
        "zipf",
    ]:
        key = f"pre_sybil_{metric}"
        weighted_val = results["WEIGHTED"][key]
        desw_val = results["DESW"][key]
        lsw_val = results["LOG_WEIGHTED"][key]
        srsw_val = results["SRSW_WEIGHTED"][key]
        print(
            f"  {metric:<25} {weighted_val:<15.4f} {desw_val:<15.4f} {lsw_val:<15.4f} {srsw_val:<15.4f}"
        )

    print("\n2. METRICS SAU SYBIL (Post-Sybil):")
    print(
        f"  {'Metric':<25} {'WEIGHTED':<15} {'DESW':<15} {'LOG_WEIGHTED':<15} {'SRSW_WEIGHTED':<15}"
    )
    print(f"  {'-'*85}")
    for metric in [
        "gini",
        "nakamoto",
        "nakamoto_liveness",
        "nakamoto_safety",
        "hhi",
        "zipf",
    ]:
        key = f"post_sybil_{metric}"
        weighted_val = results["WEIGHTED"][key]
        desw_val = results["DESW"][key]
        lsw_val = results["LOG_WEIGHTED"][key]
        srsw_val = results["SRSW_WEIGHTED"][key]
        print(
            f"  {metric:<25} {weighted_val:<15.4f} {desw_val:<15.4f} {lsw_val:<15.4f} {srsw_val:<15.4f}"
        )

    print("\n3. METRICS CUỐI CÙNG (Final):")
    print(
        f"  {'Metric':<25} {'WEIGHTED':<15} {'DESW':<15} {'LOG_WEIGHTED':<15} {'SRSW_WEIGHTED':<15}"
    )
    print(f"  {'-'*85}")
    for metric in [
        "gini",
        "nakamoto",
        "nakamoto_liveness",
        "nakamoto_safety",
        "hhi",
        "zipf",
        "theil",
    ]:
        key = f"final_{metric}"
        weighted_val = results["WEIGHTED"][key]
        desw_val = results["DESW"][key]
        lsw_val = results["LOG_WEIGHTED"][key]
        srsw_val = results["SRSW_WEIGHTED"][key]
        print(
            f"  {metric:<25} {weighted_val:<15.4f} {desw_val:<15.4f} {lsw_val:<15.4f} {srsw_val:<15.4f}"
        )

    print("\n4. SỐ LẦN ĐƯỢC CHỌN (Selection Counts):")
    print(
        f"  {'Metric':<35} {'WEIGHTED':<15} {'DESW':<15} {'LOG_WEIGHTED':<15} {'SRSW_WEIGHTED':<15}"
    )
    print(f"  {'-'*95}")

    w_sel = results["WEIGHTED"]["selection_analysis"]
    d_sel = results["DESW"]["selection_analysis"]
    lsw_sel = results["LOG_WEIGHTED"]["selection_analysis"]
    srsw_sel = results["SRSW_WEIGHTED"]["selection_analysis"]

    print(
        f"  {'Avg selections/epoch (Before)':<35} "
        f"{w_sel['avg_selections_per_epoch_before']:<15.4f} "
        f"{d_sel['avg_selections_per_epoch_before']:<15.4f} "
        f"{lsw_sel['avg_selections_per_epoch_before']:<15.4f} "
        f"{srsw_sel['avg_selections_per_epoch_before']:<15.4f}"
    )
    print(
        f"  {'Avg selections/epoch (After)':<35} "
        f"{w_sel['avg_selections_per_epoch_after']:<15.4f} "
        f"{d_sel['avg_selections_per_epoch_after']:<15.4f} "
        f"{lsw_sel['avg_selections_per_epoch_after']:<15.4f} "
        f"{srsw_sel['avg_selections_per_epoch_after']:<15.4f}"
    )
    print(
        f"  {'Change in avg selections':<35} "
        f"{w_sel['change_in_avg_selections']:<15.4f} "
        f"{d_sel['change_in_avg_selections']:<15.4f} "
        f"{lsw_sel['change_in_avg_selections']:<15.4f} "
        f"{srsw_sel['change_in_avg_selections']:<15.4f}"
    )

    w_pct = w_sel["percentage_change"] if w_sel["percentage_change"] is not None else 0
    d_pct = d_sel["percentage_change"] if d_sel["percentage_change"] is not None else 0
    lsw_pct = (
        lsw_sel["percentage_change"] if lsw_sel["percentage_change"] is not None else 0
    )
    srsw_pct = (
        srsw_sel["percentage_change"]
        if srsw_sel["percentage_change"] is not None
        else 0
    )
    print(
        f"  {'Percentage change (%)':<35} "
        f"{w_pct:<15.2f} {d_pct:<15.2f} {lsw_pct:<15.2f} {srsw_pct:<15.2f}"
    )

    print(f"\n5. THỜI GIAN THỰC THI:")
    print(f"  - WEIGHTED: {results['WEIGHTED']['execution_time']:.2f}s")
    print(f"  - DESW: {results['DESW']['execution_time']:.2f}s")
    print(f"  - LOG_WEIGHTED: {results['LOG_WEIGHTED']['execution_time']:.2f}s")
    print(f"  - SRSW_WEIGHTED: {results['SRSW_WEIGHTED']['execution_time']:.2f}s")
    print(f"  - Total: {total_execution_time:.2f}s")

    # Lưu kết quả
    if save_results:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_dir = os.path.join(os.path.dirname(__file__), "results")
        os.makedirs(results_dir, exist_ok=True)

        filename = os.path.join(results_dir, f"sybil_comparison_{timestamp}.json")

        output_data = {
            "metadata": {
                "experiment_name": "Sybil Attack Comparison: WEIGHTED vs DESW vs LOG_WEIGHTED vs SRSW_WEIGHTED",
                "timestamp": timestamp,
                "total_execution_time": round(total_execution_time, 3),
                "parameters": {
                    "n_epochs": n_epochs,
                    "n_peers": n_peers,
                    "initial_stake_volume": params.initial_stake_volume,
                    "initial_distribution": params.initial_distribution.name,
                    "actual_starting_gini": round(gini(stakes_original), 4),
                    "network_type": "closed",
                    "dynamic_reward": params.use_dynamic_reward,
                    "reward": params.reward,
                    "random_seed": experiment_seed,  # Seed dùng chung cho cả 2 thuật toán
                },
                "sybil_attack": {
                    "target_type": (
                        target_type
                        if isinstance(target_type, str)
                        else f"entity_{target_type}"
                    ),
                    "target_entity_id": target_entity_id,
                    "target_initial_stake": round(stakes_original[target_entity_id], 2),
                    "sybil_epoch": sybil_epoch,
                    "num_splits": num_splits,
                },
            },
            "results": results,
        }

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Kết quả đã được lưu vào: {filename}")

    print("\n" + "=" * 80)
    print("HOÀN THÀNH THÍ NGHIỆM!")
    print("=" * 80)

    return results


def main():
    """Main function"""
    # Cấu hình thí nghiệm
    n_epochs = 10000
    n_peers = 500
    sybil_epoch = 5000  # Sybil xảy ra ở giữa quá trình
    num_splits = 5  # Split thành 5 validators

    # Chọn validator thực hiện Sybil attack:
    # - "richest": Validator giàu nhất (mặc định)
    # - "poorest": Validator nghèo nhất
    # - "random": Random validator
    # - entity_id (int): Chỉ định cụ thể entity_id (ví dụ: 0, 1, 2, ...)
    target_type = "richest"

    # Chạy thí nghiệm
    results = run_sybil_comparison_experiment(
        n_epochs=n_epochs,
        n_peers=n_peers,
        sybil_epoch=sybil_epoch,
        num_splits=num_splits,
        target_type=target_type,
        save_results=True,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback

        traceback.print_exc()
