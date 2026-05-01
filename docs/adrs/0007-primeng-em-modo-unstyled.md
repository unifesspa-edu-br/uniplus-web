---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0007: PrimeNG em modo unstyled como component library

## Contexto e enunciado do problema

Adotado o Gov.br Design System como contrato visual canônico (ADR-0006), o `uniplus-web` precisa de uma biblioteca de componentes Angular que cubra o catálogo necessário (formulários complexos, tabelas com paginação e filtros, calendar, dialog, file upload, select com virtualScroll, tabs, multi-step wizard) sem impor um tema próprio que conflite com os tokens Gov.br.

O wrapper oficial `@govbr-ds/webcomponents-angular` foi descartado por pre-release crônico, bugs em roteamento SPA e catálogo limitado (~36 componentes). Bibliotecas com tema próprio (PrimeNG default, Angular Material com Material Design) implicariam em sobrescrever estilos via especificidade — abordagem frágil e cara em manutenção.

## Drivers da decisão

- Catálogo amplo de componentes prontos (≥ 80 componentes maduros).
- Possibilidade de aplicar identidade visual externa sem sobrescrever CSS por especificidade.
- Acessibilidade ARIA nativa (roles, atributos, navegação por teclado).
- Integração nativa com Reactive Forms tipados e signals.
- Compatibilidade com Zone.js (ADR-0005) — bibliotecas que exigem zoneless ficam fora.

## Opções consideradas

- PrimeNG 21 em modo unstyled, com PassThrough API aplicando classes Tailwind por slot.
- PrimeNG 21 com tema próprio (Aura/Lara) e overrides via CSS.
- Angular Material com tema customizado.
- Construir componentes próprios em Angular nativo a partir do CDK + Tailwind.

## Resultado da decisão

**Escolhida:** PrimeNG 21 em **modo unstyled** com PassThrough API.

Diretrizes derivadas da decisão:

1. Habilitar o modo unstyled via `providePrimeNG({ theme: 'none' })` no `app.config.ts` de cada app.
2. **Não** importar temas do PrimeNG (Aura, Lara, Saga, etc.) — qualquer tema entraria em conflito com os tokens Gov.br.
3. Manter um objeto `govbrPassThrough` central (ex.: `apps/*/src/app/primeng-govbr-pt.ts`) que define, slot a slot, as classes Tailwind aplicadas a cada componente PrimeNG utilizado.
4. Para componentes que o PrimeNG não cobre adequadamente (ex.: header/footer institucional Gov.br, componentes específicos do contrato visual), implementar em Angular nativo aplicando classes Tailwind derivadas dos tokens.
5. Acessibilidade: confiar em ARIA nativo do PrimeNG (`role="tab"`, `role="dialog"`, `aria-modal`, `aria-selected`, `aria-expanded`) e manter focus ring overlay Gov.br via `<span>` `position: fixed` ajustado dinamicamente.

A POC validou esta estratégia em `apps/poc-primeng/` com 8 componentes funcionais, 13/13 testes Vitest e 88/88 testes Playwright (15 fluxo + 56 tokens + 17 acessibilidade), produzindo apenas 1 `!important` no código (supressão do outline nativo). A POC permanece como referência de implementação obrigatória.

## Consequências

### Positivas

- PassThrough injeta classes Tailwind diretamente nos slots internos dos componentes, eliminando a batalha de especificidade típica de overrides CSS.
- Catálogo amplo (80+ componentes) cobre o escopo presente e futuro do Uni+.
- ARIA + navegação por teclado built-in nos componentes PrimeNG, reduzindo trabalho de acessibilidade.
- Manutenção centralizada — todos os mapeamentos slot → classes vivem em 1–2 arquivos por app, sem editar código de bibliotecas instaladas.
- Estratégia permite substituir um componente PrimeNG por implementação Angular nativa sem reescrever a estratégia.

### Negativas

- Bundle inicial maior do que alternativas sem PrimeNG (~119 KB gzip com Zone.js, ainda dentro do aceitável).
- Dois componentes têm limitação em unstyled mode: `p-confirmdialog` (não renderiza conteúdo) e `p-table` (PassThrough não aplica em `ng-template #header/#body`). Workarounds documentados na POC (~10 minutos por ocorrência).
- Equipe precisa familiarizar-se com a PassThrough API e com o catálogo do PrimeNG.

### Neutras

- A decisão é independente da escolha de tokens Gov.br: trocar para outro DS exigiria apenas reescrever o `govbrPassThrough` e o `@theme` do Tailwind.

## Confirmação

- `app.config.ts` de cada app deve conter `providePrimeNG({ theme: 'none' })`.
- Lint/CI pode verificar ausência de imports de temas do PrimeNG (`primeng/themes/aura`, `primeng/themes/lara`).
- Suíte E2E da POC em `apps/poc-primeng-e2e/` é o gate de regressão visual e de acessibilidade.

## Mais informações

- ADR-0006 define o Gov.br DS como contrato visual.
- ADR-0008 define o mapeamento dos tokens via Tailwind.
- Documentação: [PrimeNG — Unstyled + PassThrough](https://primeng.org/theming).
- **Origem:** revisão da ADR interna Uni+ ADR-018 (não publicada), seção de PrimeNG unstyled + PassThrough.
