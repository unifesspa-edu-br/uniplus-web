#!/usr/bin/env bash
# Confere se cada cópia do contrato em libs/shared-data/openapi é igual à da branch main do
# repositório que a publica: os módulos, o uniplus-api; o geo, o unifesspa-geo-api. O
# codegen-api-check só compara o cliente gerado com a cópia daqui; esta verificação pega a cópia
# que ficou para trás do contrato publicado.
#
# Sai com 1 se alguma cópia divergir e com 2 se a verificação não pôde ser feita (sem acesso ao
# GitHub, contrato ausente no repositório de origem ou cópia local ilegível).
set -euo pipefail

API_REPO="${API_REPO:-unifesspa-edu-br/uniplus-api}"
API_REF="${API_REF:-main}"
GEO_REPO="${GEO_REPO:-unifesspa-edu-br/unifesspa-geo-api}"
GEO_REF="${GEO_REF:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COPIAS="$SCRIPT_DIR/../openapi"
# módulo:repositório:referência de origem do contrato.
origens=(
  "selecao:$API_REPO:$API_REF"
  "ingresso:$API_REPO:$API_REF"
  "organizacao:$API_REPO:$API_REF"
  "configuracao:$API_REPO:$API_REF"
  "publicacoes:$API_REPO:$API_REF"
  "portal:$API_REPO:$API_REF"
  "autorizacao:$API_REPO:$API_REF"
  "geo:$GEO_REPO:$GEO_REF"
)

baixado=$(mktemp)
trap 'rm -f "$baixado"' EXIT

# Baixa o contrato do módulo do repositório de origem para $baixado. Falha de consulta ao GitHub
# é erro de verificação, distinto de cópia divergente.
baixar_contrato() {
  local modulo="$1" repo="$2" ref="$3" sha
  if ! sha=$(gh api "repos/$repo/git/trees/$ref:contracts" \
    --jq ".tree[] | select(.path == \"openapi.$modulo.json\") | .sha"); then
    echo "Não foi possível consultar $repo@$ref no GitHub (rede ou login do gh)." >&2
    exit 2
  fi
  if [[ -z "$sha" ]]; then
    echo "O repositório $repo@$ref não publica o contrato de $modulo." >&2
    exit 2
  fi
  if ! gh api -H "Accept: application/vnd.github.raw" "repos/$repo/git/blobs/$sha" >"$baixado"; then
    echo "Não foi possível baixar o contrato de $modulo de $repo." >&2
    exit 2
  fi
}

divergentes=()
for origem in "${origens[@]}"; do
  IFS=: read -r modulo repo ref <<<"$origem"
  if [[ ! -r "$COPIAS/$modulo.openapi.json" ]]; then
    echo "Cópia local ausente ou ilegível: $COPIAS/$modulo.openapi.json." >&2
    exit 2
  fi
  baixar_contrato "$modulo" "$repo" "$ref"
  status=0
  cmp -s "$baixado" "$COPIAS/$modulo.openapi.json" || status=$?
  if ((status == 1)); then
    divergentes+=("$modulo")
  elif ((status != 0)); then
    echo "Não foi possível comparar a cópia de $modulo com o contrato de origem." >&2
    exit 2
  fi
done

if ((${#divergentes[@]})); then
  echo "Cópias do contrato diferentes da branch de origem: ${divergentes[*]}." >&2
  echo "Copie contracts/openapi.<módulo>.json do repositório de origem (uniplus-api; para o geo," >&2
  echo "unifesspa-geo-api) para libs/shared-data/openapi/<módulo>.openapi.json," >&2
  echo "rode \`nx run shared-data:codegen-api\` e corrija o que o compilador apontar." >&2
  exit 1
fi

echo "As cópias do contrato batem com a $API_REF de $API_REPO e com a $GEO_REF de $GEO_REPO."
