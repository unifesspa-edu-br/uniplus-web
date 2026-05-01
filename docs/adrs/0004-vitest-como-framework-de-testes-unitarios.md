---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0004: Vitest como framework de testes unitários

## Contexto e enunciado do problema

O `uniplus-web` precisa de um framework de testes unitários para componentes Angular, services, pipes e utilidades de bibliotecas compartilhadas. A escolha precisa integrar bem com o build system Nx (ADR-0003), com o pipeline Vite já adotado pelo Angular CLI moderno e com a estratégia de affected tests no CI.

Durante o scaffolding do workspace, a opção padrão do Nx 22 para projetos Angular passou a ser Vitest via `@analogjs/vitest-angular`, em substituição ao Jest tradicional.

## Drivers da decisão

- Reaproveitar o pipeline Vite já configurado para build, evitando uma segunda pipeline de transformação.
- Configuração unificada (um único `vite.config.mts` por projeto) versus arquivos separados (`jest.config.ts`).
- Alinhamento com o padrão atual do Nx 22 para projetos Angular.
- API de assertions familiar (`expect`, `describe`, `it`) para reduzir atrito na migração de exemplos.

## Opções consideradas

- Vitest via `@analogjs/vitest-angular`.
- Jest via `jest-preset-angular`.
- Web Test Runner (`@web/test-runner`) com navegador real.

## Resultado da decisão

**Escolhida:** Vitest 4.x como framework de testes unitários, integrado ao Angular via `@analogjs/vitest-angular` 2.x.

Stack de testes unitários:

| Componente              | Tecnologia                  |
|-------------------------|-----------------------------|
| Test runner             | Vitest 4.x                  |
| Integração Angular      | @analogjs/vitest-angular 2.x|
| Cobertura               | @vitest/coverage-v8 4.x     |
| Ambiente DOM            | jsdom                       |
| Setup                   | `src/test-setup.ts`         |

Configuração centralizada em `vite.config.mts` por projeto. Major versions de Vitest e do plugin Angular ficam pinned no `package.json` para evitar surpresas em atualizações.

## Consequências

### Positivas

- Execução de testes mais rápida por reutilizar o pipeline Vite.
- Configuração simplificada em um único arquivo por projeto.
- Hot module replacement em modo watch (`vitest --watch`).
- UI de debugging via `@vitest/ui` quando necessário.
- Menos atrito com atualizações futuras do Nx, que padronizou Vitest para Angular.

### Negativas

- Ecossistema de plugins menor que o do Jest.
- Documentação Angular específica para Vitest ainda menos abundante que para Jest.
- Equipe pode ter familiaridade prévia com Jest e precisar de ramp-up curto.

### Neutras

- A API de assertions é largamente compatível com Jest, então exemplos da comunidade podem ser portados com baixa fricção.

## Confirmação

- `npx nx vite:test <projeto>` é o comando canônico de execução local.
- Pipeline de CI executa `nx affected --target=vite:test` em PRs.

## Mais informações

- ADR-0003 detalha o uso do Nx.
- Documentação: [Analog Vitest Angular](https://analogjs.org/docs/features/testing/vitest), [Nx Vitest Plugin](https://nx.dev/nx-api/vitest).
- **Origem:** revisão da ADR interna Uni+ ADR-016 (não publicada).
