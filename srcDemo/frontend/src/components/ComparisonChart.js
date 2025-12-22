import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ComparisonChart = ({
  results,
  metric,
  title,
  yAxisLabel,
  height = 400,
  totalEpochs,
}) => {
  if (!results || results.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No data to display</p>
      </div>
    );
  }

  // Color palette for different algorithms
  const colors = [
    "#3b82f6", // Blue
    "#ef4444", // Red
    "#10b981", // Green
    "#f59e0b", // Yellow
    "#8b5cf6", // Purple
    "#06b6d4", // Cyan
    "#f97316", // Orange
  ];

  // Determine max length based on the longest series
  const maxLength = Math.max(
    ...results.map((r) => r.simulation_data?.[metric]?.length || 0)
  );

  // Backend chỉ trả về ~200 điểm đã được downsample.
  // Nếu biết tổng số epoch thực tế, map 200 điểm này đều lên [1, totalEpochs],
  // tương tự logic trong ResultsChart.
  const sampleCount = maxLength;
  const effectiveTotalEpochs = totalEpochs || sampleCount;
  const labels = Array.from({ length: sampleCount }, (_, i) => {
    if (sampleCount <= 1) return 1;
    const ratio = i / (sampleCount - 1);
    return Math.round(ratio * (effectiveTotalEpochs - 1)) + 1;
  });

  const datasets = results.map((result, index) => {
    const series = result.simulation_data?.[metric] || [];

    return {
      label: result.algorithm,
      data: series,
      borderColor: colors[index % colors.length],
      backgroundColor: "transparent",
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.1,
    };
  });

  const chartData = {
    labels,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: "bold",
        },
        padding: 20,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "white",
        bodyColor: "white",
        borderWidth: 1,
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(4)}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: "Epoch",
          font: {
            size: 14,
            weight: "bold",
          },
        },
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: yAxisLabel || title,
          font: {
            size: 14,
            weight: "bold",
          },
        },
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
        beginAtZero: true,
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
  };

  return (
    <div style={{ height: `${height}px` }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default ComparisonChart;
