---
status: "accepted"
date: "2026-05-09"
decision-makers:
  - "Tech Lead"
consulted:
  - "Equipe Frontend"
informed:
  - "DevOps"
  - "Equipe `uniplus-web`"
---

# ADR-0022: Retirada da POC `poc-primeng` do workspace Nx ativo

## Contexto e enunciado do problema

A POC `apps/poc-primeng/` foi entregue como prova de viabilidade da estratégia PrimeNG em modo unstyled + tokens Gov.br DS, ratificada pelas [ADR-0006](0006-govbr-design-system-como-contrato-visual.md), [ADR-0007](0007-primeng-em-modo-unstyled.md) e [ADR-0008](0008-tailwind-css-4-com-tokens-govbr.md). Os 45 tokens Gov.br foram promovidos à foundation compartilhada `libs/shared-ui/src/styles/govbr-tokens.css` na D.1 (PR #215), e os 3 apps de produção (`selecao`, `ingresso`, `portal`) cutoveraram para Tailwind 4 + foundation compartilhada na D.2 (PR #225) e D.3 (PR #218), conforme [ADR-0019](0019-tokens-govbr-compartilhados-em-shared-ui.md).

A POC continuava no workspace ativo, gerando custo permanente sem agregar valor:

- `apps/poc-primeng/` carregava `tags: []`, ficando fora do enforcement das `depConstraints` `scope:*` em `eslint.config.mjs` silenciosamente.
- `apps/poc-primeng-e2e/` mantinha 46 testes de tokens + 17 de acessibilidade que `nx affected` redisparava em qualquer mudança estrutural (`package-lock.json`, `nx.json`, `tsconfig.base.json`, `eslint.config.mjs`, `ci.yml`), adicionando ~3-5 min de CI por PR.
- A POC poluía `nx graph` e a superfície de governança planejada para a Onda 1 (Epic [#243](https://github.com/unifesspa-edu-br/uniplus-web/issues/243)).

A pergunta operacional: a POC já cumpriu seu papel — ela deve continuar como projeto ativo, ser arquivada como referência, ou ser deletada por completo?

## Drivers da decisão

- **Custo de CI** — `nx affected` ressuscitava 63 testes E2E da POC em qualquer PR estrutural; preço pago em todas as PRs do repo.
- **Governança** — a POC com `tags: []` é um buraco no enforcement de boundaries (Epic [#243](https://github.com/unifesspa-edu-br/uniplus-web/issues/243)).
- **Histórico arquitetural** — o código da POC tem valor pedagógico: mostra um setup PrimeNG unstyled mínimo (sem foundation), referenciado por ADR-0007/0008/0017/0019.
- **Reversibilidade** — a foundation `libs/shared-ui/src/styles/govbr-tokens.css` está consolidada em produção; a POC não precisa servir mais como rede de segurança.

## Opções consideradas

- **A. Manter no workspace ativo** — `apps/poc-primeng/` permanece e o custo de CI é tolerado.
- **B. Deletar completamente** — `git rm -rf apps/poc-primeng* apps/poc-primeng-e2e*`; histórico via `git log`.
- **C. Mover para `docs/referencias/poc-primeng/` (read-only, fora do Nx)** — preserva código como referência viva navegável e remove do auto-discovery do Nx.

## Resultado da decisão

**Escolhida:** "Opção C", porque preserva o valor pedagógico da POC sem custo recorrente de CI nem ruído em `nx graph`.

A POC foi movida para `docs/referencias/poc-primeng/` e `docs/referencias/poc-primeng-e2e/`. Os arquivos de configuração que tornavam o diretório descobrível pelos plugins do Nx foram removidos:

| Arquivo | Plugin que descobria |
|---|---|
| `project.json` | core Nx |
| `vite.config.mts` | `@nx/vite/plugin` |
| `playwright.config.ts` | `@nx/playwright/plugin` |
| `eslint.config.mjs` (POC + e2e) | `@nx/eslint/plugin` |

Permanecem (como referência histórica navegável): `src/`, `public/`, `screenshots/`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `findings.md`. O código não é mais build-able pelo workspace; consulta serve apenas como exemplo de PrimeNG unstyled puro com `@theme {...}` direto (pré-foundation).

## Consequências

### Positivas

- `nx graph` lista 12 projects (era 14): apps de produção + e2e + 5 libs `shared-*`.
- `nx affected` para mudanças estruturais não dispara mais 63 testes da POC — economia de ~3-5 min por PR estrutural.
- Eixo de governança da Onda 1 (Epic [#243](https://github.com/unifesspa-edu-br/uniplus-web/issues/243)) opera sem o buraco `tags: []` da POC.
- Código da POC permanece versionado e navegável em `docs/referencias/poc-primeng/`, citável em ADRs.

### Negativas

- Revivar a POC como projeto ativo exige restaurar os arquivos de config Nx removidos (`project.json`, `vite.config.mts`, `playwright.config.ts`, `eslint.config.mjs`) — custo low, mas não-zero.
- ADRs antigas (0007, 0008, 0017, 0019) precisaram ter os paths atualizados de `apps/poc-primeng/` para `docs/referencias/poc-primeng/`.

### Neutras

- O conteúdo de `src/` permanece em forma de código TypeScript válido — alguma IDE ainda pode reconhecê-lo via `tsconfig.json` local; o que muda é a invocação por Nx targets (`build`, `test`, `e2e`).

## Confirmação

- `nx show projects` retorna 12 projects, sem `poc-primeng` ou `poc-primeng-e2e`.
- `nx run-many --target=build --all` e `nx run-many --target=e2e --all` não incluem a POC.
- `git ls-tree -r HEAD apps/` não lista mais subpastas `poc-primeng*`.
- `docs/referencias/poc-primeng/src/main.ts` permanece legível.

## Prós e contras das opções

### A. Manter no workspace ativo

- Bom, porque zero churn — nenhuma ADR, nenhum CI a ajustar.
- Ruim, porque paga custo de CI permanente por valor zero — POC já validou tudo o que tinha a validar.
- Ruim, porque `tags: []` cria buraco silencioso no enforcement de boundaries da Onda 1.

### B. Deletar completamente

- Bom, porque elimina qualquer custo futuro com a POC.
- Ruim, porque ADRs 0007/0008/0017/0019 referenciam código vivo da POC como "validação atual" — quebrar esses links exige reescrita extensa.
- Ruim, porque o código tem valor pedagógico recuperável: estilo `@theme {...}` direto sem foundation só existe lá.

### C. Mover para `docs/referencias/poc-primeng/`

- Bom, porque preserva a navegabilidade do código histórico.
- Bom, porque o auto-discovery do Nx ignora `docs/` quando os arquivos de config são removidos.
- Bom, porque ADRs antigas continuam válidas com path bump simples.
- Ruim, porque exige decisão consciente sobre quais arquivos remover (configs de plugin Nx) vs preservar (`tsconfig*`, `src/`).

## Mais informações

- [ADR-0006](0006-govbr-design-system-como-contrato-visual.md) — Adoção do Gov.br Design System como contrato visual.
- [ADR-0007](0007-primeng-em-modo-unstyled.md) — PrimeNG em modo unstyled.
- [ADR-0008](0008-tailwind-css-4-com-tokens-govbr.md) — Tailwind CSS 4 com tokens Gov.br.
- [ADR-0017](0017-pattern-feature-page-container-presentational.md) — Pattern feature page container/presentational.
- [ADR-0019](0019-tokens-govbr-compartilhados-em-shared-ui.md) — Tokens Gov.br compartilhados em `shared-ui`.
- [Epic #243](https://github.com/unifesspa-edu-br/uniplus-web/issues/243) — Plataforma de bibliotecas e governança do workspace (Onda 1).
- [Issue #242](https://github.com/unifesspa-edu-br/uniplus-web/issues/242) — Issue desta retirada.
