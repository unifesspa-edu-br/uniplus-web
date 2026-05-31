# UniPlus Web — Uni+ (S2U)

Frontend do Uni+ (S2U) da Unifesspa, construido como monorepo Nx com Angular 21.

## Aplicações

| App | Descrição | Porta |
|-----|-----------|-------|
| **selecao** | Gestão de processos seletivos (editais, inscrições, homologação, notas, classificação) | 4200 |
| **ingresso** | Gestão de ingresso (chamadas, convocações, matrículas) | 4201 |
| **portal** | Portal público do candidato (inscrição, acompanhamento, documentos, recursos) | 4202 |

## Bibliotecas compartilhadas

| Lib | Descricao |
|-----|-----------|
| **shared-ui** | Wrappers Angular reutilizaveis do Uni+ DS (CSS-only), shells, forms, dados e overlays |
| **shared-auth** | Autenticacao Keycloak (services, guards, interceptors) |
| **shared-data** | DTOs, API clients OpenAPI, utilitarios |

## Pre-requisitos

- Node.js 22.x LTS
- npm 10.x+
- Docker (para build de producao)

## Inicio rapido

```bash
# Instalar dependencias (requer Node 22.x — veja CONTRIBUTING.md para setup com nvm)
nvm use && npm install

# Servir a aplicacao selecao
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
- Keycloak (autenticação)
- Playwright (testes E2E)
- Vitest (testes unitários)
