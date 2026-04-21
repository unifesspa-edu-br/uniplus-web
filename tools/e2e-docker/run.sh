#!/usr/bin/env bash
# Runner E2E com ciclo de vida completo.
#
# Sobe infraestrutura (Keycloak + PostgreSQL), serve as apps Angular,
# executa a suíte Playwright (chromium + firefox + webkit) e derruba tudo.
#
# Uso:
#   ./tools/e2e-docker/run.sh [selecao-e2e|portal-e2e|all] [--no-pull]
#
# Variáveis obrigatórias:
#   KEYCLOAK_ADMIN_PASSWORD   senha do admin configurada no Keycloak
#
# Pré-requisitos:
#   - Docker em execução

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.e2e.yml"
DOCKERFILE="$SCRIPT_DIR/Dockerfile"
IMAGE_REMOTE="ghcr.io/unifesspa-edu-br/uniplus-e2e-runner:1.58.2"
IMAGE_LOCAL="uniplus-e2e-runner"
VOLUME_NAME="uniplus-e2e-node-modules"

TARGET="all"
NO_PULL=false

for arg in "$@"; do
  case "$arg" in
    selecao-e2e|portal-e2e|all) TARGET="$arg" ;;
    --no-pull) NO_PULL=true ;;
    *) echo "ERRO: argumento inválido '$arg'" >&2; exit 1 ;;
  esac
done

# ─── Validações ───────────────────────────────────────────────────────────────

if [[ -z "${KEYCLOAK_ADMIN_PASSWORD:-}" ]]; then
  echo "ERRO: KEYCLOAK_ADMIN_PASSWORD não definido."
  echo "  export KEYCLOAK_ADMIN_PASSWORD=<senha>"
  exit 1
fi

if ! docker info > /dev/null 2>&1; then
  echo "ERRO: Docker não está em execução."
  exit 1
fi

for port in 8080 4200 4202; do
  if ss -tlnp "sport = :$port" 2>/dev/null | grep -q LISTEN; then
    echo "ERRO: porta $port já está em uso."
    echo "  Pare o serviço antes de rodar o E2E runner."
    exit 1
  fi
done

export KEYCLOAK_ADMIN_PASSWORD

# ─── Cleanup (trap) ───────────────────────────────────────────────────────────

SELECAO_PID=""
PORTAL_PID=""

cleanup() {
  echo ""
  echo "→ Teardown..."
  [[ -n "$SELECAO_PID" ]] && kill "$SELECAO_PID" 2>/dev/null || true
  [[ -n "$PORTAL_PID" ]] && kill "$PORTAL_PID" 2>/dev/null || true
  # nx serve spawna processos filhos que sobrevivem ao kill do PID pai
  fuser -k 4200/tcp 2>/dev/null || true
  fuser -k 4202/tcp 2>/dev/null || true
  wait "$SELECAO_PID" "$PORTAL_PID" 2>/dev/null || true
  docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
  echo "→ Ambiente encerrado."
}
trap cleanup EXIT INT TERM

# ─── 1. Imagem Playwright ─────────────────────────────────────────────────────

if [[ "$NO_PULL" == false ]] && docker pull "$IMAGE_REMOTE" 2>/dev/null; then
  IMAGE_NAME="$IMAGE_REMOTE"
  echo "→ Imagem obtida do registry: $IMAGE_REMOTE"
else
  echo "→ Build local da imagem Playwright (pull não disponível ou --no-pull)..."
  docker build -t "$IMAGE_LOCAL" -f "$DOCKERFILE" "$REPO_ROOT"
  IMAGE_NAME="$IMAGE_LOCAL"
fi

# ─── 2. Infraestrutura ────────────────────────────────────────────────────────

echo "→ Subindo Keycloak..."
docker compose -f "$COMPOSE_FILE" up -d

echo -n "→ Aguardando Keycloak ficar saudável"
DEADLINE=$(( $(date +%s) + 120 ))
until docker compose -f "$COMPOSE_FILE" ps -q keycloak \
    | xargs docker inspect --format '{{.State.Health.Status}}' 2>/dev/null \
    | grep -q "^healthy$"; do
  if [[ $(date +%s) -gt $DEADLINE ]]; then
    echo " TIMEOUT"
    echo "ERRO: Keycloak não ficou saudável em 120s."
    exit 1
  fi
  printf '.'
  sleep 5
done
echo " OK"

# ─── 3. Apps Angular ──────────────────────────────────────────────────────────

cd "$REPO_ROOT"

echo "→ Subindo Seleção (porta 4200)..."
npx nx serve selecao > /tmp/uniplus-selecao-serve.log 2>&1 &
SELECAO_PID=$!

echo "→ Subindo Portal (porta 4202)..."
npx nx serve portal > /tmp/uniplus-portal-serve.log 2>&1 &
PORTAL_PID=$!

echo -n "→ Aguardando apps ficarem prontas"
for port in 4200 4202; do
  DEADLINE=$(( $(date +%s) + 120 ))
  until curl -sf "http://localhost:$port" > /dev/null 2>&1; do
    if [[ $(date +%s) -gt $DEADLINE ]]; then
      echo " TIMEOUT (porta $port)"
      echo "  Logs: /tmp/uniplus-selecao-serve.log e /tmp/uniplus-portal-serve.log"
      exit 1
    fi
    printf '.'
    sleep 3
  done
done
echo " OK"

# ─── 4. Testes E2E ────────────────────────────────────────────────────────────

run_e2e() {
  local app="$1"
  echo ""
  echo "→ Executando E2E: $app (chromium + firefox + webkit)"
  docker run --rm \
    --network=host \
    -e CI=true \
    -e KEYCLOAK_ADMIN_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD" \
    -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    -v "$REPO_ROOT:/workspace" \
    -v "$VOLUME_NAME:/workspace/node_modules" \
    "$IMAGE_NAME" \
    npx playwright test --config="apps/$app/playwright.config.ts" --workers=1
}

case "$TARGET" in
  selecao-e2e) run_e2e selecao-e2e ;;
  portal-e2e)  run_e2e portal-e2e ;;
  all)
    run_e2e selecao-e2e
    run_e2e portal-e2e
    ;;
esac

echo ""
echo "✓ Todos os E2E concluídos com sucesso."
