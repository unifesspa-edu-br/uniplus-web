#!/usr/bin/env bash
# Drift check do codegen OpenAPI (ADR-0013): regenera os schemas e compara
# com o committed em HEAD. Usa `git show HEAD:<file>` em vez de `git diff` para
# evitar falso-positivo quando o working tree do dev local está sujo por
# motivos não relacionados ao codegen — o gate é sempre "o gerado bate com o
# que está committed?".
#
# Sai com código != 0 se algum `schema.ts` divergir do committed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

generated=(
  "libs/shared-data/src/lib/api/selecao/schema.ts"
  "libs/shared-data/src/lib/api/ingresso/schema.ts"
)

bash "$SCRIPT_DIR/generate-api-clients.sh"

drift=0
for file in "${generated[@]}"; do
  committed=$(mktemp)
  trap 'rm -f "$committed"' EXIT

  if ! git show "HEAD:$file" >"$committed" 2>/dev/null; then
    echo "AVISO: $file ainda não existe em HEAD (primeiro commit do gerado)" >&2
    rm -f "$committed"
    continue
  fi

  if ! diff -u "$committed" "$file" >/dev/null; then
    echo "DRIFT: $file divergiu do committed em HEAD" >&2
    diff -u "$committed" "$file" || true
    drift=1
  fi
  rm -f "$committed"
done

if (( drift )); then
  echo "Codegen drift detectado. Rode \`nx run shared-data:codegen-api\` e commite os schemas atualizados." >&2
  exit 1
fi

echo "Sem drift — os schemas committed batem com o regenerado."
