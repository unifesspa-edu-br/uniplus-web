# CLAUDE.md — uniplus-web

## Visao geral

Frontend do Sistema Unificado CEPS (UniPlus) da Unifesspa. Monorepo Nx com 3 aplicacoes Angular e 3 bibliotecas compartilhadas.

## Stack e versoes

- **Angular** 21.x (standalone components, signals, OnPush)
- **Nx** 22.x (monorepo, affected, caching)
- **PrimeNG** 21.x (componentes UI)
- **Tailwind CSS** 3.x (estilizacao utility-first)
- **Keycloak** (autenticacao via keycloak-angular)
- **Playwright** (testes E2E)
- **Vitest** (testes unitarios via @analogjs/vitest-angular)
- **TypeScript** 5.9.x (strict mode)

## Estrutura do workspace

```
apps/
  selecao/        → Modulo Selecao (gestao de editais, inscricoes, homologacao, notas, classificacao)
  selecao-e2e/    → Testes E2E do selecao
  ingresso/       → Modulo Ingresso (chamadas, convocacoes, matriculas)
  ingresso-e2e/   → Testes E2E do ingresso
  portal/         → Portal publico do candidato (inscricao, acompanhamento, documentos, recursos)
  portal-e2e/     → Testes E2E do portal

libs/
  shared-ui/      → Componentes reutilizaveis (cpf-input, data-table, file-upload, status-badge, etc.)
  shared-auth/    → Autenticacao Keycloak (auth.service, guards, interceptor, providers)
  shared-data/    → DTOs, API clients, utilitarios (cpf.util, date.util, api-error-handler)
```

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
