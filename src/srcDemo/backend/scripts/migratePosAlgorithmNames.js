// One-off migration script to rename PoS algorithm identifiers in MongoDB
// From: LOG_WEIGHTED -> LSW, SRSW_WEIGHTED -> SRSW

const mongoose = require("mongoose");
const Simulation = require("../models/Simulation");
const Comparison = require("../models/Comparison");

async function run() {
  const uri = process.env.MONGODB_URI;

  console.log("Connecting to MongoDB (PoS db)...");
  await mongoose.connect(uri, {});
  console.log("Connected");

  // Simulations: parameters.proof_of_stake
  const simLog = await Simulation.updateMany(
    { "parameters.proof_of_stake": "LOG_WEIGHTED" },
    { $set: { "parameters.proof_of_stake": "LSW" } }
  );
  const simSrsw = await Simulation.updateMany(
    { "parameters.proof_of_stake": "SRSW_WEIGHTED" },
    { $set: { "parameters.proof_of_stake": "SRSW" } }
  );

  // Comparisons: algorithms_to_compare (array)
  const cmpLog = await Comparison.updateMany(
    { algorithms_to_compare: "LOG_WEIGHTED" },
    {
      $set: { "algorithms_to_compare.$[elem]": "LSW" },
    },
    { arrayFilters: [{ elem: "LOG_WEIGHTED" }] }
  );
  const cmpSrsw = await Comparison.updateMany(
    { algorithms_to_compare: "SRSW_WEIGHTED" },
    {
      $set: { "algorithms_to_compare.$[elem]": "SRSW" },
    },
    { arrayFilters: [{ elem: "SRSW_WEIGHTED" }] }
  );

  // Comparisons: simulation_results[].algorithm (array of subdocuments)
  const cmpSimLog = await Comparison.updateMany(
    { "simulation_results.algorithm": "LOG_WEIGHTED" },
    {
      $set: { "simulation_results.$[res].algorithm": "LSW" },
    },
    { arrayFilters: [{ "res.algorithm": "LOG_WEIGHTED" }] }
  );

  const cmpSimSrsw = await Comparison.updateMany(
    { "simulation_results.algorithm": "SRSW_WEIGHTED" },
    {
      $set: { "simulation_results.$[res].algorithm": "SRSW" },
    },
    { arrayFilters: [{ "res.algorithm": "SRSW_WEIGHTED" }] }
  );

  console.log("Migration summary:");
  console.log(
    "- Simulations LOG_WEIGHTED -> LSW:",
    simLog.modifiedCount ?? simLog.nModified ?? 0
  );
  console.log(
    "- Simulations SRSW_WEIGHTED -> SRSW:",
    simSrsw.modifiedCount ?? simSrsw.nModified ?? 0
  );
  console.log(
    "- Comparisons LOG_WEIGHTED -> LSW:",
    cmpLog.modifiedCount ?? cmpLog.nModified ?? 0
  );
  console.log(
    "- Comparisons SRSW_WEIGHTED -> SRSW:",
    cmpSrsw.modifiedCount ?? cmpSrsw.nModified ?? 0
  );
  console.log(
    "- Comparison results LOG_WEIGHTED -> LSW:",
    cmpSimLog.modifiedCount ?? cmpSimLog.nModified ?? 0
  );
  console.log(
    "- Comparison results SRSW_WEIGHTED -> SRSW:",
    cmpSimSrsw.modifiedCount ?? cmpSimSrsw.nModified ?? 0
  );

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
