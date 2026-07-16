#!/usr/bin/env bash

# Regressão de #462: executa o template Nginx na mesma imagem de produção e
# verifica hard reload de rota aninhada, base absoluto e assets sob o subpath.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="nginxinc/nginx-unprivileged:1.27-alpine"
TEMPLATE="$REPO_ROOT/docker/nginx.conf.template"
PREPARE_BASE_HREF="$REPO_ROOT/docker/prepare-base-href.envsh"
FIXTURE_DIR="$(mktemp -d)"
CONTAINERS=()

# nginxinc/nginx-unprivileged executa como UID 101 e precisa atravessar o
# diretório temporário montado no container.
chmod 755 "$FIXTURE_DIR"

cleanup() {
  for container in "${CONTAINERS[@]}"; do
    docker rm -f "$container" >/dev/null 2>&1 || true
  done
  rm -rf "$FIXTURE_DIR"
}
trap cleanup EXIT

for command in curl docker grep mktemp; do
  command -v "$command" >/dev/null || {
    echo "ERRO: comando obrigatório ausente: $command" >&2
    exit 1
  }
done

mkdir -p "$FIXTURE_DIR/assets"
printf '%s\n' '<!doctype html><html><head><base href="/"></head><body>Uni+</body></html>' \
  > "$FIXTURE_DIR/index.html"
printf '%s\n' 'console.log("asset-ok");' > "$FIXTURE_DIR/assets/main.js"
printf '%s\n' '{"apiUrl":"https://api.invalid"}' > "$FIXTURE_DIR/assets/runtime-config.json"
printf '%s\n' '<!doctype html><title>silent</title>' > "$FIXTURE_DIR/assets/silent-check-sso.html"

run_case() {
  local name="$1"
  local base_href="$2"
  local container="uniplus-web-base-href-${name}-$$"
  local host_port
  local html

  CONTAINERS+=("$container")
  docker run -d --rm --name "$container" -P \
    -e "APP_BASE_HREF=$base_href" \
    -e 'NGINX_ENVSUBST_FILTER=^APP_BASE_(HREF|PATH)$' \
    -v "$TEMPLATE:/etc/nginx/templates/default.conf.template:ro" \
    -v "$PREPARE_BASE_HREF:/docker-entrypoint.d/10-prepare-base-href.envsh:ro" \
    -v "$FIXTURE_DIR:/usr/share/nginx/html:ro" \
    "$IMAGE" >/dev/null

  for _ in {1..20}; do
    host_port="$(docker port "$container" 8080/tcp 2>/dev/null | head -1 | sed 's/.*://')"
    if [[ -n "$host_port" ]] && curl --fail --silent "http://127.0.0.1:$host_port/health.json" >/dev/null; then
      break
    fi
    sleep 0.25
  done

  [[ -n "${host_port:-}" ]] || {
    echo "ERRO: Nginx não publicou a porta para $name" >&2
    docker logs "$container" >&2 || true
    exit 1
  }

  if ! html="$(curl --fail --silent --show-error "http://127.0.0.1:$host_port${base_href}rota/aninhada")"; then
    docker logs "$container" >&2 || true
    exit 1
  fi
  grep -Fq "<base href=\"$base_href\">" <<<"$html"
  if [[ "$base_href" != / ]]; then
    if ! curl --fail --silent --show-error --location "http://127.0.0.1:$host_port${base_href%/}" \
      | grep -Fq "<base href=\"$base_href\">"; then
      docker logs "$container" >&2 || true
      exit 1
    fi
  fi
  curl --fail --silent --show-error "http://127.0.0.1:$host_port${base_href}assets/main.js" \
    | grep -Fq 'asset-ok'
  curl --fail --silent --show-error "http://127.0.0.1:$host_port${base_href}assets/runtime-config.json" \
    | grep -Fq 'apiUrl'
  docker exec "$container" nginx -t >/dev/null

  echo "ok   $name ($base_href)"
}

# Raiz preserva standalone-compact/lab. Os quatro apps exercitam uma rota com
# dois segmentos sob subpath, exatamente o cenário que falhava com `./`.
run_case root /
run_case portal /portal/
run_case selecao /selecao/
run_case ingresso /ingresso/
run_case configuracao /configuracao/

for dockerfile in "$REPO_ROOT"/docker/Dockerfile.{portal,selecao,ingresso,configuracao}; do
  grep -Fq 'ENV APP_BASE_HREF=/' "$dockerfile"
  grep -Fq 'docker/nginx.conf.template' "$dockerfile"
  grep -Fq 'docker/prepare-base-href.envsh' "$dockerfile"
done

echo '5 cenários de base href validados.'
