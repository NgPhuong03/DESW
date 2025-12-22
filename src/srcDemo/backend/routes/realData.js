/**
 * Real Data Analysis Routes
 *
 * API endpoints for collecting and analyzing real blockchain data
 */

const express = require("express");
const router = express.Router();
const realDataController = require("../controllers/realDataController");

// Real data routes mapped to controller layer
router.get("/chains", realDataController.getChains);
router.get("/collect/:chainName?", realDataController.collectData);
router.post("/analyze", realDataController.analyzeData);
router.get("/full-analysis/:chainName?", realDataController.fullAnalysis);
router.post("/comparison-matrix", realDataController.generateComparisonMatrix);
router.get("/health", realDataController.healthCheck);
router.get("/csv/list", realDataController.listCSVFiles);
router.get("/csv/download/:filename", realDataController.downloadCSV);

module.exports = router;
