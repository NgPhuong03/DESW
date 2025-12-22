const express = require("express");
const router = express.Router();
const simulationController = require("../controllers/simulationController");

// Simulation routes mapped to controller layer
router.post("/run", simulationController.runSimulation);
router.get("/:id/status", simulationController.getSimulationStatus);
router.get("/:id/results", simulationController.getSimulationResults);
router.get(
  "/session/:sessionId",
  simulationController.getSessionSimulations
);
router.delete("/:id", simulationController.deleteSimulation);
router.post("/validate", simulationController.validateSimulationParameters);
router.post("/:id/add-peer", simulationController.addPeer);
router.post("/test", simulationController.testSimulation);

module.exports = router;
