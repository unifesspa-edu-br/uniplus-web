---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0005: Manter Zone.js no Angular 21

## Contexto e enunciado do problema

O Angular 21 promoveu o modo zoneless a stable, permitindo remover Zone.js da aplicação e delegar toda a detecção de mudanças a signals e `provideZonelessChangeDetection()`. Como o `uniplus-web` é um workspace novo, é razoável questionar se vale adotar zoneless desde o início para reduzir bundle e simplificar o modelo mental de change detection.

Por outro lado, a estratégia de UI do projeto (ver ADR-0006/0007/0008) depende fortemente de PrimeNG 21, e nenhuma versão do PrimeNG declara compatibilidade oficial com modo zoneless. Bugs ativos foram identificados em DynamicDialog, Tooltip e Select com virtualScroll quando rodando sem Zone.js — todos componentes centrais para os fluxos de inscrição, homologação e classificação.

## Drivers da decisão

- Compatibilidade total com PrimeNG 21 (Dialog, Tooltip, Select com virtualScroll são componentes críticos).
- Confiabilidade durante janelas de inscrição com milhares de candidatos simultâneos.
- Risco de bugs difíceis de diagnosticar em overlays e formulários complexos.
- Custo de manter workarounds manuais por componente é alto e frágil.

## Opções consideradas

- Manter Zone.js com `provideZoneChangeDetection({ eventCoalescing: true })`.
- Adotar modo zoneless com `provideZonelessChangeDetection()`.
- Híbrido: zoneless com patches manuais nos componentes PrimeNG afetados.
- Trocar PrimeNG por uma biblioteca zoneless-compatible (ex.: Angular Material).

## Resultado da decisão

**Escolhida:** manter Zone.js em todas as aplicações do workspace, com `provideZoneChangeDetection({ eventCoalescing: true })` e `"polyfills": ["zone.js"]` declarado nos `project.json`.

Justificativa central:

1. PrimeNG 21 não suporta oficialmente o modo zoneless e há issues abertas afetando Dialog, Tooltip e Select.
2. `eventCoalescing: true` agrupa eventos DOM em um único ciclo de change detection e captura parte do ganho de performance que motivaria o zoneless.
3. Os componentes do projeto seguem `OnPush` + signals, o que torna uma migração futura para zoneless straightforward, caso o PrimeNG declare suporte oficial.

Reavaliação obrigatória a cada major release do PrimeNG e do Angular.

## Consequências

### Positivas

- Compatibilidade total com PrimeNG 21 em todos os fluxos.
- Sem workarounds frágeis ou patches manuais de change detection.
- `eventCoalescing` entrega parte do ganho de performance do zoneless sem o risco.
- Migração futura para zoneless permanece viável, dado que componentes já são `OnPush` + signals.

### Negativas

- Zone.js adiciona aproximadamente 30–40 KB ao bundle inicial (~13 KB gzip).
- Monkey-patching de APIs nativas (setTimeout, Promise, addEventListener) permanece ativo.
- Não se beneficia da simplificação de debugging que o modo zoneless oferece.

### Neutras

- A decisão é reversível assim que o PrimeNG declarar suporte oficial a zoneless — não há trabalho descartável.

## Confirmação

- Lint/CI pode verificar que `provideZonelessChangeDetection` não é usado em `app.config.ts`.
- `project.json` de cada app deve declarar `polyfills: ["zone.js"]`.

## Mais informações

- ADR-0006/0007/0008 detalham a estratégia de UI baseada em PrimeNG unstyled + Tailwind + Gov.br.
- Referências externas:
  - [Angular PR #62699 — Promote zoneless to stable](https://github.com/angular/angular/pull/62699)
  - [PrimeNG #19497 — DynamicDialog em zoneless](https://github.com/primefaces/primeng/issues/19497)
  - [PrimeNG #18358 — Tooltip requer Zone.js](https://github.com/primefaces/primeng/issues/18358)
  - [Angular `provideZoneChangeDetection`](https://angular.dev/api/core/provideZoneChangeDetection)
- **Origem:** revisão da ADR interna Uni+ ADR-017 (não publicada).
