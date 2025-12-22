import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes timeout for long simulations
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("API Response Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Simulation API
export const simulationAPI = {
  // Run a single simulation
  runSimulation: (sessionId, parameters) =>
    api.post("/simulation/run", { sessionId, parameters }),

  // Get simulation status
  getSimulationStatus: (simulationId) =>
    api.get(`/simulation/${simulationId}/status`),

  // Get simulation results
  getSimulationResults: (simulationId) =>
    api.get(`/simulation/${simulationId}/results`),

  // Get all simulations for a session
  getSessionSimulations: (sessionId, page = 1, limit = 10) =>
    api.get(`/simulation/session/${sessionId}?page=${page}&limit=${limit}`),

  // Delete a simulation
  deleteSimulation: (simulationId) => api.delete(`/simulation/${simulationId}`),

  // Validate parameters
  validateParameters: (parameters) =>
    api.post("/simulation/validate", { parameters }),
};

// Comparison API
export const comparisonAPI = {
  // Run algorithm comparison
  runComparison: (
    sessionId,
    name,
    description,
    baseParameters,
    algorithmsToCompare
  ) =>
    api.post("/comparison/run", {
      sessionId,
      name,
      description,
      base_parameters: baseParameters,
      algorithms_to_compare: algorithmsToCompare,
    }),

  // Get comparison status
  getComparisonStatus: (comparisonId) =>
    api.get(`/comparison/${comparisonId}/status`),

  // Get comparison results
  getComparisonResults: (comparisonId) =>
    api.get(`/comparison/${comparisonId}/results`),

  // Get all comparisons for a session
  getSessionComparisons: (sessionId, page = 1, limit = 10) =>
    api.get(`/comparison/session/${sessionId}?page=${page}&limit=${limit}`),

  // Delete a comparison
  deleteComparison: (comparisonId) => api.delete(`/comparison/${comparisonId}`),
};

// Real Data Analysis API
export const realDataAPI = {
  // Get supported chains
  getSupportedChains: () => api.get("/real-data/chains"),

  // Collect data from chain(s)
  collectData: (chainName) =>
    chainName
      ? api.get(`/real-data/collect/${chainName}`)
      : api.get("/real-data/collect"),

  // Analyze data
  analyzeData: (chainData) => api.post("/real-data/analyze", chainData),

  // Full analysis (collect + analyze)
  fullAnalysis: (chainName, chains) => {
    if (chainName) {
      return api.get(`/real-data/full-analysis/${chainName}`);
    }
    const chainsParam = chains
      ? `?chains=${encodeURIComponent(chains.join(","))}`
      : "";
    return api.get(`/real-data/full-analysis${chainsParam}`);
  },

  // List CSV files
  listCSVFiles: (chainName) => {
    const params = chainName ? `?chain=${chainName}` : "";
    return api.get(`/real-data/csv/list${params}`);
  },

  // Download CSV file
  downloadCSV: (filename) =>
    api.get(`/real-data/csv/download/${filename}`, {
      responseType: "blob", // Important for file downloads
    }),
};

// Health check
export const healthAPI = {
  checkHealth: () => api.get("/health"),
};

export default api;
