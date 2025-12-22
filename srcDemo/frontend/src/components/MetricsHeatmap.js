import React, { useState, useEffect } from "react";
import { Thermometer, Info, Download } from "lucide-react";
import { toast } from "react-hot-toast";

const MetricsHeatmap = ({ analysisResults, summaryStats }) => {
  const [heatmapData, setHeatmapData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState("gini_coefficient");
  const [colorScheme, setColorScheme] = useState("blue-red");

  // Available metrics
  const availableMetrics = {
    gini_coefficient: {
      name: "Gini coefficient",
      description: "Stake distribution inequality",
      format: (value) => value?.toFixed(3) || "N/A",
      isLowerBetter: true, // Lower Gini = better decentralization
    },
    nakamoto_coefficient: {
      name: "Nakamoto coefficient",
      description: "Validators needed to control 51%",
      format: (value) => Math.round(value) || "N/A",
      isLowerBetter: false, // Higher Nakamoto = better security
    },
    hhi_coefficient: {
      name: "HHI index",
      description: "Market concentration",
      format: (value) => value?.toFixed(4) || "N/A",
      isLowerBetter: true, // Lower HHI = less concentration
    },
    total_validators: {
      name: "Total validators",
      description: "Number of validators in the network",
      format: (value) => Math.round(value)?.toLocaleString() || "N/A",
      isLowerBetter: false, // More validators = better
    },
  };

  // Algorithm configurations
  const algorithmConfigs = {
    baseline: { name: "Baseline", shortName: "BASE" },
    srsw: { name: "SRSW", shortName: "SRSW" },
    lsw: { name: "LSW", shortName: "LSW" },
    desw: { name: "DESW", shortName: "DESW" },
  };

  // Color schemes
  const colorSchemes = {
    "blue-red": {
      name: "Blue–Red",
      colors: [
        "#1e40af",
        "#3b82f6",
        "#60a5fa",
        "#93c5fd",
        "#fecaca",
        "#f87171",
        "#ef4444",
        "#dc2626",
      ],
    },
    "green-red": {
      name: "Green–Red",
      colors: [
        "#166534",
        "#16a34a",
        "#22c55e",
        "#86efac",
        "#fecaca",
        "#f87171",
        "#ef4444",
        "#dc2626",
      ],
    },
    "purple-orange": {
      name: "Purple–Orange",
      colors: [
        "#581c87",
        "#7c3aed",
        "#a855f7",
        "#c084fc",
        "#fed7aa",
        "#fb923c",
        "#f97316",
        "#ea580c",
      ],
    },
  };

  // Process data for heatmap
  useEffect(() => {
    if (!analysisResults || !analysisResults.results) {
      setHeatmapData([]);
      return;
    }

    const processedData = [];
    const allValues = [];

    // Collect all values for normalization
    Object.entries(analysisResults.results).forEach(
      ([chainName, chainResult]) => {
        if (chainResult.analysis_results && !chainResult.error) {
          Object.entries(chainResult.analysis_results).forEach(
            ([algKey, algResult]) => {
              if (algResult && !algResult.error) {
                const value = algResult[selectedMetric];
                if (typeof value === "number" && !isNaN(value)) {
                  allValues.push(value);
                }
              }
            }
          );
        }
      }
    );

    if (allValues.length === 0) {
      setHeatmapData([]);
      return;
    }

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;

    // Process data with normalized values
    Object.entries(analysisResults.results).forEach(
      ([chainName, chainResult]) => {
        if (chainResult.analysis_results && !chainResult.error) {
          Object.entries(chainResult.analysis_results).forEach(
            ([algKey, algResult]) => {
              if (algResult && !algResult.error) {
                const value = algResult[selectedMetric];
                if (typeof value === "number" && !isNaN(value)) {
                  // Normalize value to 0-1 range
                  const normalizedValue =
                    range > 0 ? (value - minValue) / range : 0;

                  processedData.push({
                    blockchain:
                      chainName.charAt(0).toUpperCase() + chainName.slice(1),
                    algorithm: algKey,
                    value: value,
                    normalizedValue: normalizedValue,
                    displayValue:
                      availableMetrics[selectedMetric].format(value),
                  });
                }
              }
            }
          );
        }
      }
    );

    setHeatmapData(processedData);
  }, [analysisResults, selectedMetric]);

  // Get color for normalized value
  const getColor = (normalizedValue) => {
    const colors = colorSchemes[colorScheme].colors;
    const metric = availableMetrics[selectedMetric];

    // If lower is better, invert the color scale
    const adjustedValue = metric.isLowerBetter
      ? 1 - normalizedValue
      : normalizedValue;

    const colorIndex = Math.floor(adjustedValue * (colors.length - 1));
    return colors[Math.max(0, Math.min(colorIndex, colors.length - 1))];
  };

  // Get unique blockchains and algorithms
  const blockchains = [...new Set(heatmapData.map((d) => d.blockchain))].sort();
  const algorithms = Object.keys(algorithmConfigs);

  // Export heatmap data
  const exportHeatmapData = () => {
    if (!heatmapData.length) return;

    const csvData = [];
    csvData.push(["Blockchain", "Algorithm", "Value", "Metric"].join(","));

    heatmapData.forEach((item) => {
      csvData.push(
        [
          item.blockchain,
          algorithmConfigs[item.algorithm].name,
          item.value,
          availableMetrics[selectedMetric].name,
        ].join(",")
      );
    });

    const csvContent = csvData.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metrics_heatmap_${selectedMetric}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Heatmap data exported successfully!");
  };

  if (!analysisResults || !heatmapData.length) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Thermometer className="w-5 h-5 mr-2" />
          Metric heatmap comparison
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No data to display.</p>
          <p className="text-sm">Please run the analysis to see results.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <div className="flex items-center mb-4 lg:mb-0">
          <Thermometer className="w-5 h-5 mr-2 text-purple-600" />
          <div>
            <h3 className="text-lg font-semibold">Metric heatmap comparison</h3>
            <p className="text-sm text-gray-600">
              Visualize {availableMetrics[selectedMetric].name} across
              blockchains and algorithms
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={exportHeatmapData}
            className="flex items-center px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Metric:
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {Object.entries(availableMetrics).map(([key, metric]) => (
              <option key={key} value={key}>
                {metric.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color scheme:
          </label>
          <select
            value={colorScheme}
            onChange={(e) => setColorScheme(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {Object.entries(colorSchemes).map(([key, scheme]) => (
              <option key={key} value={key}>
                {scheme.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header row */}
          <div className="flex">
            <div className="w-24 h-12 flex items-center justify-center font-medium text-sm bg-gray-100 border border-gray-300">
              Blockchain
            </div>
            {algorithms.map((algKey) => (
              <div
                key={algKey}
                className="w-20 h-12 flex items-center justify-center font-medium text-sm bg-gray-100 border border-gray-300"
              >
                {algorithmConfigs[algKey].shortName}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {blockchains.map((blockchain) => (
            <div key={blockchain} className="flex">
              <div className="w-24 h-12 flex items-center justify-center font-medium text-sm bg-gray-50 border border-gray-300">
                {blockchain}
              </div>
              {algorithms.map((algKey) => {
                const dataPoint = heatmapData.find(
                  (d) => d.blockchain === blockchain && d.algorithm === algKey
                );

                const backgroundColor = dataPoint
                  ? getColor(dataPoint.normalizedValue)
                  : "#f3f4f6";
                const textColor =
                  dataPoint && dataPoint.normalizedValue > 0.5
                    ? "white"
                    : "black";

                return (
                  <div
                    key={`${blockchain}-${algKey}`}
                    className="w-20 h-12 flex items-center justify-center text-xs font-mono border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor, color: textColor }}
                    title={
                      dataPoint
                        ? `${blockchain} - ${algorithmConfigs[algKey].name}: ${dataPoint.displayValue}`
                        : "No data"
                    }
                  >
                    {dataPoint ? dataPoint.displayValue : "N/A"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Color legend */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium">Color scale:</span>
          <div className="flex items-center space-x-1">
            {colorSchemes[colorScheme].colors.map((color, index) => (
              <div
                key={index}
                className="w-6 h-4 border border-gray-300"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <span>
              {availableMetrics[selectedMetric].isLowerBetter ? "Good" : "Poor"}
            </span>
            <span>→</span>
            <span>
              {availableMetrics[selectedMetric].isLowerBetter ? "Poor" : "Good"}
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-purple-50 rounded-lg">
        <div className="flex items-start space-x-2">
          <Info className="w-4 h-4 text-purple-600 mt-0.5" />
          <div className="text-sm text-purple-800">
            <p className="font-medium mb-1">
              {availableMetrics[selectedMetric].name}:
            </p>
            <p>{availableMetrics[selectedMetric].description}</p>
            <p className="mt-1 text-xs">
              💡 Color{" "}
              {availableMetrics[selectedMetric].isLowerBetter
                ? "blue = better (lower value)"
                : "red = better (higher value)"}
              . Hover to see details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsHeatmap;
