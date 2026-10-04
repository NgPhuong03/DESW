#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for profile in LSW DESW; do
  echo "Checking Dora ${profile}: 512 reference vectors, pre-Electra and Electra"
  (
    cd "${ROOT_DIR}/doras/dora_${profile}"
    go test ./indexer/beacon/duties -count=1 -run 'TestWeightedProposerReferenceVectors|TestDESWGiniAndExponent'
  )
  echo "Checking Lighthouse ${profile} against the same reference vectors"
  (
    cd "${ROOT_DIR}/lighthouses/lighthouse_${profile}"
    cargo test -p types regression_tests
  )
done

echo "All LSW/DESW proposer reference and Gini regression tests passed."
