"""
PoS Simulation Package
"""

from .parameters import Parameters, Distribution, PoS, NewEntry, SType
from .simulator import simulate, simulate_verbose, run_experiment
from .utils import (
    gini,
    generate_peers,
    consensus,
    weighted_consensus,
    opposite_weighted_consensus,
    gini_stabilized_consensus,
    log_weighted_consensus,
    srsw_weighted_consensus,
    desw_consensus,
    nakamoto_coefficient,
    HHI_coefficient,
)

__all__ = [
    # Core classes and enums
    "Parameters",
    "Distribution",
    "PoS",
    "NewEntry",
    "SType",
    # Simulation functions
    "simulate",
    "simulate_verbose",
    "run_experiment",
    # Utility functions
    "gini",
    "generate_peers",
    "consensus",
    "weighted_consensus",
    "opposite_weighted_consensus",
    "gini_stabilized_consensus",
    "log_weighted_consensus",
    "srsw_weighted_consensus",
    "desw_consensus",
    "nakamoto_coefficient",
    "HHI_coefficient",
]
