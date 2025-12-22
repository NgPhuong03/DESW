const Simulation = require("../models/Simulation");
const {
  SimulationEngine,
  PoSAlgorithms,
  DistributionTypes,
  NewEntryTypes,
  STypes,
} = require("../utils/simulation");

// Single shared simulation engine instance
const simulationEngine = new SimulationEngine();

/**
 * Validate simulation parameters (logic extracted from old routes layer)
 * @param {object} params
 * @returns {string[]} list of validation error messages
 */
function validateParameters(params = {}) {
  const errors = [];

  if (!params.n_epochs || params.n_epochs < 1 || params.n_epochs > 100000) {
    errors.push("n_epochs must be between 1 and 100000");
  }

  if (
    !params.proof_of_stake ||
    ![
      "WEIGHTED",
      "OPPOSITE_WEIGHTED",
      "GINI_STABILIZED",
      "LOG_WEIGHTED",
      "DESW",
      "SRSW_WEIGHTED",
      "RANDOM",
    ].includes(params.proof_of_stake)
  ) {
    errors.push("Invalid proof_of_stake algorithm");
  }

  if (params.initial_stake_volume < 0) {
    errors.push("initial_stake_volume must be non-negative");
  }

  if (!["UNIFORM", "GINI", "RANDOM"].includes(params.initial_distribution)) {
    errors.push("Invalid initial_distribution");
  }

  if (params.initial_gini < 0 || params.initial_gini > 1) {
    errors.push("initial_gini must be between 0 and 1");
  }

  if (!params.n_peers || params.n_peers < 1 || params.n_peers > 10000) {
    errors.push("n_peers must be between 1 and 10000");
  }

  if (params.n_corrupted < 0 || params.n_corrupted > params.n_peers) {
    errors.push("n_corrupted must be between 0 and n_peers");
  }

  if (params.p_fail < 0 || params.p_fail > 1) {
    errors.push("p_fail must be between 0 and 1");
  }

  if (params.p_join < 0 || params.p_join > 1) {
    errors.push("p_join must be between 0 and 1");
  }

  if (params.p_leave < 0 || params.p_leave > 1) {
    errors.push("p_leave must be between 0 and 1");
  }

  if (
    !["NEW_MAX", "NEW_MIN", "NEW_RANDOM", "NEW_AVERAGE"].includes(
      params.join_amount
    )
  ) {
    errors.push("Invalid join_amount");
  }

  if (params.penalty_percentage < 0 || params.penalty_percentage > 1) {
    errors.push("penalty_percentage must be between 0 and 1");
  }

  if (params.theta < 0 || params.theta > 1) {
    errors.push("theta must be between 0 and 1");
  }

  if (!["CONSTANT", "LINEAR", "QUADRATIC", "SQRT"].includes(params.s_type)) {
    errors.push("Invalid s_type");
  }

  if (params.k <= 0) {
    errors.push("k must be positive");
  }

  if (params.reward <= 0) {
    errors.push("reward must be positive");
  }

  if (
    params.use_dynamic_reward !== undefined &&
    typeof params.use_dynamic_reward !== "boolean"
  ) {
    errors.push("use_dynamic_reward must be a boolean");
  }

  if (params.p_sybil < 0 || params.p_sybil > 1) {
    errors.push("p_sybil must be between 0 and 1");
  }

  if (params.min_sybil_size < 2) {
    errors.push("min_sybil_size must be at least 2");
  }

  if (params.max_sybil_size < params.min_sybil_size) {
    errors.push("max_sybil_size must be >= min_sybil_size");
  }

  if (Array.isArray(params.scheduled_joins)) {
    const invalid = params.scheduled_joins.some((j) => {
      // Accept tuple [epoch, stake] or object {epoch, stake} (also allow stake_amount alias)
      if (Array.isArray(j) && j.length >= 2) {
        return isNaN(Number(j[0])) || isNaN(Number(j[1]));
      }
      if (j && typeof j === "object") {
        const stakeVal =
          j.stake !== undefined
            ? j.stake
            : j.stake_amount !== undefined
            ? j.stake_amount
            : undefined;
        return isNaN(Number(j.epoch)) || isNaN(Number(stakeVal));
      }
      return true;
    });
    if (invalid) {
      errors.push(
        "scheduled_joins entries must be [epoch, stake] or {epoch, stake}"
      );
    }
  }

  if (Array.isArray(params.scheduled_sybil_attacks)) {
    const invalid = params.scheduled_sybil_attacks.some((item) => {
      // Accept both tuple [epoch, entity_id, num_splits] and object format
      if (Array.isArray(item) && item.length >= 3) {
        return (
          isNaN(Number(item[0])) ||
          item[1] === undefined ||
          isNaN(Number(item[2]))
        );
      }
      if (item && typeof item === "object") {
        return (
          isNaN(Number(item.epoch)) ||
          item.entity_id === undefined ||
          isNaN(Number(item.num_splits))
        );
      }
      return true;
    });
    if (invalid) {
      errors.push(
        "scheduled_sybil_attacks must be [epoch, entity_id, num_splits] or object form"
      );
    }
  }

  return errors;
}

/**
 * Sample array data to reduce size for API responses
 * @param {Array} data - Array to sample
 * @param {number} maxPoints - Maximum points to keep (default 200)
 * @returns {Array} Sampled array
 */
function sampleArray(data, maxPoints = 200) {
  if (!Array.isArray(data) || data.length <= maxPoints) {
    return data;
  }

  const step = Math.ceil(data.length / maxPoints);
  const sampled = [];

  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
  }

  // Always include the last point
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1]);
  }

  return sampled;
}

/**
 * Internal helper to map raw engine results into DB / FE shape
 * Only keep the metrics that FE is actually using:
 * - Gini, HHI, Nakamoto Liveness, Nakamoto Safety, Zipf
 * Apply sampling to reduce data size for API responses
 */
function mapEngineResults(rawResults = {}, applySampling = false) {
  const maxPoints = 200; // Configurable sampling limit

  const histories = {
    gini_history: rawResults.gini_history || [],
    hhi_history: rawResults.hhi_history || [],
    // Liveness & Safety histories (nc values)
    nakamoto_liveness_history: rawResults.nakamoto_liveness_history || [],
    nakamoto_safety_history: rawResults.nakamoto_safety_history || [],
    zipf_history: rawResults.zipf_history || [],
    // Keep epoch_history for possible future inspection/debug
    epoch_history: rawResults.epoch_history || [],
  };

  // Apply sampling if requested (for API responses)
  if (applySampling) {
    Object.keys(histories).forEach((key) => {
      histories[key] = sampleArray(histories[key], maxPoints);
    });
  }

  return {
    ...histories,
    final_metrics: {
      gini: rawResults.final_results?.final_gini ?? 0,
      hhi: rawResults.final_results?.final_hhi ?? 0,
      nakamoto_liveness: rawResults.final_results?.final_nakamoto_liveness ?? 0,
      nakamoto_safety: rawResults.final_results?.final_nakamoto_safety ?? 0,
      zipf: rawResults.final_results?.final_zipf ?? 0,
      // Lưu số lượng peer ở epoch cuối (không cần history)
      n_peers:
        rawResults.final_results?.final_network_size ??
        (Array.isArray(rawResults.network_size_history) &&
        rawResults.network_size_history.length > 0
          ? rawResults.network_size_history[
              rawResults.network_size_history.length - 1
            ]
          : 0),
    },
  };
}

/**
 * Create Simulation document and start async engine run.
 * Returns the created Simulation (status=pending / running).
 */
async function createAndStartSimulation(sessionId, parameters) {
  const simulation = new Simulation({
    sessionId,
    parameters,
    status: "pending",
  });

  await simulation.save();

  // Start simulation asynchronously
  setImmediate(async () => {
    try {
      simulation.status = "running";
      await simulation.save();

      const startTime = Date.now();

      // Generate initial stakes
      const stakes = simulationEngine.generatePeers(
        parameters.n_peers,
        parameters.initial_stake_volume,
        parameters.initial_distribution,
        parameters.initial_gini
      );

      // Create corrupted peers
      const corrupted = [];
      for (let i = 0; i < parameters.n_corrupted; i++) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * parameters.n_peers);
        } while (corrupted.includes(randomIndex));
        corrupted.push(randomIndex);
      }

      // Progress callback for real-time updates
      const onProgress = async (progressData) => {
        try {
          simulation.progress = progressData.progress;
          simulation.current_epoch = progressData.epoch;

          if (progressData.is_full_update) {
            await simulation.save();
          }
        } catch (error) {
          console.error("Progress update error:", error);
        }
      };

      // Run simulation with progress callback
      const rawResults = await simulationEngine.simulate(
        stakes,
        corrupted,
        parameters,
        onProgress
      );

      const executionTime = Date.now() - startTime;

      // Map and persist results (full data for DB storage)
      simulation.results = mapEngineResults(rawResults, false);
      simulation.status = "completed";
      simulation.progress = 100;
      simulation.execution_time = executionTime;
      simulation.completed_at = new Date();

      await simulation.save();
    } catch (error) {
      console.error("Simulation error:", error);
      simulation.status = "failed";
      simulation.error_message = error.message;
      await simulation.save();
    }
  });

  return simulation;
}

async function getSimulationStatus(simulationId) {
  return Simulation.findById(simulationId);
}

async function getSimulationWithMappedResults(simulationId) {
  const simulation = await Simulation.findById(simulationId);
  if (!simulation) return null;

  const results = simulation.results || {};

  // Apply sampling for API response to reduce data transfer
  const mappedResults = {
    // Histories (sampled for FE performance)
    gini_history: sampleArray(results.gini_history || []),
    hhi_history: sampleArray(results.hhi_history || []),
    nakamoto_liveness_history: sampleArray(
      results.nakamoto_liveness_history ||
        results.nakamoto_liveness_pct_history ||
        []
    ),
    nakamoto_safety_history: sampleArray(
      results.nakamoto_safety_history ||
        results.nakamoto_safety_pct_history ||
        []
    ),
    zipf_history: sampleArray(results.zipf_history || []),
    epoch_history: sampleArray(results.epoch_history || []),
    // Final metrics (no sampling needed)
    final_metrics: results.final_metrics || {
      gini: results.final_results?.final_gini ?? 0,
      hhi: results.final_results?.final_hhi ?? 0,
      nakamoto_liveness: results.final_results?.final_nakamoto_liveness ?? 0,
      nakamoto_safety: results.final_results?.final_nakamoto_safety ?? 0,
      zipf: results.final_results?.final_zipf ?? 0,
      n_peers:
        results.final_results?.final_network_size ??
        (Array.isArray(results.network_size_history) &&
        results.network_size_history.length > 0
          ? results.network_size_history[
              results.network_size_history.length - 1
            ]
          : 0),
    },
  };

  return { simulation, mappedResults };
}

async function listSimulationsBySession(sessionId, { page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;

  const simulations = await Simulation.find({
    sessionId,
  })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .select(
      "_id parameters.proof_of_stake status progress execution_time created_at completed_at"
    );

  const total = await Simulation.countDocuments({ sessionId });

  return {
    simulations,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

async function deleteSimulation(simulationId) {
  return Simulation.findByIdAndDelete(simulationId);
}

async function addPeer({ simulationId, stake, epoch }) {
  const simulation = await Simulation.findById(simulationId);
  if (!simulation) {
    return { error: "not_found" };
  }
  if (simulation.status !== "running") {
    return { error: "invalid_state" };
  }

  let result;
  if (typeof epoch === "number" && epoch >= 0) {
    simulationEngine.schedulePeerJoin(simulationId, epoch, stake);
    result = { scheduled: true, epoch };
  } else {
    result = {
      peerId: simulationEngine.addNewPeerDuringSimulation(simulationId, stake),
      immediate: true,
    };
  }

  return { simulation, result };
}

/**
 * Run a short, in-memory test simulation without DB persistence.
 */
function runTestSimulation(parameters) {
  // Generate initial stakes
  const stakes = simulationEngine.generatePeers(
    parameters.n_peers,
    parameters.initial_stake_volume,
    parameters.initial_distribution,
    parameters.initial_gini
  );

  // Create corrupted peers
  const corrupted = [];
  for (let i = 0; i < parameters.n_corrupted; i++) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * parameters.n_peers);
    } while (corrupted.includes(randomIndex));
    corrupted.push(randomIndex);
  }

  const testParams = {
    ...parameters,
    n_epochs: Math.min(parameters.n_epochs, 100),
  };

  const results = simulationEngine.simulate(stakes, corrupted, testParams);

  return {
    parameters: testParams,
    results,
    initial_stakes: stakes.slice(0, 10),
    corrupted,
  };
}

module.exports = {
  validateParameters,
  createAndStartSimulation,
  getSimulationStatus,
  getSimulationWithMappedResults,
  listSimulationsBySession,
  deleteSimulation,
  addPeer,
  runTestSimulation,
};
