const mongoose = require("mongoose");

const comparisonSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    base_parameters: {
      n_epochs: { type: Number, required: true },
      initial_stake_volume: { type: Number, required: true },
      initial_distribution: { type: String, required: true },
      initial_gini: { type: Number, required: true },
      n_peers: { type: Number, required: true },
      n_corrupted: { type: Number, required: true },
      p_fail: { type: Number, required: true },
      p_join: { type: Number, required: true },
      p_leave: { type: Number, required: true },
      join_amount: { type: String, required: true },
      penalty_percentage: { type: Number, required: true },
      theta: { type: Number, required: true },
      s_type: { type: String, required: true },
      k: { type: Number, required: true },
      reward: { type: Number, required: true },
      use_dynamic_reward: { type: Boolean, required: true },
      p_sybil: { type: Number, required: true },
      min_sybil_size: { type: Number, required: true },
      max_sybil_size: { type: Number, required: true },
      scheduled_joins: [
        {
          epoch: Number,
          stake: Number, // align with Simulation & Python
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
    algorithms_to_compare: [
      {
        type: String,
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
    ],
    simulation_results: [
      {
        algorithm: String,
        simulation_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Simulation",
        },
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
        execution_time: Number,
      },
    ],
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
    total_execution_time: Number,
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

// Indexes
comparisonSchema.index({ sessionId: 1, created_at: -1 });
comparisonSchema.index({ status: 1 });

// TTL index to auto-delete old comparisons after 7 days
comparisonSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);

module.exports = mongoose.model("Comparison", comparisonSchema);
