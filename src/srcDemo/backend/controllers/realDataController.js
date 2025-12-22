const path = require("path");
const fs = require("fs");
const BlockchainDataService = require("../services/blockchainDataService");
const RealDataAnalysisService = require("../services/realDataAnalysisService");

const dataService = new BlockchainDataService();
const analysisService = new RealDataAnalysisService();

/**
 * GET /api/real-data/chains
 * Get list of supported blockchains
 */
function getChains(req, res) {
  try {
    res.json({
      success: true,
      supported_chains: dataService.supportedChains,
      algorithms: Object.keys(analysisService.algorithms),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/real-data/collect/:chainName?
 * Collect data from a specific chain or all chains
 */
async function collectData(req, res) {
  try {
    const { chainName } = req.params;

    let result;
    if (chainName) {
      result = await dataService.fetchSingleChain(chainName);
    } else {
      result = await dataService.fetchAllChainsData();
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/real-data/analyze
 * Analyze data with algorithms
 * Body: { chainData: {...} } or { chainsData: {...} }
 */
async function analyzeData(req, res) {
  try {
    const { chainData, chainsData } = req.body;

    let result;
    if (chainData) {
      result = analysisService.analyzeBlockchain(chainData);
    } else if (chainsData) {
      result = analysisService.analyzeMultipleChains(chainsData);
    } else {
      return res.status(400).json({
        success: false,
        error: "Missing chainData or chainsData in request body",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/real-data/full-analysis/:chainName?
 * Collect data and analyze in a single request
 */
async function fullAnalysis(req, res) {
  try {
    const { chainName } = req.params;
    const chainQuery =
      typeof req.query.chains === "string"
        ? req.query.chains
            .split(",")
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean)
        : null;

    let collectionResult;
    if (chainName) {
      collectionResult = await dataService.fetchSingleChain(chainName);
    } else {
      collectionResult = await dataService.fetchAllChainsData(chainQuery);
    }

    let analysisResult;
    if (chainName) {
      // Single chain analysis
      if (!collectionResult.success) {
        return res.json({
          success: false,
          error: `Failed to collect data for ${chainName}: ${collectionResult.error}`,
          collection_result: collectionResult,
          timestamp: new Date().toISOString(),
        });
      }

      analysisResult = analysisService.analyzeBlockchain(collectionResult);
    } else {
      // Multiple chains analysis
      if (!collectionResult.success) {
        return res.json({
          success: false,
          error: "Failed to collect data from chains",
          collection_result: collectionResult,
          timestamp: new Date().toISOString(),
        });
      }

      analysisResult = analysisService.analyzeMultipleChains(
        collectionResult.chains
      );
    }

    let comparisonMatrix = null;
    let summaryStats = null;

    if (!chainName && analysisResult.results) {
      comparisonMatrix = analysisService.generateComparisonMatrix(
        analysisResult.results
      );
      summaryStats = analysisService.generateSummaryStats(
        analysisResult.results
      );
    }

    res.json({
      success: true,
      collection_result: collectionResult,
      analysis_result: analysisResult,
      comparison_matrix: comparisonMatrix,
      summary_stats: summaryStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/real-data/comparison-matrix
 * Generate comparison matrix from analysis results
 */
function generateComparisonMatrix(req, res) {
  try {
    const { analysisResults } = req.body;

    if (!analysisResults) {
      return res.status(400).json({
        success: false,
        error: "Missing analysisResults in request body",
        timestamp: new Date().toISOString(),
      });
    }

    const matrix = analysisService.generateComparisonMatrix(analysisResults);
    const stats = analysisService.generateSummaryStats(analysisResults);

    res.json({
      success: true,
      comparison_matrix: matrix,
      summary_stats: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/real-data/health
 * Health check for real data services
 */
function healthCheck(req, res) {
  try {
    const health = {
      status: "OK",
      services: {
        blockchain_data_service: "OK",
        analysis_service: "OK",
      },
      supported_chains: dataService.supportedChains.length,
      supported_algorithms: Object.keys(analysisService.algorithms).length,
      environment: {
        dune_api_configured: !!process.env.DUNE_API_KEY,
        node_env: process.env.NODE_ENV || "development",
      },
      timestamp: new Date().toISOString(),
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/real-data/csv/list
 * Get list of saved CSV files
 * Query params: ?chain=chainName (optional) to filter by chain
 */
function listCSVFiles(req, res) {
  try {
    const { chain } = req.query;
    const csvFiles = dataService.csvWriter.listCSVFiles(chain || null);

    res.json({
      success: true,
      files: csvFiles,
      total_files: csvFiles.length,
      chain_filter: chain || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/real-data/csv/download/:filename
 * Download a specific CSV file
 */
function downloadCSV(req, res) {
  try {
    const { filename } = req.params;
    const csvDir = path.join(__dirname, "..", "data", "csv");
    const filepath = path.join(csvDir, filename);

    if (!filepath.startsWith(csvDir)) {
      return res.status(403).json({
        success: false,
        error: "Invalid file path",
      });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  getChains,
  collectData,
  analyzeData,
  fullAnalysis,
  generateComparisonMatrix,
  healthCheck,
  listCSVFiles,
  downloadCSV,
};
