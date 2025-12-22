"""
Main simulation module for PoS Simulator
Equivalent to Simulator.jl from the original Julia version
"""

from typing import List, Tuple
import copy

# Initialize pmin and pmax for DESW
pmin = 0.1
pmax = 0.6

try:
    from tqdm import tqdm
except ImportError:
    # Fallback if tqdm is not available
    def tqdm(iterable, **kwargs):
        return iterable


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
        shapley_gini,
    )
except ImportError:
    # Khi chạy như script, sử dụng absolute imports
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
        shapley_gini,
    )


def simulate(
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
    float,
    float,
    float,
]:
    """
    Run PoS simulation

    Args:
        stakes: Initial stake for each peer
        corrupted: List of indices of corrupted peers
        params: Simulation parameters
        compute_shapley: Nếu True, sẽ tính Shapley Gini ở epoch cuối (tốn thời gian)
        shapley_samples: Số lượng mẫu Monte Carlo cho shapley_gini (mặc định 10000).

    Returns:
        Tuple of (
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
        )
    """
    # Create copies to avoid modifying original data
    stakes = copy.deepcopy(stakes)
    corrupted = copy.deepcopy(corrupted)

    # Initialize entity_ids: each validator starts with unique entity ID
    entity_ids = list(range(len(stakes)))

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

    # Shapley Gini (chỉ tính ở epoch cuối cùng nếu được bật)
    shapley_gini_liveness_final = 0.0
    shapley_gini_safety_final = 0.0
    shapley_gini_correlation_final = 0.0

    percentage_corrupted = len(corrupted) / len(stakes) if stakes else 0

    # Initialize t for GiniStabilized
    t = d(gini(stakes), params.θ)

    # Convert scheduled_joins to dictionary for fast lookup
    scheduled_joins_dict = {}
    if params.scheduled_joins:
        for epoch, stake_amount in params.scheduled_joins:
            if epoch not in scheduled_joins_dict:
                scheduled_joins_dict[epoch] = []
            scheduled_joins_dict[epoch].append(stake_amount)

    # Convert scheduled_sybil_attacks to dictionary for fast lookup
    scheduled_sybil_dict = {}
    if params.scheduled_sybil_attacks:
        for epoch, entity_id, num_splits in params.scheduled_sybil_attacks:
            if epoch not in scheduled_sybil_dict:
                scheduled_sybil_dict[epoch] = []
            scheduled_sybil_dict[epoch].append((entity_id, num_splits))

    for i in range(params.n_epochs):
        # Handle scheduled joins for current epoch
        if i in scheduled_joins_dict:
            for stake_amount in scheduled_joins_dict[i]:
                stakes.append(stake_amount)
                entity_ids.append(max(entity_ids) + 1 if entity_ids else 0)
                print(f"  Epoch {i}: Scheduled join with stake {stake_amount:.2f}")

        # Try adding/removing peers (random joins)
        try_to_join(
            stakes, corrupted, params.p_join, params.join_amount, percentage_corrupted
        )
        try_to_leave(stakes, params.p_leave)

        # Sync entity_ids với stakes (thêm mới hoặc xóa bớt)
        while len(entity_ids) < len(stakes):
            entity_ids.append(max(entity_ids) + 1 if entity_ids else 0)
        while len(entity_ids) > len(stakes):
            entity_ids.pop()

        # Handle scheduled Sybil attacks for current epoch
        if i in scheduled_sybil_dict:
            for entity_id, num_splits in scheduled_sybil_dict[i]:
                success = perform_scheduled_sybil(
                    stakes, entity_ids, entity_id, num_splits
                )
                if success:
                    print(
                        f"  Epoch {i}: Scheduled Sybil attack - Entity {entity_id} split into {num_splits} validators"
                    )
                else:
                    print(
                        f"  Epoch {i}: Scheduled Sybil attack failed - Entity {entity_id} not found"
                    )
                # Update corrupted list after Sybil attack
                corrupted = [c for c in corrupted if c < len(stakes)]

        # Try random Sybil attack (split stake into multiple validators)
        if params.p_sybil > 0:
            try_sybil_attack(
                stakes,
                entity_ids,
                params.p_sybil,
                params.min_sybil_size,
                params.max_sybil_size,
            )
            # Update corrupted list indices after Sybil attack
            corrupted = [c for c in corrupted if c < len(stakes)]

        # Calculate current Gini coefficient
        g = gini(stakes)
        gini_history.append(g)

        # Calculate current Nakamoto Coefficient
        nc = nakamoto_coefficient(stakes)
        nakamoto_history.append(nc)

        # Calculate current HHI Coefficient
        hhi = HHI_coefficient(stakes)
        hhi_history.append(hhi)

        # Calculate Nakamoto Liveness (33% threshold)
        nc_liveness, nc_liveness_pct = nakamoto_liveness(stakes)
        nakamoto_liveness_history.append(nc_liveness)
        nakamoto_liveness_pct_history.append(nc_liveness_pct)

        # Calculate Nakamoto Safety (66% threshold)
        nc_safety, nc_safety_pct = nakamoto_safety(stakes)
        nakamoto_safety_history.append(nc_safety)
        nakamoto_safety_pct_history.append(nc_safety_pct)

        # Calculate Theil Index
        theil = theil_index(stakes)
        theil_history.append(theil)

        # Calculate Zipf Coefficient
        zipf = zipf_coefficient(stakes)
        zipf_history.append(zipf)

        # Calculate Palma Ratio
        palma = palma_ratio(stakes)
        palma_history.append(palma)

        # Calculate Shannon Index
        shannon = shannon_index(stakes)
        shannon_history.append(shannon)

        # Select validator based on consensus mechanism
        if params.proof_of_stake == PoS.GINI_STABILIZED:
            # Calculate s based on s_type
            if params.s_type == SType.CONSTANT:
                s = params.k
            elif params.s_type == SType.LINEAR:
                s = abs(g - params.θ) * params.k
            elif params.s_type == SType.QUADRATIC:
                s = (abs(g - params.θ)) ** 2 * params.k
            else:  # SQRT or other
                s = (abs(g - params.θ)) ** 0.5 * params.k

            validator = consensus(params.proof_of_stake, stakes, t)
            t = lerp(t, d(g, params.θ), s)
        else:
            if params.proof_of_stake == PoS.DESW:
                validator = consensus(params.proof_of_stake, stakes, t, pmin, pmax)
            else:
                validator = consensus(params.proof_of_stake, stakes)

        # Calculate reward (dynamic hoặc constant)
        if params.use_dynamic_reward:
            # Dynamic reward: tỷ lệ với stake percentage
            total_stake = sum(stakes)
            current_reward = dynamic_reward(
                params.reward, stakes[validator], total_stake
            )
        else:
            # Constant reward
            current_reward = params.reward

        # Apply rewards/penalties
        if validator in corrupted and __import__("random").random() > 1 - params.p_fail:
            # Corrupted validator fails - apply penalty
            stakes[validator] *= 1 - params.penalty_percentage
        else:
            # Successful validation - apply reward
            stakes[validator] += current_reward

        # Record number of peers
        n_peers_history.append(len(stakes))

    # Tính Shapley Gini ở epoch cuối cùng (dùng stakes cuối cùng) nếu được bật
    if compute_shapley and shapley_samples > 0:
        try:
            print(
                f"\nĐang tính Shapley Gini ở epoch cuối cùng (n_epochs={params.n_epochs}, num_samples={shapley_samples})..."
            )
            (
                shapley_gini_liveness_final,
                shapley_gini_safety_final,
                shapley_gini_correlation_final,
            ) = shapley_gini(stakes, num_samples=shapley_samples)
            print("  ✓ Hoàn thành tính Shapley Gini (simulate).")
        except Exception as e:
            # Không để benchmark/simulation fail chỉ vì Shapley, log warning và để 0
            print(f"  ⚈ Cảnh báo: lỗi khi tính Shapley Gini trong simulate(): {e}")
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
    )


def simulate_verbose(
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
    float,
    float,
    float,
]:
    """
    Run PoS simulation with progress bar

    Args:
        stakes: Initial stake for each peer
        corrupted: List of indices of corrupted peers
        params: Simulation parameters

    Returns:
        Tuple of (
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
        )
    """
    # Create copies to avoid modifying original data
    stakes = copy.deepcopy(stakes)
    corrupted = copy.deepcopy(corrupted)

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

    shapley_gini_liveness_final = 0.0
    shapley_gini_safety_final = 0.0
    shapley_gini_correlation_final = 0.0

    percentage_corrupted = len(corrupted) / len(stakes) if stakes else 0

    # Initialize t for GiniStabilized
    t = d(gini(stakes), params.θ)

    # Initialize pmin and pmax for DESW

    # Convert scheduled_joins to dictionary for fast lookup
    scheduled_joins_dict = {}
    if params.scheduled_joins:
        for epoch, stake_amount in params.scheduled_joins:
            if epoch not in scheduled_joins_dict:
                scheduled_joins_dict[epoch] = []
            scheduled_joins_dict[epoch].append(stake_amount)

    # Use tqdm for progress bar (equivalent to @showprogress in Julia)
    for i in tqdm(range(params.n_epochs), desc="Simulating epochs"):
        # Handle scheduled joins for current epoch
        if i in scheduled_joins_dict:
            for stake_amount in scheduled_joins_dict[i]:
                stakes.append(stake_amount)
                print(f"  Epoch {i}: Scheduled join with stake {stake_amount:.2f}")

        # Try adding/removing peers (random joins)
        try_to_join(
            stakes, corrupted, params.p_join, params.join_amount, percentage_corrupted
        )
        try_to_leave(stakes, params.p_leave)

        # Calculate current Gini coefficient
        g = gini(stakes)
        gini_history.append(g)

        # Calculate current Nakamoto Coefficient
        nc = nakamoto_coefficient(stakes)
        nakamoto_history.append(nc)

        # Calculate current HHI Coefficient
        hhi = HHI_coefficient(stakes)
        hhi_history.append(hhi)

        # Calculate Nakamoto Liveness (33% threshold)
        nc_liveness, nc_liveness_pct = nakamoto_liveness(stakes)
        nakamoto_liveness_history.append(nc_liveness)
        nakamoto_liveness_pct_history.append(nc_liveness_pct)

        # Calculate Nakamoto Safety (66% threshold)
        nc_safety, nc_safety_pct = nakamoto_safety(stakes)
        nakamoto_safety_history.append(nc_safety)
        nakamoto_safety_pct_history.append(nc_safety_pct)

        # Calculate Theil Index
        theil = theil_index(stakes)
        theil_history.append(theil)

        # Calculate Zipf Coefficient
        zipf = zipf_coefficient(stakes)
        zipf_history.append(zipf)

        # Calculate Palma Ratio
        palma = palma_ratio(stakes)
        palma_history.append(palma)

        # Calculate Shannon Index
        shannon = shannon_index(stakes)
        shannon_history.append(shannon)

        # Select validator based on consensus mechanism
        if params.proof_of_stake == PoS.GINI_STABILIZED:
            # Calculate s based on s_type
            if params.s_type == SType.CONSTANT:
                s = params.k
            elif params.s_type == SType.LINEAR:
                s = abs(g - params.θ) * params.k
            elif params.s_type == SType.QUADRATIC:
                s = (abs(g - params.θ)) ** 2 * params.k
            else:  # SQRT or other
                s = (abs(g - params.θ)) ** 0.5 * params.k

            validator = consensus(params.proof_of_stake, stakes, t)
            t = lerp(t, d(g, params.θ), s)
        else:
            if params.proof_of_stake == PoS.DESW:
                validator = consensus(params.proof_of_stake, stakes, t, pmin, pmax)
            else:
                validator = consensus(params.proof_of_stake, stakes)

        # Calculate reward (dynamic hoặc constant)
        if params.use_dynamic_reward:
            # Dynamic reward: tỷ lệ với stake percentage
            total_stake = sum(stakes)
            current_reward = dynamic_reward(
                params.reward, stakes[validator], total_stake
            )
        else:
            # Constant reward
            current_reward = params.reward

        # Apply rewards/penalties
        if validator in corrupted and __import__("random").random() > 1 - params.p_fail:
            # Corrupted validator fails - apply penalty
            stakes[validator] *= 1 - params.penalty_percentage
        else:
            # Successful validation - apply reward
            stakes[validator] += current_reward

        # Record number of peers
        n_peers_history.append(len(stakes))

    # Tính Shapley Gini ở epoch cuối cùng nếu được bật
    if compute_shapley and shapley_samples > 0:
        try:
            print(
                f"\nĐang tính Shapley Gini ở epoch cuối cùng (n_epochs={params.n_epochs}, num_samples={shapley_samples})..."
            )
            (
                shapley_gini_liveness_final,
                shapley_gini_safety_final,
                shapley_gini_correlation_final,
            ) = shapley_gini(stakes, num_samples=shapley_samples)
            print("  ✓ Hoàn thành tính Shapley Gini (simulate_verbose).")
        except Exception as e:
            print(
                f"  ⚈ Cảnh báo: lỗi khi tính Shapley Gini trong simulate_verbose(): {e}"
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
    )


# Convenience function to run a single experiment
def run_experiment(
    n_peers: int,
    initial_volume: float,
    initial_gini: float,
    params: Parameters,
    verbose: bool = False,
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
    float,
    float,
    float,
]:
    """
    Run a single experiment with given parameters

    Args:
        n_peers: Initial number of peers
        initial_volume: Initial stake volume
        initial_gini: Initial Gini coefficient
        params: Simulation parameters
        verbose: Whether to show progress bar
        compute_shapley: Có tính Shapley Gini ở epoch cuối không
        shapley_samples: Số samples cho Shapley Gini nếu compute_shapley=True

    Returns:
        Tuple of (gini_history, n_peers_history, nakamoto_history, hhi_history,
                  nakamoto_liveness_history, nakamoto_liveness_pct_history,
                  nakamoto_safety_history, nakamoto_safety_pct_history,
                  theil_history, zipf_history, palma_history, shannon_history,
                  shapley_gini_liveness_final, shapley_gini_safety_final,
                  shapley_gini_correlation_final)
    """
    from .utils import generate_peers
    import random

    # Generate initial stakes
    stakes = generate_peers(
        n_peers, initial_volume, params.initial_distribution, initial_gini
    )

    # Create corrupted peers
    corrupted = random.sample(range(n_peers), params.n_corrupted)

    # Run simulation
    if verbose:
        return simulate_verbose(
            stakes,
            corrupted,
            params,
            compute_shapley=compute_shapley,
            shapley_samples=shapley_samples,
        )
    else:
        return simulate(
            stakes,
            corrupted,
            params,
            compute_shapley=compute_shapley,
            shapley_samples=shapley_samples,
        )
