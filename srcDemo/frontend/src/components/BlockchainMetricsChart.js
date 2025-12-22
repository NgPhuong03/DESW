import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  Download,
  Settings,
  BarChart3,
  TrendingUp,
  Target,
} from "lucide-react";
import { toast } from "react-hot-toast";

const BlockchainMetricsChart = ({ analysisResults, summaryStats }) => {
  const [selectedMetrics, setSelectedMetrics] = useState(["gini_coefficient"]);
  const [selectedAlgorithms, setSelectedAlgorithms] = useState([
    "baseline",
    "srsw",
    "lsw",
    "desw",
  ]);
  const [chartType, setChartType] = useState("bar");
  const [chartData, setChartData] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  // Available metrics for comparison
  const availableMetrics = {
    gini_coefficient: {
      name: "Gini coefficient",
      shortName: "Gini",
      description: "Measures inequality in stake distribution (0–1)",
      yAxisLabel: "Gini coefficient",
      format: (value) => value?.toFixed(3) || "N/A",
      range: [0, 1],
      color: "#8884d8",
    },
    nakamoto_coefficient: {
      name: "Nakamoto coefficient",
      shortName: "Nakamoto",
      description: "Validators required to control 51% of the network",
      yAxisLabel: "Validators",
      format: (value) => Math.round(value) || "N/A",
      range: [1, 100],
      color: "#82ca9d",
    },
    hhi_coefficient: {
      name: "HHI index",
      shortName: "HHI",
      description: "Herfindahl–Hirschman Index (concentration, 0–1)",
      yAxisLabel: "HHI index",
      format: (value) => value?.toFixed(4) || "N/A",
      range: [0, 1],
      color: "#ffc658",
    },
    total_validators: {
      name: "Total validators",
      shortName: "Validators",
      description: "Total number of validators in the network",
      yAxisLabel: "Validators",
      format: (value) => Math.round(value)?.toLocaleString() || "N/A",
      range: [0, 1000],
      color: "#ff7c7c",
    },
  };

  // Algorithm configurations (matching original analysis_chains colors)
  const algorithmConfigs = {
    baseline: {
      name: "Baseline (w=s)",
      shortName: "w=s G",
      color: "#407F7F",
      description: "Original stake weighting",
    },
    srsw: {
      name: "SRSW",
      shortName: "SRSW G*",
      color: "#A67F8E",
      description: "Square Root Stake Weighting",
    },
    lsw: {
      name: "LSW",
      shortName: "LSW G**",
      color: "#8B4F7F",
      description: "Logarithmic Stake Weighting",
    },
    desw: {
      name: "DESW",
      shortName: "DESW G***",
      color: "#F2B134",
      description: "Dynamic Exponential Stake Weighting",
    },
  };

  // Process data for chart
  useEffect(() => {
    if (!analysisResults || !analysisResults.results) {
      setChartData([]);
      return;
    }

    const processedData = [];

    Object.entries(analysisResults.results).forEach(
      ([chainName, chainResult]) => {
        if (chainResult.analysis_results && !chainResult.error) {
          const dataPoint = {
            blockchain: chainName.charAt(0).toUpperCase() + chainName.slice(1),
            chainName: chainName,
            fullName: chainName.toUpperCase(),
          };

          // Add data for selected algorithms and metrics
          selectedAlgorithms.forEach((algKey) => {
            const algResult = chainResult.analysis_results[algKey];
            if (algResult && !algResult.error) {
              selectedMetrics.forEach((metricKey) => {
                const key = `${algKey}_${metricKey}`;
                dataPoint[key] = algResult[metricKey] || 0;
              });
            }
          });

          processedData.push(dataPoint);
        }
      }
    );

    // Sort by blockchain name for consistent ordering
    processedData.sort((a, b) => a.blockchain.localeCompare(b.blockchain));
    setChartData(processedData);
  }, [analysisResults, selectedMetrics, selectedAlgorithms]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg max-w-xs">
          <p className="font-semibold text-gray-800 mb-2">{label}</p>
          {payload.map((entry, index) => {
            const [algKey, metricKey] = entry.dataKey.split("_");
            const algorithm = algorithmConfigs[algKey];
            const metric = availableMetrics[metricKey];

            return (
              <div
                key={index}
                className="flex items-center justify-between mb-1"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm font-medium">
                    {algorithm?.shortName} ({metric?.shortName})
                  </span>
                </div>
                <span className="text-sm font-mono">
                  {metric?.format(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Generate bars/lines for chart
  const generateChartElements = () => {
    const elements = [];

    selectedAlgorithms.forEach((algKey) => {
      const algorithm = algorithmConfigs[algKey];

      selectedMetrics.forEach((metricKey, metricIndex) => {
        const metric = availableMetrics[metricKey];
        const dataKey = `${algKey}_${metricKey}`;

        // Create unique color for each algorithm-metric combination
        const baseColor = algorithm.color;
        const opacity = 1 - metricIndex * 0.2; // Vary opacity for different metrics

        if (chartType === "bar") {
          elements.push(
            <Bar
              key={dataKey}
              dataKey={dataKey}
              fill={baseColor}
              fillOpacity={opacity}
              name={`${algorithm.shortName} (${metric.shortName})`}
              radius={[2, 2, 0, 0]}
            />
          );
        } else if (chartType === "line") {
          elements.push(
            <Line
              key={dataKey}
              type="monotone"
              dataKey={dataKey}
              stroke={baseColor}
              strokeWidth={3}
              strokeOpacity={opacity}
              dot={{ r: 4, fill: baseColor }}
              name={`${algorithm.shortName} (${metric.shortName})`}
            />
          );
        }
      });
    });

    return elements;
  };

  // Render bar chart
  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={500}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 40, bottom: 80 }}
        barCategoryGap="15%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="blockchain"
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={80}
          interval={0}
        />
        <YAxis
          label={{
            value:
              selectedMetrics.length === 1
                ? availableMetrics[selectedMetrics[0]].yAxisLabel
                : "Value",
            angle: -90,
            position: "insideLeft",
          }}
          tick={{ fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="rect" />
        {generateChartElements()}
      </BarChart>
    </ResponsiveContainer>
  );

  // Render line chart
  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={500}>
      <LineChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 40, bottom: 80 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="blockchain"
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={80}
          interval={0}
        />
        <YAxis
          label={{
            value:
              selectedMetrics.length === 1
                ? availableMetrics[selectedMetrics[0]].yAxisLabel
                : "Value",
            angle: -90,
            position: "insideLeft",
          }}
          tick={{ fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
        {generateChartElements()}
      </LineChart>
    </ResponsiveContainer>
  );

  // Export chart data as CSV
  const exportToCSV = () => {
    if (!chartData.length) return;

    const headers = ["Blockchain"];
    selectedAlgorithms.forEach((algKey) => {
      selectedMetrics.forEach((metricKey) => {
        const algorithm = algorithmConfigs[algKey];
        const metric = availableMetrics[metricKey];
        headers.push(`${algorithm.name} (${metric.name})`);
      });
    });

    const csvContent = [
      headers.join(","),
      ...chartData.map((row) => {
        const values = [row.fullName];
        selectedAlgorithms.forEach((algKey) => {
          selectedMetrics.forEach((metricKey) => {
            const key = `${algKey}_${metricKey}`;
            values.push(row[key] || 0);
          });
        });
        return values.join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blockchain_metrics_comparison_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exported successfully!");
  };

  if (!analysisResults || !chartData.length) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2" />
          Blockchain metrics comparison
        </h3>
        <div className="text-center py-12 text-gray-500">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
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
          <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold">
              Blockchain metrics comparison
            </h3>
            <p className="text-sm text-gray-600">
              Compare {selectedMetrics.length} metrics across {chartData.length}{" "}
              blockchains with {selectedAlgorithms.length} algorithms
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border">
          <h4 className="font-medium text-gray-800 mb-4">Chart settings</h4>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chart type:
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
              </select>
            </div>

            {/* Metrics Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Metrics:
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {Object.entries(availableMetrics).map(([key, metric]) => (
                  <label key={key} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMetrics([...selectedMetrics, key]);
                        } else {
                          setSelectedMetrics(
                            selectedMetrics.filter((m) => m !== key)
                          );
                        }
                      }}
                      className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {metric.name}
                  </label>
                ))}
              </div>
            </div>

            {/* Algorithms Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Algorithms:
              </label>
              <div className="space-y-2">
                {Object.entries(algorithmConfigs).map(([key, algorithm]) => (
                  <label key={key} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={selectedAlgorithms.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAlgorithms([...selectedAlgorithms, key]);
                        } else {
                          setSelectedAlgorithms(
                            selectedAlgorithms.filter((a) => a !== key)
                          );
                        }
                      }}
                      className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded mr-2"
                        style={{ backgroundColor: algorithm.color }}
                      />
                      {algorithm.name}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="w-full">
        {chartType === "bar" ? renderBarChart() : renderLineChart()}
      </div>

      {/* Chart Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start space-x-3">
          <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How to read this chart:</p>
            <ul className="space-y-1 text-xs">
              <li>
                • <strong>Lower Gini</strong> = more even stake distribution (better decentralization)
              </li>
              <li>
                • <strong>Higher Nakamoto</strong> = more validators needed to attack (better security)
              </li>
              <li>
                • <strong>Lower HHI</strong> = less concentration (better decentralization)
              </li>
              <li>• Hover to see detailed values</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockchainMetricsChart;
