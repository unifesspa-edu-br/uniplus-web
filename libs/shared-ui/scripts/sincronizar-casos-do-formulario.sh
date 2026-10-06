#!/usr/bin/env bash
# Copia o corpus de casos da avaliação do formulário do uniplus-api para o interpretador do
# shared-ui (ADR-0139 da API). A API e o interpretador rodam os mesmos casos; caso novo nasce no
# contracts/formularios/casos da API e chega aqui por este script.
#
# Uso: libs/shared-ui/scripts/sincronizar-casos-do-formulario.sh [caminho-do-uniplus-api]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="${1:-$SCRIPT_DIR/../../../../uniplus-api}"
ORIGEM="$API_DIR/contracts/formularios/casos"
DESTINO="$SCRIPT_DIR/../src/lib/components/formulario-do-candidato/interpretador/casos"

if [[ ! -d "$ORIGEM" ]]; then
  echo "ERRO: corpus ausente em $ORIGEM — informe o caminho do uniplus-api" >&2
  exit 1
fi

if ! compgen -G "$ORIGEM/*.json" >/dev/null; then
  echo "ERRO: nenhum caso em $ORIGEM — a cópia atual fica como está" >&2
  exit 1
fi

rm -f "$DESTINO"/*.json
cp "$ORIGEM"/*.json "$DESTINO"/
echo "Casos sincronizados: $(ls "$DESTINO"/*.json | wc -l)"
