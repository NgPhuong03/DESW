"""
Helper module để track rewards cho một entity cụ thể trong simulation
"""

from typing import List, Tuple, Dict
import copy
import random

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
        stake_based_reward,
        nakamoto_coefficient,
        nakamoto_liveness,
        nakamoto_safety,
        HHI_coefficient,
        theil_index,
        zipf_coefficient,
        palma_ratio,
        shannon_index,
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
        stake_based_reward,
        nakamoto_coefficient,
        nakamoto_liveness,
        nakamoto_safety,
        HHI_coefficient,
        theil_index,
        zipf_coefficient,
        palma_ratio,
        shannon_index,
    )

# Initialize pmin and pmax for DESW
pmin = 0
pmax = 1


def simulate_with_reward_tracking(
    stakes: List[float],
    corrupted: List[int],
    params: Parameters,
    tracked_entity_id: int = 0,  # Entity ID cần track rewards
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
    float,  # Total rewards for tracked entity
    int,  # Number of times tracked entity was selected
]:
    """
    Run simulation và track tổng phần thưởng cho một entity cụ thể

    Args:
        stakes: Initial stake for each peer
        corrupted: List of indices of corrupted peers
        params: Simulation parameters
        tracked_entity_id: Entity ID cần track (default: 0 = validator đầu tiên)

    Returns:
        Tuple giống simulate() + (total_rewards, selection_count)
    """
    stakes = copy.deepcopy(stakes)
    corrupted = copy.deepcopy(corrupted)

    # Initialize entity_ids
    entity_ids = list(range(len(stakes)))

    # Track rewards cho entity
    total_rewards = 0.0
    selection_count = 0

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

        # Handle scheduled Sybil attacks
        if i in scheduled_sybil_dict:
            for entity_id, num_splits in scheduled_sybil_dict[i]:
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

        # Track rewards cho tracked entity (bao gồm cả validators con sau Sybil)
        validator_entity_id = (
            entity_ids[validator] if validator < len(entity_ids) else -1
        )

        # Calculate reward (dynamic hoặc constant)
        if params.use_dynamic_reward:
            # Dynamic reward: tỷ lệ với stake percentage
            total_stake = sum(stakes)
            current_reward = dynamic_reward(
                params.reward, stakes[validator], total_stake
            )
        else:
            current_reward = params.reward

        # Apply reward/penalty
        if validator in corrupted and random.random() > 1 - params.p_fail:
            # Penalty (không tính reward)
            stakes[validator] *= 1 - params.penalty_percentage
        else:
            # Reward
            stakes[validator] += current_reward

            # Track nếu là entity được theo dõi (bao gồm validators con)
            if validator_entity_id == tracked_entity_id:
                total_rewards += current_reward
                selection_count += 1

        n_peers_history.append(len(stakes))

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
        total_rewards,
        selection_count,
    )
