# Architecture Decision Records — `uniplus-web`

Base canônica de decisões arquiteturais do `uniplus-web`, formato [MADR 4.0](https://adr.github.io/madr/).

Cada ADR registra **uma única decisão**. Histórico de decisões institucionais que originaram parte deste acervo permanece em documentação interna não publicada — quando relevante, a seção `Mais informações` de cada ADR cita a origem como `Origem: revisão da ADR interna Uni+ ADR-NNN (não publicada)`.

## Estrutura

- Cada ADR em arquivo `NNNN-titulo-em-slug.md` (4 dígitos, slug ASCII).
- Frontmatter YAML obrigatório com `status`, `date`, `decision-makers`.
- Seções fixas: Contexto, Drivers, Opções, Resultado da decisão (única), Consequências, Confirmação opcional, Mais informações.
- Conteúdo em pt-BR; chaves do frontmatter em inglês para compatibilidade com ferramentas MADR.

## Linter

Validador local em [`tools/adr-lint/`](../../tools/adr-lint/README.md):

```bash
bash tools/adr-lint/validate.sh
```

Adicionalmente:

```bash
npx markdownlint-cli2 'docs/adrs/**/*.md'
```

## Índice

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| [0001](0001-separacao-em-tres-aplicacoes-frontend.md) | Separação em três aplicações frontend (Seleção, Ingresso, Portal) | accepted | 2026-05-01 |
| [0002](0002-angular-21-como-framework-spa.md) | Angular 21 como framework SPA | accepted | 2026-05-01 |
| [0003](0003-nx-como-build-system-do-monorepo-frontend.md) | Nx como build system do monorepo frontend | accepted | 2026-05-01 |
| [0004](0004-vitest-como-framework-de-testes-unitarios.md) | Vitest como framework de testes unitários | accepted | 2026-05-01 |
| [0005](0005-manter-zonejs-no-angular-21.md) | Manter Zone.js no Angular 21 | accepted | 2026-05-01 |
| [0006](0006-govbr-design-system-como-contrato-visual.md) | Adoção do Gov.br Design System como contrato visual | superseded by ADR-0023 | 2026-05-01 |
| [0007](0007-primeng-em-modo-unstyled.md) | PrimeNG em modo unstyled como component library | superseded by ADR-0023 | 2026-05-01 |
| [0008](0008-tailwind-css-4-com-tokens-govbr.md) | Tailwind CSS 4 com tokens Gov.br via `@theme` | superseded by ADR-0023 | 2026-05-01 |
| [0009](0009-provedor-oidc-do-uniplus-web.md) | Provedor OIDC do `uniplus-web` | accepted | 2026-05-01 |
| [0010](0010-opentelemetry-para-instrumentacao-frontend.md) | OpenTelemetry para instrumentação do `uniplus-web` (RUM) | accepted | 2026-05-01 |
| [0011](0011-consumer-adapter-api-result.md) | Consumer adapter `ApiResult<T>` em nova lib `libs/shared-http` | superseded by ADR-0012 | 2026-05-03 |
| [0012](0012-placement-api-result-em-shared-core.md) | Placement do `ApiResult<T>` em subpasta de `shared-core`, não em nova lib | accepted | 2026-05-04 |
| [0013](0013-gerador-openapi-node-only.md) | Gerador OpenAPI Node-only (`openapi-typescript`) em vez de `openapi-generator-cli` | accepted | 2026-05-05 |
| [0014](0014-idempotency-key-cliente-via-http-context.md) | Idempotency-Key cliente via `HttpContext` + UUID v7, anexado pelo `apiResultInterceptor` | accepted | 2026-05-05 |
| [0015](0015-cursor-pagination-consumer-link-header.md) | Cursor pagination consumer via parser de `Link` header — decode no caller, não no interceptor | accepted | 2026-05-06 |
| [0016](0016-vendor-mime-consumer-via-http-context.md) | Vendor MIME consumer via `HttpContext` — `withVendorMime` declara o recurso e o `apiResultInterceptor` anexa `Accept` | accepted | 2026-05-06 |
| [0017](0017-pattern-feature-page-container-presentational.md) | Páginas de feature no padrão container/presentational — `XxxPage` smart + `ui-*` dumb | accepted | 2026-05-06 |
| [0018](0018-adocao-httpresource-via-wrapper-use-api-resource.md) | Adoção de `httpResource` Angular 21 via wrapper `useApiResource` em `shared-core` | accepted | 2026-05-07 |
| [0019](0019-tokens-govbr-compartilhados-em-shared-ui.md) | Tokens Gov.br compartilhados em `libs/shared-ui/src/styles/govbr-tokens.css` + migração Tailwind 3→4 cross-app | superseded by ADR-0023 | 2026-05-07 |
| [0020](0020-registry-ghcr-e-tagging.md) | GitHub Container Registry e estratégia de tagging das imagens da `uniplus-web` | accepted | 2026-05-08 |
| [0021](0021-runtime-config-via-token.md) | Runtime config via `AUTH_CONFIG` InjectionToken + fitness cross-app | accepted | 2026-05-09 |
| [0022](0022-retirada-poc-primeng-do-workspace-ativo.md) | Retirada da POC `poc-primeng` do workspace Nx ativo | accepted | 2026-05-09 |
| [0023](0023-uniplus-ds-como-contrato-visual-vigente.md) | Uni+ DS como contrato visual vigente | accepted | 2026-05-30 |
| [0024](0024-uso-seletivo-primeng-wrappers-ui.md) | Uso seletivo de PrimeNG em wrappers `ui-*` | accepted | 2026-05-31 |
| [0025](0025-autoria-css-scss-no-angular.md) | Autoria CSS/SCSS nos componentes Angular | accepted | 2026-05-31 |

## Como adicionar um novo ADR

1. Identifique o próximo número sequencial (`ls docs/adrs/[0-9]*.md | wc -l`).
2. Copie [`_template.md`](_template.md).
3. Renomeie para `NNNN-titulo-em-slug.md` (slug ASCII em minúsculas, hífens como separador).
4. Preencha frontmatter, contexto, drivers, opções, resultado da decisão (única), consequências.
5. Rode o linter (`bash tools/adr-lint/validate.sh`).
6. Adicione linha ao índice acima.
7. Abra PR.
