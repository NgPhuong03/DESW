import pandas as pd
import numpy as np
import os
from datetime import datetime
import glob
from scipy.stats import linregress


def calculate_gini_coefficient(df, col="tokens"):
    """
    Compute the Gini coefficient using the standard Lorenz curve formula

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values

    Returns:
        float: Gini index (0 = perfect equality, 1 = complete inequality)
    """
    # Ensure numpy array for performance
    weights = df[col].to_numpy()

    # Sort values
    weights_sorted = np.sort(weights)

    # Cumulative sum of tokens
    cum_weights = np.cumsum(weights_sorted, dtype=float)
    total_weight = cum_weights[-1]

    # Lorenz curve is cumulative tokens divided by total tokens
    lorenz_curve = cum_weights / total_weight

    # Area under the Lorenz curve
    B = np.trapz(lorenz_curve, dx=1 / len(weights))

    # Gini coefficient via G = 1 - 2B
    gini_coefficient = 1 - 2 * B

    return gini_coefficient


def calculate_nakamoto_coefficient(df, col="tokens"):
    """
    Compute the Nakamoto coefficient - minimum number of validators to control > 50% stake

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values

    Returns:
        int: Number of validators required to exceed 50% of total stake
    """
    tokens = df[col].to_numpy()
    tokens_sorted = np.sort(tokens)[::-1]  # sort descending

    total_stake = np.sum(tokens_sorted)
    threshold = total_stake / 2

    cumulative_stake = 0
    for i, stake in enumerate(tokens_sorted):
        cumulative_stake += stake
        if cumulative_stake > threshold:
            return i + 1

    return len(tokens_sorted)


def calculate_nakamoto_coefficient_liveness(df, col="tokens"):
    """
    Compute the Nakamoto coefficient for Liveness - minimum number of validators to control > 33% stake

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values

    Returns:
        tuple: (validator_count, percentage) - Number of validators and percentage of total validators
    """
    tokens = df[col].to_numpy()
    tokens_sorted = np.sort(tokens)[::-1]  # sort descending

    total_stake = np.sum(tokens_sorted)
    threshold = total_stake * 0.33  # 33% threshold for liveness

    cumulative_stake = 0
    validator_count = 0
    for stake in tokens_sorted:
        cumulative_stake += stake
        validator_count += 1
        if cumulative_stake >= threshold:
            break

    total_validators = len(tokens_sorted)
    percentage = (
        (validator_count / total_validators) * 100 if total_validators > 0 else 0
    )

    return validator_count, round(percentage, 2)


def calculate_nakamoto_coefficient_safety(df, col="tokens"):
    """
    Compute the Nakamoto coefficient for Safety - minimum number of validators to control > 66% stake

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values

    Returns:
        tuple: (validator_count, percentage) - Number of validators and percentage of total validators
    """
    tokens = df[col].to_numpy()
    tokens_sorted = np.sort(tokens)[::-1]  # sort descending

    total_stake = np.sum(tokens_sorted)
    threshold = total_stake * 0.66  # 66% threshold for safety

    cumulative_stake = 0
    validator_count = 0
    for stake in tokens_sorted:
        cumulative_stake += stake
        validator_count += 1
        if cumulative_stake >= threshold:
            break

    total_validators = len(tokens_sorted)
    percentage = (
        (validator_count / total_validators) * 100 if total_validators > 0 else 0
    )

    return validator_count, round(percentage, 2)


def calculate_hhi_coefficient(df, col="tokens", normalize=False):
    """
    Compute HHI coefficient (Herfindahl-Hirschman Index) - measures market concentration

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values
        normalize (bool): Normalize HHI by number of validators or not

    Returns:
        float: HHI index (0 = fully diffuse, 1 = fully concentrated)
    """
    # Handle NaNs and values <= 0
    weights = df[col].fillna(0).to_numpy()
    weights = weights[weights > 0]

    total_weight = weights.sum()
    if total_weight == 0:
        return 0.0

    market_shares = weights / total_weight
    hhi_index = np.sum(market_shares**2)

    if normalize and len(weights) > 1:
        n = len(weights)
        hhi_index = (hhi_index - 1 / n) / (1 - 1 / n)

    return hhi_index


def calculate_theil_index(df, col="tokens"):
    """
    Compute the Theil Index - measures inequality in distribution

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values

    Returns:
        float: Theil Index (0 = perfect equality, higher = more inequality)
    """
    tokens = df[col].to_numpy()

    # Calculate the mean tokens
    mean_tokens = np.mean(tokens)

    # Avoid division by zero and log(0) issues by replacing 0 with a very small value
    tokens = tokens.copy()
    tokens[tokens == 0] = 1e-10
    mean_tokens = max(mean_tokens, 1e-10)

    # Compute the Theil Index
    theil_index = np.mean((tokens / mean_tokens) * np.log(tokens / mean_tokens))

    return theil_index


def calculate_zipf_coefficient(df, col="tokens"):
    """
    Compute Zipf's Law coefficient - measures power-law distribution

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values

    Returns:
        float: Zipf coefficient (higher = more concentrated)
    """
    # Sort weights in descending order and filter out zeros
    weights = np.sort(df[col].to_numpy())[::-1]
    weights = weights[weights > 0]  # Filter out zero values to avoid log(0)

    if len(weights) < 2:
        return 0.0

    # Rank each validator (1-based rank)
    ranks = np.arange(1, len(weights) + 1)

    # Perform log-log transformation
    log_ranks = np.log(ranks)
    log_weights = np.log(weights)

    # Calculate the slope (Z) of the log-log regression
    slope, _, _, _, _ = linregress(log_ranks, log_weights)

    # Zipf's Law coefficient is the negative of the slope
    zipf_coefficient = -slope
    return zipf_coefficient


def calculate_palma_ratio(df, col="tokens"):
    """
    Compute Palma Ratio - ratio of top 10% to bottom 40% stake

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values

    Returns:
        float: Palma Ratio (higher = more inequality)
    """
    tokens = df[col].to_numpy()

    # Sort the values in descending order
    tokens_sorted = np.sort(tokens)[::-1]

    # Determine the indices for the top 10% and bottom 40%
    top_10_idx = int(len(tokens) * 0.1)
    bottom_40_idx = int(len(tokens) * 0.4)

    if top_10_idx == 0 or bottom_40_idx == 0:
        return float("inf") if top_10_idx > 0 else 0.0

    # Sum the tokens for the top 10% and bottom 40%
    sum_top_10 = np.sum(tokens_sorted[:top_10_idx])
    sum_bottom_40 = np.sum(tokens_sorted[-bottom_40_idx:])

    # Calculate the Palma Ratio
    if sum_bottom_40 > 0:
        palma_ratio = sum_top_10 / sum_bottom_40
    else:
        palma_ratio = float("inf")

    return palma_ratio


def calculate_shannon_index(df, col="tokens"):
    """
    Compute Shannon Index (normalized) - measures diversity/entropy

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values

    Returns:
        float: Normalized Shannon Index (0 = no diversity, 1 = maximum diversity)
    """
    stakes = df[col].to_numpy()

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

    # Normalize by log of number of non-zero proportions
    normalized_shannon = shannon_index / np.log(len(nonzero_proportions))

    return normalized_shannon


def calculate_gamma_delta(df, col="tokens", gamma=50):
    """
    Compute Gamma-Delta model - ratio of richest to gamma percentile

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values
        gamma (float): Percentile (0-100) to compare with richest

    Returns:
        float: Delta value (richest / gamma_percentile - 1)
    """
    # Sort the DataFrame by tokens in ascending order
    sorted_tokens = np.sort(df[col].to_numpy())
    sorted_tokens = sorted_tokens[sorted_tokens > 0]  # Filter out zeros

    if len(sorted_tokens) == 0:
        return 0.0

    # Calculate the index for the gamma percentile
    gamma_index = max(int(np.ceil(gamma / 100 * len(sorted_tokens)) - 1), 0)

    # Get the tokens for the richest and gamma percentile
    richest_tokens = sorted_tokens[-1]
    gamma_percentile_tokens = sorted_tokens[gamma_index]

    # Check to prevent division by zero
    if gamma_percentile_tokens == 0:
        return float("inf")

    # Calculate delta
    delta = richest_tokens / gamma_percentile_tokens - 1
    return delta


def calculate_shapley_gini(
    df, col="tokens", liveness_ratio=0.33, safety_ratio=0.66, num_samples=1000
):
    """
    Compute Shapley-based Gini coefficients for liveness and safety

    Args:
        df (pd.DataFrame): DataFrame containing data
        col (str): Column name containing stake values
        liveness_ratio (float): Threshold for liveness (default 0.33 = 33%)
        safety_ratio (float): Threshold for safety (default 0.66 = 66%)
        num_samples (int): Number of Monte Carlo samples (default 1000)

    Returns:
        tuple: (gini_liveness, gini_safety, correlation)
    """
    import random

    weights = df[col].to_numpy()
    total_weight = weights.sum()
    n = len(weights)

    if n == 0 or total_weight == 0:
        return 0.0, 0.0, 0.0

    shapley_values_liveness = np.zeros(n)
    shapley_values_safety = np.zeros(n)

    # Monte Carlo sampling to approximate Shapley values
    for i in range(n):
        marginal_contributions_liveness = []
        marginal_contributions_safety = []

        # Sample random subsets to approximate the Shapley values
        for _ in range(num_samples):
            other_indices = [j for j in range(n) if j != i]
            subset_size = random.randint(0, n - 1) if n > 1 else 0
            subset_indices = (
                random.sample(other_indices, subset_size) if subset_size > 0 else []
            )
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

    # Calculate Gini coefficients for liveness and safety
    gini_liveness = calculate_gini_coefficient(
        pd.DataFrame({col: shapley_values_liveness}), col
    )
    gini_safety = calculate_gini_coefficient(
        pd.DataFrame({col: shapley_values_safety}), col
    )

    # Calculate correlation
    if len(shapley_values_liveness) > 1:
        correlation = np.corrcoef(shapley_values_liveness, shapley_values_safety)[0, 1]
        if np.isnan(correlation):
            correlation = 0.0
    else:
        correlation = 0.0

    return gini_liveness, gini_safety, float(correlation)
