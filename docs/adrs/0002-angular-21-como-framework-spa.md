---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0002: Angular 21 como framework SPA

## Contexto e enunciado do problema

O `uniplus-web` precisa de um framework SPA que sustente formulários complexos com validação tipada (inscrições com dezenas de campos, dependências condicionais e regras de cota), tabelas de dados administrativas, upload de documentos e acessibilidade obrigatória. A equipe é pequena e mantida por servidores da Unifesspa, exigindo uma stack opinada com documentação ampla, ciclo LTS e baixa rotatividade arquitetural.

A escolha do framework precisa também ser compatível com a estratégia de UI baseada em PrimeNG unstyled + tokens Gov.br (ADR-0006/0007/0008) e com a obrigatoriedade de manter Zone.js (ADR-0005).

## Drivers da decisão

- Formulários complexos com tipagem forte (Reactive Forms tipados).
- Equipe pequena, com benefício em frameworks opinados.
- Ciclo LTS estável e suporte a longo prazo (vida útil ≥ 5 anos do sistema).
- TypeScript em strict mode como padrão de qualidade.
- Compatibilidade com bibliotecas de componentes maduras voltadas a Angular.

## Opções consideradas

- Angular 21 com TypeScript 5.9 strict.
- React + biblioteca de componentes (ex.: Material UI ou Ant Design).
- Vue 3 com Composition API.

## Resultado da decisão

**Escolhida:** Angular 21 (standalone components, signals, OnPush change detection) com TypeScript 5.9 em strict mode.

Padrões obrigatórios derivados desta escolha:

- **Sempre** standalone components (sem NgModules).
- **Sempre** `ChangeDetectionStrategy.OnPush`.
- **Sempre** signals para estado reativo.
- Reactive Forms tipados para todos os formulários.
- Lazy loading em todas as feature routes.
- Strict mode do TypeScript ligado em todos os projetos do workspace.

Angular oferece um framework opinado com router, forms e DI integrados, reduzindo decisões arbitrárias e divergência de estilo entre os apps. Signals e standalone components, estabilizados nas versões 17–21, modernizam a API reativa e simplificam o bootstrap das aplicações.

## Consequências

### Positivas

- Reactive Forms tipados eliminam classes inteiras de bugs de formulário em compile time.
- Standalone + signals reduzem boilerplate e tornam o grafo de dependências por feature explícito.
- Ciclo LTS de 18 meses por major, com `nx migrate` cobrindo grande parte das atualizações automaticamente.
- Ecossistema maduro com PrimeNG, Keycloak Angular e ferramentas de teste integradas (Vitest, Playwright).

### Negativas

- Curva de aprendizado mais íngreme que React/Vue para desenvolvedores iniciantes.
- Bundle inicial maior que frameworks minimalistas; mitigado por lazy loading e tree-shaking.
- Atualizações entre majors podem exigir ajustes em bibliotecas de terceiros.

### Neutras

- A escolha de Angular fixa a integração de UI em torno do PrimeNG (ADR-0007), não em bibliotecas voltadas a React/Vue.

## Confirmação

- ESLint com `@angular-eslint` aplicado em todos os apps e libs do workspace.
- `tsconfig.base.json` exige `strict: true` e `strictTemplates: true`.
- `nx migrate` é a ferramenta canônica para promover atualizações entre majors.

## Mais informações

- ADR-0003 detalha o uso do Nx como build system.
- ADR-0005 explica a permanência de Zone.js no Angular 21.
- **Origem:** revisão da ADR interna Uni+ ADR-006 (não publicada).
