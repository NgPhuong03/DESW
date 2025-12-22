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
} from "recharts";

const MetricsComparisonChart = ({ analysisResults, summaryStats }) => {
  const [selectedMetric, setSelectedMetric] = useState("gini_coefficient");
  const [chartType, setChartType] = useState("bar");
  const [chartData, setChartData] = useState([]);

  // Available metrics for comparison
  const availableMetrics = {
    gini_coefficient: {
      name: "Gini coefficient",
      description: "Measures inequality in stake distribution (0–1)",
      yAxisLabel: "Gini coefficient",
      format: (value) => value?.toFixed(3) || "N/A",
      color: "#8884d8",
    },
    nakamoto_liveness: {
      name: "Nakamoto Liveness",
      description:
        "Validators required to reach 33% of total stake (network liveness)",
      yAxisLabel: "Validators (33%)",
      format: (value) => Math.round(value) || "N/A",
      color: "#22c55e",
    },
    nakamoto_safety: {
      name: "Nakamoto Safety",
      description:
        "Validators required to reach 66% of total stake (safety against attacks)",
      yAxisLabel: "Validators (66%)",
      format: (value) => Math.round(value) || "N/A",
      color: "#0ea5e9",
    },
    hhi_coefficient: {
      name: "HHI index",
      description: "Herfindahl–Hirschman Index (concentration, 0–1)",
      yAxisLabel: "HHI index",
      format: (value) => value?.toFixed(4) || "N/A",
      color: "#f97316",
    },
    zipf_coefficient: {
      name: "Zipf coefficient",
      description:
        "Log-log slope of stake distribution (power concentration at top validators)",
      yAxisLabel: "Zipf coefficient",
      format: (value) => value?.toFixed(4) || "N/A",
      color: "#a855f7",
    },
  };

  // Algorithm colors (matching the original chart style)
  const algorithmColors = {
    baseline: "#407F7F", // Teal
    srsw: "#A67F8E", // Purple-pink
    lsw: "#8B4F7F", // Purple
    desw: "#F2B134", // Orange/Gold
  };

  // Algorithm labels (matching original chart)
  const algorithmLabels = {
    baseline: "WEIGHTED",
    srsw: "SRSW",
    lsw: "LSW",
    desw: "DESW",
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
            blockchain: chainName.toUpperCase(),
            chainName: chainName,
          };

          // Add data for each algorithm
          Object.entries(chainResult.analysis_results).forEach(
            ([algKey, algResult]) => {
              if (!algResult.error) {
                dataPoint[algKey] = algResult[selectedMetric] || 0;
              }
            }
          );

          processedData.push(dataPoint);
        }
      }
    );

    // Sort by blockchain name for consistent ordering
    processedData.sort((a, b) => a.blockchain.localeCompare(b.blockchain));
    setChartData(processedData);
  }, [analysisResults, selectedMetric]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const metric = availableMetrics[selectedMetric];
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold text-gray-800">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${
                algorithmLabels[entry.dataKey] || entry.dataKey
              }: ${metric.format(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Render bar chart
  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={600}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        barCategoryGap="20%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="blockchain"
          tick={{ fontSize: 12 }}
          angle={0}
          textAnchor="middle"
          height={60}
        />
        <YAxis
          label={{
            value: availableMetrics[selectedMetric].yAxisLabel,
            angle: -90,
            position: "insideLeft",
          }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: "20px" }}
          formatter={(value) => algorithmLabels[value] || value}
        />

        {/* Bars for each algorithm */}
        <Bar
          dataKey="baseline"
          fill={algorithmColors.baseline}
          name="baseline"
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="srsw"
          fill={algorithmColors.srsw}
          name="srsw"
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="lsw"
          fill={algorithmColors.lsw}
          name="lsw"
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="desw"
          fill={algorithmColors.desw}
          name="desw"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  // Render line chart
  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="blockchain"
          tick={{ fontSize: 12 }}
          angle={0}
          textAnchor="middle"
          height={60}
        />
        <YAxis
          label={{
            value: availableMetrics[selectedMetric].yAxisLabel,
            angle: -90,
            position: "insideLeft",
          }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: "20px" }}
          formatter={(value) => algorithmLabels[value] || value}
        />

        {/* Lines for each algorithm */}
        <Line
          type="monotone"
          dataKey="baseline"
          stroke={algorithmColors.baseline}
          strokeWidth={3}
          dot={{ r: 4 }}
          name="baseline"
        />
        <Line
          type="monotone"
          dataKey="srsw"
          stroke={algorithmColors.srsw}
          strokeWidth={3}
          dot={{ r: 4 }}
          name="srsw"
        />
        <Line
          type="monotone"
          dataKey="lsw"
          stroke={algorithmColors.lsw}
          strokeWidth={3}
          dot={{ r: 4 }}
          name="lsw"
        />
        <Line
          type="monotone"
          dataKey="desw"
          stroke={algorithmColors.desw}
          strokeWidth={3}
          dot={{ r: 4 }}
          name="desw"
        />
      </LineChart>
    </ResponsiveContainer>
  );

  if (!analysisResults || !chartData.length) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          Metric comparison by algorithm
        </h3>
        <div className="text-center py-8 text-gray-500">
          No data to display. Please run the analysis first.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Metric comparison by algorithm
          </h3>
          <p className="text-sm text-gray-600">
            {availableMetrics[selectedMetric].description}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-4 lg:mt-0">
          {/* Metric selector */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">
              Metric:
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(availableMetrics).map(([key, metric]) => (
                <option key={key} value={key}>
                  {metric.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chart type selector */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">
              Chart type:
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full">
        {chartType === "bar" ? renderBarChart() : renderLineChart()}
      </div>

      {/* Summary stats for selected metric */}
      {/* {summaryStats && summaryStats.overall && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-3">
            Average value - {availableMetrics[selectedMetric].name}
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {Object.entries(algorithmColors).map(([algKey, color]) => {
              const avgValue =
                summaryStats.overall[`average_${selectedMetric}`]?.[algKey];
              return (
                <div key={algKey} className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="font-medium">
                    {algorithmLabels[algKey]}:
                  </span>
                  <span>
                    {availableMetrics[selectedMetric].format(avgValue)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )} */}

      {/* Chart info */}
      <div className="mt-4 text-xs text-gray-500">
        <p>
          This chart compares{" "}
          {availableMetrics[selectedMetric].name.toLowerCase()} across 4
          algorithms on {chartData.length} blockchains. Hover to see details.
        </p>
      </div>
    </div>
  );
};

export default MetricsComparisonChart;
