import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  History as HistoryIcon,
  Eye,
  Trash2,
  Clock,
  Users,
  BarChart3,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { simulationAPI, comparisonAPI } from "../services/api";
import { useSession } from "../contexts/SessionContext";
import toast from "react-hot-toast";

const History = () => {
  const { sessionId } = useSession();
  const [activeTab, setActiveTab] = useState("simulations");
  const [simulations, setSimulations] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const [simulationsRes, comparisonsRes] = await Promise.all([
        simulationAPI.getSessionSimulations(sessionId, 1, 50),
        comparisonAPI.getSessionComparisons(sessionId, 1, 50),
      ]);

      setSimulations(simulationsRes.data.simulations || []);
      setComparisons(comparisonsRes.data.comparisons || []);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Something went wrong while loading history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  const handleDeleteSimulation = async (id) => {
    if (!window.confirm("Are you sure you want to delete this simulation?"))
      return;

    try {
      await simulationAPI.deleteSimulation(id);
      setSimulations((prev) => prev.filter((sim) => sim._id !== id));
      toast.success("Simulation deleted");
    } catch (error) {
      console.error("Error deleting simulation:", error);
      toast.error("Something went wrong while deleting the simulation");
    }
  };

  const handleDeleteComparison = async (id) => {
    if (!window.confirm("Are you sure you want to delete this comparison?"))
      return;

    try {
      await comparisonAPI.deleteComparison(id);
      setComparisons((prev) => prev.filter((comp) => comp._id !== id));
      toast.success("Comparison deleted");
    } catch (error) {
      console.error("Error deleting comparison:", error);
      toast.error("Something went wrong while deleting the comparison");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: "badge badge-pending",
      running: "badge badge-running",
      completed: "badge badge-completed",
      failed: "badge badge-failed",
    };

    const labels = {
      pending: "Pending",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
    };

    return (
      <span className={badges[status] || "badge"}>
        {labels[status] || status}
      </span>
    );
  };

  const filteredSimulations = simulations.filter((sim) => {
    const matchesSearch = sim.parameters?.proof_of_stake
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || sim.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredComparisons = comparisons.filter((comp) => {
    const matchesSearch = comp.name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || comp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading history...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
              <HistoryIcon className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">History</h1>
              <p className="text-gray-600">
                Review your past simulations and comparisons
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by model name or comparison name..."
                  className="form-input pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="running">Running</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <button onClick={fetchData} className="btn btn-outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("simulations")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "simulations"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Simulations ({filteredSimulations.length})
            </button>
            <button
              onClick={() => setActiveTab("comparisons")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "comparisons"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Comparisons ({filteredComparisons.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === "simulations" && (
          <div className="space-y-4">
            {filteredSimulations.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No simulations yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your first simulation to get started
                </p>
                <Link to="/simulation" className="btn btn-primary">
                  New simulation
                </Link>
              </div>
            ) : (
              filteredSimulations.map((simulation) => (
                <div key={simulation._id} className="card">
                  <div className="card-body">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {simulation.parameters?.proof_of_stake ||
                              "Unknown model"}
                          </h3>
                          {getStatusBadge(simulation.status)}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Epochs:</span>{" "}
                            {simulation.parameters?.n_epochs?.toLocaleString() ||
                              "N/A"}
                          </div>
                          <div>
                            <span className="font-medium">Validators:</span>{" "}
                            {simulation.parameters?.n_peers || "N/A"}
                          </div>
                          <div>
                            <span className="font-medium">Time:</span>{" "}
                            {simulation.execution_time
                              ? `${simulation.execution_time}ms`
                              : "N/A"}
                          </div>
                          <div>
                            <span className="font-medium">Created:</span>{" "}
                            {new Date(simulation.created_at).toLocaleDateString(
                              "en-US"
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {simulation.status === "completed" && (
                          <Link
                            to={`/results/${simulation._id}`}
                            className="btn btn-outline btn-sm"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Link>
                        )}

                        <button
                          onClick={() => handleDeleteSimulation(simulation._id)}
                          className="btn btn-outline btn-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "comparisons" && (
          <div className="space-y-4">
            {filteredComparisons.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No comparisons yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Start comparing PoS stake-weighting models
                </p>
                <Link to="/comparison" className="btn btn-primary">
                  New comparison
                </Link>
              </div>
            ) : (
              filteredComparisons.map((comparison) => (
                <div key={comparison._id} className="card">
                  <div className="card-body">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {comparison.name || "Unnamed Comparison"}
                          </h3>
                          {getStatusBadge(comparison.status)}
                        </div>

                        <div className="mb-2">
                          <div className="flex flex-wrap gap-1">
                            {comparison.algorithms_to_compare?.map(
                              (algorithm) => (
                                <span
                                  key={algorithm}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800"
                                >
                                  {algorithm}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Models:</span>{" "}
                            {comparison.algorithms_to_compare?.length || 0}
                          </div>
                          <div>
                            <span className="font-medium">Time:</span>{" "}
                            {comparison.total_execution_time
                              ? `${(
                                  comparison.total_execution_time / 1000
                                ).toFixed(1)}s`
                              : "N/A"}
                          </div>
                          <div>
                            <span className="font-medium">Created:</span>{" "}
                            {new Date(comparison.created_at).toLocaleDateString(
                              "en-US"
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {comparison.status === "completed" && (
                          <Link
                            to={`/comparison-results/${comparison._id}`}
                            className="btn btn-outline btn-sm"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Link>
                        )}

                        <button
                          onClick={() => handleDeleteComparison(comparison._id)}
                          className="btn btn-outline btn-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
