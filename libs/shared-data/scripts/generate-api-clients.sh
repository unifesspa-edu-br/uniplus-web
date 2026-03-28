#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../src/lib/api"

echo "Gerando clientes de API a partir das especificações OpenAPI..."

# Seleção API
npx openapi-generator-cli generate \
  -i "$SCRIPT_DIR/../openapi/selecao.openapi.yaml" \
  -g typescript-angular \
  -o "$OUTPUT_DIR/selecao" \
  --additional-properties=ngVersion=21.0.0,providedInRoot=true

# Ingresso API
npx openapi-generator-cli generate \
  -i "$SCRIPT_DIR/../openapi/ingresso.openapi.yaml" \
  -g typescript-angular \
  -o "$OUTPUT_DIR/ingresso" \
  --additional-properties=ngVersion=21.0.0,providedInRoot=true

echo "Clientes de API gerados com sucesso."
