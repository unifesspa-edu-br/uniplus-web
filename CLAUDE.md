# CLAUDE.md — uniplus-web

## Visao geral

Frontend do Uni+ (S2U) (UniPlus) da Unifesspa. Monorepo Nx com 3 aplicacoes Angular e 3 bibliotecas compartilhadas.

## Stack e versões

- **Angular** 21.x (standalone components, signals, OnPush)
- **Nx** 22.x (monorepo, affected, caching)
- **Uni+ DS** CSS-only (tokens semanticos, temas e anatomia HTML)
- **PrimeNG** 21.x (uso legado/complexo encapsulado quando necessário)
- **Tailwind CSS** 4.x (estilização utility-first com @theme)
- **OIDC** (autenticação; adapter atual via keycloak-angular)
- **Playwright** (testes E2E)
- **Vitest** (testes unitários via @analogjs/vitest-angular)
- **TypeScript** 5.9.x (strict mode)

## Estrutura do workspace

```
apps/
  selecao/        → Módulo Seleção (gestão de editais, inscrições, homologação, notas, classificação)
  selecao-e2e/    → Testes E2E do selecao
  ingresso/       → Módulo Ingresso (chamadas, convocações, matrículas)
  ingresso-e2e/   → Testes E2E do ingresso
  portal/         → Portal público do candidato (inscrição, acompanhamento, documentos, recursos)
  portal-e2e/     → Testes E2E do portal

libs/
  shared-ui/      → Componentes reutilizáveis (cpf-input, data-table, file-upload, status-badge, etc.)
  shared-auth/    → Autenticação OIDC (auth.service, guards, interceptor, providers)
  shared-data/    → DTOs, API clients, utilitários (cpf.util, date.util, api-error-handler)

docs/referencias/
  poc-primeng/    → Código histórico da POC (read-only, fora do workspace Nx) — ADR-0022
  poc-primeng-e2e/→ Suíte E2E histórica da POC (read-only, fora do workspace Nx) — ADR-0022
```

## Estratégia de UI — Uni+ DS CSS-only + wrappers Angular

Estratégia vigente registrada na ADR-0023. O `uniplus-ds` é a fonte canonica CSS-only para tokens, temas, anatomia HTML, ARIA, foco e responsividade. O `uniplus-web` implementa wrappers Angular em `libs/shared-ui` sem criar um design system paralelo.

### Arquitetura de estilização

```
uniplus-ds CSS-only
  → libs/shared-ui/src/styles/{tokens,base,components}.css
  → Tailwind 4 @theme inline (tokens semanticos)
  → componentes Angular ui-* importados por @uniplus/shared-ui
```

1. Apps importam `tokens.css`, `base.css` e `components.css` antes do Tailwind.
2. `@theme inline` expõe tokens semânticos sem duplicar valores.
3. Componentes `ui-*` consomem classes canonicas do DS (`btn`, `field`, `table-responsive`, `alert`, `tag`, etc.).
4. Temas são controlados por `data-theme="auto|light|dark|contrast"` e `data-font-mode="legible"` no shell.

### Regras de estilização

- **Sempre** usar tokens semanticos do Uni+ DS; nao usar paletas Tailwind genericas como API visual.
- **Sempre** criar componentes `ui-*` standalone, OnPush e sem dependência de domínio.
- **Nunca** expor classes CSS como API publica de componente.
- **Nunca** importar temas PrimeNG (Aura, Lara, etc.).
- **Preferir** HTML nativo e Angular CDK; PrimeNG só com ganho claro em comportamento complexo e encapsulado.
- **Validar** 320 px, teclado, foco visivel, tema contraste, zoom 200% e ausência de overflow horizontal.
- **Manter** imports TypeScript por `@uniplus/shared-*`. Imports CSS globais permanecem relativos até `shared-ui` ter exports CSS como pacote resolvivel pelo builder.

### Arquivos de referência

| Arquivo | O que contém |
|---------|-------------|
| `libs/shared-ui/src/styles/tokens.css` | Tokens semanticos do Uni+ DS |
| `libs/shared-ui/src/styles/base.css` | Reset, tipografia, foco, skip link e utilitarios base |
| `libs/shared-ui/src/styles/components.css` | Classes canonicas de componentes CSS-only |
| `apps/<app>/src/styles.css` | Imports da foundation + `@source` + `@theme inline` |
| `docs/referencias/poc-primeng/` | POC historica read-only; nao governa novas implementacoes |

## Path aliases

- `@uniplus/shared-ui` → `libs/shared-ui/src/index.ts`
- `@uniplus/shared-auth` → `libs/shared-auth/src/index.ts`
- `@uniplus/shared-data` → `libs/shared-data/src/index.ts`

## Padroes de componentes

- **Sempre** standalone components (sem NgModules)
- **Sempre** `ChangeDetectionStrategy.OnPush`
- **Sempre** signals para estado reativo
- **Nunca** `any` — tipagem estrita obrigatoria
- **Lazy loading** para todas as feature routes
- Reactive Forms com tipagem forte
- Strings user-facing em pt-BR

## Comandos uteis

```bash
# Servir aplicacoes
npx nx serve selecao          # porta 4200
npx nx serve ingresso         # porta 4201
npx nx serve portal           # porta 4202

# Build
npx nx build selecao
npx nx run-many --target=build --all

# Testes unitarios
npx nx vite:test selecao
npx nx run-many --target=vite:test --all

# Lint
npx nx lint selecao
npx nx run-many --target=lint --all

# Testes E2E
npx nx e2e selecao-e2e

# Grafo de dependencias
npx nx graph

# Gerar API clients
npm run generate:api

# Affected (CI)
npx nx affected --target=build
npx nx affected --target=vite:test
```

## Localização do repositório

**REGRA ABSOLUTA:** este repositório deve estar clonado em `repositories/uniplus-web/` dentro do diretório de trabalho do projeto. NUNCA clonar ou criar cópias fora de `repositories/`.

## Git conventions

- Conventional commits em pt-BR: `feat(selecao): adicionar listagem de editais`
- Feature branches: `feature/editais-crud`, `fix/validacao-cpf`
- Nunca commitar na main

## Regras criticas

- LGPD: CPF mascarado em logs (`***.***.***-XX`)
- Soft delete: nunca deletar registros fisicamente
- Acessibilidade: ARIA em componentes interativos, WCAG 2.1 AA
- Seguranca: tokens JWT via OIDC, nunca em localStorage
