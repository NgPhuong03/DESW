#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<EOF
Usage: $(basename "$0") <PROFILE> <ENCLAVE_NAME>

PROFILE:
  - SRSW        -> uses params/paramsSRSW.yaml
  - LSW         -> uses params/paramsLSW.yaml
  - DESW        -> uses params/paramsDESW.yaml
  - DF          -> uses params/paramsDF.yaml

Example:
  $(basename "$0") SRSW my-srsw-net
EOF
}

if [[ "$#" -ne 2 ]]; then
  usage
  exit 1
fi

PROFILE_INPUT="$1"
ENCLAVE_NAME="$2"

resolve_params_file() {
  local input="$1"
  local upper
  upper="$(echo "${input}" | tr '[:lower:]' '[:upper:]')"

  case "${upper}" in
    SRSW) echo "params/paramsSRSW.yaml" ;;
    LSW) echo "params/paramsLSW.yaml" ;;
    DESW) echo "params/paramsDESW.yaml" ;;
    DF) echo "params/paramsDF.yaml" ;;
    *)
      echo "Unknown profile: ${input}" >&2
      return 1
      ;;
  esac
}

PARAMS_REL_PATH="$(resolve_params_file "${PROFILE_INPUT}")"
PARAMS_FILE="${ROOT_DIR}/${PARAMS_REL_PATH}"

if [[ ! -f "${PARAMS_FILE}" ]]; then
  echo "Params file not found: ${PARAMS_FILE}" >&2
  exit 1
fi

cd "${ROOT_DIR}"

echo "Using params file: ${PARAMS_FILE}"
echo "Starting kurtosis network with enclave '${ENCLAVE_NAME}'..."
kurtosis run github.com/ethpandaops/ethereum-package \
  --args-file "${PARAMS_FILE}" \
  --image-download always \
  --enclave "${ENCLAVE_NAME}"

echo "Kurtosis run completed."


