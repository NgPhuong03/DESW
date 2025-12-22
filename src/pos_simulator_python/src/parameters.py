"""
Parameter module for PoS Simulator
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional, List, Tuple


class Distribution(Enum):
    """Distribution types for initial stake allocation"""

    UNIFORM = 1
    GINI = 2
    RANDOM = 3


class PoS(Enum):
    """Proof of Stake consensus types"""

    WEIGHTED = 1
    OPPOSITE_WEIGHTED = 2
    GINI_STABILIZED = 3
    LOG_WEIGHTED = 4
    DESW = 5  # New algorithm (DESW - Dynamic Exponential Stake Weighting)
    SRSW_WEIGHTED = 6
    RANDOM = 7  # Random algorithm


class NewEntry(Enum):
    """New entry amount types when peer joins"""

    NEW_MAX = 0
    NEW_MIN = 1
    NEW_RANDOM = 2
    NEW_AVERAGE = 3


class SType(Enum):
    """Update function types for GiniStabilized PoS"""

    CONSTANT = 0
    LINEAR = 1
    QUADRATIC = 2
    SQRT = 3


@dataclass
class Parameters:
    """
    Parameter class containing all simulation parameters
    """

    n_epochs: int = 50000
    proof_of_stake: PoS = PoS.WEIGHTED
    initial_stake_volume: float = 10000.0
    initial_distribution: Distribution = Distribution.GINI
    initial_gini: float = 0.3
    n_peers: int = 1000
    n_corrupted: int = 20
    p_fail: float = 0.50
    p_join: float = 0.001
    p_leave: float = 0.001
    join_amount: NewEntry = NewEntry.NEW_RANDOM
    penalty_percentage: float = 0.50
    θ: float = 0.3  # theta - target Gini coefficient
    s_type: SType = SType.LINEAR
    k: float = 0.001
    reward: float = 10.0  # Base reward (for constant) or total reward (for dynamic)
    use_dynamic_reward: bool = True  # True = dynamic reward, False = constant reward
    scheduled_joins: Optional[List[Tuple[int, float]]] = (
        None  # [(epoch, stake_amount), ...]
    )
    # Sybil Attack parameters
    p_sybil: float = 0.0  # Probability of Sybil attack per epoch (0 = disabled)
    min_sybil_size: int = 2  # Minimum number of validators to split into
    max_sybil_size: int = 5  # Maximum number of validators to split into
    scheduled_sybil_attacks: Optional[List[Tuple[int, int, int]]] = (
        None  # [(epoch, entity_id, num_splits), ...]
    )

    def __post_init__(self):
        """Post-initialization validation"""
        if self.n_epochs <= 0:
            raise ValueError("n_epochs must be positive")
        if not 0 <= self.initial_gini <= 1:
            raise ValueError("initial_gini must be between 0 and 1")
        if self.n_peers <= 0:
            raise ValueError("n_peers must be positive")
        if self.n_corrupted < 0:
            raise ValueError("n_corrupted must be non-negative")
        if not 0 <= self.p_fail <= 1:
            raise ValueError("p_fail must be between 0 and 1")
        if not 0 <= self.p_join <= 1:
            raise ValueError("p_join must be between 0 and 1")
        if not 0 <= self.p_leave <= 1:
            raise ValueError("p_leave must be between 0 and 1")
        if not 0 <= self.penalty_percentage <= 1:
            raise ValueError("penalty_percentage must be between 0 and 1")
        if not 0 <= self.θ <= 1:
            raise ValueError("θ (theta) must be between 0 and 1")
        if self.k <= 0:
            raise ValueError("k must be positive")
        if self.reward <= 0:
            raise ValueError("reward must be positive")
        if not 0 <= self.p_sybil <= 1:
            raise ValueError("p_sybil must be between 0 and 1")
        if self.min_sybil_size < 2:
            raise ValueError("min_sybil_size must be at least 2")
        if self.max_sybil_size < self.min_sybil_size:
            raise ValueError("max_sybil_size must be >= min_sybil_size")
