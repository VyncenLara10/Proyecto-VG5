#!/usr/bin/env bash
set -euo pipefail

BASE="${KUBELAB_IP:-192.168.50.240}"

check() {
  local host="$1"
  local path="$2"
  local expected="$3"
  local code

  code=$(curl --noproxy '*' --max-time 10 \
    -sS -o /dev/null -w '%{http_code}' \
    -H "Host: $host" \
    "http://$BASE$path")

  echo "$host$path -> HTTP $code"

  if [[ "$code" != "$expected" ]]; then
    echo "ERROR: se esperaba HTTP $expected"
    exit 1
  fi
}

check "app.grupo5.lab" "/" "200"
check "api.grupo5.lab" "/health" "200"
check "api.grupo5.lab" "/products" "200"
check "api.grupo5.lab" "/metrics" "200"

echo "SMOKE TEST CORRECTO"
