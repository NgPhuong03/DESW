"""
Detailed tracking module để export CSV chi tiết về các peers
"""

from typing import List, Tuple, Dict
import copy
import random
import csv
from datetime import datetime

try:
    from .parameters import Parameters, PoS, SType
    from .utils import (
        gini,
        consensus,
        d,
        lerp,
        try_to_join,
        try_to_leave,
        try_sybil_attack,
        perform_scheduled_sybil,
        dynamic_reward,
        nakamoto_coefficient,
        nakamoto_liveness,
        nakamoto_safety,
        HHI_coefficient,
        theil_index,
        zipf_coefficient,
        palma_ratio,
        shannon_index,
        shapley_gini,
    )
except ImportError:
    from parameters import Parameters, PoS, SType
    from utils import (
        gini,
        consensus,
        d,
        lerp,
        try_to_join,
        try_to_leave,
        try_sybil_attack,
        perform_scheduled_sybil,
        dynamic_reward,
        nakamoto_coefficient,
        nakamoto_liveness,
        nakamoto_safety,
        HHI_coefficient,
        theil_index,
        zipf_coefficient,
        palma_ratio,
        shannon_index,
        shapley_gini,
    )

pmin = 0
pmax = 1


def simulate_with_detailed_tracking(
    stakes: List[float],
    corrupted: List[int],
    params: Parameters,
    compute_shapley: bool = False,
    shapley_samples: int = 10000,
) -> Tuple[
    List[float],
    List[int],
    List[int],
    List[float],
    List[int],
    List[float],
    List[int],
    List[float],
    List[float],
    List[float],
    List[float],
    List[float],
    List[float],
    float,  # shapley_gini_liveness_final
    float,  # shapley_gini_safety_final
    float,  # shapley_gini_correlation_final
    List[Dict],  # Detailed peer data for CSV export
]:
    """
    Run simulation và track chi tiết thông tin từng peer

    Args:
        stakes: Initial stake for each peer
        corrupted: List of indices of corrupted peers
        params: Simulation parameters
        compute_shapley: Có tính Shapley Gini không (default: False)
        shapley_samples: Số samples cho Shapley Gini (default: 10000)

    Returns:
        Tuple of (gini_history, n_peers_history, nakamoto_history, hhi_history,
                  nakamoto_liveness_history, nakamoto_liveness_pct_history,
                  nakamoto_safety_history, nakamoto_safety_pct_history,
                  theil_history, zipf_history, palma_history, shannon_history,
                  shapley_gini_liveness_final, shapley_gini_safety_final,
                  shapley_gini_correlation_final, detailed_peer_data)
        detailed_peer_data: List of dicts, mỗi dict chứa thông tin peers tại mỗi epoch
        Shapley Gini chỉ được tính ở epoch cuối cùng nếu compute_shapley=True
    """
    stakes = copy.deepcopy(stakes)
    corrupted = copy.deepcopy(corrupted)
    entity_ids = list(range(len(stakes)))

    # History lists
    gini_history = []
    n_peers_history = []
    nakamoto_history = []
    hhi_history = []
    nakamoto_liveness_history = []
    nakamoto_liveness_pct_history = []
    nakamoto_safety_history = []
    nakamoto_safety_pct_history = []
    theil_history = []
    zipf_history = []
    palma_history = []
    shannon_history = []

    # Shapley Gini chỉ tính ở epoch cuối cùng (không lưu history)
    shapley_gini_liveness_final = 0.0
    shapley_gini_safety_final = 0.0
    shapley_gini_correlation_final = 0.0

    # Detailed tracking: mỗi epoch lưu thông tin tất cả peers
    detailed_peer_data = []

    percentage_corrupted = len(corrupted) / len(stakes) if stakes else 0
    t = d(gini(stakes), params.θ)

    scheduled_joins_dict = {}
    if params.scheduled_joins:
        for epoch, stake_amount in params.scheduled_joins:
            if epoch not in scheduled_joins_dict:
                scheduled_joins_dict[epoch] = []
            scheduled_joins_dict[epoch].append(stake_amount)

    scheduled_sybil_dict = {}
    if params.scheduled_sybil_attacks:
        for epoch, entity_id, num_splits in params.scheduled_sybil_attacks:
            if epoch not in scheduled_sybil_dict:
                scheduled_sybil_dict[epoch] = []
            scheduled_sybil_dict[epoch].append((entity_id, num_splits))

    # Thông báo về Shapley Gini
    print(f"  Lưu ý: Shapley Gini chỉ được tính ở epoch cuối cùng với 10000 samples\n")

    for i in range(params.n_epochs):
        # Scheduled joins
        if i in scheduled_joins_dict:
            for stake_amount in scheduled_joins_dict[i]:
                stakes.append(stake_amount)
                entity_ids.append(max(entity_ids) + 1 if entity_ids else 0)

        # Random joins/leaves
        try_to_join(
            stakes, corrupted, params.p_join, params.join_amount, percentage_corrupted
        )
        try_to_leave(stakes, params.p_leave)

        # Sync entity_ids
        while len(entity_ids) < len(stakes):
            entity_ids.append(max(entity_ids) + 1 if entity_ids else 0)
        while len(entity_ids) > len(stakes):
            entity_ids.pop()

        # Scheduled Sybil attacks
        if i in scheduled_sybil_dict:
            for entity_id, num_splits in scheduled_sybil_dict[i]:
                # Tìm validator sẽ bị split để log thông tin
                candidates = [
                    (idx, stakes[idx])
                    for idx in range(len(stakes))
                    if idx < len(entity_ids) and entity_ids[idx] == entity_id
                ]
                if candidates:
                    victim_idx, original_stake = max(candidates, key=lambda x: x[1])
                    split_stake = original_stake / num_splits
                    print(
                        f"  Epoch {i}: Sybil Attack - Entity {entity_id} split validator {victim_idx} "
                        f"(stake: {original_stake:.2f}) thành {num_splits} validators "
                        f"(mỗi validator: {split_stake:.2f} stake)"
                    )
                    success = perform_scheduled_sybil(
                        stakes, entity_ids, entity_id, num_splits
                    )
                    if not success:
                        print(
                            f"  Epoch {i}: ⚠ Sybil attack failed - Không thể split Entity {entity_id}"
                        )
                else:
                    print(
                        f"  Epoch {i}: ⚠ Sybil attack failed - Không tìm thấy validator của Entity {entity_id}"
                    )
                    perform_scheduled_sybil(stakes, entity_ids, entity_id, num_splits)
                corrupted = [c for c in corrupted if c < len(stakes)]

        # Random Sybil attack
        if params.p_sybil > 0:
            try_sybil_attack(
                stakes,
                entity_ids,
                params.p_sybil,
                params.min_sybil_size,
                params.max_sybil_size,
            )
            corrupted = [c for c in corrupted if c < len(stakes)]

        # Calculate metrics
        g = gini(stakes)
        gini_history.append(g)
        nakamoto_history.append(nakamoto_coefficient(stakes))
        hhi_history.append(HHI_coefficient(stakes))

        nc_liveness, nc_liveness_pct = nakamoto_liveness(stakes)
        nakamoto_liveness_history.append(nc_liveness)
        nakamoto_liveness_pct_history.append(nc_liveness_pct)

        nc_safety, nc_safety_pct = nakamoto_safety(stakes)
        nakamoto_safety_history.append(nc_safety)
        nakamoto_safety_pct_history.append(nc_safety_pct)

        theil_history.append(theil_index(stakes))
        zipf_history.append(zipf_coefficient(stakes))
        palma_history.append(palma_ratio(stakes))
        shannon_history.append(shannon_index(stakes))

        # Shapley Gini chỉ tính ở epoch cuối cùng để tăng tốc độ
        # (Sẽ tính sau khi loop kết thúc)

        # Progress indicator mỗi 100 epochs
        if (i + 1) % 100 == 0:
            print(f"  Đã chạy {i + 1}/{params.n_epochs} epochs...", end="\r")

        # Select validator
        if params.proof_of_stake == PoS.GINI_STABILIZED:
            if params.s_type == SType.CONSTANT:
                s = params.k
            elif params.s_type == SType.LINEAR:
                s = abs(g - params.θ) * params.k
            elif params.s_type == SType.QUADRATIC:
                s = (abs(g - params.θ)) ** 2 * params.k
            else:
                s = (abs(g - params.θ)) ** 0.5 * params.k
            validator = consensus(params.proof_of_stake, stakes, t)
            t = lerp(t, d(g, params.θ), s)
        else:
            if params.proof_of_stake == PoS.DESW:
                validator = consensus(params.proof_of_stake, stakes, t, pmin, pmax)
            else:
                validator = consensus(params.proof_of_stake, stakes)

        # Track chi tiết từng peer trước khi apply reward
        # Lưu stake trước khi apply reward
        stakes_before = stakes.copy()

        # Calculate reward (dynamic hoặc constant)
        if params.use_dynamic_reward:
            # Dynamic reward: tỷ lệ với stake percentage
            total_stake = sum(stakes)
            current_reward = dynamic_reward(
                params.reward, stakes[validator], total_stake
            )
        else:
            current_reward = params.reward

        epoch_peer_data = []

        # Apply reward/penalty cho validator được chọn
        if validator in corrupted and random.random() > 1 - params.p_fail:
            # Penalty
            stakes[validator] *= 1 - params.penalty_percentage
            reward_received = -(
                stakes_before[validator] - stakes[validator]
            )  # Negative reward
        else:
            # Reward
            stakes[validator] += current_reward
            reward_received = current_reward

        # Track tất cả peers
        for validator_idx in range(len(stakes)):
            is_selected = validator_idx == validator
            peer_reward = reward_received if is_selected else 0.0

            epoch_peer_data.append(
                {
                    "epoch": i,
                    "validator_index": validator_idx,
                    "entity_id": (
                        entity_ids[validator_idx]
                        if validator_idx < len(entity_ids)
                        else -1
                    ),
                    "stake": stakes[validator_idx],
                    "stake_percentage": (
                        stakes[validator_idx] / sum(stakes) * 100
                        if sum(stakes) > 0
                        else 0
                    ),
                    "is_selected": is_selected,
                    "reward_received": peer_reward,
                    "is_corrupted": validator_idx in corrupted,
                }
            )

        detailed_peer_data.append(epoch_peer_data)
        n_peers_history.append(len(stakes))

    # Tính Shapley Gini ở epoch cuối cùng (nếu được bật)
    if compute_shapley and shapley_samples > 0:
        try:
            print(
                f"\n  Đang tính Shapley Gini ở epoch cuối cùng (num_samples={shapley_samples})..."
            )
            (
                shapley_gini_liveness_final,
                shapley_gini_safety_final,
                shapley_gini_correlation_final,
            ) = shapley_gini(stakes, num_samples=shapley_samples)
            print(f"  ✓ Hoàn thành tính Shapley Gini!")
        except Exception as e:
            print(
                f"  ⚈ Cảnh báo: lỗi khi tính Shapley Gini trong simulate_with_detailed_tracking(): {e}"
            )
            shapley_gini_liveness_final = 0.0
            shapley_gini_safety_final = 0.0
            shapley_gini_correlation_final = 0.0

    return (
        gini_history,
        n_peers_history,
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
    )


def export_peers_to_csv(
    detailed_peer_data: List[List[Dict]],
    filename: str,
    epochs_to_export: List[int] = None,
):
    """
    Export thông tin chi tiết các peers ra file CSV

    Args:
        detailed_peer_data: List of lists, mỗi inner list chứa dicts của peers tại một epoch
        filename: Tên file CSV để lưu
        epochs_to_export: List các epoch numbers cần export. Nếu None, export epoch cuối cùng
                          Ví dụ: [200, 9999] để export epoch 200 và 9999
    """
    with open(filename, "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = [
            "epoch",
            "validator_index",
            "entity_id",
            "stake",
            "stake_percentage",
            "is_selected",
            "reward_received",
            "is_corrupted",
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        if epochs_to_export is None:
            # Mặc định: export epoch cuối cùng
            if detailed_peer_data:
                last_epoch_data = detailed_peer_data[-1]
                for peer_data in last_epoch_data:
                    writer.writerow(peer_data)
                print(
                    f"✓ Đã export epoch cuối cùng ({len(detailed_peer_data)-1}) ra file: {filename}"
                )
                print(f"  - Số peers: {len(last_epoch_data)}")
        else:
            # Export các epochs được chỉ định
            total_peers = 0
            exported_epochs = []
            for epoch_num in epochs_to_export:
                if 0 <= epoch_num < len(detailed_peer_data):
                    epoch_data = detailed_peer_data[epoch_num]
                    for peer_data in epoch_data:
                        writer.writerow(peer_data)
                    total_peers += len(epoch_data)
                    exported_epochs.append(epoch_num)
                else:
                    print(
                        f"  ⚠ Epoch {epoch_num} không tồn tại (max: {len(detailed_peer_data)-1})"
                    )

            if exported_epochs:
                print(
                    f"✓ Đã export {len(exported_epochs)} epoch(s): {exported_epochs} ra file: {filename}"
                )
                print(f"  - Tổng số peers: {total_peers}")
