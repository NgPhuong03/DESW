import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ResultsChart = ({
  data,
  series,
  title,
  yAxisLabel,
  color = "#3b82f6",
  showPoints = false,
  fill = false,
  height = 400,
  totalEpochs,
}) => {
  const [isRendering, setIsRendering] = useState(true);

  // When inputs change, mark as "rendering" again
  useEffect(() => {
    setIsRendering(true);
  }, [data, series, title, yAxisLabel, color]);

  const hasSeries = Array.isArray(series) && series.length > 0;
  const primaryData = hasSeries ? series[0]?.data : data;

  if (!primaryData || primaryData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No data to display</p>
      </div>
    );
  }

  const sampleCount = primaryData.length;
  const effectiveTotalEpochs = totalEpochs || sampleCount;
  const epochs = primaryData.map((_, i) => {
    if (sampleCount <= 1) return 1;
    const ratio = i / (sampleCount - 1);
    return Math.round(ratio * (effectiveTotalEpochs - 1)) + 1;
  });

  const chartData = {
    labels: epochs,
    datasets: hasSeries
      ? series.map((s, index) => {
          const seriesData = s.data || [];
          return {
            label: s.label || `${title} ${index + 1}`,
            data: seriesData,
            borderColor: s.color || color,
            backgroundColor: fill ? `${s.color || color}20` : "transparent",
            borderWidth: 2,
            pointRadius: showPoints ? 2 : 0,
            pointHoverRadius: 4,
            fill: fill,
            tension: 0.1,
          };
        })
      : [
          {
            label: title,
            data,
            borderColor: color,
            backgroundColor: fill ? `${color}20` : "transparent",
            borderWidth: 2,
            pointRadius: showPoints ? 2 : 0,
            pointHoverRadius: 4,
            fill: fill,
            tension: 0.1,
          },
        ],
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
        borderColor: color,
        borderWidth: 1,
        callbacks: {
          label: function (context) {
            const epochLabel = context.label;
            return `Epoch ${epochLabel}: ${context.parsed.y.toFixed(4)}`;
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
    // When ChartJS finishes animation, turn off the "rendering" state
    animation: {
      onComplete: () => {
        // avoid setState in the middle of ChartJS rendering
        setTimeout(() => {
          setIsRendering(false);
        }, 0);
      },
    },
  };

  return (
    <div className="relative" style={{ height: `${height}px` }}>
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
          <p className="text-sm text-gray-500">Rendering chart...</p>
        </div>
      )}
      <Line data={chartData} options={options} />
    </div>
  );
};

export default ResultsChart;
