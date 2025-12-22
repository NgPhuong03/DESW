import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const MetricsTable = ({ metrics, title = "Final metrics" }) => {
  if (!metrics) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-500">No metrics data</p>
      </div>
    );
  }

  const formatValue = (value, decimals = 4) => {
    if (typeof value !== "number") return "N/A";
    return value.toFixed(decimals);
  };

  const getMetricDescription = (key) => {
    const descriptions = {
      gini: "Gini coefficient (0 = perfect equality, 1 = max inequality)",
      nakamoto: "Nakamoto coefficient (validators needed to control 51%)",
      hhi: "HHI index (0 = fully dispersed, 1 = fully concentrated)",
      nakamoto_liveness: "Nakamoto Liveness (33% threshold)",
      nakamoto_liveness_pct: "Nakamoto Liveness (%)",
      nakamoto_safety: "Nakamoto Safety (66% threshold)",
      nakamoto_safety_pct: "Nakamoto Safety (%)",
      zipf: "Zipf coefficient (power distribution)",
      n_peers: "Number of validators",
    };
    return descriptions[key] || key;
  };

  const getMetricTrend = (key, value) => {
    // Define which metrics are "better" when lower vs higher
    const lowerIsBetter = ["gini", "hhi"];
    const higherIsBetter = ["nakamoto", "nakamoto_liveness", "nakamoto_safety", "n_peers"];

    if (lowerIsBetter.includes(key)) {
      if (value < 0.3)
        return { icon: TrendingUp, color: "text-green-500", label: "Good" };
      if (value > 0.7)
        return { icon: TrendingDown, color: "text-red-500", label: "Poor" };
      return { icon: Minus, color: "text-yellow-500", label: "Average" };
    }

    if (higherIsBetter.includes(key)) {
      if (value > 10)
        return { icon: TrendingUp, color: "text-green-500", label: "Good" };
      if (value < 5)
        return { icon: TrendingDown, color: "text-red-500", label: "Poor" };
      return { icon: Minus, color: "text-yellow-500", label: "Average" };
    }

    return { icon: Minus, color: "text-gray-500", label: "" };
  };

  const metricEntries = Object.entries(metrics).filter(
    ([key]) => !["theil", "palma", "shannon"].includes(key)
  );

  const metricRows = metricEntries.map(([key, value]) => {
    const trend = getMetricTrend(key, value);
    const TrendIcon = trend.icon;

    return {
      key,
      name: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      value: formatValue(value),
      description: getMetricDescription(key),
      trend,
      TrendIcon,
    };
  });

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      </div>
      <div className="card-body p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metric
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th> */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metricRows.map((row) => (
                <tr key={row.key} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {row.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-mono">
                      {row.value}
                    </div>
                  </td>
                  {/* <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <row.TrendIcon className={`w-4 h-4 mr-2 ${row.trend.color}`} />
                      <span className={`text-sm ${row.trend.color}`}>
                        {row.trend.label}
                      </span>
                    </div>
                  </td> */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">
                      {row.description}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MetricsTable;
