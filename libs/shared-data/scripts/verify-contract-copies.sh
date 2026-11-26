#!/usr/bin/env bash
# Confere se cada cópia do contrato em libs/shared-data/openapi é igual à da branch main do
# uniplus-api. O codegen-api-check só compara o cliente gerado com a cópia daqui; esta
# verificação pega a cópia que ficou para trás do contrato publicado pela API.
#
# Sai com 1 se alguma cópia divergir e com 2 se a verificação não pôde ser feita (sem acesso ao
# GitHub, contrato ausente na API ou cópia local ilegível). O contrato do geo não é conferido:
# ele não vem do repositório da API.
set -euo pipefail

API_REPO="${API_REPO:-unifesspa-edu-br/uniplus-api}"
API_REF="${API_REF:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COPIAS="$SCRIPT_DIR/../openapi"
modulos=(selecao ingresso organizacao configuracao publicacoes portal autorizacao)

baixado=$(mktemp)
trap 'rm -f "$baixado"' EXIT

# Baixa o contrato do módulo para $baixado. Falha de consulta ao GitHub é erro de verificação,
# distinto de cópia divergente.
baixar_contrato_da_api() {
  local modulo="$1" sha
  if ! sha=$(gh api "repos/$API_REPO/git/trees/$API_REF:contracts" \
    --jq ".tree[] | select(.path == \"openapi.$modulo.json\") | .sha"); then
    echo "Não foi possível consultar $API_REPO@$API_REF no GitHub (rede ou login do gh)." >&2
    exit 2
  fi
  if [[ -z "$sha" ]]; then
    echo "A API não publica o contrato de $modulo em $API_REPO@$API_REF." >&2
    exit 2
  fi
  if ! gh api -H "Accept: application/vnd.github.raw" "repos/$API_REPO/git/blobs/$sha" >"$baixado"; then
    echo "Não foi possível baixar o contrato de $modulo da API." >&2
    exit 2
  fi
}

divergentes=()
for modulo in "${modulos[@]}"; do
  if [[ ! -r "$COPIAS/$modulo.openapi.json" ]]; then
    echo "Cópia local ausente ou ilegível: $COPIAS/$modulo.openapi.json." >&2
    exit 2
  fi
  baixar_contrato_da_api "$modulo"
  status=0
  cmp -s "$baixado" "$COPIAS/$modulo.openapi.json" || status=$?
  if ((status == 1)); then
    divergentes+=("$modulo")
  elif ((status != 0)); then
    echo "Não foi possível comparar a cópia de $modulo com o contrato da API." >&2
    exit 2
  fi
done

if ((${#divergentes[@]})); then
  echo "Cópias do contrato diferentes da $API_REF de $API_REPO: ${divergentes[*]}." >&2
  echo "Copie contracts/openapi.<módulo>.json para libs/shared-data/openapi/<módulo>.openapi.json," >&2
  echo "rode \`nx run shared-data:codegen-api\` e corrija o que o compilador apontar." >&2
  exit 1
fi

echo "As cópias do contrato batem com a $API_REF de $API_REPO."
