import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Loader2 } from "lucide-react";
import ParameterForm from "../components/ParameterForm";
import { simulationAPI } from "../services/api";
import { useSession } from "../contexts/SessionContext";
import toast from "react-hot-toast";

const Simulation = () => {
  const navigate = useNavigate();
  const { sessionId } = useSession();
  const [isRunning, setIsRunning] = useState(false);

  const handleRunSimulation = async (parameters) => {
    if (!sessionId) {
      toast.error("Session error. Please reload the page.");
      return;
    }

    setIsRunning(true);

    try {
      const response = await simulationAPI.runSimulation(sessionId, parameters);
      const { simulationId } = response.data;

      toast.success("Simulation started successfully!");

      // Navigate to results page
      navigate(`/results/${simulationId}`);
    } catch (error) {
      console.error("Error running simulation:", error);

      if (error.response?.data?.details) {
        toast.error(
          `Parameter error: ${error.response.data.details.join(", ")}`
        );
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error("Something went wrong while running the simulation");
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
              <Play className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Single model simulation
              </h1>
              <p className="text-gray-600">
                Run a simulation with a specific PoS stake-weighting model
              </p>
            </div>
          </div>
        </div>

        {/* Info Card
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            How it works
          </h3>
          <div className="text-blue-800 space-y-2">
            <p>
              • <strong>Select a model:</strong> Choose the PoS stake-weighting
              model you want to simulate
            </p>
            <p>
              • <strong>Configure parameters:</strong> Tune simulation
              parameters to your needs
            </p>
            <p>
              • <strong>Run simulation:</strong> The system computes and
              displays results automatically
            </p>
            <p>
              • <strong>Analyze results:</strong> Review charts and detailed
              metrics
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
                  Starting simulation...
                </h3>
                <p className="text-yellow-800">
                  Please wait a moment. You’ll be redirected to the results
                  page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Parameter Form */}
        <div className="bg-white rounded-lg shadow-sm">
          <ParameterForm onSubmit={handleRunSimulation} disabled={isRunning} />
        </div>

        {/* Tips */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <h4 className="font-semibold mb-2">Recommended ranges:</h4>
              <ul className="space-y-1">
                <li>• Epochs: 1,000–10,000 for stable results</li>
                <li>• Validators: 50–500 for faster runs</li>
                <li>• Initial Gini: 0.2–0.5 is common</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Common models:</h4>
              <ul className="space-y-1">
                <li>
                  • <strong>WEIGHTED:</strong> Baseline model
                </li>
                <li>
                  • <strong>DESW:</strong> Dynamic Exponential Stake Weighting
                </li>
                <li>
                  • <strong>SRSW:</strong> Square Root Stake Weighting
                </li>
                <li>
                  • <strong>LSW:</strong> Logarithmic Stake Weighting
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Simulation;
