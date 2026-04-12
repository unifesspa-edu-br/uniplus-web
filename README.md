# UniPlus Web — Uni+ (S2U)

Frontend do Uni+ (S2U) da Unifesspa, construido como monorepo Nx com Angular 21.

## Aplicações

| App | Descrição | Porta |
|-----|-----------|-------|
| **selecao** | Gestão de processos seletivos (editais, inscrições, homologação, notas, classificação) | 4200 |
| **ingresso** | Gestão de ingresso (chamadas, convocações, matrículas) | 4201 |
| **portal** | Portal público do candidato (inscrição, acompanhamento, documentos, recursos) | 4202 |
| **poc-primeng** | POC de validação — PrimeNG unstyled + Gov.br Design System + Tailwind | 4203 |

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

## POC PrimeNG + Gov.br Design System

A aplicação `apps/poc-primeng/` é uma prova de conceito que validou a estratégia de UI do projeto. Conclusões:

**PrimeNG em modo unstyled + Gov.br DS é o caminho recomendado para desenvolvimento.**

### O que foi validado

- **PrimeNG unstyled mode**: componentes PrimeNG (Tabs, InputText, Select, RadioButton, Button, Dialog, ConfirmDialog, Message, DataTable) funcionam sem CSS próprio, recebendo estilos via PassThrough (`govbrPassThrough`)
- **Gov.br Design System**: tokens do `@govbr-ds/core` (cores, tipografia, espaçamento, bordas, focus ring) integrados como variáveis CSS e expostos via Tailwind `@theme` — 46 tokens mapeados
- **Acessibilidade**: focus ring dourado tracejado (4px #c2850c) validado em 7+ tipos de elementos interativos, navegação por teclado (Tab, Shift+Tab, Arrow keys, Enter, Escape), conformidade WCAG 2.1 AA
- **Responsividade**: layout funcional de 375px (mobile) a desktop

### Estratégia de estilização

```
@govbr-ds/core (tokens CSS) → Tailwind @theme (46 tokens) → PrimeNG PassThrough (classes Tailwind por slot)
```

1. **Importar tokens Gov.br**: `@govbr-ds/core/dist/core-tokens.min.css` (somente CSS, sem JS)
2. **Mapear em Tailwind**: variáveis CSS viram classes utilitárias (`bg-govbr-primary`, `text-govbr-danger`, `rounded-govbr-pill`)
3. **Aplicar no PrimeNG**: `govbrPassThrough` define classes Tailwind para cada slot de cada componente
4. **Custom focus ring**: overlay `<span>` com borda dourada tracejada, nunca cortado por overflow

### Cobertura de testes E2E (Playwright)

- `govbr-design-tokens.spec.ts` — 46 testes (tipografia, cores, bordas, focus ring, hover, espaçamento, layout)
- `keyboard-a11y.spec.ts` — 17 testes (navegação Tab/Shift+Tab, teclado em Select/Dialog/Tabs, consistência do focus ring)

### Arquivos-chave da POC

| Arquivo | Propósito |
|---------|-----------|
| `apps/poc-primeng/src/styles.css` | Tokens Gov.br → Tailwind @theme mapping |
| `apps/poc-primeng/src/main.ts` | Configuração PrimeNG unstyled + govbrPassThrough + focus ring overlay |
| `apps/poc-primeng/src/app/` | Componentes de formulário multi-step demonstrando a integração |
| `apps/poc-primeng-e2e/` | Suíte E2E completa validando tokens e acessibilidade |

## Stack

- Angular 21 / TypeScript 5.9
- Nx 22 (monorepo)
- PrimeNG 21 (modo unstyled + PassThrough)
- @govbr-ds/core 3.7 (design tokens — somente CSS)
- Tailwind CSS 4.2 (estilização utility-first com @theme)
- Keycloak (autenticação)
- Playwright (testes E2E)
- Vitest (testes unitários)
