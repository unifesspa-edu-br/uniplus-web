#!/usr/bin/env bash
# Runner E2E com ciclo de vida completo.
#
# Sobe infraestrutura (Keycloak + PostgreSQL), serve as apps Angular,
# executa a suíte Playwright (chromium + firefox + webkit) e derruba tudo.
# `portal-e2e`/`all` também sobem a imagem Docker real do portal sob
# subpath (porta 4212, APP_BASE_HREF=/portal/) e rodam a suíte de login
# OIDC sob subpath (Story #449) — dev server nunca reproduziria isso.
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
# Precisa acompanhar a versão de "playwright" travada em package-lock.json
# (não "@playwright/test", que é um range solto — o binário instalado é
# quem importa). Drift aqui derruba a suíte inteira com "Executable
# doesn't exist" / "Please update docker image as well" — achado
# corrigindo a validação local da Story #449.
PLAYWRIGHT_VERSION="1.61.1"
IMAGE_REMOTE="ghcr.io/unifesspa-edu-br/uniplus-e2e-runner:${PLAYWRIGHT_VERSION}"
IMAGE_LOCAL="uniplus-e2e-runner"
# Sufixo de versão é obrigatório: o volume nomeado sobrevive a `docker
# compose down -v` (só derruba o que o compose gerencia) e a rebuilds da
# imagem — sem o sufixo, uma máquina que já rodou este script antes de um
# bump de PLAYWRIGHT_VERSION reusa o volume antigo (node_modules da versão
# velha), reproduzindo o mesmo "Executable doesn't exist" que o bump
# deveria corrigir (achado do Codex AI no PR da Story #449). Versões
# antigas do volume ficam órfãs — `docker volume prune` limpa quando
# quiser.
VOLUME_NAME="uniplus-e2e-node-modules-${PLAYWRIGHT_VERSION}"

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

for port in 8080 4200 4202 4212; do
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
PORTAL_SUBPATH_CID=""

cleanup() {
  echo ""
  echo "→ Teardown..."
  [[ -n "$SELECAO_PID" ]] && kill "$SELECAO_PID" 2>/dev/null || true
  [[ -n "$PORTAL_PID" ]] && kill "$PORTAL_PID" 2>/dev/null || true
  # nx serve spawna processos filhos que sobrevivem ao kill do PID pai
  fuser -k 4200/tcp 2>/dev/null || true
  fuser -k 4202/tcp 2>/dev/null || true
  wait "$SELECAO_PID" "$PORTAL_PID" 2>/dev/null || true
  [[ -n "$PORTAL_SUBPATH_CID" ]] && docker rm -f "$PORTAL_SUBPATH_CID" >/dev/null 2>&1 || true
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

# ─── 3.5. Portal sob subpath real (imagem Docker, Story #449) ────────────────
#
# O dev server acima (porta 4202) só serve na raiz — não exercita o
# nginx.conf.template parametrizado por subpath (Story #448) nem o
# redirect de logout relativo a document.baseURI (Story #447). Só a
# imagem Docker real (docker/Dockerfile.portal), com APP_BASE_HREF
# setado, reproduz isso. Roda em paralelo ao dev server, porta própria
# (4212), pra não competir com o alvo `portal-e2e` (root) de forma alguma.

if [[ "$TARGET" == "portal-e2e" || "$TARGET" == "all" ]]; then
  echo "→ Build da imagem do portal (subpath /portal/)..."
  docker build -q -t uniplus-portal-e2e-subpath -f "$REPO_ROOT/docker/Dockerfile.portal" "$REPO_ROOT" >/dev/null

  echo "→ Subindo portal sob subpath (porta 4212)..."
  # Bridge (não --network=host): o nginx do container escuta 8080 fixo
  # (nginx.conf.template) — precisa de -p pra mapear pra 4212 no host.
  # Sem chamada server-side ao Keycloak (é SPA estática), então bridge não
  # quebra nada: o runtime-config.json é lido pelo browser, que já
  # enxerga localhost:8080 (Keycloak) diretamente.
  PORTAL_SUBPATH_CID=$(docker run -d --rm \
    -p 4212:8080 \
    -e APP_BASE_HREF=/portal/ \
    uniplus-portal-e2e-subpath)

  echo -n "→ Aguardando o container ficar pronto"
  DEADLINE=$(( $(date +%s) + 60 ))
  until curl -sf "http://localhost:4212/portal/" > /dev/null 2>&1; do
    if [[ $(date +%s) -gt $DEADLINE ]]; then
      echo " TIMEOUT (porta 4212)"
      echo "  Logs: docker logs $PORTAL_SUBPATH_CID"
      exit 1
    fi
    printf '.'
    sleep 2
  done
  echo " OK"

  # ConfigMap de produção nunca é montado aqui — sobrescreve o placeholder
  # (que aborta o bootstrap de propósito, ADR-0021) com o Keycloak local
  # que a infra do runner já sobe acima.
  # -i é obrigatório — sem stdin interativo o heredoc não chega no
  # container via `docker exec`, e o arquivo fica vazio (achado
  # depurando a validação local da Story #449: app trava no bootstrap
  # com JSON vazio, sem erro óbvio no console).
  docker exec -i "$PORTAL_SUBPATH_CID" sh -c 'cat > /usr/share/nginx/html/assets/runtime-config.json' <<'EOF'
{"apiUrl":"http://localhost:5000","oidc":{"issuerUrl":"http://localhost:8080/realms/unifesspa","clientId":"portal-web"}}
EOF
fi

# ─── 4. Testes E2E ────────────────────────────────────────────────────────────

run_e2e() {
  local app="$1"
  local config="${2:-apps/$app/playwright.config.ts}"
  echo ""
  echo "→ Executando E2E: $app (chromium + firefox + webkit) [$config]"
  docker run --rm \
    --network=host \
    -e CI=true \
    -e KEYCLOAK_ADMIN_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD" \
    -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    -v "$REPO_ROOT:/workspace" \
    -v "$VOLUME_NAME:/workspace/node_modules" \
    "$IMAGE_NAME" \
    npx playwright test --config="$config" --workers=1
}

run_e2e_portal_subpath() {
  # Config própria (chromium apenas) — não faz parte da matriz completa
  # (chromium+firefox+webkit) porque valida infra de deploy (nginx/CSP/
  # subpath), não compatibilidade cross-browser da aplicação em si.
  run_e2e portal-e2e apps/portal-e2e/playwright.subpath.config.ts
}

case "$TARGET" in
  selecao-e2e) run_e2e selecao-e2e ;;
  portal-e2e)
    run_e2e portal-e2e
    run_e2e_portal_subpath
    ;;
  all)
    run_e2e selecao-e2e
    run_e2e portal-e2e
    run_e2e_portal_subpath
    ;;
esac

echo ""
echo "✓ Todos os E2E concluídos com sucesso."
