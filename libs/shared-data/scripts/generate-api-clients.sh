#!/usr/bin/env bash
# Gera os tipos TypeScript dos contratos OpenAPI 3.1 da `uniplus-api` para
# consumo pelos services Angular standalone do `uniplus-web` (ADR-0013).
#
# Roda Node-only (npx openapi-typescript) — sem JRE. Output são arquivos
# `schema.ts` por módulo, contendo `paths` e `components` strongly typed.
# Não emite NgModule, Configuration nem service factory: services são
# escritos manualmente em `*.api.ts` e tipam DTOs via
# `components['schemas']['<Nome>']`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT_DIR="$SCRIPT_DIR/../openapi"
OUTPUT_DIR="$SCRIPT_DIR/../src/lib/api"

modules=(selecao ingresso)

echo "Gerando tipos OpenAPI (openapi-typescript) para módulos: ${modules[*]}"

for module in "${modules[@]}"; do
  input="$INPUT_DIR/$module.openapi.json"
  out_dir="$OUTPUT_DIR/$module"
  out_file="$out_dir/schema.ts"

  if [[ ! -f "$input" ]]; then
    echo "ERRO: baseline ausente em $input — sincronize a partir de uniplus-api/contracts/" >&2
    exit 1
  fi

  mkdir -p "$out_dir"
  npx openapi-typescript "$input" \
    --output "$out_file" \
    --immutable \
    --enum
  echo "  ✓ $out_file"
done

echo "Concluído."
