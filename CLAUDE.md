# CLAUDE.md — uniplus-web

## Visao geral

Frontend do Uni+ (S2U) (UniPlus) da Unifesspa. Monorepo Nx com 3 aplicacoes Angular e 3 bibliotecas compartilhadas.

## Stack e versões

- **Angular** 21.x (standalone components, signals, OnPush)
- **Nx** 22.x (monorepo, affected, caching)
- **PrimeNG** 21.x (modo unstyled + PassThrough com tokens Gov.br)
- **@govbr-ds/core** 3.7.x (design tokens CSS — sem JS)
- **Tailwind CSS** 4.x (estilização utility-first com @theme)
- **Keycloak** (autenticação via keycloak-angular)
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
  poc-primeng/    → POC: PrimeNG unstyled + Gov.br DS + Tailwind (referência de implementação)
  poc-primeng-e2e/→ Testes E2E da POC (46 testes de tokens + 17 de acessibilidade)

libs/
  shared-ui/      → Componentes reutilizáveis (cpf-input, data-table, file-upload, status-badge, etc.)
  shared-auth/    → Autenticação Keycloak (auth.service, guards, interceptor, providers)
  shared-data/    → DTOs, API clients, utilitários (cpf.util, date.util, api-error-handler)
```

## Estratégia de UI — PrimeNG unstyled + Gov.br Design System

**Validado via POC (`apps/poc-primeng/`).** Esta é a estratégia obrigatória para todos os componentes do sistema.

### Arquitetura de estilização

```
@govbr-ds/core (tokens CSS) → Tailwind @theme (46 tokens) → PrimeNG PassThrough (classes por slot)
```

1. Tokens Gov.br importados de `@govbr-ds/core/dist/core-tokens.min.css` (somente CSS, sem runtime JS)
2. Tokens mapeados como extensões do Tailwind via `@theme` (ex.: `bg-govbr-primary`, `text-govbr-danger`)
3. PrimeNG em **modo unstyled** — estilos aplicados via objeto `govbrPassThrough` que define classes Tailwind para cada slot de cada componente
4. Focus ring customizado: overlay `<span>` com borda dourada tracejada (4px #c2850c), compatível com WCAG 2.1 AA

### Regras de estilização

- **Sempre** usar PrimeNG em modo unstyled com PassThrough
- **Sempre** usar tokens Gov.br via classes Tailwind (`bg-govbr-*`, `text-govbr-*`, `rounded-govbr-*`)
- **Nunca** importar temas PrimeNG (Aura, Lara, etc.)
- **Nunca** usar cores hardcoded — sempre tokens
- **Nunca** sobrescrever focus ring nativo sem usar o overlay Gov.br
- A POC (`apps/poc-primeng/`) é a **referência de implementação** — consultar antes de criar novos componentes

### Arquivos de referência da POC

| Arquivo | O que contém |
|---------|-------------|
| `apps/poc-primeng/src/styles.css` | Mapeamento completo de 46 tokens Gov.br → Tailwind @theme |
| `apps/poc-primeng/src/main.ts` | Configuração PrimeNG unstyled + `govbrPassThrough` + focus ring overlay |
| `apps/poc-primeng/src/app/` | Componentes de exemplo (formulário multi-step com validação) |
| `apps/poc-primeng-e2e/src/` | Suíte E2E: `govbr-design-tokens.spec.ts` (46 testes) + `keyboard-a11y.spec.ts` (17 testes) |

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
- Seguranca: tokens JWT via Keycloak, nunca em localStorage
