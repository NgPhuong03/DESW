"""
Utility functions for PoS simulation
"""

import numpy as np
import random
from typing import List, Tuple, Optional

try:
    from scipy.stats import linregress
except ImportError:
    # Fallback if scipy is not available
    def linregress(x, y):
        raise ImportError("scipy.stats is required for zipf_coefficient function")


try:
    from .parameters import Distribution, PoS, NewEntry, Parameters
except ImportError:
    from parameters import Distribution, PoS, NewEntry, Parameters


def gini(data: List[float]) -> float:
    """
    Compute the Gini coefficient of a given dataset.

    The Gini coefficient is a statistical measure of dispersion representing
    inequality within a distribution. Commonly used to measure income inequality.

    Args:
        data: List of numeric data points.

    Returns:
        The Gini coefficient of the input dataset in [0, 1], where 0 means
        perfect equality and 1 means maximal inequality.

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> gini(data)  # Output: 0.2
    """
    if not data or len(data) == 0:
        return 0.0

    # Number of data points
    n = len(data)

    # Sum of data points
    total = sum(data)

    if total == 0:
        return 0.0

    # Sort data points in ascending order
    sorted_data = sorted(data)

    # Cumulative share of sorted data
    cumulative_percentage = np.cumsum(sorted_data) / total

    # Lorenz curve
    lorenz_curve = cumulative_percentage - 0.5 * (np.array(sorted_data) / total)

    # Gini coefficient
    G = 1 - 2 * np.sum(lorenz_curve) / n

    return G


def nakamoto_coefficient(data: List[float], threshold: float = 0.51) -> int:
    """
    Compute the Nakamoto Coefficient of a given dataset.

    The Nakamoto Coefficient is the smallest number of entities required to
    control a given percentage (default 51%) of the total resource. It is a key
    metric of decentralization in blockchains.

    Args:
        data: List of numeric data (e.g., validators' stakes).
        threshold: Target fraction to control (default 0.51 = 51%).

    Returns:
        The Nakamoto Coefficient: the minimal number of entities required to
        control threshold% of the total resource.

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]  # Total: 1500
        >>> nakamoto_coefficient(data)  # 2 largest validators (500+400=900 > 765)
        >>> nakamoto_coefficient(data, 0.33)  # 1 validator (500 > 495)
    """
    if not data or len(data) == 0:
        return 0

    # Total resource
    total = sum(data)

    if total == 0:
        return 0

    # Sort descending (largest to smallest)
    sorted_data = sorted(data, reverse=True)

    # Target amount to control
    target_amount = total * threshold

    # Cumulative sum from the largest
    cumulative_sum = 0
    for i, value in enumerate(sorted_data):
        cumulative_sum += value
        if cumulative_sum >= target_amount:
            return i + 1  # Return number of entities needed

    # Fallback in case of insufficient resource (shouldn't happen)
    return len(data)


def nakamoto_liveness(data: List[float]) -> Tuple[int, float]:
    """
    Compute the Nakamoto Coefficient for Liveness of a given dataset.

    The Nakamoto Coefficient for Liveness measures the smallest number of entities
    required to control 33% of the total resource. This is used to assess the
    system's ability to maintain liveness (ability to produce blocks).

    Args:
        data: List of numeric data (e.g., validators' stakes).

    Returns:
        Tuple of (nakamoto_coefficient, percentage) where:
        - nakamoto_coefficient: Minimal number of entities needed to control 33%
        - percentage: Percentage of total validators needed (0-100)

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]  # Total: 1500
        >>> nc, pct = nakamoto_liveness(data)
    """
    if not data or len(data) == 0:
        return 0, 0.0

    nc = nakamoto_coefficient(data, threshold=0.33)
    total_validators = len(data)
    percentage = (nc / total_validators) * 100 if total_validators > 0 else 0.0

    return nc, round(percentage, 2)


def nakamoto_safety(data: List[float]) -> Tuple[int, float]:
    """
    Compute the Nakamoto Coefficient for Safety of a given dataset.

    The Nakamoto Coefficient for Safety measures the smallest number of entities
    required to control 66% of the total resource. This is used to assess the
    system's safety (ability to prevent double-spending attacks).

    Args:
        data: List of numeric data (e.g., validators' stakes).

    Returns:
        Tuple of (nakamoto_coefficient, percentage) where:
        - nakamoto_coefficient: Minimal number of entities needed to control 66%
        - percentage: Percentage of total validators needed (0-100)

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]  # Total: 1500
        >>> nc, pct = nakamoto_safety(data)
    """
    if not data or len(data) == 0:
        return 0, 0.0

    nc = nakamoto_coefficient(data, threshold=0.66)
    total_validators = len(data)
    percentage = (nc / total_validators) * 100 if total_validators > 0 else 0.0

    return nc, round(percentage, 2)


# def nakamoto_coefficient_analysis(data: List[float]) -> dict:
#     """
#     Detailed analysis of the Nakamoto Coefficient across multiple thresholds.

#     Args:
#         data: List of numeric data points.

#     Returns:
#         Dictionary mapping percentage thresholds to their Nakamoto Coefficient.

#     Examples:
#         >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
#         >>> result = nakamoto_coefficient_analysis(data)
#         >>> print(result)
#         {'25%': 1, '33%': 1, '50%': 2, '51%': 2, '66%': 3, '75%': 4}
#     """
#     if not data or len(data) == 0:
#         return {}

#     thresholds = [0.25, 0.33, 0.50, 0.51, 0.66, 0.75]
#     results = {}

#     for threshold in thresholds:
#         nc = nakamoto_coefficient(data, threshold)
#         results[f"{int(threshold * 100)}%"] = nc

#     return results


# def decentralization_score(data: List[float]) -> float:
#     """
#     Compute a decentralization score based on the Nakamoto Coefficient.

#     The score normalizes the Nakamoto Coefficient by the total number of
#     entities. Higher score = more decentralized.

#     Args:
#         data: List of numeric data points.

#     Returns:
#         Decentralization score in [0, 1] (1 = fully decentralized).

#     Examples:
#         >>> data = [100.0, 100.0, 100.0, 100.0, 100.0]  # Even distribution
#         >>> decentralization_score(data)  # ~1.0
#         >>> data = [1000.0, 10.0, 10.0, 10.0, 10.0]  # Concentrated
#         >>> decentralization_score(data)  # ~0.0
#     """
#     if not data or len(data) == 0:
#         return 0.0

#     n_entities = len(data)
#     nc_51 = nakamoto_coefficient(data, 0.51)

#     # Decentralization score = (n_entities - nc_51) / (n_entities - 1)
#     # When nc_51 = 1 (highly centralized) → score = 0
#     # When nc_51 = n_entities (fully decentralized) → score = 1
#     # When nc_51 = n_entities/2 → score = 0.5
#     if n_entities == 1:
#         return 0.0

#     score = (n_entities - nc_51) / (n_entities - 1)

#     return score


def HHI_coefficient(data: List[float]) -> float:
    """
    Compute the Herfindahl-Hirschman Index (HHI) of a dataset.

    HHI is a decentralization measure used to quantify market concentration.

    Args:
        data: List of numeric data points.

    Returns:
        The HHI of the input dataset.

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> HHI_coefficient(data)  # Output: 0.2
    """
    if not data or len(data) == 0:
        return 0.0

    # Total resource
    total = sum(data)

    if total == 0:
        return 0.0

    # Percentage of each data point
    percentages = [value / total for value in data]

    # HHI coefficient
    HHI = sum(percentage**2 for percentage in percentages)

    return HHI


def theil_index(data: List[float]) -> float:
    """
    Compute the Theil Index of a given dataset.

    The Theil Index is a measure of economic inequality. It measures entropy
    in the distribution, where 0 means perfect equality and higher values
    indicate greater inequality.

    Args:
        data: List of numeric data points.

    Returns:
        The Theil Index of the input dataset.

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> theil_index(data)
    """
    if not data or len(data) == 0:
        return 0.0

    # Convert to numpy array
    tokens = np.array(data)

    # Calculate the mean
    mean_tokens = np.mean(tokens)

    # Avoid division by zero and log(0) issues
    epsilon = 1e-10
    tokens = np.where(tokens == 0, epsilon, tokens)
    mean_tokens = max(mean_tokens, epsilon)

    # Compute the Theil Index
    ratios = tokens / mean_tokens
    theil_index = np.mean(ratios * np.log(ratios))

    return float(theil_index)


def zipf_coefficient(data: List[float]) -> float:
    """
    Compute the Zipf Coefficient (Z) of a given dataset.

    Zipf's Law coefficient measures the distribution of resources across entities.
    It is calculated as the negative slope of the log-log regression between
    rank and resource amount.

    Args:
        data: List of numeric data points.

    Returns:
        The Zipf Coefficient (Z) of the input dataset.

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> zipf_coefficient(data)
    """
    if not data or len(data) == 0:
        return 0.0

    # Sort weights in descending order and filter out zeros
    weights = np.array(sorted(data, reverse=True), dtype=np.float64)
    weights = weights[weights > 0]  # Filter out zero values

    if len(weights) == 0:
        return 0.0

    # Rank each validator (1-based rank)
    ranks = np.arange(1, len(weights) + 1, dtype=np.float64)

    # Perform log-log transformation
    log_ranks = np.log(ranks)
    log_weights = np.log(weights)

    # Memory-efficient linear regression slope calculation
    # Using formula: slope = (n*sum(xy) - sum(x)*sum(y)) / (n*sum(x^2) - sum(x)^2)
    # This avoids computing the full covariance matrix
    n = len(log_ranks)
    sum_x = np.sum(log_ranks)
    sum_y = np.sum(log_weights)
    sum_xy = np.sum(log_ranks * log_weights)
    sum_x2 = np.sum(log_ranks * log_ranks)
    
    denominator = n * sum_x2 - sum_x * sum_x
    if abs(denominator) < 1e-10:  # Avoid division by zero
        return 0.0
    
    slope = (n * sum_xy - sum_x * sum_y) / denominator

    # Zipf's Law coefficient is the negative of the slope
    zipf_coefficient = -slope

    return float(zipf_coefficient)


def palma_ratio(data: List[float]) -> float:
    """
    Compute the Palma Ratio of a given dataset.

    The Palma Ratio is the ratio of the richest 10% to the poorest 40% of the
    population. It is a measure of inequality that focuses on the extremes
    of the distribution.

    Args:
        data: List of numeric data points.

    Returns:
        The Palma Ratio of the input dataset. Returns NaN if bottom 40% is zero.

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> palma_ratio(data)
    """
    if not data or len(data) == 0:
        return 0.0

    # Sort the values in descending order
    tokens_sorted = sorted(data, reverse=True)

    # Determine the indices for the top 10% and bottom 40%
    n = len(tokens_sorted)
    top_10_idx = int(n * 0.1)
    bottom_40_idx = int(n * 0.4)

    # Sum the tokens for the top 10% and bottom 40%
    sum_top_10 = sum(tokens_sorted[:top_10_idx])
    sum_bottom_40 = sum(tokens_sorted[-bottom_40_idx:]) if bottom_40_idx > 0 else 0

    # Calculate the Palma Ratio
    if sum_bottom_40 == 0:
        return float("inf")

    palma_ratio = sum_top_10 / sum_bottom_40

    return float(palma_ratio)


def shannon_index(data: List[float]) -> float:
    """
    Compute the Shannon Index (normalized) of a given dataset.

    The Shannon Index is a measure of diversity/entropy. Higher values indicate
    more diversity. The normalized version divides by log(n) to scale between 0 and 1.

    Args:
        data: List of numeric data points.

    Returns:
        The normalized Shannon Index of the input dataset in [0, 1].

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> shannon_index(data)
    """
    if not data or len(data) == 0:
        return 0.0

    # Convert to numpy array
    stakes = np.array(data)

    # Calculate the total stake
    total_stake = np.sum(stakes)

    if total_stake == 0:
        return 0.0

    # Calculate the proportion of each stake
    proportions = stakes / total_stake

    # Filter out zero values to avoid log(0)
    nonzero_proportions = proportions[proportions > 0]

    if len(nonzero_proportions) == 0:
        return 0.0

    # Compute the Shannon Index
    shannon_index = -np.sum(nonzero_proportions * np.log(nonzero_proportions))

    # Normalize by log(n)
    normalized_shannon = shannon_index / np.log(len(nonzero_proportions))

    return float(normalized_shannon)


def shapley_values(
    data: List[float],
    liveness_ratio: float = 0.33,
    safety_ratio: float = 0.66,
    num_samples: int = 10000,
) -> Tuple[List[float], List[float]]:
    """
    Calculate Shapley values for liveness and safety using Monte Carlo sampling.

    Shapley values measure the marginal contribution of each entity to achieving
    consensus thresholds. This function approximates Shapley values using Monte
    Carlo sampling for computational efficiency.

    Args:
        data: List of numeric data points (e.g., validator stakes).
        liveness_ratio: Threshold for liveness (default 0.33 = 33%).
        safety_ratio: Threshold for safety (default 0.66 = 66%).
        num_samples: Number of Monte Carlo samples (default 10000).

    Returns:
        Tuple of (shapley_values_liveness, shapley_values_safety) as lists.

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> liveness, safety = shapley_values(data)
    """
    if not data or len(data) == 0:
        return [], []

    weights = np.array(data)
    total_weight = np.sum(weights)

    if total_weight == 0:
        return [0.0] * len(data), [0.0] * len(data)

    n = len(weights)
    shapley_values_liveness = np.zeros(n)
    shapley_values_safety = np.zeros(n)

    # Monte Carlo sampling to approximate Shapley values
    for i in range(n):
        marginal_contributions_liveness = []
        marginal_contributions_safety = []

        # Sample random subsets to approximate the Shapley values
        for _ in range(num_samples):
            # Create subset excluding entity i
            other_indices = [j for j in range(n) if j != i]
            subset_size = random.randint(0, n - 1)
            subset_indices = random.sample(other_indices, subset_size)
            subset_sum = np.sum(weights[subset_indices])

            # Liveness marginal contribution
            if (
                subset_sum <= liveness_ratio * total_weight
                and (subset_sum + weights[i]) > liveness_ratio * total_weight
            ):
                marginal_contributions_liveness.append(1)
            else:
                marginal_contributions_liveness.append(0)

            # Safety marginal contribution
            if (
                subset_sum <= safety_ratio * total_weight
                and (subset_sum + weights[i]) > safety_ratio * total_weight
            ):
                marginal_contributions_safety.append(1)
            else:
                marginal_contributions_safety.append(0)

        # Average the marginal contributions
        shapley_values_liveness[i] = np.mean(marginal_contributions_liveness)
        shapley_values_safety[i] = np.mean(marginal_contributions_safety)

    return shapley_values_liveness.tolist(), shapley_values_safety.tolist()


def shapley_gini(
    data: List[float],
    liveness_ratio: float = 0.33,
    safety_ratio: float = 0.66,
    num_samples: int = 10000,
) -> Tuple[float, float, float]:
    """
    Calculate Shapley-based Gini coefficients for liveness and safety, plus correlation.

    This function computes Shapley values and then calculates Gini coefficients
    for both liveness and safety measures, along with their correlation.

    Args:
        data: List of numeric data points (e.g., validator stakes).
        liveness_ratio: Threshold for liveness (default 0.33 = 33%).
        safety_ratio: Threshold for safety (default 0.66 = 66%).
        num_samples: Number of Monte Carlo samples (default 10000).

    Returns:
        Tuple of (gini_liveness, gini_safety, correlation) where correlation
        is between liveness and safety Shapley values.

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> gini_l, gini_s, corr = shapley_gini(data)
    """
    if not data or len(data) == 0:
        return 0.0, 0.0, 0.0

    # Calculate Shapley values
    shapley_liveness, shapley_safety = shapley_values(
        data, liveness_ratio, safety_ratio, num_samples
    )

    # Calculate Gini coefficients for liveness and safety
    gini_liveness = gini(shapley_liveness)
    gini_safety = gini(shapley_safety)

    # Calculate correlation
    if len(shapley_liveness) > 1:
        correlation = np.corrcoef(shapley_liveness, shapley_safety)[0, 1]
        if np.isnan(correlation):
            correlation = 0.0
    else:
        correlation = 0.0

    return gini_liveness, gini_safety, float(correlation)


def gamma_delta(data: List[float], gamma: float) -> float:
    """
    Calculate delta value for a given gamma percentile in the m-Gamma-Delta model.

    Delta measures the ratio between the richest entity and the entity at the
    gamma percentile, indicating inequality at that percentile.

    Args:
        data: List of numeric data points.
        gamma: Gamma percentile (0-100).

    Returns:
        Delta value. Returns infinity if gamma percentile is zero.

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> gamma_delta(data, 50.0)  # Delta at 50th percentile
    """
    if not data or len(data) == 0:
        return 0.0

    # Filter out zeros and sort in ascending order
    filtered_data = [x for x in data if x > 0]

    if len(filtered_data) == 0:
        return 0.0

    sorted_data = sorted(filtered_data)
    n = len(sorted_data)

    # Calculate the index for the gamma percentile
    gamma_index = max(int(np.ceil(gamma / 100 * n) - 1), 0)
    gamma_index = min(gamma_index, n - 1)

    # Get the tokens for the richest and gamma percentile
    richest_tokens = sorted_data[-1]
    gamma_percentile_tokens = sorted_data[gamma_index]

    # Check to prevent division by zero
    if gamma_percentile_tokens == 0:
        return float("inf")

    # Calculate delta
    delta = richest_tokens / gamma_percentile_tokens - 1

    return float(delta)


def gamma_delta_step_function(data: List[float], step: float = 5.0) -> List[float]:
    """
    Calculate delta values at regular intervals from 0 to 100 percent.

    This function computes delta values for gamma from 0 to 100 at regular
    intervals, creating a step function representation of the m-Gamma-Delta model.

    Args:
        data: List of numeric data points.
        step: Step size for gamma intervals (default 5.0).

    Returns:
        List of delta values corresponding to gamma values [0, step, 2*step, ..., 100].

    Examples:
        >>> data = [100.0, 200.0, 300.0, 400.0, 500.0]
        >>> deltas = gamma_delta_step_function(data)
    """
    if not data or len(data) == 0:
        return []

    delta_values = []
    gamma_values = np.arange(0, 101, step)

    for gamma in gamma_values:
        delta = gamma_delta(data, gamma)
        delta_values.append(delta)

    return delta_values


def lerp_vector(a: List[float], b: List[float], l: float) -> List[float]:
    """
    Perform linear interpolation between two vectors a and b with interpolation factor l.
    Linear interpolation (lerp) computes a point between vectors a and b based on scalar l in [0,1].
    When l=0, result equals a; when l=1, result equals b.

    Parameters:
        a: Starting vector.
        b: Ending vector.
        l: Interpolation factor in range [0, 1].

    Returns:
        A new list representing the linear interpolation result between a and b with factor l.

    Examples:
        >>> a = [1.0, 2.0, 3.0]
        >>> b = [4.0, 5.0, 6.0]
        >>> l = 0.5
        >>> lerp_vector(a, b, l)  # Output: [2.5, 3.5, 4.5]
    """
    if len(a) != len(b):
        raise ValueError("Vectors a and b must have the same length")

    interpolated_vector = []
    for i in range(len(a)):
        interpolated_vector.append((1 - l) * a[i] + l * b[i])

    return interpolated_vector


def lerp(a: float, b: float, l: float) -> float:
    """
    Perform linear interpolation between two values a and b with interpolation factor l.

    Linear interpolation (lerp) computes a point between a and b based on scalar l in [0,1].
    When l=0, result equals a; when l=1, result equals b.

    Parameters:
        a: Starting value.
        b: Ending value.
        l: Interpolation factor in range [0, 1].

    Returns:
        Result of linear interpolation between a and b with factor l.

    Examples:
        >>> a = 1.0
        >>> b = 4.0
        >>> l = 0.5
        >>> lerp(a, b, l)  # Output: 2.5
    """
    return (1 - l) * a + l * b


def weighted_consensus(peers: List[float]) -> int:
    """
    Determine weighted consensus among a group of peer nodes based on their probabilities.
    This function computes weighted consensus among peer nodes, where each node is represented
    by a probability value. Nodes with higher probabilities have greater influence on consensus.

    Parameters:
        peers: A list containing the staked token amounts of each node.

    Returns:
        Index of the node selected as consensus result, based on weighted probability.

    Examples:
    >>> peers = [0.2, 0.3, 0.5]
    >>> weighted_consensus(peers)  # Result: index of selected node
    """
    if not peers or len(peers) == 0:
        raise ValueError("Peers list cannot be empty")

    total = sum(peers)
    if total == 0:
        return random.randint(0, len(peers) - 1)

    cumulative_probabilities = np.cumsum(np.array(peers) / total)
    random_number = random.random()

    # Find first index with cumulative probability >= random number
    for i, cum_prob in enumerate(cumulative_probabilities):
        if cum_prob >= random_number:
            return i

    # Fallback (shouldn't happen with proper cumulative probabilities)
    return len(peers) - 1


def opposite_weighted_consensus(peers: List[float]) -> int:
    """
    Determine opposite weighted consensus among peer group based on
    their probabilities.

    This function computes opposite weighted consensus among peer group,
    where each peer is represented by a probability value.
    Peers with lower probabilities (opposite influence) have
    greater influence on consensus result.

    Args:
        peers: List containing staked token amounts of each peer.

    Returns:
        Index of peer selected as opposite consensus, based on
        opposite weighted probability.

    Examples:
        >>> peers = [0.2, 0.3, 0.5]
        >>> opposite_weighted_consensus(peers)  # Output: index of the selected peer
    """
    if not peers or len(peers) == 0:
        raise ValueError("Peers list cannot be empty")

    max_peer = max(peers)
    opposite_peers = [abs(max_peer - peer) for peer in peers]

    total = sum(opposite_peers)
    if total == 0:
        return random.randint(0, len(peers) - 1)

    cumulative_probabilities = np.cumsum(np.array(opposite_peers) / total)
    random_number = random.random()

    # Find first index with cumulative probability >= random number
    for i, cum_prob in enumerate(cumulative_probabilities):
        if cum_prob >= random_number:
            return i

    # Fallback (shouldn't happen with proper cumulative probabilities)
    return len(peers) - 1


def gini_stabilized_consensus(peers: List[float], t: float) -> int:
    """
    Determine Gini stabilized consensus among peer group based on
    their probabilities, using linear interpolation between two consensus methods.

    It combines two consensus methods: weighted consensus and
    opposite weighted consensus, using linear interpolation based on parameter t.

    Args:
        peers: List containing staked token amounts of each peer.
        t: Interpolation parameter from 0 to 1, determining weight
           of weighted consensus (when t=0) and opposite weighted consensus (when t=1).

    Returns:
        Index of peer selected as dynamic consensus.

    Examples:
        >>> peers = [0.2, 0.3, 0.5]
        >>> t = 0.5
        >>> gini_stabilized_consensus(peers, t)  # Output: index of the selected peer
    """
    if t == -1:
        raise ValueError("Cannot launch GiniStabilized with t = -1")

    if not peers or len(peers) == 0:
        raise ValueError("Peers list cannot be empty")

    total = sum(peers)
    if total == 0:
        return random.randint(0, len(peers) - 1)

    # Calculate weighted probabilities
    weighted = np.cumsum(np.array(peers) / total)

    # Calculate opposite weighted probabilities
    max_peer = max(peers)
    processed_peers = [abs(max_peer - peer) for peer in peers]
    total_processed = sum(processed_peers)

    if total_processed == 0:
        opposite_weighted = np.cumsum(np.ones(len(peers)) / len(peers))
    else:
        opposite_weighted = np.cumsum(np.array(processed_peers) / total_processed)

    # Linear interpolation between the two methods
    cumulative_probabilities = lerp_vector(
        opposite_weighted.tolist(), weighted.tolist(), t
    )

    random_number = random.random()

    # Find first index with cumulative probability >= random number
    for i, cum_prob in enumerate(cumulative_probabilities):
        if cum_prob >= random_number:
            return i

    # Fallback (shouldn't happen with proper cumulative probabilities)
    return len(peers) - 1


def desw_consensus(peers: List[float], pmin: float = 0, pmax: float = 1) -> int:
    """
    Determine DESW (Dynamic Exponential Stake Weighting) consensus among peer group.
    Weight combines Power-Law (stake^p, where p = 1 - Gini) to create dynamic balance.

    Args:
        peers: List containing staked token amounts of each peer.

    Returns:
        Index of peer selected as DESW consensus.

    Examples:
        >>> peers = [0.2, 0.3, 0.5]
        >>> desw_consensus(peers)  # Output: index of the selected peer
    """
    if not peers or len(peers) == 0:
        raise ValueError("Peers list cannot be empty")

    total = sum(peers)
    if total == 0:
        return random.randint(0, len(peers) - 1)

    # Calculate Gini coefficient using existing function
    gini_stake = gini(peers)

    # Calculate dynamic p: p = 1 - Gini, bounded in [0.2, 0.8]
    p_dynamic = max(pmin, min(pmax, 1 - gini_stake))

    # Calculate Power-Law weights
    power_weights = np.array(peers) ** p_dynamic

    # Normalize to probabilities
    total_weight = sum(power_weights)
    probabilities = power_weights / total_weight
    cumulative_probabilities = np.cumsum(probabilities)

    # Select validator randomly
    random_number = random.random()
    for i, cum_prob in enumerate(cumulative_probabilities):
        if cum_prob >= random_number:
            return i

    # Fallback
    return len(peers) - 1


def srsw_weighted_consensus(peers: List[float]) -> int:
    """
    Determine SRSW weighted consensus among a group of peer nodes.

    This function applies square root to stake before calculating probabilities,
    helping reduce influence of validators with very high stake and decrease
    the system's Gini coefficient.

    Args:
        peers: List containing staked token amounts of each node.

    Returns:
        Index of node selected as consensus result,
        based on square root weighted probability.

    Examples:
        >>> peers = [1, 10, 100]
        >>> srsw_weighted_consensus(peers)  # Reduce influence of peer with stake = 100
    """
    if not peers or len(peers) == 0:
        raise ValueError("Peers list cannot be empty")

    # Calculate square root of stakes
    srsw_stakes = [np.sqrt(stake) for stake in peers]

    total = sum(srsw_stakes)
    if total == 0:
        return random.randint(0, len(peers) - 1)

    cumulative_probabilities = np.cumsum(np.array(srsw_stakes) / total)
    random_number = random.random()

    # Find first index with cumulative probability >= random number
    for i, cum_prob in enumerate(cumulative_probabilities):
        if cum_prob >= random_number:
            return i

    # Fallback (shouldn't happen with proper cumulative probabilities)
    return len(peers) - 1


def log_weighted_consensus(peers: List[float]) -> int:
    """
    Determine logarithmic weighted consensus among a group of peer nodes.

    This function applies natural logarithm to stake before calculating probabilities,
    helping reduce influence of validators with very high stake and decrease
    the system's Gini coefficient.

    Args:
        peers: List containing staked token amounts of each node.

    Returns:
        Index of node selected as consensus result,
        based on logarithmic weighted probability.

    Examples:
        >>> peers = [1, 10, 100]
        >>> log_weighted_consensus(peers)  # Reduce influence of peer with stake = 100
    """
    if not peers or len(peers) == 0:
        raise ValueError("Peers list cannot be empty")

    # Avoid log(0) by adding small value
    epsilon = 1e-8
    log_stakes = [np.log(max(stake, epsilon)) for stake in peers]

    total = sum(log_stakes)
    if total == 0:
        return random.randint(0, len(peers) - 1)

    cumulative_probabilities = np.cumsum(np.array(log_stakes) / total)
    random_number = random.random()

    # Find first index with cumulative probability >= random number
    for i, cum_prob in enumerate(cumulative_probabilities):
        if cum_prob >= random_number:
            return i

    # Fallback (shouldn't happen with proper cumulative probabilities)
    return len(peers) - 1


def random_consensus(peers: List[float]) -> int:
    """
    Determine random consensus among peer group.

    This function selects a random agent from the group based on uniform distribution.

    Args:
        peers: List containing staked token amounts of each peer.

    Returns:
        Index of randomly selected agent for consensus.

    Examples:
        >>> peers = [0.2, 0.3, 0.5]
        >>> random_consensus(peers)  # Output: index of the randomly selected agent
    """
    if not peers or len(peers) == 0:
        raise ValueError("Peers list cannot be empty")

    return random.randint(0, len(peers) - 1)


def constant_reward(total_reward: float, n_epochs: int) -> float:
    """Calculate fixed reward per epoch"""
    return total_reward / n_epochs


def dynamic_reward(
    base_reward: float, validator_stake: float, total_stake: float
) -> float:
    """
    Calculate dynamic reward tỷ lệ với stake của validator

    Reward = base_reward * (stake_percentage + 1)
    Validator có stake lớn hơn nhận reward nhiều hơn

    Args:
        base_reward: Reward cơ bản
        validator_stake: Stake của validator được chọn
        total_stake: Tổng stake trong hệ thống

    Returns:
        Reward amount tỷ lệ với stake
    """
    if total_stake == 0:
        return base_reward

    stake_percentage = validator_stake / total_stake
    # Reward = base_reward * (1 + stake_percentage)
    # Ví dụ: stake_percentage = 0.1 (10%) -> reward = base_reward * 1.1
    return base_reward * (1 + stake_percentage)


def stake_based_reward(
    base_reward: float, validator_stake: float, total_stake: float
) -> float:
    """
    Calculate reward dựa trên stake percentage của validator
    Validator có stake lớn hơn nhận reward nhiều hơn

    Args:
        base_reward: Reward cơ bản
        validator_stake: Stake của validator được chọn
        total_stake: Tổng stake trong hệ thống

    Returns:
        Reward amount
    """
    if total_stake == 0:
        return base_reward
    stake_percentage = validator_stake / total_stake
    return base_reward * (
        1 + stake_percentage
    )  # Reward = base * (1 + stake_percentage)


def generate_peers(
    n_peers: int,
    initial_volume: float,
    distribution_type: Distribution,
    initial_gini: float = -1.0,
) -> List[float]:
    """
    Generate initial peer stakes based on distribution type

    Args:
        n_peers: Number of peers to create
        initial_volume: Total initial stake volume
        distribution_type: Distribution type (Uniform, Gini, Random)
        initial_gini: Initial Gini coefficient (for Gini distribution)

    Returns:
        List of initial stakes for each peer
    """
    if distribution_type == Distribution.UNIFORM:
        return generate_vector_uniform(n_peers, initial_volume)
    elif distribution_type == Distribution.GINI:
        if initial_gini == -1.0:
            print(
                "In order to generate peers with a Gini distribution, call 'generate_peers' with the 'initial_gini' "
                + "parameter positive and less or equal to 1. Automatically setting 'initial_gini' equal to 0.3"
            )
            initial_gini = 0.3
        return generate_vector_with_gini(n_peers, initial_volume, initial_gini)
    elif distribution_type == Distribution.RANDOM:
        return generate_vector_random(n_peers, initial_volume)
    else:
        raise ValueError(f"Unknown distribution type: {distribution_type}")


def consensus(
    pos: PoS, stakes: List[float], t: float = -1.0, pmin: float = 0, pmax: float = 1
) -> int:
    """
    Execute consensus algorithm based on PoS type

    Args:
        pos: Proof of Stake type
        stakes: List of peer stakes
        t: Parameter for GiniStabilized consensus

    Returns:
        Index of selected validator
    """
    if pos == PoS.WEIGHTED:
        return weighted_consensus(stakes)
    elif pos == PoS.OPPOSITE_WEIGHTED:
        return opposite_weighted_consensus(stakes)
    elif pos == PoS.GINI_STABILIZED:
        return gini_stabilized_consensus(stakes, t)
    elif pos == PoS.LOG_WEIGHTED:
        return log_weighted_consensus(stakes)
    elif pos == PoS.DESW:
        return desw_consensus(stakes, pmin, pmax)
    elif pos == PoS.SRSW_WEIGHTED:
        return srsw_weighted_consensus(stakes)
    elif pos == PoS.RANDOM:
        return random_consensus(stakes)
    else:
        raise ValueError(f"Unknown PoS type: {pos}")


def generate_vector_with_gini(
    n_peers: int, initial_volume: float, gini_coeff: float
) -> List[float]:
    """
    Generate a vector with specific Gini coefficient

    Args:
        n_peers: Number of peers
        initial_volume: Total volume to distribute
        gini_coeff: Target Gini coefficient

    Returns:
        List of stakes with specified Gini coefficient
    """

    def lorenz_curve(x1: float, y1: float, x2: float, y2: float):
        """Create Lorenz curve function"""
        m = (y2 - y1) / (x2 - x1) if x2 != x1 else 0
        return lambda x: m * x

    max_r = (n_peers - 1) / 2
    r = gini_coeff * max_r
    prop = ((n_peers - 1) / n_peers) * ((max_r - r) / max_r)
    lc = lorenz_curve(0, 0, (n_peers - 1) / n_peers, prop)

    # Create cumulative distribution
    q = [lc(i / n_peers) for i in range(1, n_peers)]
    q.append(1.0)

    # Convert to actual stakes
    cumulative_sum = [i * initial_volume for i in q]
    stakes = [cumulative_sum[0]]

    for i in range(1, n_peers):
        stakes.append(cumulative_sum[i] - cumulative_sum[i - 1])

    return stakes


def generate_vector_uniform(n: int, volume: float) -> List[float]:
    """
    Generate uniform distribution of stakes

    Args:
        n: Number of peers
        volume: Total volume to distribute

    Returns:
        List of equal stakes
    """
    return [volume / n for _ in range(n)]


def generate_vector_random(n: int, volume: float) -> List[float]:
    """
    Generate random distribution of stakes

    Args:
        n: Number of peers
        volume: Total volume to distribute

    Returns:
        List of randomly distributed stakes
    """
    if n <= 0:
        return []

    if n == 1:
        return [volume]

    # Create n-1 random cut points in range [0, volume]
    cut_points = sorted([random.uniform(0, volume) for _ in range(n - 1)])

    # Calculate stake for each peer based on cut points
    stakes = []

    # First peer: from 0 to first cut_point
    stakes.append(cut_points[0])

    # Middle peers: from previous cut_point to next cut_point
    for i in range(1, n - 1):
        stakes.append(cut_points[i] - cut_points[i - 1])

    # Last peer: from last cut_point to volume
    stakes.append(volume - cut_points[-1])

    # Ensure no negative stakes (in very rare cases)
    stakes = [max(0.0, stake) for stake in stakes]

    # Normalize to ensure total equals volume exactly
    total = sum(stakes)
    if total > 0:
        stakes = [stake * volume / total for stake in stakes]
    else:
        # Emergency case: return uniform distribution
        return generate_vector_uniform(n, volume)

    # stakes[0] = max(stakes) * 0.7
    return stakes


def compute_smooth_parameter(
    current_gini: float, target_gini: float, r: float
) -> float:
    """
    Calculate smoothing parameter for Gini stabilization

    Args:
        current_gini: Current Gini coefficient
        target_gini: Target Gini coefficient
        r: Smoothing coefficient

    Returns:
        Smoothing parameter value
    """
    diff = abs(current_gini - target_gini)
    diff = diff * (1 / r)

    res = (diff + 0j) ** (1 / 7.0)
    res = res.real * (1 if current_gini >= target_gini else -1)

    res = (res / 2) + 0.5

    if res > 1.0:
        res = 1.0
    if res < 0.0:
        res = 0.0

    return 1 - res


def compute_smooth_parameter2(
    current_gini: float, target_gini: float, r: float
) -> float:
    """
    Alternative smoothing parameter calculation

    Args:
        current_gini: Current Gini coefficient
        target_gini: Target Gini coefficient
        r: Smoothing coefficient

    Returns:
        Smoothing parameter value
    """
    denom = target_gini + r
    if denom == 0:
        return 0.5

    res = 0.5 - ((current_gini / denom) - (target_gini / denom)) * (
        1 / (1 - target_gini / denom)
    )

    if res > 1.0:
        res = 1.0
    if res < 0.0:
        res = 0.0

    return res


def compute_smooth_parameter3(current_gini: float, target_gini: float) -> float:
    """
    Simple smoothing parameter computation

    Args:
        current_gini: Current Gini coefficient
        target_gini: Target Gini coefficient

    Returns:
        Smoothing parameter value
    """
    if current_gini > target_gini:
        return 0.0
    elif current_gini < target_gini:
        return 1.5
    else:
        return 0.75  # Default when equal


def d(g: float, θ: float) -> float:
    """
    Compute function d for GiniStabilized consensus

    Args:
        g: Current Gini coefficient
        θ: Target Gini coefficient (theta)

    Returns:
        The value of d
    """
    if g > θ:
        return 0.5
    else:
        return 1.5


def try_to_join(
    stakes: List[float],
    corrupted: List[int],
    p: float,
    join_amount: NewEntry,
    percentage_corrupted: float,
) -> None:
    """
    Try to add new peer to the network

    Args:
        stakes: Current stake list (modified in place)
        corrupted: List of corrupted peer indices (modified in place)
        p: Join probability
        join_amount: Amount type for new peer
        percentage_corrupted: Percentage of corrupted peers
    """
    if random.random() <= p:
        # Add new peer
        if join_amount == NewEntry.NEW_AVERAGE:
            new_stake = sum(stakes) / len(stakes) if stakes else 0
        elif join_amount == NewEntry.NEW_MAX:
            new_stake = max(stakes) if stakes else 0
        elif join_amount == NewEntry.NEW_MIN:
            new_stake = min(stakes) if stakes else 0
        elif join_amount == NewEntry.NEW_RANDOM:
            new_stake = stakes[random.randint(0, len(stakes) - 1)] if stakes else 0
        else:
            new_stake = 0

        stakes.append(new_stake)

        # Check if new peer is corrupted
        if random.random() <= percentage_corrupted:
            corrupted.append(len(stakes) - 1)

        # Recursive call to try adding another peer
        try_to_join(stakes, corrupted, p, join_amount, percentage_corrupted)


def try_to_leave(stakes: List[float], p: float) -> None:
    """
    Try to remove peer from network

    Args:
        stakes: Current stake list (modified in place)
        p: Leave probability
    """
    if stakes and random.random() <= p:
        # Remove random peer
        index_to_remove = random.randint(0, len(stakes) - 1)
        stakes.pop(index_to_remove)


def try_sybil_attack(
    stakes: List[float],
    entity_ids: List[int],
    p_sybil: float,
    min_size: int,
    max_size: int,
) -> None:
    """
    Try to perform Sybil attack: split a validator's stake into multiple validators

    Args:
        stakes: Current stake list (modified in place)
        entity_ids: List mapping validator index to entity ID (modified in place)
        p_sybil: Probability of Sybil attack
        min_size: Minimum number of validators to split into
        max_size: Maximum number of validators to split into
    """
    if not stakes or random.random() > p_sybil:
        return

    # Find validators with sufficient stake (at least 2x average to split)
    avg_stake = sum(stakes) / len(stakes) if stakes else 0
    min_stake_to_split = avg_stake * 2

    # Get candidates (validators with enough stake)
    candidates = [i for i, stake in enumerate(stakes) if stake >= min_stake_to_split]

    if not candidates:
        return

    # Choose random validator to split
    victim_idx = random.choice(candidates)
    original_stake = stakes[victim_idx]
    original_entity_id = entity_ids[victim_idx]

    # Random number of splits
    num_splits = random.randint(min_size, max_size)

    # Split stake equally (simple strategy)
    split_stake = original_stake / num_splits

    # Remove original validator
    stakes.pop(victim_idx)
    entity_ids.pop(victim_idx)

    # Add N new validators with split stake
    for _ in range(num_splits):
        stakes.append(split_stake)
        entity_ids.append(original_entity_id)  # Same entity ID


def perform_scheduled_sybil(
    stakes: List[float],
    entity_ids: List[int],
    target_entity_id: int,
    num_splits: int,
) -> bool:
    """
    Thực hiện Sybil attack theo lịch: split validator của entity cụ thể

    Args:
        stakes: Current stake list (modified in place)
        entity_ids: List mapping validator index to entity ID (modified in place)
        target_entity_id: Entity ID cần thực hiện Sybil attack
        num_splits: Số validators để split thành

    Returns:
        True nếu thành công, False nếu không tìm thấy validator phù hợp
    """
    if not stakes or num_splits < 2:
        return False

    # Tìm tất cả validators có entity_id = target_entity_id
    candidates = [
        (i, stakes[i])
        for i in range(len(stakes))
        if i < len(entity_ids) and entity_ids[i] == target_entity_id
    ]

    if not candidates:
        return False

    # Chọn validator có stake lớn nhất
    victim_idx, original_stake = max(candidates, key=lambda x: x[1])

    # Split stake equally
    split_stake = original_stake / num_splits
    original_entity_id = entity_ids[victim_idx]

    # Remove original validator
    stakes.pop(victim_idx)
    entity_ids.pop(victim_idx)

    # Add N new validators with split stake
    for _ in range(num_splits):
        stakes.append(split_stake)
        entity_ids.append(original_entity_id)  # Same entity ID

    return True


def count_unique_entities(entity_ids: List[int]) -> int:
    """
    Count the number of unique entities (actual validators vs Sybil validators)

    Args:
        entity_ids: List mapping validator index to entity ID

    Returns:
        Number of unique entities
    """
    return len(set(entity_ids)) if entity_ids else 0
