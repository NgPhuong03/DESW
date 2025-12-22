const mongoose = require("mongoose");

const simulationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    parameters: {
      n_epochs: { type: Number, required: true, min: 1, max: 100000 },
      proof_of_stake: {
        type: String,
        required: true,
        enum: [
          "WEIGHTED",
          "OPPOSITE_WEIGHTED",
          "GINI_STABILIZED",
          "LSW",
          "DESW",
          "SRSW",
          "RANDOM",
        ],
      },
      initial_stake_volume: { type: Number, required: true, min: 0 },
      initial_distribution: {
        type: String,
        required: true,
        enum: ["UNIFORM", "GINI", "RANDOM"],
      },
      initial_gini: { type: Number, required: true, min: 0, max: 1 },
      n_peers: { type: Number, required: true, min: 1, max: 10000 },
      n_corrupted: { type: Number, required: true, min: 0 },
      p_fail: { type: Number, required: true, min: 0, max: 1 },
      p_join: { type: Number, required: true, min: 0, max: 1 },
      p_leave: { type: Number, required: true, min: 0, max: 1 },
      join_amount: {
        type: String,
        required: true,
        enum: ["NEW_MAX", "NEW_MIN", "NEW_RANDOM", "NEW_AVERAGE"],
      },
      penalty_percentage: { type: Number, required: true, min: 0, max: 1 },
      theta: { type: Number, required: true, min: 0, max: 1 }, // θ
      s_type: {
        type: String,
        required: true,
        enum: ["CONSTANT", "LINEAR", "QUADRATIC", "SQRT"],
      },
      k: { type: Number, required: true, min: 0 },
      reward: { type: Number, required: true, min: 0 },
      use_dynamic_reward: { type: Boolean, required: true },
      p_sybil: { type: Number, required: true, min: 0, max: 1 },
      min_sybil_size: { type: Number, required: true, min: 2 },
      max_sybil_size: { type: Number, required: true, min: 2 },
      // Optional scheduled events
      scheduled_joins: [
        {
          epoch: Number,
          stake: Number, // align with Python & service params
        },
      ],
      scheduled_sybil_attacks: [
        {
          epoch: Number,
          entity_id: Number,
          num_splits: Number,
        },
      ],
    },
    results: {
      gini_history: [Number],
      n_peers_history: [Number],
      nakamoto_history: [Number],
      hhi_history: [Number],
      nakamoto_liveness_history: [Number],
      nakamoto_liveness_pct_history: [Number],
      nakamoto_safety_history: [Number],
      nakamoto_safety_pct_history: [Number],
      theil_history: [Number],
      zipf_history: [Number],
      palma_history: [Number],
      shannon_history: [Number],
      shapley_gini_liveness_final: Number,
      shapley_gini_safety_final: Number,
      shapley_gini_correlation_final: Number,
      // Final epoch metrics
      final_metrics: {
        gini: Number,
        nakamoto: Number,
        hhi: Number,
        nakamoto_liveness: Number,
        nakamoto_liveness_pct: Number,
        nakamoto_safety: Number,
        nakamoto_safety_pct: Number,
        theil: Number,
        zipf: Number,
        palma: Number,
        shannon: Number,
        n_peers: Number,
      },
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    error_message: String,
    execution_time: Number, // in milliseconds
    created_at: {
      type: Date,
      default: Date.now,
    },
    completed_at: Date,
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
simulationSchema.index({ sessionId: 1, created_at: -1 });
simulationSchema.index({ status: 1 });

// TTL index to auto-delete old simulations after 7 days
simulationSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);

module.exports = mongoose.model("Simulation", simulationSchema);
