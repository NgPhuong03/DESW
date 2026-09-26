/**
 * Real Data Analysis Service
 *
 * Analyze real blockchain data with algorithms:
 * - Baseline (WEIGHTED)
 * - SRSW (Square Root Stake Weighting)
 * - LSW (Log Stake Weighting)
 * - DESW (Dynamic Exponential Stake Weighting)
 */

class RealDataAnalysisService {
  constructor() {
    this.algorithms = {
      BASELINE: "BASELINE", // Original stake weights
      SRSW: "SRSW", // Square root weights
      LSW: "LSW", // Logarithmic weights
      DESW: "DESW", // Dynamic exponential weights
    };

    // DESW parameters (matching analysis_chains)
    this.pmin = 0.1;
    this.pmax = 0.6;
  }

  /**
   * Calculate Gini coefficient
   */
  calculateGini(stakes) {
    if (!stakes || stakes.length === 0) return 0.0;

    const n = stakes.length;
    const total = stakes.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0.0;

    // Sort ascending (matching Python: np.sort)
    const sorted = [...stakes].sort((a, b) => a - b);

    // Cumulative sum (matching Python: np.cumsum)
    const cumWeights = [];
    let cumSum = 0;
    for (let i = 0; i < n; i++) {
      cumSum += sorted[i];
      cumWeights.push(cumSum);
    }

    // Lorenz curve = cumulative weights / total weight
    const lorenzCurve = cumWeights.map((cw) => cw / total);

    // Area under Lorenz curve using trapezoidal rule (matching Python: np.trapz)
    // dx = 1/n (each point represents 1/n of the population)
    const dx = 1 / n;
    let area = 0;
    for (let i = 0; i < n - 1; i++) {
      // Trapezoidal rule: area = dx * (y[i] + y[i+1]) / 2
      area += dx * ((lorenzCurve[i] + lorenzCurve[i + 1]) / 2);
    }

    // Gini coefficient: G = 1 - 2B (matching Python)
    const giniCoeff = 1 - 2 * area;
    return Math.max(0, Math.min(1, giniCoeff));
  }

  /**
   * Calculate Nakamoto coefficient
   * Standard: threshold = 0.5 (50%)
   * - For 50%: use > (strictly greater than) - matches Python
   * - For 33% and 66%: use >= (greater than or equal) - matches Python
   */
  calculateNakamoto(stakes, threshold = 0.5) {
    if (!stakes || stakes.length === 0) return 0;

    const total = stakes.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;

    // Sort descending
    const sorted = [...stakes].sort((a, b) => b - a);
    const targetAmount = total * threshold;

    let cumulativeSum = 0;
    for (let i = 0; i < sorted.length; i++) {
      cumulativeSum += sorted[i];
      if (threshold === 0.5) {
        if (cumulativeSum > targetAmount) {
          return i + 1;
        }
      } else {
        if (cumulativeSum >= targetAmount) {
          return i + 1;
        }
      }
    }

    return sorted.length;
  }

  /**
   * Calculate HHI (Herfindahl-Hirschman Index)
   */
  calculateHHI(stakes) {
    if (!stakes || stakes.length === 0) return 0;

    const total = stakes.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;

    return stakes.reduce((sum, stake) => {
      const marketShare = stake / total;
      return sum + marketShare * marketShare;
    }, 0);
  }

  /**
   * Calculate Nakamoto liveness (33% threshold)
   * Returns number of validators needed to reach 33% of total stake
   */
  calculateNakamotoLiveness(stakes) {
    return this.calculateNakamoto(stakes, 0.33);
  }

  /**
   * Calculate Nakamoto safety (66% threshold)
   * Returns number of validators needed to reach 66% of total stake
   */
  calculateNakamotoSafety(stakes) {
    return this.calculateNakamoto(stakes, 0.66);
  }

  /**
   * Calculate Zipf coefficient (negative slope of log-log rank vs stake)
   */
  calculateZipf(stakes) {
    if (!stakes || stakes.length === 0) return 0;

    // Filter out non-positive stakes and sort descending
    const weights = stakes.filter((v) => v > 0).sort((a, b) => b - a);
    if (weights.length === 0) return 0;

    const n = weights.length;
    const ranks = Array.from({ length: n }, (_, i) => i + 1);
    const logRanks = ranks.map((r) => Math.log(r));
    const logWeights = weights.map((w) => Math.log(w));

    const meanX = logRanks.reduce((sum, v) => sum + v, 0) / logRanks.length;
    const meanY = logWeights.reduce((sum, v) => sum + v, 0) / logWeights.length;

    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const dx = logRanks[i] - meanX;
      const dy = logWeights[i] - meanY;
      num += dx * dy;
      den += dx * dx;
    }

    if (den === 0) return 0;

    const slope = num / den;
    // Zipf coefficient is negative of the slope
    return Number((-slope).toFixed(6));
  }

  /**
   * Apply algorithm transformation to stakes
   */
  applyAlgorithm(stakes, algorithm) {
    if (!stakes || stakes.length === 0) {
      return [];
    }

    switch (algorithm) {
      case this.algorithms.BASELINE:
        // Original stakes (no transformation)
        return [...stakes];

      case this.algorithms.SRSW:
        // Square root of stakes
        return stakes.map((stake) => Math.sqrt(stake));

      case this.algorithms.LSW:
        // Logarithmic weights (log1p to avoid log(0))
        return stakes.map((stake) => Math.log1p(stake));

      case this.algorithms.DESW:
        // Dynamic exponential weighting
        const giniOriginal = this.calculateGini(stakes);
        const pDynamic = Math.max(
          this.pmin,
          Math.min(this.pmax, 1 - giniOriginal)
        );
        return stakes.map((stake) => Math.pow(stake, pDynamic));

      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }

  /**
   * Analyze a blockchain with all algorithms
   */
  analyzeBlockchain(validatorData) {
    if (!validatorData || !Array.isArray(validatorData.validators)) {
      throw new Error("Invalid validator data format");
    }

    const validValidators = validatorData.validators.filter(
      (v) => v.tokens != null && typeof v.tokens === "number" && v.tokens > 0
    );

    if (validValidators.length === 0) {
      throw new Error("No valid validators found (all have stake <= 0)");
    }

    const stakes = validValidators.map((v) => v.tokens);
    const results = {};

    // Analyze with each algorithm
    for (const [name, algorithm] of Object.entries(this.algorithms)) {
      try {
        const transformedStakes = this.applyAlgorithm(stakes, algorithm);
        const totalValidators = transformedStakes.length;

        const livenessCount = this.calculateNakamotoLiveness(transformedStakes);
        const safetyCount = this.calculateNakamotoSafety(transformedStakes);

        const livenessPct =
          totalValidators > 0 ? (livenessCount / totalValidators) * 100 : 0;
        const safetyPct =
          totalValidators > 0 ? (safetyCount / totalValidators) * 100 : 0;

        results[name.toLowerCase()] = {
          algorithm: algorithm,
          gini_coefficient: this.calculateGini(transformedStakes),
          nakamoto_coefficient: this.calculateNakamoto(transformedStakes, 0.5),
          nakamoto_liveness: livenessCount,
          nakamoto_liveness_pct: Number(livenessPct.toFixed(2)),
          nakamoto_safety: safetyCount,
          nakamoto_safety_pct: Number(safetyPct.toFixed(2)),
          hhi_coefficient: this.calculateHHI(transformedStakes),
          zipf_coefficient: this.calculateZipf(transformedStakes),
          total_validators: transformedStakes.length,
          total_stake: transformedStakes.reduce((sum, s) => sum + s, 0),
        };
      } catch (error) {
        results[name.toLowerCase()] = {
          algorithm: algorithm,
          error: error.message,
          gini_coefficient: 0,
          nakamoto_coefficient: 0,
          nakamoto_liveness: 0,
          nakamoto_liveness_pct: 0,
          nakamoto_safety: 0,
          nakamoto_safety_pct: 0,
          hhi_coefficient: 0,
          zipf_coefficient: 0,
          total_validators: 0,
          total_stake: 0,
        };
      }
    }

    const totalValidators = validValidators.length;
    const totalStake = stakes.reduce((sum, s) => sum + s, 0);
    const originalTotalValidators = validatorData.validators.length;
    const filteredOutCount = originalTotalValidators - totalValidators;

    return {
      blockchain: validatorData.blockchain,
      timestamp: validatorData.timestamp,
      original_data: {
        total_validators: totalValidators,
        total_stake: totalStake,
        original_total_validators: originalTotalValidators,
        filtered_out_validators: filteredOutCount,
      },
      analysis_results: results,
    };
  }

  /**
   * Analyze multiple blockchains
   */
  analyzeMultipleChains(chainsData) {
    const results = {};
    const summary = {
      total_chains: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      algorithms_compared: Object.keys(this.algorithms),
    };

    for (const [chainName, chainData] of Object.entries(chainsData)) {
      summary.total_chains++;

      try {
        if (chainData.success && chainData.validators) {
          results[chainName] = this.analyzeBlockchain(chainData);
          summary.successful_analyses++;
        } else {
          results[chainName] = {
            blockchain: chainName,
            error: chainData.error || "No validator data available",
            analysis_results: {},
          };
          summary.failed_analyses++;
        }
      } catch (error) {
        results[chainName] = {
          blockchain: chainName,
          error: error.message,
          analysis_results: {},
        };
        summary.failed_analyses++;
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      results,
    };
  }

  /**
   * Generate comparison matrix for visualization
   */
  generateComparisonMatrix(analysisResults) {
    const matrix = {
      blockchains: [],
      algorithms: Object.keys(this.algorithms),
      metrics: {
        gini_coefficients: {},
        nakamoto_coefficients: {},
        hhi_coefficients: {},
      },
    };

    // Initialize metrics objects
    for (const algorithm of matrix.algorithms) {
      matrix.metrics.gini_coefficients[algorithm.toLowerCase()] = [];
      matrix.metrics.nakamoto_coefficients[algorithm.toLowerCase()] = [];
      matrix.metrics.hhi_coefficients[algorithm.toLowerCase()] = [];
    }

    // Populate data
    for (const [chainName, chainResult] of Object.entries(analysisResults)) {
      if (chainResult.analysis_results && !chainResult.error) {
        matrix.blockchains.push(chainName);

        for (const [algName, algResult] of Object.entries(
          chainResult.analysis_results
        )) {
          matrix.metrics.gini_coefficients[algName].push({
            blockchain: chainName,
            value: algResult.gini_coefficient || 0,
          });
          matrix.metrics.nakamoto_coefficients[algName].push({
            blockchain: chainName,
            value: algResult.nakamoto_coefficient || 0,
          });
          matrix.metrics.hhi_coefficients[algName].push({
            blockchain: chainName,
            value: algResult.hhi_coefficient || 0,
          });
        }
      }
    }

    return matrix;
  }

  /**
   * Generate summary statistics
   */
  generateSummaryStats(analysisResults) {
    const stats = {
      by_algorithm: {},
      by_blockchain: {},
      overall: {
        total_blockchains: 0,
        total_validators: 0,
        average_gini: {},
        average_nakamoto: {},
        average_hhi: {},
      },
    };

    // Initialize algorithm stats
    for (const algorithm of Object.keys(this.algorithms)) {
      const algKey = algorithm.toLowerCase();
      stats.by_algorithm[algKey] = {
        gini_values: [],
        nakamoto_values: [],
        hhi_values: [],
      };
      stats.overall.average_gini[algKey] = 0;
      stats.overall.average_nakamoto[algKey] = 0;
      stats.overall.average_hhi[algKey] = 0;
    }

    // Collect data
    for (const [chainName, chainResult] of Object.entries(analysisResults)) {
      if (chainResult.analysis_results && !chainResult.error) {
        stats.overall.total_blockchains++;
        stats.overall.total_validators +=
          chainResult.original_data?.total_validators || 0;

        stats.by_blockchain[chainName] = chainResult.analysis_results;

        for (const [algName, algResult] of Object.entries(
          chainResult.analysis_results
        )) {
          if (!algResult.error) {
            stats.by_algorithm[algName].gini_values.push(
              algResult.gini_coefficient
            );
            stats.by_algorithm[algName].nakamoto_values.push(
              algResult.nakamoto_coefficient
            );
            stats.by_algorithm[algName].hhi_values.push(
              algResult.hhi_coefficient
            );
          }
        }
      }
    }

    // Calculate averages
    for (const [algName, algStats] of Object.entries(stats.by_algorithm)) {
      const giniAvg =
        algStats.gini_values.length > 0
          ? algStats.gini_values.reduce((sum, v) => sum + v, 0) /
            algStats.gini_values.length
          : 0;
      const nakamotoAvg =
        algStats.nakamoto_values.length > 0
          ? algStats.nakamoto_values.reduce((sum, v) => sum + v, 0) /
            algStats.nakamoto_values.length
          : 0;
      const hhiAvg =
        algStats.hhi_values.length > 0
          ? algStats.hhi_values.reduce((sum, v) => sum + v, 0) /
            algStats.hhi_values.length
          : 0;

      stats.overall.average_gini[algName] = Math.round(giniAvg * 1000) / 1000;
      stats.overall.average_nakamoto[algName] =
        Math.round(nakamotoAvg * 100) / 100;
      stats.overall.average_hhi[algName] = Math.round(hhiAvg * 1000) / 1000;
    }

    return stats;
  }
}

module.exports = RealDataAnalysisService;
