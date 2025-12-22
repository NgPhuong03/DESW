/**
 * PoS Simulator Service - Enhanced version based on demo_v1
 *
 * This service implements the core Proof-of-Stake simulation logic
 * with real-time updates, peer injection, and scheduled joins.
 */

const EventEmitter = require("events");

// Consensus algorithms enum
const PoSAlgorithms = {
  WEIGHTED: "WEIGHTED",
  OPPOSITE_WEIGHTED: "OPPOSITE_WEIGHTED",
  GINI_STABILIZED: "GINI_STABILIZED",
  LSW: "LSW",
  DESW: "DESW",
  SRSW: "SRSW",
  RANDOM: "RANDOM",
};

// Distribution types enum
const DistributionTypes = {
  UNIFORM: "UNIFORM",
  GINI: "GINI",
  RANDOM: "RANDOM",
};

// New entry types enum
const NewEntryTypes = {
  NEW_MAX: "NEW_MAX",
  NEW_MIN: "NEW_MIN",
  NEW_RANDOM: "NEW_RANDOM",
  NEW_AVERAGE: "NEW_AVERAGE",
};

// S-type for Gini Stabilized enum
const STypes = {
  CONSTANT: "CONSTANT",
  LINEAR: "LINEAR",
  QUADRATIC: "QUADRATIC",
  SQRT: "SQRT",
};

class SimulationEngine extends EventEmitter {
  constructor() {
    super();
    this.runningSimulations = new Map();
    this.pmin = 0.1;
    this.pmax = 0.6;
    this.entityIdSeed = 0;
  }

  /**
   * Add a new peer with high stake during simulation
   */
  addNewPeerDuringSimulation(simulationId, stake) {
    const simulation = this.runningSimulations.get(simulationId);
    if (!simulation) {
      throw new Error("Simulation not found");
    }

    if (!Array.isArray(simulation.stakes)) {
      throw new Error("Simulation stakes are not available");
    }

    const newPeerId = simulation.stakes.length;
    simulation.stakes.push(stake);

    return newPeerId;
  }

  /**
   * Schedule a peer to join at a specific epoch
   */
  schedulePeerJoin(simulationId, epoch, stake) {
    const simulation = this.runningSimulations.get(simulationId);
    if (!simulation) {
      throw new Error("Simulation not found");
    }
    if (!Array.isArray(simulation.scheduledJoins)) {
      simulation.scheduledJoins = [];
    }
    simulation.scheduledJoins.push({ epoch, stake });
    this.runningSimulations.set(simulationId, simulation);
  }

  /**
   * Calculate Gini coefficient for a dataset
   */
  gini(data) {
    if (!data || data.length === 0) return 0.0;

    const n = data.length;
    const total = data.reduce((sum, val) => sum + val, 0);

    if (total === 0) return 0.0;

    // Sort data in ascending order
    const sortedData = [...data].sort((a, b) => a - b);

    // Calculate cumulative percentage
    let cumulativeSum = 0;
    let lorenzSum = 0;

    for (let i = 0; i < n; i++) {
      cumulativeSum += sortedData[i];
      const cumulativePercentage = cumulativeSum / total;
      const lorenzValue = cumulativePercentage - 0.5 * (sortedData[i] / total);
      lorenzSum += lorenzValue;
    }

    // Calculate Gini coefficient
    const giniCoeff = 1 - (2 * lorenzSum) / n;
    return Math.max(0, Math.min(1, giniCoeff));
  }

  /**
   * Calculate Nakamoto coefficient
   */
  nakamotoCoefficient(data, threshold = 0.51) {
    if (!data || data.length === 0) return 0;

    const total = data.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;

    // Sort in descending order
    const sortedData = [...data].sort((a, b) => b - a);
    const targetAmount = total * threshold;

    let cumulativeSum = 0;
    for (let i = 0; i < sortedData.length; i++) {
      cumulativeSum += sortedData[i];
      if (cumulativeSum >= targetAmount) {
        return i + 1;
      }
    }

    return sortedData.length;
  }

  /**
   * Calculate HHI (Herfindahl-Hirschman Index)
   */
  hhi(data) {
    if (!data || data.length === 0) return 0;

    const total = data.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;

    return data.reduce((sum, stake) => {
      const marketShare = stake / total;
      return sum + marketShare * marketShare;
    }, 0);
  }

  /**
   * Calculate Theil index
   */
  theil(data) {
    if (!data || data.length === 0) return 0;

    const n = data.length;
    const mean = data.reduce((sum, val) => sum + val, 0) / n;

    if (mean === 0) return 0;

    return data.reduce((sum, val) => {
      if (val === 0) return sum;
      return sum + (val / (n * mean)) * Math.log(val / mean);
    }, 0);
  }

  /**
   * Calculate Shannon entropy
   */
  shannon(data) {
    if (!data || data.length === 0) return 0;

    const total = data.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;

    return -data.reduce((sum, stake) => {
      if (stake === 0) return sum;
      const p = stake / total;
      return sum + p * Math.log2(p);
    }, 0);
  }

  /**
   * Nakamoto liveness (33% threshold) - returns { nc, pct }
   */
  nakamotoLiveness(data) {
    if (!data || data.length === 0) {
      return { nc: 0, pct: 0 };
    }

    const nc = this.nakamotoCoefficient(data, 0.33);
    const totalValidators = data.length;
    const pct = totalValidators > 0 ? (nc / totalValidators) * 100 : 0;

    return {
      nc,
      pct: Math.round(pct * 100) / 100, // 2 decimal places
    };
  }

  /**
   * Nakamoto safety (66% threshold) - returns { nc, pct }
   */
  nakamotoSafety(data) {
    if (!data || data.length === 0) {
      return { nc: 0, pct: 0 };
    }

    const nc = this.nakamotoCoefficient(data, 0.66);
    const totalValidators = data.length;
    const pct = totalValidators > 0 ? (nc / totalValidators) * 100 : 0;

    return {
      nc,
      pct: Math.round(pct * 100) / 100,
    };
  }

  /**
   * Zipf coefficient (negative slope of log-log rank vs stake)
   */
  zipfCoefficient(data) {
    if (!data || data.length === 0) return 0;

    // Filter out non-positive stakes and sort descending
    const weights = data.filter((v) => v > 0).sort((a, b) => b - a);

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
   * Palma ratio: richest 10% / poorest 40%
   */
  palmaRatio(data) {
    if (!data || data.length === 0) return 0;

    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;

    const poorestCount = Math.max(1, Math.floor(n * 0.4));
    const richestCount = Math.max(1, Math.floor(n * 0.1));

    const poorest = sorted.slice(0, poorestCount);
    const richest = sorted.slice(n - richestCount);

    const poorestSum = poorest.reduce((sum, v) => sum + v, 0);
    const richestSum = richest.reduce((sum, v) => sum + v, 0);

    if (poorestSum === 0) return 0;

    return Number((richestSum / poorestSum).toFixed(6));
  }

  /**
   * Generate initial peer stakes based on distribution type
   */
  generatePeers(nPeers, initialVolume, distributionType, initialGini = 0.3) {
    switch (distributionType) {
      case DistributionTypes.UNIFORM:
        return this.generateUniformDistribution(nPeers, initialVolume);
      case DistributionTypes.GINI:
        return this.generateGiniDistribution(
          nPeers,
          initialVolume,
          initialGini
        );
      case DistributionTypes.RANDOM:
        return this.generateRandomDistribution(nPeers, initialVolume);
      default:
        throw new Error(`Unknown distribution type: ${distributionType}`);
    }
  }

  /**
   * Generate uniform distribution
   */
  generateUniformDistribution(n, volume) {
    const stakePerPeer = volume / n;
    return Array(n).fill(stakePerPeer);
  }

  /**
   * Generate Gini distribution
   */
  generateGiniDistribution(nPeers, initialVolume, giniCoeff) {
    const maxR = (nPeers - 1) / 2;
    const r = giniCoeff * maxR;
    const prop = ((nPeers - 1) / nPeers) * ((maxR - r) / maxR);

    // Create Lorenz curve function
    const createLorenzCurve = (x1, y1, x2, y2) => {
      const m = x2 !== x1 ? (y2 - y1) / (x2 - x1) : 0;
      return (x) => m * x;
    };

    const lorenzCurve = createLorenzCurve(0, 0, (nPeers - 1) / nPeers, prop);

    // Generate cumulative distribution
    const q = [];
    for (let i = 1; i < nPeers; i++) {
      q.push(lorenzCurve(i / nPeers));
    }
    q.push(1.0);

    // Convert to actual stakes
    const cumulativeSum = q.map((val) => val * initialVolume);
    const stakes = [cumulativeSum[0]];

    for (let i = 1; i < nPeers; i++) {
      stakes.push(cumulativeSum[i] - cumulativeSum[i - 1]);
    }

    return stakes;
  }

  /**
   * Generate random distribution
   */
  generateRandomDistribution(n, volume) {
    if (n <= 0) return [];
    if (n === 1) return [volume];

    // Generate n-1 random cut points
    const cutPoints = [];
    for (let i = 0; i < n - 1; i++) {
      cutPoints.push(Math.random() * volume);
    }
    cutPoints.sort((a, b) => a - b);

    // Calculate stakes
    const stakes = [];
    stakes.push(cutPoints[0]);

    for (let i = 1; i < n - 1; i++) {
      stakes.push(cutPoints[i] - cutPoints[i - 1]);
    }
    stakes.push(volume - cutPoints[cutPoints.length - 1]);

    // Ensure no negative stakes
    const positiveStakes = stakes.map((stake) => Math.max(0, stake));

    // Normalize to exact volume
    const total = positiveStakes.reduce((sum, stake) => sum + stake, 0);
    if (total > 0) {
      return positiveStakes.map((stake) => (stake * volume) / total);
    } else {
      return this.generateUniformDistribution(n, volume);
    }
  }

  /**
   * Weighted consensus - select validator based on stake proportion
   */
  weightedConsensus(stakes) {
    if (!stakes || stakes.length === 0) {
      throw new Error("Stakes array cannot be empty");
    }

    const total = stakes.reduce((sum, stake) => sum + stake, 0);
    if (total === 0) {
      return Math.floor(Math.random() * stakes.length);
    }

    const random = Math.random() * total;
    let cumulativeSum = 0;

    for (let i = 0; i < stakes.length; i++) {
      cumulativeSum += stakes[i];
      if (cumulativeSum >= random) {
        return i;
      }
    }

    return stakes.length - 1;
  }

  /**
   * Opposite weighted consensus - favor validators with lower stakes
   */
  oppositeWeightedConsensus(stakes) {
    if (!stakes || stakes.length === 0) {
      throw new Error("Stakes array cannot be empty");
    }

    const maxStake = Math.max(...stakes);
    const oppositeStakes = stakes.map((stake) => Math.abs(maxStake - stake));

    return this.weightedConsensus(oppositeStakes);
  }

  /**
   * Log weighted consensus - use logarithm to reduce large stake influence
   */
  logWeightedConsensus(stakes) {
    if (!stakes || stakes.length === 0) {
      throw new Error("Stakes array cannot be empty");
    }

    const epsilon = 1e-8;
    // Match Python: np.log(max(stake, epsilon))
    const logStakes = stakes.map((stake) => Math.log(Math.max(stake, epsilon)));

    return this.weightedConsensus(logStakes);
  }

  /**
   * Gini stabilized consensus - interpolate between weighted and opposite weighted
   */
  giniStabilizedConsensus(stakes, t) {
    if (t === -1) {
      throw new Error("Cannot launch GiniStabilized with t = -1");
    }

    if (!stakes || stakes.length === 0) {
      throw new Error("Stakes array cannot be empty");
    }

    const total = stakes.reduce((sum, stake) => sum + stake, 0);
    if (total === 0) {
      return Math.floor(Math.random() * stakes.length);
    }

    // Calculate weighted probabilities
    const weightedProbs = stakes.map((stake) => stake / total);

    // Calculate opposite weighted probabilities
    const maxStake = Math.max(...stakes);
    const oppositeStakes = stakes.map((stake) => Math.abs(maxStake - stake));
    const totalOpposite = oppositeStakes.reduce((sum, stake) => sum + stake, 0);

    let oppositeProbs;
    if (totalOpposite === 0) {
      oppositeProbs = Array(stakes.length).fill(1 / stakes.length);
    } else {
      oppositeProbs = oppositeStakes.map((stake) => stake / totalOpposite);
    }

    // Linear interpolation
    const mixedProbs = weightedProbs.map(
      (wProb, i) => (1 - t) * oppositeProbs[i] + t * wProb
    );

    // Select based on mixed probabilities
    const random = Math.random();
    let cumulativeSum = 0;

    for (let i = 0; i < mixedProbs.length; i++) {
      cumulativeSum += mixedProbs[i];
      if (cumulativeSum >= random) {
        return i;
      }
    }

    return stakes.length - 1;
  }

  /**
   * DESW consensus algorithm
   */
  deswConsensus(stakes) {
    if (!stakes || stakes.length === 0) {
      throw new Error("Stakes array cannot be empty");
    }

    const total = stakes.reduce((sum, stake) => sum + stake, 0);
    if (total === 0) {
      return Math.floor(Math.random() * stakes.length);
    }

    const giniStake = this.gini(stakes);
    const pDynamic = Math.max(this.pmin, Math.min(this.pmax, 1 - giniStake));
    const powerWeights = stakes.map((stake) => Math.pow(stake, pDynamic));

    const totalWeight = powerWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) {
      return Math.floor(Math.random() * stakes.length);
    }

    return this.weightedConsensus(powerWeights);
  }

  /**
   * SRSW Weighted consensus algorithm
   */
  srswWeightedConsensus(stakes) {
    if (!stakes || stakes.length === 0) {
      throw new Error("Stakes array cannot be empty");
    }

    // SRSW uses a different weighting scheme
    const weights = stakes.map((stake) => Math.sqrt(stake));
    return this.weightedConsensus(weights);
  }

  /**
   * Random consensus - purely random selection
   */
  randomConsensus(stakes) {
    if (!stakes || stakes.length === 0) {
      throw new Error("Stakes array cannot be empty");
    }

    return Math.floor(Math.random() * stakes.length);
  }

  /**
   * Select validator based on consensus algorithm
   */
  selectValidator(algorithm, stakes, t = null) {
    switch (algorithm) {
      case PoSAlgorithms.WEIGHTED:
        return this.weightedConsensus(stakes);
      case PoSAlgorithms.OPPOSITE_WEIGHTED:
        return this.oppositeWeightedConsensus(stakes);
      case PoSAlgorithms.LSW:
        return this.logWeightedConsensus(stakes);
      case PoSAlgorithms.GINI_STABILIZED:
        if (t === null) {
          throw new Error(
            "Parameter 't' is required for GINI_STABILIZED consensus"
          );
        }
        return this.giniStabilizedConsensus(stakes, t);
      case PoSAlgorithms.DESW:
        return this.deswConsensus(stakes);
      case PoSAlgorithms.SRSW:
        return this.srswWeightedConsensus(stakes);
      case PoSAlgorithms.RANDOM:
        return this.randomConsensus(stakes);
      default:
        throw new Error(`Unknown consensus algorithm: ${algorithm}`);
    }
  }

  /**
   * Calculate d function for Gini Stabilized consensus
   */
  calculateD(currentGini, targetGini) {
    return currentGini > targetGini ? 0.5 : 1.5;
  }

  /**
   * Linear interpolation
   */
  lerp(a, b, t) {
    return (1 - t) * a + t * b;
  }

  /**
   * Try to add new peers to the network
   * Note: Does NOT handle entity_ids (matches Python behavior)
   * Entity IDs are synced in the main simulation loop after join/leave
   */
  tryToJoin(stakes, corrupted, pJoin, joinAmount, percentageCorrupted) {
    if (Math.random() <= pJoin && stakes.length > 0) {
      let newStake;

      switch (joinAmount) {
        case NewEntryTypes.NEW_AVERAGE:
          newStake =
            stakes.reduce((sum, stake) => sum + stake, 0) / stakes.length;
          break;
        case NewEntryTypes.NEW_MAX:
          newStake = Math.max(...stakes);
          break;
        case NewEntryTypes.NEW_MIN:
          newStake = Math.min(...stakes);
          break;
        case NewEntryTypes.NEW_RANDOM:
          newStake = stakes[Math.floor(Math.random() * stakes.length)];
          break;
        default:
          newStake = 0;
      }

      stakes.push(newStake);

      // Check if new peer is corrupted
      if (Math.random() <= percentageCorrupted) {
        corrupted.push(stakes.length - 1);
      }

      // Recursive call to potentially add more peers
      this.tryToJoin(stakes, corrupted, pJoin, joinAmount, percentageCorrupted);
    }
  }

  /**
   * Try to remove peers from the network
   * Note: Does NOT update corrupted list (matches Python behavior)
   * Corrupted list cleanup happens only after Sybil attacks in main simulation loop
   */
  tryToLeave(stakes, entityIds, pLeave) {
    if (stakes.length > 0 && Math.random() <= pLeave) {
      const indexToRemove = Math.floor(Math.random() * stakes.length);
      stakes.splice(indexToRemove, 1);
      entityIds.splice(indexToRemove, 1);
    }
  }

  /**
   * Try Sybil attack: split one validator into many
   */
  trySybilAttack(
    stakes,
    corrupted,
    entityIds,
    pSybil,
    minSybilSize,
    maxSybilSize
  ) {
    if (!stakes || stakes.length === 0) return;
    if (Math.random() > (pSybil || 0)) return;

    const avgStake =
      stakes.reduce((sum, v) => sum + v, 0) / (stakes.length || 1);
    const minStakeToSplit = avgStake * 2;
    const candidates = stakes
      .map((stake, idx) => ({ stake, idx }))
      .filter((c) => c.stake >= minStakeToSplit);
    if (candidates.length === 0) return;

    const victim = candidates[Math.floor(Math.random() * candidates.length)];
    const victimIdx = victim.idx;
    const victimStake = stakes[victimIdx];
    const victimEntity = entityIds[victimIdx];
    const victimCorrupted = corrupted.includes(victimIdx);

    const numSplits = Math.max(
      minSybilSize || 2,
      Math.min(
        maxSybilSize || minSybilSize || 2,
        Math.floor(
          Math.random() * ((maxSybilSize || 5) - (minSybilSize || 2) + 1)
        ) + (minSybilSize || 2)
      )
    );
    const splitStake = victimStake / numSplits;

    // Remove victim
    stakes.splice(victimIdx, 1);
    entityIds.splice(victimIdx, 1);
    corrupted = corrupted
      .filter((c) => c !== victimIdx)
      .map((c) => (c > victimIdx ? c - 1 : c));

    // Insert splits
    for (let i = 0; i < numSplits; i++) {
      stakes.splice(victimIdx + i, 0, splitStake);
      // Keep same entity id for all splits (match Python try_sybil_attack)
      entityIds.splice(victimIdx + i, 0, victimEntity);
      if (victimCorrupted) {
        corrupted.push(victimIdx + i);
      }
    }

    // Ensure corrupted sorted & unique
    corrupted.sort((a, b) => a - b);
    return corrupted;
  }

  /**
   * Run a single simulation with real-time progress tracking
   */
  async simulate(stakes, corrupted, parameters, onProgress = null) {
    const simulationId = `sim_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      // seed entity ids so that new joins get unique ids
      this.entityIdSeed = Math.max(this.entityIdSeed, stakes.length);
      let entityIds = stakes.map((_, idx) => idx);
      // Mark simulation as running
      this.runningSimulations.set(simulationId, {
        status: "running",
        shouldStop: false,
        stakes: [...stakes],
        corrupted: [...corrupted],
        entityIds: [...entityIds],
        scheduledJoins: Array.isArray(parameters.scheduled_joins)
          ? parameters.scheduled_joins
              .map((join) => {
                if (Array.isArray(join) && join.length >= 2) {
                  return { epoch: Number(join[0]), stake: Number(join[1]) };
                }
                if (join && typeof join === "object") {
                  const stakeVal =
                    join.stake !== undefined
                      ? join.stake
                      : join.stake_amount !== undefined
                      ? join.stake_amount
                      : undefined;
                  return {
                    epoch: Number(join.epoch),
                    stake: Number(stakeVal),
                  };
                }
                return null;
              })
              .filter(
                (join) =>
                  join !== null && !isNaN(join.epoch) && !isNaN(join.stake)
              )
          : [],
        scheduledSybilAttacks: Array.isArray(parameters.scheduled_sybil_attacks)
          ? parameters.scheduled_sybil_attacks
              .map((item) => {
                if (Array.isArray(item) && item.length >= 3) {
                  return {
                    epoch: Number(item[0]),
                    entity_id: item[1],
                    num_splits: Number(item[2]),
                  };
                }
                if (item && typeof item === "object") {
                  return {
                    epoch: Number(item.epoch),
                    entity_id: item.entity_id,
                    num_splits: Number(item.num_splits),
                  };
                }
                return null;
              })
              .filter(
                (item) =>
                  item !== null &&
                  !isNaN(item.epoch) &&
                  item.entity_id !== undefined &&
                  !isNaN(item.num_splits)
              )
          : [],
      });

      const percentageCorrupted = corrupted.length / stakes.length;

      // Initialize history arrays
      const giniHistory = [];
      const nakamotoHistory = [];
      const networkSizeHistory = [];
      const epochHistory = [];
      const hhiHistory = [];
      const theilHistory = [];
      const shannonHistory = [];
      const nakamotoLivenessHistory = [];
      const nakamotoLivenessPctHistory = [];
      const nakamotoSafetyHistory = [];
      const nakamotoSafetyPctHistory = [];
      const zipfHistory = [];
      const palmaHistory = [];

      // Initialize t for Gini Stabilized
      let t = this.calculateD(this.gini(stakes), parameters.theta || 0.3);

      // Run simulation epochs
      for (let epoch = 0; epoch < parameters.n_epochs; epoch++) {
        // Check if simulation should stop
        const simStatus = this.runningSimulations.get(simulationId);
        if (!simStatus || simStatus.shouldStop) {
          break;
        }

        // Apply any scheduled joins for this exact epoch
        // Python order: scheduled_joins → random joins/leaves → sync → scheduled_sybil → random_sybil
        const pending = simStatus?.scheduledJoins || [];
        if (pending.length > 0) {
          const toApply = [];
          const toKeep = [];
          for (const item of pending) {
            if (
              item &&
              typeof item.epoch === "number" &&
              typeof item.stake === "number" &&
              item.epoch === epoch
            ) {
              toApply.push(item);
            } else {
              toKeep.push(item);
            }
          }
          if (toApply.length > 0) {
            for (const j of toApply) {
              stakes.push(j.stake);
              // Use max(entity_ids) + 1 to match Python behavior
              // IMPORTANT: Recalculate max each time (not once) to handle multiple joins at same epoch
              const maxId = entityIds.length > 0 ? Math.max(...entityIds) : -1;
              entityIds.push(maxId + 1);
            }
            // Update simulation state
            const updatedState = this.runningSimulations.get(simulationId);
            if (updatedState) {
              updatedState.stakes = stakes;
              updatedState.scheduledJoins = toKeep;
              updatedState.entityIds = entityIds;
              this.runningSimulations.set(simulationId, updatedState);
            }
          }
        }

        // Try to add/remove peers (random joins/leaves)
        const initialNetworkSize = stakes.length;
        this.tryToJoin(
          stakes,
          corrupted,
          parameters.p_join || 0,
          parameters.join_amount || NewEntryTypes.NEW_AVERAGE,
          percentageCorrupted
        );
        const afterJoinSize = stakes.length;
        this.tryToLeave(stakes, entityIds, parameters.p_leave || 0);
        const finalNetworkSize = stakes.length;

        // Sync entity_ids with stakes (add new or remove excess)
        // This matches Python behavior after try_to_join/try_to_leave
        while (entityIds.length < stakes.length) {
          const maxId = entityIds.length > 0 ? Math.max(...entityIds) : -1;
          entityIds.push(maxId + 1);
        }
        while (entityIds.length > stakes.length) {
          entityIds.pop();
        }

        // Apply any scheduled sybil attacks at this epoch (AFTER random joins/leaves and sync)
        // Python order: scheduled_joins → random joins/leaves → sync → scheduled_sybil → random_sybil
        const sybilPending = simStatus?.scheduledSybilAttacks || [];
        if (sybilPending.length > 0) {
          const toApply = [];
          const toKeep = [];
          for (const item of sybilPending) {
            if (
              item &&
              typeof item.epoch === "number" &&
              item.epoch === epoch &&
              item.entity_id !== undefined &&
              typeof item.num_splits === "number"
            ) {
              toApply.push(item);
            } else {
              toKeep.push(item);
            }
          }
          if (toApply.length > 0) {
            for (const attack of toApply) {
              // find victim by entity id
              const victimIdx = entityIds.findIndex(
                (id) =>
                  id === attack.entity_id ||
                  String(id) === String(attack.entity_id)
              );
              if (victimIdx !== -1) {
                const victimStake = stakes[victimIdx];
                const victimEntity = entityIds[victimIdx];
                const victimCorrupted = corrupted.includes(victimIdx);
                const splits = Math.max(attack.num_splits, 2);
                const splitStake = victimStake / splits;

                stakes.splice(victimIdx, 1);
                entityIds.splice(victimIdx, 1);
                corrupted = corrupted
                  .filter((c) => c !== victimIdx)
                  .map((c) => (c > victimIdx ? c - 1 : c));

                for (let i = 0; i < splits; i++) {
                  stakes.splice(victimIdx + i, 0, splitStake);
                  // Keep same entity id for all splits (match Python perform_scheduled_sybil)
                  entityIds.splice(victimIdx + i, 0, victimEntity);
                  if (victimCorrupted) {
                    corrupted.push(victimIdx + i);
                  }
                }
                corrupted.sort((a, b) => a - b);
              }
            }
            const updatedState = this.runningSimulations.get(simulationId);
            if (updatedState) {
              updatedState.stakes = stakes;
              updatedState.entityIds = entityIds;
              updatedState.corrupted = corrupted;
              updatedState.scheduledSybilAttacks = toKeep;
              this.runningSimulations.set(simulationId, updatedState);
            }
          }
        }

        // Attempt random Sybil attack
        const sybilResult = this.trySybilAttack(
          stakes,
          corrupted,
          entityIds,
          parameters.p_sybil || 0,
          parameters.min_sybil_size || 2,
          parameters.max_sybil_size || 5
        );
        if (Array.isArray(sybilResult)) {
          corrupted = sybilResult;
        }

        // Cleanup corrupted list (filter out invalid indices after leave/sybil)
        // This matches Python behavior: corrupted = [c for c in corrupted if c < len(stakes)]
        corrupted = corrupted.filter((c) => c < stakes.length);

        const peersJoined = afterJoinSize - initialNetworkSize;
        const peersLeft = afterJoinSize - finalNetworkSize;

        // Calculate current metrics
        const currentGini = this.gini(stakes);
        const currentNakamoto = this.nakamotoCoefficient(stakes);
        const currentHHI = this.hhi(stakes);
        const currentTheil = this.theil(stakes);
        const currentShannon = this.shannon(stakes);
        const networkSize = stakes.length;
        const { nc: livenessNc, pct: livenessPct } =
          this.namotoLiveness?.(stakes) ?? this.nakamotoLiveness(stakes);
        const { nc: safetyNc, pct: safetyPct } =
          this.namotoSafety?.(stakes) ?? this.nakamotoSafety(stakes);
        const currentZipf = this.zipfCoefficient(stakes);
        const currentPalma = this.palmaRatio(stakes);

        // Record metrics
        giniHistory.push(currentGini);
        nakamotoHistory.push(currentNakamoto);
        networkSizeHistory.push(networkSize);
        hhiHistory.push(currentHHI);
        theilHistory.push(currentTheil);
        shannonHistory.push(currentShannon);
        nakamotoLivenessHistory.push(livenessNc);
        nakamotoLivenessPctHistory.push(livenessPct);
        nakamotoSafetyHistory.push(safetyNc);
        nakamotoSafetyPctHistory.push(safetyPct);
        zipfHistory.push(currentZipf);
        palmaHistory.push(currentPalma);

        // Select validator
        let selectedValidator;
        if (parameters.proof_of_stake === PoSAlgorithms.GINI_STABILIZED) {
          // Calculate s based on s_type
          let s;
          const giniDiff = Math.abs(currentGini - (parameters.theta || 0.3));

          switch (parameters.s_type) {
            case STypes.CONSTANT:
              s = parameters.k || 0.1;
              break;
            case STypes.LINEAR:
              s = giniDiff * (parameters.k || 0.1);
              break;
            case STypes.QUADRATIC:
              s = Math.pow(giniDiff, 2) * (parameters.k || 0.1);
              break;
            case STypes.SQRT:
              s = Math.sqrt(giniDiff) * (parameters.k || 0.1);
              break;
            default:
              s = giniDiff * (parameters.k || 0.1);
          }

          selectedValidator = this.selectValidator(
            parameters.proof_of_stake,
            stakes,
            t
          );
          t = this.lerp(
            t,
            this.calculateD(currentGini, parameters.theta || 0.3),
            s
          );
        } else {
          selectedValidator = this.selectValidator(
            parameters.proof_of_stake,
            stakes
          );
        }

        // Apply reward/penalty
        const isCorrupted = corrupted.includes(selectedValidator);
        const validatorFailed =
          isCorrupted && Math.random() < (parameters.p_fail || 0);

        let rewardApplied = 0;
        let penaltyApplied = 0;

        if (validatorFailed) {
          // Apply penalty
          const penalty =
            stakes[selectedValidator] * (parameters.penalty_percentage || 0.1);
          stakes[selectedValidator] -= penalty;
          penaltyApplied = penalty;
        } else {
          // Apply reward (dynamic or constant)
          const baseReward = parameters.reward || 1;
          const totalStake = stakes.reduce((sum, v) => sum + v, 0);
          const useDynamic = Boolean(parameters.use_dynamic_reward);
          const dynamicReward = useDynamic
            ? baseReward *
              (1 +
                (totalStake > 0 ? stakes[selectedValidator] / totalStake : 0))
            : baseReward;
          stakes[selectedValidator] += dynamicReward;
          rewardApplied = dynamicReward;
        }

        // Record epoch data
        const epochData = {
          epoch,
          gini_coefficient: currentGini,
          nakamoto_coefficient: currentNakamoto,
          hhi: currentHHI,
          theil: currentTheil,
          shannon: currentShannon,
          network_size: networkSize,
          selected_validator: selectedValidator,
          validator_was_corrupted: isCorrupted,
          validator_failed: validatorFailed,
          reward_applied: rewardApplied,
          penalty_applied: penaltyApplied,
          peers_joined: peersJoined,
          peers_left: peersLeft,
          timestamp: new Date(),
        };

        epochHistory.push(epochData);

        // Call progress callback
        if (onProgress) {
          const shouldSendFullData =
            epoch % 100 === 0 || epoch === parameters.n_epochs - 1;

          await onProgress({
            epoch,
            progress: ((epoch + 1) / parameters.n_epochs) * 100,
            current_gini: currentGini,
            current_nakamoto: currentNakamoto,
            current_hhi: currentHHI,
            current_theil: currentTheil,
            current_shannon: currentShannon,
            network_size: networkSize,
            gini_history: shouldSendFullData ? giniHistory : [currentGini],
            nakamoto_history: shouldSendFullData
              ? nakamotoHistory
              : [currentNakamoto],
            network_size_history: shouldSendFullData
              ? networkSizeHistory
              : [networkSize],
            hhi_history: shouldSendFullData ? hhiHistory : [currentHHI],
            theil_history: shouldSendFullData ? theilHistory : [currentTheil],
            shannon_history: shouldSendFullData
              ? shannonHistory
              : [currentShannon],
            current_peers: shouldSendFullData
              ? stakes.map((stake, i) => ({
                  peer_id: i,
                  stake,
                  is_corrupted: corrupted.includes(i),
                  selection_probability:
                    stake / stakes.reduce((sum, s) => sum + s, 0),
                }))
              : [],
            is_full_update: shouldSendFullData,
          });
        }

        // Yield control occasionally to prevent blocking
        if (epoch % 10 === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      // Mark simulation as completed
      this.runningSimulations.delete(simulationId);

      // Calculate final results
      const finalResults = {
        final_gini: giniHistory[giniHistory.length - 1] || 0,
        final_nakamoto: nakamotoHistory[nakamotoHistory.length - 1] || 0,
        final_hhi: hhiHistory[hhiHistory.length - 1] || 0,
        final_theil: theilHistory[theilHistory.length - 1] || 0,
        final_shannon: shannonHistory[shannonHistory.length - 1] || 0,
        final_network_size:
          networkSizeHistory[networkSizeHistory.length - 1] || 0,
        final_nakamoto_liveness:
          nakamotoLivenessHistory[nakamotoLivenessHistory.length - 1] || 0,
        final_nakamoto_liveness_pct:
          nakamotoLivenessPctHistory[nakamotoLivenessPctHistory.length - 1] ||
          0,
        final_nakamoto_safety:
          nakamotoSafetyHistory[nakamotoSafetyHistory.length - 1] || 0,
        final_nakamoto_safety_pct:
          nakamotoSafetyPctHistory[nakamotoSafetyPctHistory.length - 1] || 0,
        final_zipf: zipfHistory[zipfHistory.length - 1] || 0,
        final_palma: palmaHistory[palmaHistory.length - 1] || 0,
        average_gini:
          giniHistory.reduce((sum, val) => sum + val, 0) / giniHistory.length,
        average_nakamoto:
          nakamotoHistory.reduce((sum, val) => sum + val, 0) /
          nakamotoHistory.length,
        average_hhi:
          hhiHistory.reduce((sum, val) => sum + val, 0) / hhiHistory.length,
        average_theil:
          theilHistory.reduce((sum, val) => sum + val, 0) / theilHistory.length,
        average_shannon:
          shannonHistory.reduce((sum, val) => sum + val, 0) /
          shannonHistory.length,
        gini_variance: this.calculateVariance(giniHistory),
        nakamoto_variance: this.calculateVariance(nakamotoHistory),
        total_epochs_completed: giniHistory.length,
      };

      return {
        success: true,
        gini_history: giniHistory,
        nakamoto_history: nakamotoHistory,
        network_size_history: networkSizeHistory,
        hhi_history: hhiHistory,
        theil_history: theilHistory,
        shannon_history: shannonHistory,
        nakamoto_liveness_history: nakamotoLivenessHistory,
        nakamoto_liveness_pct_history: nakamotoLivenessPctHistory,
        nakamoto_safety_history: nakamotoSafetyHistory,
        nakamoto_safety_pct_history: nakamotoSafetyPctHistory,
        zipf_history: zipfHistory,
        palma_history: palmaHistory,
        epoch_history: epochHistory,
        final_results: finalResults,
        final_peers: stakes.map((stake, i) => ({
          peer_id: i,
          stake,
          is_corrupted: corrupted.includes(i),
          selection_probability: stake / stakes.reduce((sum, s) => sum + s, 0),
        })),
      };
    } catch (error) {
      this.runningSimulations.delete(simulationId);
      throw error;
    }
  }

  /**
   * Stop a running simulation
   */
  stopSimulation(simulationId) {
    const simulation = this.runningSimulations.get(simulationId);
    if (simulation) {
      simulation.shouldStop = true;
      this.runningSimulations.set(simulationId, simulation);
      return true;
    }
    return false;
  }

  /**
   * Check if simulation is running
   */
  isSimulationRunning(simulationId) {
    const simulation = this.runningSimulations.get(simulationId);
    return (
      simulation && simulation.status === "running" && !simulation.shouldStop
    );
  }

  /**
   * Calculate variance of an array
   */
  calculateVariance(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const variance =
      arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return variance;
  }
}

module.exports = {
  SimulationEngine,
  PoSAlgorithms,
  DistributionTypes,
  NewEntryTypes,
  STypes,
};
