# UniPlus Web — Sistema Unificado CEPS

Frontend do Sistema Unificado CEPS da Unifesspa, construido como monorepo Nx com Angular 21.

## Aplicacoes

| App | Descricao | Porta |
|-----|-----------|-------|
| **selecao** | Gestao de processos seletivos (editais, inscricoes, homologacao, notas, classificacao) | 4200 |
| **ingresso** | Gestao de ingresso (chamadas, convocacoes, matriculas) | 4201 |
| **portal** | Portal publico do candidato (inscricao, acompanhamento, documentos, recursos) | 4202 |

## Bibliotecas compartilhadas

| Lib | Descricao |
|-----|-----------|
| **shared-ui** | Componentes reutilizaveis (cpf-input, data-table, file-upload, status-badge, etc.) |
| **shared-auth** | Autenticacao Keycloak (services, guards, interceptors) |
| **shared-data** | DTOs, API clients OpenAPI, utilitarios |

## Pre-requisitos

- Node.js 22.x LTS
- npm 10.x+
- Docker (para build de producao)

## Inicio rapido

```bash
# Instalar dependencias
npm install

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

## Stack

- Angular 21 / TypeScript 5.9
- Nx 22 (monorepo)
- PrimeNG 21 (componentes UI)
- Tailwind CSS 3 (estilizacao)
- Keycloak (autenticacao)
- Playwright (testes E2E)
- Vitest (testes unitarios)
