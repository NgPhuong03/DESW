#!/usr/bin/env python3
"""
Timing utilities for performance analysis
"""

import time
import numpy as np
from typing import List, Tuple, Dict
import statistics
from functools import wraps

def time_function(func):
    """Decorator to measure function execution time"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        return result, execution_time
    return wrapper

def gini_with_timing(data: List[float]) -> Tuple[float, float]:
    """
    Compute Gini coefficient with timing measurement
    
    Args:
        data: List of numeric data points
        
    Returns:
        Tuple of (gini_coefficient, execution_time_in_seconds)
    """
    if not data or len(data) == 0:
        return 0.0, 0.0
    
    start_time = time.perf_counter()
    
    # Number of data points
    n = len(data)
    
    # Sum of data points
    total = sum(data)
    
    if total == 0:
        return 0.0, 0.0
    
    # Sort data points in ascending order
    sorted_data = sorted(data)
    
    # Cumulative share of sorted data
    cumulative_percentage = np.cumsum(sorted_data) / total
    
    # Lorenz curve
    lorenz_curve = cumulative_percentage - 0.5 * (np.array(sorted_data) / total)
    
    # Gini coefficient
    G = 1 - 2 * np.sum(lorenz_curve) / n
    
    end_time = time.perf_counter()
    execution_time = end_time - start_time
    
    return G, execution_time

def benchmark_gini_calculation(data_sizes: List[int], num_iterations: int = 100) -> Dict:
    """
    Benchmark Gini coefficient calculation for different data sizes
    
    Args:
        data_sizes: List of data sizes to test
        num_iterations: Number of iterations per data size
        
    Returns:
        Dictionary with timing statistics
    """
    results = {}
    
    for size in data_sizes:
        print(f"Benchmarking Gini calculation for {size} data points...")
        
        # Generate random data for testing
        test_data = [np.random.uniform(1, 1000) for _ in range(size)]
        
        execution_times = []
        gini_values = []
        
        for _ in range(num_iterations):
            gini_val, exec_time = gini_with_timing(test_data)
            execution_times.append(exec_time)
            gini_values.append(gini_val)
        
        results[size] = {
            'mean_time': statistics.mean(execution_times),
            'std_time': statistics.stdev(execution_times),
            'min_time': min(execution_times),
            'max_time': max(execution_times),
            'median_time': statistics.median(execution_times),
            'mean_gini': statistics.mean(gini_values),
            'std_gini': statistics.stdev(gini_values)
        }
        
        print(f"  Mean time: {results[size]['mean_time']:.6f}s")
        print(f"  Std time: {results[size]['std_time']:.6f}s")
        print(f"  Mean Gini: {results[size]['mean_gini']:.6f}")
    
    return results

def analyze_gini_performance_in_simulation(stakes_history: List[List[float]]) -> Dict:
    """
    Analyze Gini calculation performance during simulation
    
    Args:
        stakes_history: List of stake distributions at each epoch
        
    Returns:
        Dictionary with performance analysis
    """
    execution_times = []
    gini_values = []
    data_sizes = []
    
    print("Analyzing Gini calculation performance during simulation...")
    
    for i, stakes in enumerate(stakes_history):
        if i % 1000 == 0:  # Sample every 1000 epochs
            gini_val, exec_time = gini_with_timing(stakes)
            execution_times.append(exec_time)
            gini_values.append(gini_val)
            data_sizes.append(len(stakes))
    
    return {
        'mean_time': statistics.mean(execution_times),
        'std_time': statistics.stdev(execution_times),
        'min_time': min(execution_times),
        'max_time': max(execution_times),
        'median_time': statistics.median(execution_times),
        'mean_gini': statistics.mean(gini_values),
        'std_gini': statistics.stdev(gini_values),
        'mean_data_size': statistics.mean(data_sizes),
        'total_calculations': len(execution_times)
    }

## optimized_gini removed as per project decision to keep only the standard implementation

## compare_gini_implementations removed since optimized_gini was removed
