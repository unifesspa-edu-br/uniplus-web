# UniPlus Web — Uni+ (S2U)

Frontend do Uni+ (S2U) da Unifesspa, construido como monorepo Nx com Angular 21.

## Aplicações

| App              | Descrição                                                                              | Porta | Client OIDC        |
| ---------------- | -------------------------------------------------------------------------------------- | ----- | ------------------ |
| **selecao**      | Gestão de processos seletivos (editais, inscrições, homologação, notas, classificação) | 4200  | `selecao-web`      |
| **ingresso**     | Gestão de ingresso (chamadas, convocações, matrículas)                                 | 4201  | `ingresso-web`     |
| **portal**       | Portal público do candidato (inscrição, acompanhamento, documentos, recursos)          | 4202  | `portal-web`       |
| **configuracao** | Painel administrativo de cadastros base e organização institucional                    | 4203  | `configuracao-web` |

## Bibliotecas compartilhadas

| Lib             | Descricao                                                                             |
| --------------- | ------------------------------------------------------------------------------------- |
| **shared-ui**   | Wrappers Angular reutilizaveis do Uni+ DS (CSS-only), shells, forms, dados e overlays |
| **shared-auth** | Autenticacao OIDC (services, guards, interceptors)                                    |
| **shared-data** | DTOs, API clients OpenAPI, utilitarios                                                |

## Pre-requisitos

- Node.js 22.x LTS
- npm 10.x+
- Docker Compose v2 (para rodar contra o backend local ou para build de produção)

## Início rápido com backend local

O desenvolvimento diário usa dois repositórios irmãos: o `uniplus-api` sobe a
infra, as APIs e o gateway por Docker; o `uniplus-web` roda a app escolhida com
hot reload via Nx. O guia completo, incluindo login e testes, está em
[`docs/tutorial-rodar-e-testar-a-aplicacao.md`](docs/tutorial-rodar-e-testar-a-aplicacao.md).

```bash
# Em uniplus-api (uma vez por clone)
cp docker/.env.example docker/.env
cp docker/docker-compose.override.example.yml docker/docker-compose.override.yml

# Infra, APIs e gateway; não inicia os containers *-web, deixando 4200-4203 livres.
docker compose -f docker/docker-compose.yml \
  -f docker/docker-compose.override.yml \
  up -d --build postgres redis kafka minio apicurio keycloak \
    uniplus-api geo-api portal-api traefik

# Em uniplus-web (requer Node 22.x — veja CONTRIBUTING.md para setup com nvm)
nvm use && npm ci

# Servir uma das aplicações com hot reload
npx nx serve selecao

# Abrir no navegador
open http://localhost:4200
```

## Comandos

```bash
# Servir
npx nx serve selecao
npx nx serve ingresso
npx nx serve portal
npx nx serve configuracao

# Build
npx nx run-many --target=build --all

# Testes
npx nx run-many --target=vite:test --all

# Lint
npx nx run-many --target=lint --all

# E2E
npx nx e2e selecao-e2e

# Gerar API clients
npm run generate:api

# Grafo de dependencias
npx nx graph
```

## Docker

```bash
docker build -f docker/Dockerfile.selecao -t uniplus-selecao .
docker build -f docker/Dockerfile.ingresso -t uniplus-ingresso .
docker build -f docker/Dockerfile.portal -t uniplus-portal .
```

## UI e Design System

O contrato visual vigente é o [Uni+ DS](https://github.com/unifesspa-edu-br/uniplus-ds), registrado na [ADR-0023](docs/adrs/0023-uniplus-ds-como-contrato-visual-vigente.md). O DS é CSS-only; o `uniplus-web` fornece wrappers Angular em `libs/shared-ui`.

### Estratégia de estilização

```
uniplus-ds CSS-only
  → libs/shared-ui/src/styles/{tokens,base,components}.css
  → apps/*/src/styles.css + Tailwind 4 @theme inline
  → componentes Angular ui-* via @uniplus/shared-ui
```

Regras principais:

- Usar tokens semânticos do Uni+ DS; não criar paleta paralela Tailwind.
- Usar componentes `ui-*` pequenos, standalone, OnPush e sem dependência de domínio.
- Preferir HTML nativo e Angular CDK; PrimeNG só quando houver ganho claro e encapsulado.
- Validar 320 px, teclado, foco visível, tema contraste e ausência de overflow horizontal.
- Imports TypeScript usam `@uniplus/shared-*`; imports CSS globais ainda usam caminhos relativos até `shared-ui` ter exports CSS como pacote.

## Stack

- Angular 21 / TypeScript 5.9
- Nx 22 (monorepo)
- Uni+ DS CSS-only via `libs/shared-ui/src/styles`
- PrimeNG 21 (uso legado/complexo encapsulado quando necessário)
- Tailwind CSS 4.2 (estilização utility-first com @theme)
- OIDC (autenticação)
- Playwright (testes E2E)
- Vitest (testes unitários)
