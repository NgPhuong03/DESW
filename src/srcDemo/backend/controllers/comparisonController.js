const comparisonService = require("../services/comparisonService");

/**
 * POST /api/comparison/run
 */
async function runComparison(req, res) {
  try {
    const {
      sessionId,
      name,
      description,
      base_parameters,
      algorithms_to_compare,
    } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "name is required" });
    }

    const algoErrors =
      comparisonService.validateAlgorithms(algorithms_to_compare);
    if (algoErrors.length > 0) {
      return res.status(400).json({
        error: "Invalid algorithms",
        invalid: algoErrors,
      });
    }

    const comparison = await comparisonService.createAndStartComparison({
      sessionId,
      name,
      description,
      base_parameters,
      algorithms_to_compare,
    });

    return res.json({
      message: "Comparison started",
      comparisonId: comparison._id,
      status: "pending",
    });
  } catch (error) {
    console.error("Error starting comparison:", error);
    return res.status(500).json({ error: "Failed to start comparison" });
  }
}

/**
 * GET /api/comparison/:id/status
 */
async function getComparisonStatus(req, res) {
  try {
    const comparison = await comparisonService.getComparisonStatus(
      req.params.id
    );

    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    return res.json({
      id: comparison._id,
      name: comparison.name,
      status: comparison.status,
      progress: comparison.progress,
      error_message: comparison.error_message,
      total_execution_time: comparison.total_execution_time,
      algorithms_to_compare: comparison.algorithms_to_compare,
      created_at: comparison.created_at,
      completed_at: comparison.completed_at,
    });
  } catch (error) {
    console.error("Error getting comparison status:", error);
    return res.status(500).json({ error: "Failed to get comparison status" });
  }
}

/**
 * GET /api/comparison/:id/results
 */
async function getComparisonResults(req, res) {
  try {
    const data = await comparisonService.getComparisonWithResults(
      req.params.id
    );
    if (!data) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    const { comparison, detailedResults } = data;

    if (comparison.status !== "completed") {
      return res.status(400).json({
        error: "Comparison not completed",
        status: comparison.status,
      });
    }

    return res.json({
      id: comparison._id,
      name: comparison.name,
      description: comparison.description,
      base_parameters: comparison.base_parameters,
      algorithms_compared: comparison.algorithms_to_compare,
      results: detailedResults,
      total_execution_time: comparison.total_execution_time,
      completed_at: comparison.completed_at,
    });
  } catch (error) {
    console.error("Error getting comparison results:", error);
    return res.status(500).json({ error: "Failed to get comparison results" });
  }
}

/**
 * GET /api/comparison/session/:sessionId
 */
async function getSessionComparisons(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await comparisonService.listComparisonsBySession(
      req.params.sessionId,
      { page, limit }
    );

    return res.json(result);
  } catch (error) {
    console.error("Error getting session comparisons:", error);
    return res
      .status(500)
      .json({ error: "Failed to get session comparisons" });
  }
}

/**
 * DELETE /api/comparison/:id
 */
async function deleteComparison(req, res) {
  try {
    const comparison = await comparisonService.deleteComparison(req.params.id);
    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found" });
    }

    return res.json({ message: "Comparison deleted successfully" });
  } catch (error) {
    console.error("Error deleting comparison:", error);
    return res.status(500).json({ error: "Failed to delete comparison" });
  }
}

module.exports = {
  runComparison,
  getComparisonStatus,
  getComparisonResults,
  getSessionComparisons,
  deleteComparison,
};


