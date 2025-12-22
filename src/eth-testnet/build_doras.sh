#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

build_dora() {
  local name="$1"
  local context_dir="${ROOT_DIR}/doras/${name}"
  local suffix="${name#dora_}"
  local image_tag="dora:$(echo "${suffix}" | tr '[:upper:]' '[:lower:]')"

  if [[ ! -d "${context_dir}" ]]; then
    echo "Skip ${name}: directory not found at ${context_dir}" >&2
    return
  fi

  echo "Building image ${image_tag} from ${context_dir}"
  docker build \
    -t "${image_tag}" \
    -f "${context_dir}/Dockerfile" \
    "${context_dir}"
}

resolve_dora_name() {
  local input="$1"
  local upper
  upper="$(echo "${input}" | tr '[:lower:]' '[:upper:]')"

  case "${upper}" in
    SRSW|DORA_SRSW) echo "dora_SRSW" ;;
    LSW|DORA_LSW) echo "dora_LSW" ;;
    DESW|DORA_DESW) echo "dora_DESW" ;;
    *)
      echo "Unknown dora variant: ${input}" >&2
      return 1
      ;;
  esac
}

if [[ "$#" -eq 0 ]]; then
  # No args -> build all variants
  build_dora "dora_SRSW"
  build_dora "dora_LSW"
  build_dora "dora_DESW"
else
  # Build only requested variants
  for arg in "$@"; do
    name="$(resolve_dora_name "${arg}")" || continue
    build_dora "${name}"
  done
fi

echo "Dora build script finished."

