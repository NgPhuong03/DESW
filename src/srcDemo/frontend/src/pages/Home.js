import React from "react";
import { Link } from "react-router-dom";
import {
  Play,
  BarChart3,
  History,
  Zap,
  Shield,
  TrendingUp,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const Home = () => {
  const features = [
    {
      icon: Zap,
      title: "Fast simulations",
      description:
        "Run PoS stake-weighting simulations with thousands of epochs in seconds",
    },
    {
      icon: Shield,
      title: "Multiple PoS models",
      description:
        "Study WEIGHTED, OPPOSITE, DESW, SRSW, LSW and more",
    },
    {
      icon: TrendingUp,
      title: "Decentralization metrics",
      description:
        "Track Gini, Nakamoto, HHI, Zipf and other key indicators over time",
    },
    {
      icon: BarChart3,
      title: "Visual comparisons",
      description: "Compare PoS model performance under the same parameters",
    },
  ];

  const algorithms = [
    { name: "WEIGHTED", description: "Standard stake-weighted selection" },
    {
      name: "OPPOSITE_WEIGHTED",
      description: "Inverse weighting to reduce inequality",
    },
    { name: "DESW", description: "Dynamic Exponential Stake Weighting" },
    { name: "SRSW", description: "Square Root Stake Weighting" },
    { name: "LSW", description: "Logarithmic Stake Weighting" },
    { name: "RANDOM", description: "Random validator selection" },
  ];

  const metrics = [
    "Gini coefficient",
    "Nakamoto coefficient",
    "HHI index",
    "Zipf coefficient",
    "Nakamoto Liveness/Safety",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
              <span className="text-primary-600">PoS-Analyzer</span>
              <br />
              <span className="text-2xl sm:text-4xl font-normal text-gray-600">
                PoS stake-weighting model simulator
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Study and compare different PoS stake-weighting models through
              detailed simulations, rich metrics and real blockchain data.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/simulation"
                className="btn btn-primary btn-lg inline-flex items-center"
              >
                <Play className="w-5 h-5 mr-2" />
                Start simulation
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>

              <Link
                to="/comparison"
                className="btn btn-outline btn-lg inline-flex items-center"
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                Compare models
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Key features
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A powerful tool to research and analyze PoS stake-weighting models
              across synthetic simulations and real-world blockchain datasets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                    <Icon className="w-8 h-8 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Workflows Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Choose your workflow
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Start with a single model simulation, run a full model comparison,
              or analyze real blockchain data — all within the same interface.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card h-full">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                    <Play className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Single model
                  </h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Configure parameters and run one PoS stake-weighting model to
                  see how stake distribution and decentralization evolve.
                </p>
                <Link
                  to="/simulation"
                  className="text-primary-600 text-sm font-medium inline-flex items-center"
                >
                  Go to simulation
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>

            <div className="card h-full">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                    <BarChart3 className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Model comparison
                  </h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Run the same scenario across multiple PoS models and compare
                  their impact on Gini, Nakamoto, HHI and Zipf metrics.
                </p>
                <Link
                  to="/comparison"
                  className="text-primary-600 text-sm font-medium inline-flex items-center"
                >
                  Go to comparison
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>

            <div className="card h-full">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                    <History className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    History & re-run
                  </h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Browse past simulations and comparisons, inspect parameters,
                  and quickly re-run or extend previous experiments.
                </p>
                <Link
                  to="/history"
                  className="text-primary-600 text-sm font-medium inline-flex items-center"
                >
                  View history
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>

            <div className="card h-full">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                    <BarChart3 className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Real data analysis
                  </h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Pull validator distributions from live PoS chains and compare
                  how different stake-weighting models would behave in practice.
                </p>
                <Link
                  to="/real-data"
                  className="text-primary-600 text-sm font-medium inline-flex items-center"
                >
                  Analyze real data
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Explore and compare PoS stake-weighting models to find the best fit
            for your project.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/simulation"
              className="btn bg-white text-primary-600 hover:bg-gray-50 btn-lg inline-flex items-center"
            >
              <Play className="w-5 h-5 mr-2" />
              Run your first simulation
            </Link>

            <Link
              to="/history"
              className="btn border-white text-white hover:bg-primary-700 btn-lg inline-flex items-center"
            >
              <History className="w-5 h-5 mr-2" />
              View history
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
