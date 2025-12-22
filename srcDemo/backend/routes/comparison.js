const express = require("express");
const router = express.Router();
const comparisonController = require("../controllers/comparisonController");

// Comparison routes mapped to controller layer
router.post("/run", comparisonController.runComparison);
router.get("/:id/status", comparisonController.getComparisonStatus);
router.get("/:id/results", comparisonController.getComparisonResults);
router.get(
  "/session/:sessionId",
  comparisonController.getSessionComparisons
);
router.delete("/:id", comparisonController.deleteComparison);

module.exports = router;
