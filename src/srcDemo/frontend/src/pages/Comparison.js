import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Loader2, Plus, X } from "lucide-react";
import ParameterForm from "../components/ParameterForm";
import { comparisonAPI } from "../services/api";
import { useSession } from "../contexts/SessionContext";
import toast from "react-hot-toast";

const Comparison = () => {
  const navigate = useNavigate();
  const { sessionId } = useSession();
  const [isRunning, setIsRunning] = useState(false);
  const [comparisonName, setComparisonName] = useState("");
  const [comparisonDescription, setComparisonDescription] = useState("");
  const [selectedAlgorithms, setSelectedAlgorithms] = useState([
    "WEIGHTED",
    "DESW",
  ]);

  const algorithmOptions = [
    {
      value: "WEIGHTED",
      label: "Weighted (Standard weighting)",
      color: "#3b82f6",
    },
    {
      value: "OPPOSITE_WEIGHTED",
      label: "Opposite Weighted (Inverse weighting)",
      color: "#ef4444",
    },
    {
      value: "SRSW",
      label: "SRSW (Square Root Stake Weighting)",
      color: "#06b6d4",
    },
    {
      value: "LSW",
      label: "LSW (Logarithmic Stake Weighting)",
      color: "#f59e0b",
    },
    {
      value: "DESW",
      label: "DESW (Dynamic Exponential Stake Weighting)",
      color: "#8b5cf6",
    },

    { value: "RANDOM", label: "Random (Random selection)", color: "#f97316" },
  ];

  const handleAlgorithmToggle = (algorithm) => {
    setSelectedAlgorithms((prev) => {
      if (prev.includes(algorithm)) {
        return prev.filter((a) => a !== algorithm);
      } else {
        return [...prev, algorithm];
      }
    });
  };

  const handleRunComparison = async (baseParameters) => {
    if (!sessionId) {
      toast.error("Session error. Please reload the page.");
      return;
    }

    if (selectedAlgorithms.length < 2) {
      toast.error("Please select at least 2 algorithms to compare");
      return;
    }

    if (!comparisonName.trim()) {
      toast.error("Please enter a name for this comparison");
      return;
    }

    setIsRunning(true);

    try {
      const response = await comparisonAPI.runComparison(
        sessionId,
        comparisonName.trim(),
        comparisonDescription.trim(),
        baseParameters,
        selectedAlgorithms
      );

      const { comparisonId } = response.data;

      toast.success("Comparison started successfully!");

      // Navigate to comparison results page
      navigate(`/comparison-results/${comparisonId}`);
    } catch (error) {
      console.error("Error running comparison:", error);

      if (error.response?.data?.details) {
        toast.error(
          `Parameter error: ${error.response.data.details.join(", ")}`
        );
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error("Something went wrong while running the comparison");
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
              <BarChart3 className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                PoS model comparison
              </h1>
              <p className="text-gray-600">
                Compare multiple PoS stake-weighting models under the same
                parameters
              </p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            How it works
          </h3>
          <div className="text-blue-800 space-y-2">
            <p>
              • <strong>Select models:</strong> Choose at least 2 PoS
              stake-weighting models to compare
            </p>
            <p>
              • <strong>Shared parameters:</strong> All models use the same
              simulation parameters
            </p>
            <p>
              • <strong>Parallel runs:</strong> The system runs a simulation for
              each selected model
            </p>
            <p>
              • <strong>Compare results:</strong> Review charts and detailed
              comparison tables
            </p>
          </div>
        </div> */}

        {/* Running Status */}
        {isRunning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <Loader2 className="w-6 h-6 text-yellow-600 animate-spin mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-900">
                  Starting comparison...
                </h3>
                <p className="text-yellow-800">
                  Please wait a moment. You’ll be redirected to the results
                  page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Configuration */}
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Comparison setup
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="form-group">
                <label className="form-label">Comparison name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={comparisonName}
                  onChange={(e) => setComparisonName(e.target.value)}
                  placeholder="e.g. WEIGHTED vs DESW"
                  disabled={isRunning}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={comparisonDescription}
                  onChange={(e) => setComparisonDescription(e.target.value)}
                  placeholder="A short description of what you’re comparing"
                  disabled={isRunning}
                />
              </div>
            </div>

            {/* Algorithm Selection */}
            <div className="form-group">
              <label className="form-label">
                Select algorithms to compare (minimum 2)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {algorithmOptions.map((option) => {
                  const isSelected = selectedAlgorithms.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 hover:border-gray-300"
                      } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() =>
                        !isRunning && handleAlgorithmToggle(option.value)
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div
                            className="w-4 h-4 rounded-full mr-3"
                            style={{ backgroundColor: option.color }}
                          />
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {option.value}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {option.label.split("(")[1]?.replace(")", "") ||
                                option.label}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                            <Plus className="w-4 h-4 text-white rotate-45" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedAlgorithms.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Selected {selectedAlgorithms.length} algorithms:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAlgorithms.map((algorithm) => {
                      const option = algorithmOptions.find(
                        (opt) => opt.value === algorithm
                      );
                      return (
                        <span
                          key={algorithm}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800"
                        >
                          <div
                            className="w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: option?.color }}
                          />
                          {algorithm}
                          {!isRunning && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAlgorithmToggle(algorithm);
                              }}
                              className="ml-2 text-primary-600 hover:text-primary-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Parameter Form */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Shared simulation parameters
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              These parameters will be applied to all selected algorithms
            </p>
          </div>

          <ParameterForm
            onSubmit={handleRunComparison}
            disabled={isRunning}
            showModelSelect={false}
            initialValues={{
              // Override proof_of_stake since it will be set by algorithm selection
              proof_of_stake: "WEIGHTED", // This will be ignored
            }}
          />
        </div>

        {/* Tips */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Comparison ideas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <h4 className="font-semibold mb-2">Popular comparisons:</h4>
              <ul className="space-y-1">
                <li>• WEIGHTED vs DESW</li>
                <li>• DESW vs SRSW</li>
                <li>• LSW vs OPPOSITE_WEIGHTED</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Key metrics:</h4>
              <ul className="space-y-1">
                <li>• Gini: measures inequality</li>
                <li>• Nakamoto: measures decentralization</li>
                <li>• HHI: measures concentration</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Comparison;
