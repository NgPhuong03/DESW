import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  BarChart3,
} from "lucide-react";
import ComparisonChart from "../components/ComparisonChart";
import { comparisonAPI } from "../services/api";
import toast from "react-hot-toast";

const ComparisonResults = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("gini_history");

  // Only show the metrics currently used: Gini, HHI, Liveness, Safety, Zipf
  const metricOptions = [
    {
      value: "gini_history",
      label: "Gini coefficient",
      yLabel: "Gini Coefficient",
    },
    {
      value: "nakamoto_liveness_history",
      label: "Nakamoto Liveness",
      yLabel: "Nakamoto Liveness",
    },
    {
      value: "nakamoto_safety_history",
      label: "Nakamoto Safety",
      yLabel: "Nakamoto Safety",
    },
    { value: "hhi_history", label: "HHI index", yLabel: "HHI Index" },
    {
      value: "zipf_history",
      label: "Zipf coefficient",
      yLabel: "Zipf Coefficient",
    },
  ];

  const fetchComparison = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true);

      const response = await comparisonAPI.getComparisonResults(id);
      console.log("data", response);
      setComparison(response.data);
      setError(null);

      if (showRefreshToast) {
        toast.success("Results updated");
      }
    } catch (err) {
      console.error("Error fetching comparison:", err);

      if (err.response?.status === 404) {
        setError("Comparison not found");
      } else if (err.response?.status === 400) {
        setError("Comparison is not completed yet");
      } else {
        setError("Something went wrong while loading results");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkStatus = async () => {
    try {
      const response = await comparisonAPI.getComparisonStatus(id);
      const status = response.data;

      if (status.status === "completed") {
        fetchComparison();
      } else if (status.status === "failed") {
        setError(`Comparison failed: ${status.error_message}`);
        setLoading(false);
      }
      // Continue polling if still running
      else if (status.status === "running" || status.status === "pending") {
        setTimeout(checkStatus, 50000); // Poll every 3 seconds
      }
    } catch (err) {
      console.error("Error checking status:", err);
      setError("Something went wrong while checking status");
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [id]);

  const handleRefresh = () => {
    fetchComparison(true);
  };

  const handleDownload = () => {
    if (!comparison) return;

    const data = {
      comparison_id: id,
      name: comparison.name,
      description: comparison.description,
      base_parameters: comparison.base_parameters,
      algorithms_compared: comparison.algorithms_compared,
      results: comparison.results,
      total_execution_time: comparison.total_execution_time,
      completed_at: comparison.completed_at,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison_${id}_results.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Comparison results downloaded");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Running comparison...
          </h2>
          <p className="text-gray-600">
            Please wait. This page will update automatically when it finishes.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-2">
            <button
              onClick={handleRefresh}
              className="btn btn-primary w-full"
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </>
              )}
            </button>
            <Link to="/comparison" className="btn btn-outline w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to comparison
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  const {
    name,
    description,
    base_parameters,
    algorithms_compared,
    results: rawResults,
    total_execution_time,
    completed_at,
  } = comparison;

  // Enrich results with fallback final metrics computed from histories
  const results = (rawResults || []).map((result) => {
    const fm = result.final_metrics || {};
    const sd = result.simulation_data || {};

    const last = (arr) =>
      Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : undefined;

    const gini = fm.gini ?? last(sd.gini_history);
    const hhi = fm.hhi ?? last(sd.hhi_history);
    const nakamoto_liveness =
      fm.nakamoto_liveness ?? last(sd.nakamoto_liveness_history);
    const nakamoto_safety =
      fm.nakamoto_safety ?? last(sd.nakamoto_safety_history);
    const zipf = fm.zipf ?? last(sd.zipf_history);

    // Estimate peer count to compute percentages: prefer history, fallback to base params
    const peerCount =
      last(sd.network_size_history) ??
      base_parameters?.n_peers ??
      fm.n_peers ??
      0;

    const toPct = (value) =>
      typeof value === "number" && peerCount > 0
        ? (value / peerCount) * 100
        : null;

    const nakamoto_liveness_pct = toPct(nakamoto_liveness);
    const nakamoto_safety_pct = toPct(nakamoto_safety);

    return {
      ...result,
      _metrics: {
        gini,
        hhi,
        nakamoto_liveness,
        nakamoto_safety,
        nakamoto_liveness_pct,
        nakamoto_safety_pct,
        peerCount,
        zipf,
      },
    };
  });
  const selectedMetricOption = metricOptions.find(
    (opt) => opt.value === selectedMetric
  );

  // Color palette for algorithms
  const algorithmColors = {
    WEIGHTED: "#3b82f6",
    OPPOSITE_WEIGHTED: "#ef4444",
    LOG_WEIGHTED: "#f59e0b",
    DESW: "#8b5cf6",
    SRSW_WEIGHTED: "#06b6d4",
    RANDOM: "#f97316",
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn-outline mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
                <div className="flex items-center text-gray-600 mt-1">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  <span>Completed</span>
                  <Clock className="w-4 h-4 ml-4 mr-2" />
                  <span>{total_execution_time}ms</span>
                </div>
                {description && (
                  <p className="text-gray-600 mt-1">{description}</p>
                )}
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleRefresh}
                className="btn btn-outline"
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
              <button onClick={handleDownload} className="btn btn-primary">
                <Download className="w-4 h-4 mr-2" />
                Download
              </button>
            </div>
          </div>

          {/* Comparison Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Algorithms
                </h3>
                <p className="text-lg font-semibold text-gray-900">
                  {algorithms_compared.length}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Execution time
                </h3>
                <p className="text-lg font-semibold text-gray-900">
                  {(total_execution_time / 1000).toFixed(2)}s
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Completed at
                </h3>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(completed_at).toLocaleString("en-US")}
                </p>
              </div>
            </div>

            {/* Algorithm List */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Compared algorithms
              </h3>
              <div className="flex flex-wrap gap-2">
                {algorithms_compared.map((algorithm) => (
                  <span
                    key={algorithm}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
                  >
                    <div
                      className="w-2 h-2 rounded-full mr-2"
                      style={{
                        backgroundColor:
                          algorithmColors[algorithm] || "#6b7280",
                      }}
                    />
                    {algorithm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Final Metrics Comparison Table */}
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Final results comparison
            </h3>
          </div>
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Algorithm
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gini
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nakamoto Liveness
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nakamoto Safety
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      HHI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zipf
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time (ms)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((result) => (
                    <tr key={result.algorithm} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-3"
                            style={{
                              backgroundColor:
                                algorithmColors[result.algorithm] || "#6b7280",
                            }}
                          />
                          <span className="text-sm font-medium text-gray-900">
                            {result.algorithm}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {result._metrics?.gini != null
                          ? result._metrics.gini.toFixed(4)
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {result._metrics?.nakamoto_liveness != null ? (
                          <>
                            {result._metrics.nakamoto_liveness.toFixed(4)}
                            {result._metrics.nakamoto_liveness_pct != null &&
                              result._metrics.peerCount > 0 && (
                                <span className="text-gray-500 ml-1">
                                  (
                                  {result._metrics.nakamoto_liveness_pct.toFixed(
                                    1
                                  )}
                                  %)
                                </span>
                              )}
                          </>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {result._metrics?.nakamoto_safety != null ? (
                          <>
                            {result._metrics.nakamoto_safety.toFixed(4)}
                            {result._metrics.nakamoto_safety_pct != null &&
                              result._metrics.peerCount > 0 && (
                                <span className="text-gray-500 ml-1">
                                  (
                                  {result._metrics.nakamoto_safety_pct.toFixed(
                                    1
                                  )}
                                  %)
                                </span>
                              )}
                          </>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {result._metrics?.hhi != null
                          ? result._metrics.hhi.toFixed(4)
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {result._metrics?.zipf != null
                          ? result._metrics.zipf.toFixed(4)
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {result.execution_time || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Over-time comparison
              </h3>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-gray-400" />
                <select
                  className="form-select"
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                >
                  {metricOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="card-body">
            <ComparisonChart
              results={results}
              metric={selectedMetric}
              title={selectedMetricOption?.label}
              yAxisLabel={selectedMetricOption?.yLabel}
              height={500}
              totalEpochs={base_parameters?.n_epochs}
            />
          </div>
        </div>

        {/* Performance Summary */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="card-body text-center">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Lowest Gini
              </h4>
              {(() => {
                const bestGini = results.reduce((best, current) =>
                  (current._metrics?.gini ?? 1) < (best._metrics?.gini ?? 1)
                    ? current
                    : best
                );
                return (
                  <div>
                    <div className="flex items-center justify-center mb-1">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{
                          backgroundColor: algorithmColors[bestGini.algorithm],
                        }}
                      />
                      <span className="font-medium">{bestGini.algorithm}</span>
                    </div>
                    <span className="text-2xl font-bold text-green-600">
                      {bestGini._metrics?.gini != null
                        ? bestGini._metrics.gini.toFixed(4)
                        : "N/A"}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="card">
            <div className="card-body text-center">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Highest liveness
              </h4>
              {(() => {
                const bestLiveness = results.reduce((best, current) =>
                  (current._metrics?.nakamoto_liveness ?? 0) >
                  (best._metrics?.nakamoto_liveness ?? 0)
                    ? current
                    : best
                );
                return (
                  <div>
                    <div className="flex items-center justify-center mb-1">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{
                          backgroundColor:
                            algorithmColors[bestLiveness.algorithm],
                        }}
                      />
                      <span className="font-medium">
                        {bestLiveness.algorithm}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      {bestLiveness._metrics?.nakamoto_liveness ?? "N/A"}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="card">
            <div className="card-body text-center">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Highest safety
              </h4>
              {(() => {
                const bestSafety = results.reduce((best, current) =>
                  (current._metrics?.nakamoto_safety ?? 0) >
                  (best._metrics?.nakamoto_safety ?? 0)
                    ? current
                    : best
                );
                return (
                  <div>
                    <div className="flex items-center justify-center mb-1">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{
                          backgroundColor:
                            algorithmColors[bestSafety.algorithm],
                        }}
                      />
                      <span className="font-medium">
                        {bestSafety.algorithm}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-purple-600">
                      {bestSafety._metrics?.nakamoto_safety ?? "N/A"}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonResults;
