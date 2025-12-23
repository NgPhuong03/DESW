import React, { useState, useEffect } from "react";
import { Info, AlertCircle, CheckCircle } from "lucide-react";
import { simulationAPI } from "../services/api";
import toast from "react-hot-toast";
import Tooltip from "./Tooltip";

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

  // Parameter descriptions for tooltips
  const parameterDescriptions = {
    n_epochs:
      "Number of epochs (cycles) in the simulation. Each epoch represents one validator selection round. Higher values provide more stable results but take longer.",
    proof_of_stake:
      "PoS stake-weighting algorithm to use:\n• WEIGHTED: Standard stake-weighted selection\n• DESW: Dynamic exponential weighting based on Gini\n• SRSW: Square root of stake weighting\n• LSW: Logarithmic stake weighting\n• OPPOSITE_WEIGHTED: Inverse weighting\n• RANDOM: Random selection",
    initial_stake_volume:
      "Total initial stake distributed to all validators. This value determines the overall scale of the system. Stake is distributed according to initial distribution.",
    initial_distribution:
      "Method for distributing initial stake:\n• UNIFORM: Even distribution to all validators\n• GINI: Distribution based on Gini coefficient (inequality)\n• RANDOM: Random distribution",
    initial_gini:
      "Initial Gini coefficient (0-1). Value 0 = perfectly equal distribution, 1 = completely unequal. Only applies when Initial distribution = GINI.",
    n_peers:
      "Initial number of validators in the network. Higher values simulate larger networks but run slower.",
    n_corrupted:
      "Number of corrupted validators (malicious actors). These validators may fail or attack the network. Must be less than or equal to total validators.",
    p_fail:
      "Probability that a corrupted validator will fail in each epoch (0-1). Higher values = more failures. Affects network reliability.",
    p_join:
      "Probability that a new validator joins the network in each epoch (0-1). Higher values = more new validators joining. Recommended: 0.001-0.1.",
    p_leave:
      "Probability that a validator leaves the network in each epoch (0-1). Higher values = more validators leaving. Recommended: 0.001-0.1.",
    join_amount:
      "Method to determine stake for new validators when joining:\n• NEW_MAX: Equal to current maximum stake\n• NEW_MIN: Equal to current minimum stake\n• NEW_AVERAGE: Equal to current average stake\n• NEW_RANDOM: Random stake amount",
    penalty_percentage:
      "Penalty rate when a corrupted validator fails (0-1). Higher values = heavier penalties. Penalty is deducted from validator's stake.",
    reward:
      "Base reward that a validator receives when selected in an epoch. This value can be adjusted by dynamic reward.",
    use_dynamic_reward:
      "Enable/disable dynamic rewards. When enabled, rewards change based on factors like stake distribution and performance. Helps balance the system better.",
    scheduled_joins:
      "Schedule new validators to join at specific epochs. Allows precise control over when and with how much stake new validators join.",
  };

  // Algorithm options
  const algorithmOptions = [
    { value: "WEIGHTED", label: "Weighted (Standard weighting)" },
    {
      value: "OPPOSITE_WEIGHTED",
      label: "Opposite Weighted (Inverse weighting)",
    },
    {
      value: "SRSW",
      label: "SRSW (Square Root Stake Weighting)",
    },
    {
      value: "LSW",
      label: "LSW (Logarithmic Stake Weighting)",
    },
    { value: "DESW", label: "DESW (Dynamic Exponential Stake Weighting)" },

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
                  <Tooltip content={parameterDescriptions.n_epochs}>
                    Epochs
                  </Tooltip>
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
                    <Tooltip content={parameterDescriptions.proof_of_stake}>
                      PoS stake-weighting model
                    </Tooltip>
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
                <label className="form-label">
                  <Tooltip content={parameterDescriptions.initial_stake_volume}>
                    Total initial stake
                  </Tooltip>
                </label>
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
                <label className="form-label">
                  <Tooltip content={parameterDescriptions.initial_distribution}>
                    Initial distribution
                  </Tooltip>
                </label>
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
                  <label className="form-label">
                    <Tooltip content={parameterDescriptions.initial_gini}>
                      Initial Gini
                    </Tooltip>
                  </label>
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
                <label className="form-label">
                  <Tooltip content={parameterDescriptions.n_peers}>
                    Validators
                  </Tooltip>
                </label>
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
                <label className="form-label">
                  <Tooltip content={parameterDescriptions.n_corrupted}>
                    Corrupted validators
                  </Tooltip>
                </label>
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
                  <Tooltip content={parameterDescriptions.p_fail}>
                    Failure probability (p_fail)
                  </Tooltip>
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
                <label className="form-label">
                  <Tooltip content={parameterDescriptions.p_join}>
                    Join probability (p_join)
                  </Tooltip>
                </label>
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
                  <Tooltip content={parameterDescriptions.p_leave}>
                    Leave probability (p_leave)
                  </Tooltip>
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
                <label className="form-label">
                  <Tooltip content={parameterDescriptions.join_amount}>
                    Join stake type
                  </Tooltip>
                </label>
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
                <label className="form-label">
                  <Tooltip content={parameterDescriptions.penalty_percentage}>
                    Penalty rate
                  </Tooltip>
                </label>
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
                <label className="form-label">
                  <Tooltip content={parameterDescriptions.reward}>
                    Base reward
                  </Tooltip>
                </label>
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
                  <Tooltip content={parameterDescriptions.use_dynamic_reward}>
                    Use dynamic reward
                  </Tooltip>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Scheduled Joins */}
        <div className="card flex flex-col">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              <Tooltip content={parameterDescriptions.scheduled_joins}>
                Scheduled joins
              </Tooltip>
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Schedule new validators to join at specific epochs
            </p>
          </div>
          <div className="card-body flex-1">
            {/* Add new scheduled join */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label">
                  <Tooltip content="Epoch at which the new validator will join the network. Must be a non-negative integer and less than the total number of epochs in the simulation.">
                    Epoch
                  </Tooltip>
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={newJoin.epoch}
                  onChange={(e) =>
                    setNewJoin((prev) => ({ ...prev, epoch: e.target.value }))
                  }
                  placeholder="Epoch joins"
                  min="0"
                  disabled={disabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Tooltip content="Amount of stake the new validator will have when joining at the specified epoch. Must be a positive number.">
                    Stake
                  </Tooltip>
                </label>
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
