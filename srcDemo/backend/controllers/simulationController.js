const simulationService = require("../services/simulationService");

/**
 * POST /api/simulation/run
 */
async function runSimulation(req, res) {
  try {
    const { sessionId, parameters } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const validationErrors = simulationService.validateParameters(parameters);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: validationErrors,
      });
    }

    const simulation = await simulationService.createAndStartSimulation(
      sessionId,
      parameters
    );

    return res.json({
      message: "Simulation started",
      simulationId: simulation._id,
      status: "pending",
    });
  } catch (error) {
    console.error("Error starting simulation:", error);
    return res.status(500).json({ error: "Failed to start simulation" });
  }
}

/**
 * GET /api/simulation/:id/status
 */
async function getSimulationStatus(req, res) {
  try {
    const simulation = await simulationService.getSimulationStatus(
      req.params.id
    );
    if (!simulation) {
      return res.status(404).json({ error: "Simulation not found" });
    }
    console.log("simulation ", simulation.progress);
    return res.json({
      id: simulation._id,
      status: simulation.status,
      progress: simulation.progress,
      error_message: simulation.error_message,
      execution_time: simulation.execution_time,
      created_at: simulation.created_at,
      completed_at: simulation.completed_at,
    });
  } catch (error) {
    console.error("Error getting simulation status:", error);
    return res.status(500).json({ error: "Failed to get simulation status" });
  }
}

/**
 * GET /api/simulation/:id/results
 */
async function getSimulationResults(req, res) {
  try {
    timestamp = Date.now();

    const data = await simulationService.getSimulationWithMappedResults(
      req.params.id
    );

    console.log("execution_time ", Date.now() - timestamp);

    if (!data) {
      return res.status(404).json({ error: "Simulation not found" });
    }

    const { simulation, mappedResults } = data;

    if (simulation.status !== "completed") {
      return res.status(400).json({
        error: "Simulation not completed",
        status: simulation.status,
      });
    }

    return res.json({
      id: simulation._id,
      parameters: simulation.parameters,
      results: mappedResults,
      execution_time: simulation.execution_time,
      completed_at: simulation.completed_at,
    });
  } catch (error) {
    console.error("Error getting simulation results:", error);
    return res.status(500).json({ error: "Failed to get simulation results" });
  }
}

/**
 * GET /api/simulation/session/:sessionId
 */
async function getSessionSimulations(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await simulationService.listSimulationsBySession(
      req.params.sessionId,
      { page, limit }
    );

    return res.json(result);
  } catch (error) {
    console.error("Error getting session simulations:", error);
    return res.status(500).json({ error: "Failed to get session simulations" });
  }
}

/**
 * DELETE /api/simulation/:id
 */
async function deleteSimulation(req, res) {
  try {
    const simulation = await simulationService.deleteSimulation(req.params.id);
    if (!simulation) {
      return res.status(404).json({ error: "Simulation not found" });
    }

    return res.json({ message: "Simulation deleted successfully" });
  } catch (error) {
    console.error("Error deleting simulation:", error);
    return res.status(500).json({ error: "Failed to delete simulation" });
  }
}

/**
 * POST /api/simulation/validate
 */
function validateSimulationParameters(req, res) {
  try {
    const { parameters } = req.body || {};
    if (!parameters) {
      return res.status(400).json({
        valid: false,
        errors: ["Parameters are required"],
      });
    }

    const validationErrors = simulationService.validateParameters(parameters);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        valid: false,
        errors: validationErrors,
      });
    }

    return res.json({ valid: true });
  } catch (error) {
    console.error("Error validating parameters:", error);
    return res.status(500).json({ error: "Failed to validate parameters" });
  }
}

/**
 * POST /api/simulation/:id/add-peer
 */
async function addPeer(req, res) {
  try {
    const { id } = req.params;
    const { stake, epoch } = req.body || {};

    if (!stake || typeof stake !== "number" || stake <= 0) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Valid stake amount is required",
      });
    }

    const { simulation, result, error } = await simulationService.addPeer({
      simulationId: id,
      stake,
      epoch,
    });

    if (error === "not_found") {
      return res.status(404).json({
        error: "Not found",
        message: "Simulation not found",
      });
    }
    if (error === "invalid_state") {
      return res.status(400).json({
        error: "Invalid operation",
        message: "Can only add peers to running simulations",
      });
    }

    return res.json({
      message:
        typeof epoch === "number"
          ? `Peer scheduled to join at epoch ${epoch}`
          : "New peer added successfully",
      result,
      stake,
    });
  } catch (error) {
    console.error("Add peer error:", error);
    return res.status(500).json({
      error: "Failed to add peer",
      message: error.message,
    });
  }
}

/**
 * POST /api/simulation/test
 */
function testSimulation(req, res) {
  try {
    const { parameters } = req.body || {};
    if (!parameters) {
      return res.status(400).json({ error: "Parameters are required" });
    }

    const validationErrors = simulationService.validateParameters(parameters);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: validationErrors,
      });
    }

    const result = simulationService.runTestSimulation(parameters);

    return res.json({
      message: "Test simulation completed",
      ...result,
    });
  } catch (error) {
    console.error("Test simulation error:", error);
    return res.status(500).json({
      error: "Test simulation failed",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

module.exports = {
  runSimulation,
  getSimulationStatus,
  getSimulationResults,
  getSessionSimulations,
  deleteSimulation,
  validateSimulationParameters,
  addPeer,
  testSimulation,
};
