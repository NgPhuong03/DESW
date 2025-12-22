import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import ResultsChart from "../components/ResultsChart";
import MetricsTable from "../components/MetricsTable";
import { simulationAPI } from "../services/api";
import toast from "react-hot-toast";

// Polling config for status check
const INITIAL_STATUS_POLL_INTERVAL = 2000; // 2s
const MAX_STATUS_POLL_INTERVAL = 30000; // 30s
const MAX_STATUS_POLL_DURATION = 10 * 60 * 1000; // 10 minutes

// Helper to format elapsed seconds into a readable string
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return "0s";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins <= 0) {
    return `${secs}s`;
  }

  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
};

const Results = () => {
  const { id } = useParams();
  const [simulation, setSimulation] = useState(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusInfo, setStatusInfo] = useState({
    status: null,
    progress: 0,
    createdAt: null,
  });
  const [now, setNow] = useState(Date.now());

  // Status polling control
  const pollIntervalRef = useRef(INITIAL_STATUS_POLL_INTERVAL);
  const pollTimeoutRef = useRef(null);
  const pollStartTimeRef = useRef(null);

  const scheduleNextStatusCheck = () => {
    const now = Date.now();

    if (!pollStartTimeRef.current) {
      pollStartTimeRef.current = now;
    }

    const elapsed = now - pollStartTimeRef.current;

    // Stop auto-polling if running too long to avoid spamming the API
    if (elapsed > MAX_STATUS_POLL_DURATION) {
      setError(
        "This simulation is taking longer than expected. Please click 'Retry' to refresh the status."
      );
      setLoading(false);
      return;
    }

    const delay = pollIntervalRef.current;

    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      checkStatus();
    }, delay);
  };

  const fetchSimulation = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true);

      const response = await simulationAPI.getSimulationResults(id);
      console.log("data: ", response.data);
      setSimulation(response.data);
      setError(null);

      if (showRefreshToast) {
        toast.success("Results updated");
      }

      setLoading(false);
      return true;
    } catch (err) {
      console.error("Error fetching simulation:", err);

      if (err.response?.status === 404) {
        setError("Simulation not found");
        setLoading(false);
      } else if (err.response?.status === 400) {
      } else {
        setError("Something went wrong while loading results");
        setLoading(false);
      }
    } finally {
      setRefreshing(false);
    }
    return false;
  };

  const checkStatus = async () => {
    try {
      const response = await simulationAPI.getSimulationStatus(id);
      const status = response.data;

      setStatusInfo({
        status: status.status,
        progress: status.progress ?? 0,
        createdAt: status.created_at || null,
      });

      if (status.status === "completed") {
        fetchSimulation();
      } else if (status.status === "failed") {
        setError(`Simulation failed: ${status.error_message}`);
        setLoading(false);
      }
      // Continue polling if still running
      else if (status.status === "running" || status.status === "pending") {
        // Gradually increase delay between polls to reduce request volume
        pollIntervalRef.current = Math.min(
          pollIntervalRef.current * 1.5,
          MAX_STATUS_POLL_INTERVAL
        );
        scheduleNextStatusCheck();
      }
    } catch (err) {
      console.error("Error checking status:", err);
      setError("Something went wrong while checking status");
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset polling state when the simulation id changes
    pollIntervalRef.current = INITIAL_STATUS_POLL_INTERVAL;
    pollStartTimeRef.current = null;
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }

    setLoading(true);
    setError(null);
    setStatusInfo({
      status: null,
      progress: 0,
      createdAt: null,
    });
    setNow(Date.now());

    const tryFetchFirst = async () => {
      const success = await fetchSimulation(false);
      if (!success) {
        checkStatus();
      }
    };

    tryFetchFirst();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [id]);

  // Update current time every second while running to compute elapsed time
  useEffect(() => {
    const isRunning =
      statusInfo.status === "running" || statusInfo.status === "pending";

    if (!loading || error || !isRunning) {
      return;
    }

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [loading, error, statusInfo.status]);

  const handleRefresh = () => {
    fetchSimulation(true);
  };

  const handleDownload = () => {
    if (!simulation?.results) return;

    const data = {
      simulation_id: id,
      parameters: simulation.parameters,
      results: simulation.results,
      execution_time: simulation.execution_time,
      completed_at: simulation.completed_at,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation_${id}_results.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Results downloaded");
  };

  if (loading) {
    let elapsedSeconds = 0;
    if (statusInfo.createdAt) {
      const createdAtMs = new Date(statusInfo.createdAt).getTime();
      elapsedSeconds = Math.max(0, Math.floor((now - createdAtMs) / 1000));
    }

    const progressPercent = Math.round(statusInfo.progress || 0);

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Running simulation...
          </h2>
          <p className="text-gray-600 mb-2">
            Please wait. This page will update automatically when it finishes.
          </p>
          <div className="mt-4 inline-flex flex-col items-center bg-white rounded-lg shadow px-4 py-3">
            <div className="w-64 bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden">
              <div
                className="bg-primary-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-gray-700 font-medium mb-1">
              Progress: {progressPercent}%
            </p>
            <p className="text-xs text-gray-500">
              Elapsed: {formatDuration(elapsedSeconds)}
            </p>
          </div>
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
            <Link to="/simulation" className="btn btn-outline w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to simulation
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!simulation) {
    return null;
  }

  const { parameters, results, execution_time, completed_at } = simulation;

  // Normalize results to ensure FE always has arrays (avoid undefined)
  const normalizedResults_1 = {
    ...results,
    gini_history: results?.gini_history || [],
    hhi_history: results?.hhi_history || [],
    nakamoto_liveness_history: results?.nakamoto_liveness_history || [],
    nakamoto_safety_history: results?.nakamoto_safety_history || [],
    zipf_history: results?.zipf_history || [],
  };

  const normalizedResults = {
    ...normalizedResults_1,
    final_metrics: {
      gini: normalizedResults_1.gini_history[
        normalizedResults_1.gini_history.length - 1
      ],
      hhi: normalizedResults_1.hhi_history[
        normalizedResults_1.hhi_history.length - 1
      ],
      nakamoto_liveness:
        normalizedResults_1.nakamoto_liveness_history[
          normalizedResults_1.nakamoto_liveness_history.length - 1
        ],
      nakamoto_safety:
        normalizedResults_1.nakamoto_safety_history[
          normalizedResults_1.nakamoto_safety_history.length - 1
        ],
      zipf: normalizedResults_1.zipf_history[
        normalizedResults_1.zipf_history.length - 1
      ],
    },
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
                <h1 className="text-3xl font-bold text-gray-900">
                  Simulation results
                </h1>
                <div className="flex items-center text-gray-600 mt-1">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  <span>Completed</span>
                  <Clock className="w-4 h-4 ml-4 mr-2" />
                  <span>{execution_time}ms</span>
                </div>
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

          {/* Simulation Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">PoS model</h3>
                <p className="text-lg font-semibold text-gray-900">
                  {parameters.proof_of_stake}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Epochs</h3>
                <p className="text-lg font-semibold text-gray-900">
                  {parameters.n_epochs.toLocaleString()}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Validators
                </h3>
                <p className="text-lg font-semibold text-gray-900">
                  {parameters.n_peers}
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

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-700">
              <div>
                <span className="font-medium">Initial stake:</span>{" "}
                {parameters.initial_stake_volume?.toLocaleString() ?? "N/A"}
              </div>
              <div>
                <span className="font-medium">Initial distribution:</span>{" "}
                {parameters.initial_distribution ?? "N/A"}
              </div>
              {parameters.initial_distribution === "GINI" && (
                <div>
                  <span className="font-medium">Initial Gini:</span>{" "}
                  {parameters.initial_gini != null
                    ? parameters.initial_gini.toFixed(3)
                    : "N/A"}
                </div>
              )}
              <div>
                <span className="font-medium">Corrupted validators:</span>{" "}
                {parameters.n_corrupted ?? "N/A"}
              </div>
              <div>
                <span className="font-medium">p_fail:</span>{" "}
                {parameters.p_fail != null ? parameters.p_fail : "N/A"}
              </div>
              <div>
                <span className="font-medium">p_join:</span>{" "}
                {parameters.p_join != null ? parameters.p_join : "N/A"}
              </div>
              <div>
                <span className="font-medium">p_leave:</span>{" "}
                {parameters.p_leave != null ? parameters.p_leave : "N/A"}
              </div>
              <div>
                <span className="font-medium">Join amount:</span>{" "}
                {parameters.join_amount ?? "N/A"}
              </div>
              <div>
                <span className="font-medium">Reward:</span>{" "}
                {parameters.reward != null ? parameters.reward : "N/A"}
              </div>
              <div>
                <span className="font-medium">Dynamic reward:</span>{" "}
                {parameters.use_dynamic_reward ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-medium">Penalty %:</span>{" "}
                {parameters.penalty_percentage != null
                  ? parameters.penalty_percentage
                  : "N/A"}
              </div>
            </div>

            {Array.isArray(parameters.scheduled_joins) &&
              parameters.scheduled_joins.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Scheduled joins
                  </h4>
                  <div className="space-y-2">
                    {parameters.scheduled_joins.map((join, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 p-3 rounded-lg text-sm text-gray-800"
                      >
                        <span>
                          Epoch {join.epoch}: {join.stake} stake
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Final Metrics */}
        <div className="mb-8">
          <MetricsTable metrics={normalizedResults.final_metrics} />
        </div>

        {/* Charts: Gini & HHI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">
                Gini coefficient over time
              </h3>
            </div>
            <div className="card-body">
              <ResultsChart
                data={normalizedResults.gini_history}
                title="Gini coefficient"
                yAxisLabel="Gini Coefficient"
                color="#ef4444"
                totalEpochs={parameters.n_epochs}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">
                HHI index over time
              </h3>
            </div>
            <div className="card-body">
              <ResultsChart
                data={normalizedResults.hhi_history}
                title="HHI index"
                yAxisLabel="HHI Index"
                color="#f59e0b"
                totalEpochs={parameters.n_epochs}
              />
            </div>
          </div>
        </div>

        {/* Liveness + Safety (combined) / Zipf */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">
                Nakamoto Liveness & Safety over time
              </h3>
            </div>
            <div className="card-body">
              <ResultsChart
                series={[
                  {
                    label: "Nakamoto Liveness",
                    data: normalizedResults.nakamoto_liveness_history,
                    color: "#22c55e",
                  },
                  {
                    label: "Nakamoto Safety",
                    data: normalizedResults.nakamoto_safety_history,
                    color: "#3b82f6",
                  },
                ]}
                title="Nakamoto Liveness & Safety"
                yAxisLabel="Nakamoto Coefficient"
                totalEpochs={parameters.n_epochs}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">
                Zipf coefficient over time
              </h3>
            </div>
            <div className="card-body">
              <ResultsChart
                data={normalizedResults.zipf_history}
                title="Zipf coefficient"
                yAxisLabel="Zipf"
                color="#ec4899"
                totalEpochs={parameters.n_epochs}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
