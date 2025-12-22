import React, { useState, useEffect } from "react";
import { Info, AlertCircle, CheckCircle } from "lucide-react";
import { simulationAPI } from "../services/api";
import toast from "react-hot-toast";

const ParameterForm = ({
  onSubmit,
  initialValues = {},
  disabled = false,
  showModelSelect = true,
}) => {
  const [parameters, setParameters] = useState({
    n_epochs: 1000,
    proof_of_stake: "WEIGHTED",
    initial_stake_volume: 10000,
    initial_distribution: "GINI",
    initial_gini: 0.3,
    n_peers: 100,
    n_corrupted: 5,
    p_fail: 0.5,
    p_join: 0.001,
    p_leave: 0.001,
    join_amount: "NEW_RANDOM",
    penalty_percentage: 0.5,
    theta: 0.3,
    s_type: "LINEAR",
    k: 0.001,
    reward: 10.0,
    use_dynamic_reward: true,
    p_sybil: 0.0,
    min_sybil_size: 2,
    max_sybil_size: 5,
    scheduled_joins: [],
    scheduled_sybil_attacks: [],
    ...initialValues,
  });

  const [validation, setValidation] = useState({ valid: true, errors: [] });
  const [isValidating, setIsValidating] = useState(false);

  // Algorithm options
  const algorithmOptions = [
    { value: "WEIGHTED", label: "Weighted (Standard weighting)" },
    {
      value: "OPPOSITE_WEIGHTED",
      label: "Opposite Weighted (Inverse weighting)",
    },
    { value: "LOG_WEIGHTED", label: "Log Weighted (Logarithmic weighting)" },
    { value: "DESW", label: "DESW (Dynamic Exponential Stake Weighting)" },
    {
      value: "SRSW_WEIGHTED",
      label: "SRSW Weighted (Square Root Stake Weighting)",
    },
    { value: "RANDOM", label: "Random (Random selection)" },
  ];

  const distributionOptions = [
    { value: "UNIFORM", label: "Uniform (Even distribution)" },
    { value: "GINI", label: "Gini (By Gini coefficient)" },
    { value: "RANDOM", label: "Random (Random distribution)" },
  ];

  const joinAmountOptions = [
    { value: "NEW_MAX", label: "Maximum (Largest stake)" },
    { value: "NEW_MIN", label: "Minimum (Smallest stake)" },
    { value: "NEW_AVERAGE", label: "Average (Average stake)" },
    { value: "NEW_RANDOM", label: "Random (Random stake)" },
  ];

  const sTypeOptions = [
    { value: "CONSTANT", label: "Constant" },
    { value: "LINEAR", label: "Linear" },
    { value: "QUADRATIC", label: "Quadratic" },
    { value: "SQRT", label: "Square Root" },
  ];

  // Validate parameters when they change
  useEffect(() => {
    const validateParams = async () => {
      setIsValidating(true);
      try {
        const response = await simulationAPI.validateParameters(parameters);
        console.log("validateParams ", response.data);
        setValidation({ valid: response.data.valid, errors: [] });
      } catch (error) {
        if (error.response?.data?.errors) {
          setValidation({ valid: false, errors: error.response.data.errors });
        } else {
          setValidation({ valid: false, errors: ["Validation error"] });
        }
      } finally {
        setIsValidating(false);
      }
    };

    const debounceTimer = setTimeout(validateParams, 500);
    return () => clearTimeout(debounceTimer);
  }, [parameters]);

  const handleChange = (field, value) => {
    setParameters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validation.valid && onSubmit) {
      onSubmit(parameters);
    } else {
      toast.error("Please review your parameters");
    }
  };

  // Scheduled joins management
  const [newJoin, setNewJoin] = useState({ epoch: "", stake: "" });

  const addScheduledJoin = () => {
    const epoch = parseInt(newJoin.epoch);
    const stake = parseFloat(newJoin.stake);

    if (isNaN(epoch) || isNaN(stake) || epoch < 0 || stake <= 0) {
      toast.error("Please enter a valid epoch and stake amount");
      return;
    }

    const scheduledJoins = [...parameters.scheduled_joins, { epoch, stake }];
    scheduledJoins.sort((a, b) => a.epoch - b.epoch);

    handleChange("scheduled_joins", scheduledJoins);
    setNewJoin({ epoch: "", stake: "" });
    toast.success("Scheduled join added");
  };

  const removeScheduledJoin = (index) => {
    const scheduledJoins = parameters.scheduled_joins.filter(
      (_, i) => i !== index
    );
    handleChange("scheduled_joins", scheduledJoins);
    toast.success("Scheduled join removed");
  };

  const resetToDefaults = () => {
    setParameters({
      n_epochs: 1000,
      proof_of_stake: "WEIGHTED",
      initial_stake_volume: 10000,
      initial_distribution: "GINI",
      initial_gini: 0.3,
      n_peers: 100,
      n_corrupted: 5,
      p_fail: 0.5,
      p_join: 0.001,
      p_leave: 0.001,
      join_amount: "NEW_RANDOM",
      penalty_percentage: 0.5,
      theta: 0.3,
      s_type: "LINEAR",
      k: 0.001,
      reward: 10.0,
      use_dynamic_reward: true,
      p_sybil: 0.0,
      min_sybil_size: 2,
      max_sybil_size: 5,
      scheduled_joins: [],
      scheduled_sybil_attacks: [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Validation Status */}
      {!validation.valid && validation.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Parameter errors
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5 space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {validation.valid && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Parameters look good
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cards layout – xếp ngang trên màn hình lớn */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Basic Parameters */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Basic parameters
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">
                  Epochs
                  <Info className="inline w-4 h-4 ml-1 text-gray-400" />
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={parameters.n_epochs}
                  onChange={(e) =>
                    handleChange("n_epochs", parseInt(e.target.value))
                  }
                  min="1"
                  max="100000"
                  disabled={disabled}
                />
              </div>

              {showModelSelect && (
                <div className="form-group">
                  <label className="form-label">
                    PoS stake-weighting model
                  </label>
                  <select
                    className="form-select"
                    value={parameters.proof_of_stake}
                    onChange={(e) =>
                      handleChange("proof_of_stake", e.target.value)
                    }
                    disabled={disabled}
                  >
                    {algorithmOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Total initial stake</label>
                <input
                  type="number"
                  className="form-input"
                  value={parameters.initial_stake_volume}
                  onChange={(e) =>
                    handleChange(
                      "initial_stake_volume",
                      parseFloat(e.target.value)
                    )
                  }
                  min="0"
                  step="0.01"
                  disabled={disabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial distribution</label>
                <select
                  className="form-select"
                  value={parameters.initial_distribution}
                  onChange={(e) =>
                    handleChange("initial_distribution", e.target.value)
                  }
                  disabled={disabled}
                >
                  {distributionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {parameters.initial_distribution === "GINI" && (
                <div className="form-group">
                  <label className="form-label">Initial Gini</label>
                  <input
                    type="number"
                    className="form-input"
                    value={parameters.initial_gini}
                    onChange={(e) =>
                      handleChange("initial_gini", parseFloat(e.target.value))
                    }
                    min="0"
                    max="1"
                    step="0.01"
                    disabled={disabled}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Validators</label>
                <input
                  type="number"
                  className="form-input"
                  value={parameters.n_peers}
                  onChange={(e) =>
                    handleChange("n_peers", parseInt(e.target.value))
                  }
                  min="1"
                  max="10000"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Network Parameters */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Network parameters
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Corrupted validators</label>
                <input
                  type="number"
                  className="form-input"
                  value={parameters.n_corrupted}
                  onChange={(e) =>
                    handleChange("n_corrupted", parseInt(e.target.value))
                  }
                  min="0"
                  max={parameters.n_peers}
                  disabled={disabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Failure probability (p_fail)
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={parameters.p_fail}
                  onChange={(e) =>
                    handleChange("p_fail", parseFloat(e.target.value))
                  }
                  min="0"
                  max="1"
                  step="0.01"
                  disabled={disabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Join probability (p_join)</label>
                <input
                  type="number"
                  className="form-input"
                  value={parameters.p_join}
                  onChange={(e) =>
                    handleChange("p_join", parseFloat(e.target.value))
                  }
                  min="0"
                  max="1"
                  step="0.001"
                  disabled={disabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Leave probability (p_leave)
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={parameters.p_leave}
                  onChange={(e) =>
                    handleChange("p_leave", parseFloat(e.target.value))
                  }
                  min="0"
                  max="1"
                  step="0.001"
                  disabled={disabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Join stake type</label>
                <select
                  className="form-select"
                  value={parameters.join_amount}
                  onChange={(e) => handleChange("join_amount", e.target.value)}
                  disabled={disabled}
                >
                  {joinAmountOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Penalty rate</label>
                <input
                  type="number"
                  className="form-input"
                  value={parameters.penalty_percentage}
                  onChange={(e) =>
                    handleChange(
                      "penalty_percentage",
                      parseFloat(e.target.value)
                    )
                  }
                  min="0"
                  max="1"
                  step="0.01"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Reward Parameters */}
        <div className="card flex flex-col">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Reward parameters
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Rewards received when the validator is selected
            </p>
          </div>
          <div className="card-body flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Base reward</label>
                <input
                  type="number"
                  className="form-input"
                  value={parameters.reward}
                  onChange={(e) =>
                    handleChange("reward", parseFloat(e.target.value))
                  }
                  min="0"
                  step="0.01"
                  disabled={disabled}
                />
              </div>

              <div className="form-group flex flex-col justify-end">
                <label className="form-label flex items-center mb-0">
                  <input
                    type="checkbox"
                    className="form-checkbox mr-2"
                    checked={parameters.use_dynamic_reward}
                    onChange={(e) =>
                      handleChange("use_dynamic_reward", e.target.checked)
                    }
                    disabled={disabled}
                  />
                  Use dynamic reward
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Scheduled Joins */}
        <div className="card flex flex-col">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Scheduled joins
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Schedule new validators to join at specific epochs
            </p>
          </div>
          <div className="card-body flex-1">
            {/* Add new scheduled join */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label">Epoch</label>
                <input
                  type="number"
                  className="form-input"
                  value={newJoin.epoch}
                  onChange={(e) =>
                    setNewJoin((prev) => ({ ...prev, epoch: e.target.value }))
                  }
                  placeholder="Epoch tham gia"
                  min="0"
                  disabled={disabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Stake</label>
                <input
                  type="number"
                  className="form-input"
                  value={newJoin.stake}
                  onChange={(e) =>
                    setNewJoin((prev) => ({ ...prev, stake: e.target.value }))
                  }
                  placeholder="Stake amount"
                  min="0"
                  step="0.01"
                  disabled={disabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">&nbsp;</label>
                <button
                  type="button"
                  onClick={addScheduledJoin}
                  className="btn btn-primary w-full"
                  disabled={disabled || !newJoin.epoch || !newJoin.stake}
                >
                  Add
                </button>
              </div>
            </div>

            {/* List of scheduled joins */}
            {parameters.scheduled_joins.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">
                  Scheduled joins:
                </h4>
                {parameters.scheduled_joins.map((join, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                  >
                    <div className="text-sm">
                      <span className="font-medium">Epoch {join.epoch}:</span>{" "}
                      {join.stake} stake
                    </div>
                    <button
                      type="button"
                      onClick={() => removeScheduledJoin(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                      disabled={disabled}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Algorithm-specific Parameters */}

      {/* Sybil Attack Parameters */}
      {/* <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">
            Sybil attack parameters
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Sybil attack probability</label>
              <input
                type="number"
                className="form-input"
                value={parameters.p_sybil}
                onChange={(e) =>
                  handleChange("p_sybil", parseFloat(e.target.value))
                }
                min="0"
                max="1"
                step="0.001"
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Minimum validators per split</label>
              <input
                type="number"
                className="form-input"
                value={parameters.min_sybil_size}
                onChange={(e) =>
                  handleChange("min_sybil_size", parseInt(e.target.value))
                }
                min="2"
                disabled={disabled}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Maximum validators per split</label>
              <input
                type="number"
                className="form-input"
                value={parameters.max_sybil_size}
                onChange={(e) =>
                  handleChange("max_sybil_size", parseInt(e.target.value))
                }
                min={parameters.min_sybil_size}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div> */}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="submit"
          disabled={disabled || !validation.valid || isValidating}
          className="btn btn-primary btn-lg flex-1"
        >
          {disabled ? "Running..." : "Run simulation"}
        </button>

        <button
          type="button"
          onClick={resetToDefaults}
          disabled={disabled}
          className="btn btn-outline"
        >
          Reset to defaults
        </button>
      </div>
    </form>
  );
};

export default ParameterForm;
