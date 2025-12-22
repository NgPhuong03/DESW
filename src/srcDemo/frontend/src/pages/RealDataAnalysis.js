import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import api, { realDataAPI } from "../services/api";
import MetricsComparisonChart from "../components/MetricsComparisonChart";

const RealDataAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [supportedChains, setSupportedChains] = useState([]);
  const [selectedChains, setSelectedChains] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [comparisonMatrix, setComparisonMatrix] = useState(null);
  const [summaryStats, setSummaryStats] = useState(null);
  const [collectionResult, setCollectionResult] = useState(null);
  const [error, setError] = useState(null);

  // PoS models info
  const algorithms = {
    baseline: {
      name: "Baseline (WEIGHTED)",
      description: "Original stake weighting",
    },
    srsw: { name: "SRSW", description: "Square Root Stake Weighting" },
    lsw: { name: "LSW", description: "Logarithmic Stake Weighting" },
    desw: { name: "DESW", description: "Dynamic Exponential Stake Weighting" },
  };

  // Load supported chains on mount
  useEffect(() => {
    loadSupportedChains();
  }, []);

  const loadSupportedChains = async () => {
    try {
      const response = await api.get("/real-data/chains");
      if (response.data.success) {
        setSupportedChains(response.data.supported_chains);
        setSelectedChains(response.data.supported_chains); // Select all by default
      }
    } catch (error) {
      console.error("Error loading supported chains:", error);
      toast.error("Unable to load the blockchain list");
    }
  };

  const handleChainSelection = (chainName) => {
    setSelectedChains((prev) =>
      prev.includes(chainName)
        ? prev.filter((c) => c !== chainName)
        : [...prev, chainName]
    );
  };

  const runFullAnalysis = async () => {
    if (selectedChains.length === 0) {
      toast.error("Please select at least one blockchain");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResults(null);
    setComparisonMatrix(null);
    setSummaryStats(null);
    setCollectionResult(null);

    try {
      toast.loading("Fetching data from selected blockchains...", {
        id: "analysis",
      });

      // Run full analysis for the selected list
      const chainsParam = selectedChains.join(",");
      const response = await api.get(
        `/real-data/full-analysis?chains=${encodeURIComponent(chainsParam)}`
      );

      if (response.data.success) {
        toast.success("Analysis completed!", { id: "analysis" });

        setAnalysisResults(response.data.analysis_result);
        setComparisonMatrix(response.data.comparison_matrix);
        setSummaryStats(response.data.summary_stats);
        setCollectionResult(response.data.collection_result);
      } else {
        throw new Error(response.data.error || "Analysis failed");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      setError(error.message);
      toast.error(`Analysis error: ${error.message}`, { id: "analysis" });
    } finally {
      setLoading(false);
    }
  };

  const renderChainSelector = () => (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">
        Select blockchains to analyze
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {supportedChains.map((chain) => (
          <label
            key={chain}
            className="flex items-center space-x-2 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedChains.includes(chain)}
              onChange={() => handleChainSelection(chain)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium capitalize">{chain}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex space-x-2">
        <button
          onClick={() => setSelectedChains(supportedChains)}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
        >
          Select all
        </button>
        <button
          onClick={() => setSelectedChains([])}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
        >
          Clear all
        </button>
      </div>
    </div>
  );

  const renderAlgorithmInfo = () => (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Compared PoS models</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(algorithms).map(([key, alg]) => (
          <div key={key} className="border rounded p-3">
            <h4 className="font-medium text-blue-600">{alg.name}</h4>
            <p className="text-sm text-gray-600 mt-1">{alg.description}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSummaryStats = () => {
    if (!summaryStats) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Results overview</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">
              {summaryStats.overall.total_blockchains}
            </div>
            <div className="text-sm text-gray-600">Blockchains analyzed</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">
              {summaryStats.overall.total_validators.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total validators</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded">
            <div className="text-2xl font-bold text-purple-600">4</div>
            <div className="text-sm text-gray-600">PoS models compared</div>
          </div>
        </div>

        {/* Average metrics table */}
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                  Algorithm
                </th>
                <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">
                  Gini TB
                </th>
                <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">
                  Nakamoto TB
                </th>
                <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">
                  HHI TB
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Object.entries(algorithms).map(([key, alg]) => (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium">{alg.name}</td>
                  <td className="px-4 py-2 text-sm text-center">
                    {summaryStats.overall.average_gini[key]?.toFixed(3) ||
                      "N/A"}
                  </td>
                  <td className="px-4 py-2 text-sm text-center">
                    {summaryStats.overall.average_nakamoto[key]?.toFixed(1) ||
                      "N/A"}
                  </td>
                  <td className="px-4 py-2 text-sm text-center">
                    {summaryStats.overall.average_hhi[key]?.toFixed(3) || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const convertValidatorsToCSV = (validators, chainName) => {
    if (!validators || validators.length === 0) {
      return "";
    }

    // Header
    const headers = ["address", "tokens"];
    const csvRows = [headers.join(",")];

    // Data rows
    validators.forEach((validator) => {
      const row = [validator.address || "", validator.tokens || 0];
      // Escape commas and quotes in CSV
      csvRows.push(
        row
          .map((field) => {
            const str = String(field);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      );
    });

    return csvRows.join("\n");
  };

  const downloadChainCSV = (chainName) => {
    if (!collectionResult) {
      toast.error("No data available to download");
      return;
    }

    let validators = null;

    if (
      collectionResult.validators &&
      collectionResult.blockchain === chainName
    ) {
      validators = collectionResult.validators;
    } else if (collectionResult.chains && collectionResult.chains[chainName]) {
      const chainData = collectionResult.chains[chainName];
      if (chainData.success && chainData.validators) {
        validators = chainData.validators;
      }
    }

    if (!validators || validators.length === 0) {
      toast.error(`No validator data found for ${chainName}`);
      return;
    }

    const csvContent = convertValidatorsToCSV(validators, chainName);

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `${timestamp}_${chainName}_validators.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Downloaded CSV for ${chainName}`);
  };

  const renderDetailedResults = () => {
    if (!analysisResults || !analysisResults.results) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          Detailed results by blockchain
        </h3>

        <div className="space-y-6">
          {Object.entries(analysisResults.results).map(
            ([chainName, chainResult]) => (
              <div key={chainName} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-lg capitalize text-blue-600">
                    {chainName}
                  </h4>
                  <div className="flex items-center gap-3">
                    {chainResult.original_data && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">
                          {chainResult.original_data.total_validators?.toLocaleString() ||
                            0}
                        </span>{" "}
                        validators
                      </div>
                    )}
                    <button
                      onClick={() => downloadChainCSV(chainName)}
                      className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium flex items-center gap-1"
                      title="Download validator data as CSV"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Download CSV
                    </button>
                  </div>
                </div>

                {chainResult.error ? (
                  <div className="text-red-600 text-sm">
                    Error: {chainResult.error}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left">PoS model</th>
                          <th className="px-3 py-2 text-center">Gini</th>
                          <th className="px-3 py-2 text-center">
                            Nakamoto Liveness (33%)
                          </th>
                          <th className="px-3 py-2 text-center">
                            Nakamoto Safety (66%)
                          </th>
                          <th className="px-3 py-2 text-center">HHI</th>
                          <th className="px-3 py-2 text-center">Zipf</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.entries(chainResult.analysis_results || {}).map(
                          ([algKey, algResult]) => (
                            <tr key={algKey} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">
                                {algorithms[algKey]?.name ||
                                  algKey.toUpperCase()}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {algResult.gini_coefficient != null
                                  ? algResult.gini_coefficient.toFixed(3)
                                  : "N/A"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {algResult.nakamoto_liveness != null &&
                                algResult.total_validators
                                  ? `${algResult.nakamoto_liveness} (${(
                                      algResult.nakamoto_liveness_pct ??
                                      (algResult.nakamoto_liveness /
                                        algResult.total_validators) *
                                        100
                                    ).toFixed(2)}%)`
                                  : "N/A"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {algResult.nakamoto_safety != null &&
                                algResult.total_validators
                                  ? `${algResult.nakamoto_safety} (${(
                                      algResult.nakamoto_safety_pct ??
                                      (algResult.nakamoto_safety /
                                        algResult.total_validators) *
                                        100
                                    ).toFixed(2)}%)`
                                  : "N/A"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {algResult.hhi_coefficient != null
                                  ? algResult.hhi_coefficient.toFixed(3)
                                  : "N/A"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {algResult.zipf_coefficient != null
                                  ? algResult.zipf_coefficient.toFixed(4)
                                  : "N/A"}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Real blockchain data analysis
        </h1>
        <p className="text-gray-600">
          Collect and analyze validator data from multiple blockchains using 4
          different PoS stake-weighting models
        </p>
      </div>

      {renderChainSelector()}
      {renderAlgorithmInfo()}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Run analysis</h3>
          <button
            onClick={runFullAnalysis}
            disabled={loading || selectedChains.length === 0}
            className={`px-6 py-2 rounded-lg font-medium ${
              loading || selectedChains.length === 0
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {loading ? "Analyzing..." : "Start analysis"}
          </button>
        </div>

        {selectedChains.length > 0 && (
          <div className="text-sm text-gray-600">
            Will analyze:{" "}
            {selectedChains.map((c) => c.toUpperCase()).join(", ")}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-800 font-medium">An error occurred:</div>
          <div className="text-red-600 text-sm mt-1">{error}</div>
        </div>
      )}

      {renderSummaryStats()}

      {/* Simple Metrics Comparison Chart */}
      <MetricsComparisonChart
        analysisResults={analysisResults}
        summaryStats={summaryStats}
      />

      {renderDetailedResults()}
    </div>
  );
};

export default RealDataAnalysis;
