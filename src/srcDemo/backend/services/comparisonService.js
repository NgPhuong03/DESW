const Comparison = require("../models/Comparison");
const Simulation = require("../models/Simulation");
const { SimulationEngine } = require("../utils/simulation");

const simulationEngine = new SimulationEngine();

const VALID_ALGOS = [
  "WEIGHTED",
  "OPPOSITE_WEIGHTED",
  "GINI_STABILIZED",
  "LSW",
  "DESW",
  "SRSW",
  "RANDOM",
];

function validateAlgorithms(algorithms) {
  if (!algorithms || !Array.isArray(algorithms) || algorithms.length < 2) {
    return ["At least 2 algorithms are required for comparison"];
  }
  const invalidAlgorithms = algorithms.filter(
    (alg) => !VALID_ALGOS.includes(alg)
  );
  if (invalidAlgorithms.length > 0) {
    return [`Invalid algorithms: ${invalidAlgorithms.join(", ")}`];
  }
  return [];
}

async function createAndStartComparison({
  sessionId,
  name,
  description,
  base_parameters,
  algorithms_to_compare,
}) {
  const comparison = new Comparison({
    sessionId,
    name: name.trim(),
    description: description?.trim() || "",
    base_parameters,
    algorithms_to_compare,
    status: "pending",
  });

  await comparison.save();

  // Background execution
  setImmediate(async () => {
    try {
      comparison.status = "running";
      await comparison.save();

      const startTime = Date.now();
      const simulationResults = [];

      // Generate initial stakes once (same for all algorithms)
      const initialStakes = simulationEngine.generatePeers(
        base_parameters.n_peers,
        base_parameters.initial_stake_volume,
        base_parameters.initial_distribution,
        base_parameters.initial_gini
      );

      // Create corrupted peers once
      const initialCorrupted = [];
      for (let i = 0; i < base_parameters.n_corrupted; i++) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * base_parameters.n_peers);
        } while (initialCorrupted.includes(randomIndex));
        initialCorrupted.push(randomIndex);
      }

      for (let i = 0; i < algorithms_to_compare.length; i++) {
        const algorithm = algorithms_to_compare[i];

        try {
          const overallProgress = Math.floor(
            (i / algorithms_to_compare.length) * 100
          );
          comparison.progress = overallProgress;
          await comparison.save();

          const simulation = new Simulation({
            sessionId,
            parameters: {
              ...base_parameters,
              proof_of_stake: algorithm,
            },
            status: "running",
          });
          await simulation.save();

          const algorithmStartTime = Date.now();

          const results = await simulationEngine.simulate(
            [...initialStakes],
            [...initialCorrupted],
            { ...base_parameters, proof_of_stake: algorithm },
            async (progressData) => {
              // progressData là object { epoch, progress, is_full_update, ... }
              const currentProgress =
                typeof progressData === "number"
                  ? progressData
                  : Number(progressData?.progress ?? 0);

              // Giảm tải: chỉ ghi DB khi là full update (mỗi ~100 epochs)
              if (
                progressData &&
                typeof progressData === "object" &&
                progressData.is_full_update
              ) {
                try {
                  // Cập nhật progress cho từng simulation
                  await Simulation.updateOne(
                    { _id: simulation._id },
                    { progress: currentProgress }
                  ).exec();

                  // Tính tổng progress cho toàn bộ comparison
                  const algorithmProgress =
                    currentProgress / algorithms_to_compare.length;
                  const totalProgress = overallProgress + algorithmProgress;

                  await Comparison.updateOne(
                    { _id: comparison._id },
                    { progress: Math.floor(totalProgress) }
                  ).exec();
                } catch (e) {
                  console.error("Progress update error (comparison):", e);
                }
              }
            }
          );

          const algorithmExecutionTime = Date.now() - algorithmStartTime;

          simulation.results = results;
          simulation.status = "completed";
          simulation.progress = 100;
          simulation.execution_time = algorithmExecutionTime;
          simulation.completed_at = new Date();
          await simulation.save();

          simulationResults.push({
            algorithm,
            simulation_id: simulation._id,
            final_metrics: results.final_metrics,
            execution_time: algorithmExecutionTime,
          });
        } catch (algorithmError) {
          console.error(
            `Error running algorithm ${algorithm}:`,
            algorithmError
          );

          simulationResults.push({
            algorithm,
            simulation_id: null,
            final_metrics: null,
            execution_time: null,
            error: algorithmError.message,
          });
        }
      }

      const totalExecutionTime = Date.now() - startTime;

      comparison.simulation_results = simulationResults;
      comparison.status = "completed";
      comparison.progress = 100;
      comparison.total_execution_time = totalExecutionTime;
      comparison.completed_at = new Date();

      await comparison.save();
    } catch (error) {
      console.error("Comparison error:", error);
      comparison.status = "failed";
      comparison.error_message = error.message;
      await comparison.save();
    }
  });

  return comparison;
}

async function getComparisonStatus(comparisonId) {
  return Comparison.findById(comparisonId);
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

async function getComparisonWithResults(comparisonId) {
  const comparison = await Comparison.findById(comparisonId).populate(
    "simulation_results.simulation_id",
    "results parameters execution_time"
  );
  if (!comparison) return null;

  const detailedResults = comparison.simulation_results.map((result) => ({
    algorithm: result.algorithm,
    final_metrics: result.final_metrics,
    execution_time: result.execution_time,
    simulation_data: result.simulation_id
      ? {
          // Apply sampling to reduce API response size and improve FE performance
          gini_history: sampleArray(
            result.simulation_id.results?.gini_history || []
          ),
          hhi_history: sampleArray(
            result.simulation_id.results?.hhi_history || []
          ),
          // Nakamoto liveness & safety histories (for comparison charts)
          nakamoto_liveness_history: sampleArray(
            result.simulation_id.results?.nakamoto_liveness_history || []
          ),
          nakamoto_safety_history: sampleArray(
            result.simulation_id.results?.nakamoto_safety_history || []
          ),
          // Other decentralization metrics that are still useful
          zipf_history: sampleArray(
            result.simulation_id.results?.zipf_history || []
          ),
          palma_history: sampleArray(
            result.simulation_id.results?.palma_history || []
          ),
          // Network size history (validators count over time)
          network_size_history: sampleArray(
            result.simulation_id.results?.network_size_history || []
          ),
        }
      : null,
    error: result.error || null,
  }));

  return { comparison, detailedResults };
}

async function listComparisonsBySession(sessionId, { page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;

  const comparisons = await Comparison.find({
    sessionId,
  })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .select(
      "_id name algorithms_to_compare status progress total_execution_time created_at completed_at"
    );

  const total = await Comparison.countDocuments({ sessionId });

  return {
    comparisons,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

async function deleteComparison(comparisonId) {
  const comparison = await Comparison.findByIdAndDelete(comparisonId);
  if (!comparison) return null;

  if (comparison.simulation_results) {
    const simulationIds = comparison.simulation_results
      .map((result) => result.simulation_id)
      .filter((id) => id);

    if (simulationIds.length > 0) {
      await Simulation.deleteMany({ _id: { $in: simulationIds } });
    }
  }

  return comparison;
}

module.exports = {
  validateAlgorithms,
  createAndStartComparison,
  getComparisonStatus,
  getComparisonWithResults,
  listComparisonsBySession,
  deleteComparison,
};
