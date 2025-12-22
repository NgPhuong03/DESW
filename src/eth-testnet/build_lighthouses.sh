#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

build_lighthouse() {
  local name="$1"
  local context_dir="${ROOT_DIR}/lighthouses/${name}"
  local suffix="${name#lighthouse_}"
  local image_tag="lighthouse:$(echo "${suffix}" | tr '[:upper:]' '[:lower:]')"

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

resolve_lighthouse_name() {
  local input="$1"
  local upper
  upper="$(echo "${input}" | tr '[:lower:]' '[:upper:]')"

  case "${upper}" in
    SRSW|LIGHTHOUSE_SRSW) echo "lighthouse_SRSW" ;;
    LSW|LIGHTHOUSE_LSW) echo "lighthouse_LSW" ;;
    DESW|LIGHTHOUSE_DESW) echo "lighthouse_DESW" ;;
    *)
      echo "Unknown lighthouse variant: ${input}" >&2
      return 1
      ;;
  esac
}

if [[ "$#" -eq 0 ]]; then
  # No args -> build all variants
  build_lighthouse "lighthouse_SRSW"
  build_lighthouse "lighthouse_LSW"
  build_lighthouse "lighthouse_DESW"
else
  # Build only requested variants
  for arg in "$@"; do
    name="$(resolve_lighthouse_name "${arg}")" || continue
    build_lighthouse "${name}"
  done
fi

echo "Lighthouse build script finished."

