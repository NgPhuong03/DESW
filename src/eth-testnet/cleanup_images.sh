#!/usr/bin/env bash

set -euo pipefail

remove_image() {
  local img="$1"
  if docker image inspect "${img}" >/dev/null 2>&1; then
    echo "Removing image ${img}"
    docker rmi -f "${img}"
  else
    echo "Image ${img} not found, skipping"
  fi
}

resolve_lighthouse_tag() {
  local input="$1"
  local upper
  upper="$(echo "${input}" | tr '[:lower:]' '[:upper:]')"

  case "${upper}" in
    SRSW|LIGHTHOUSE_SRSW) echo "lighthouse:srsw" ;;
    LSW|LIGHTHOUSE_LSW) echo "lighthouse:lsw" ;;
    DESW|LIGHTHOUSE_DESW) echo "lighthouse:desw" ;;
    *)
      echo "Unknown lighthouse variant to remove: ${input}" >&2
      return 1
      ;;
  esac
}

resolve_dora_tag() {
  local input="$1"
  local upper
  upper="$(echo "${input}" | tr '[:lower:]' '[:upper:]')"

  case "${upper}" in
    SRSW|DORA_SRSW) echo "dora:srsw" ;;
    LSW|DORA_LSW) echo "dora:lsw" ;;
    DESW|DORA_DESW) echo "dora:desw" ;;
    *)
      echo "Unknown dora variant to remove: ${input}" >&2
      return 1
      ;;
  esac
}

if [[ "$#" -eq 0 ]]; then
  # No args -> remove all lighthouse + dora variants
  for img in \
    "lighthouse:srsw" "lighthouse:lsw" "lighthouse:desw" \
    "dora:srsw" "dora:lsw" "dora:desw"
  do
    remove_image "${img}"
  done
else
  # Args -> interpret each as a variant name; remove both lighthouse + dora for that variant
  for arg in "$@"; do
    l_tag="$(resolve_lighthouse_tag "${arg}")" || true
    d_tag="$(resolve_dora_tag "${arg}")" || true

    [[ -n "${l_tag:-}" ]] && remove_image "${l_tag}"
    [[ -n "${d_tag:-}" ]] && remove_image "${d_tag}"
  done
fi

echo "Done cleaning lighthouse and dora images."
