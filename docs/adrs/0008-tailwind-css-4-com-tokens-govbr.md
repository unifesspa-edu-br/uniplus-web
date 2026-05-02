---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0008: Tailwind CSS 4 com tokens Gov.br via `@theme`

## Contexto e enunciado do problema

Adotados o Gov.br Design System como contrato visual (ADR-0006) e PrimeNG em modo unstyled (ADR-0007), o `uniplus-web` precisa de um mecanismo concreto para aplicar os tokens CSS do `@govbr-ds/core` aos componentes — tanto aos PrimeNG (via PassThrough) quanto aos componentes Angular nativos. Reescrever CSS por componente seria caro e fragmentaria a identidade visual; usar variáveis CSS soltas espalha o conhecimento dos nomes de tokens em arquivos diversos.

A POC mostrou que mapear os 46 tokens principais (cores, tipografia, espaçamento, bordas, sombras, focus ring) como utilitários Tailwind centraliza o vocabulário visual e elimina ambiguidade no código de feature.

## Drivers da decisão

- Vocabulário visual centralizado em um único lugar.
- Utilitários expressivos (`bg-govbr-primary`, `text-govbr-danger`, `rounded-govbr-input`) consumíveis por PassThrough do PrimeNG e por componentes Angular nativos.
- Compatibilidade com a major 4 do Tailwind, que introduziu a diretiva `@theme` para mapear tokens a partir de variáveis CSS.
- Migração simplificada quando o `@govbr-ds/core` evoluir para v4 — o mapeamento fica em um único arquivo.

## Opções consideradas

- Tailwind CSS 4 com mapeamento dos tokens Gov.br via `@theme`.
- Tailwind CSS 4 sem `@theme`, consumindo variáveis CSS diretamente em `class="text-[var(--color-...)]"`.
- CSS Modules com variáveis CSS, sem framework utility-first.
- SCSS com mixins.

## Resultado da decisão

**Escolhida:** Tailwind CSS 4 com mapeamento dos 46 tokens Gov.br via diretiva `@theme`.

Diretrizes derivadas da decisão:

1. Importar os tokens em `styles.css` global de cada app, antes do Tailwind:

   ```css
   @import "@govbr-ds/core/dist/core-tokens.min.css";
   @import "tailwindcss";
   ```

2. Mapear os tokens como extensões do Tailwind via `@theme` em um único arquivo central por app:

   ```css
   @theme {
     --color-govbr-primary: var(--blue-warm-vivid-70);
     --color-govbr-danger: var(--red-vivid-50);
     --rounded-govbr-input: var(--surface-rounder-sm);
     /* … 46 tokens cobrindo cores, tipografia, espaçamento, bordas, sombras */
   }
   ```

3. Consumir os tokens **sempre** via utilitários Tailwind (`bg-govbr-primary`, `text-govbr-danger`, `rounded-govbr-input`) — nunca hardcoded.
4. Manter a POC (`apps/poc-primeng/src/styles.css`) como fonte-verdade do mapeamento; replicar mudanças para os apps em produção.

## Consequências

### Positivas

- Vocabulário visual canônico centralizado em um único arquivo por app.
- Utilitários expressivos cobrem PassThrough do PrimeNG e componentes Angular nativos uniformemente.
- Migração v3 → v4 do `@govbr-ds/core` concentra-se em atualizar o `@theme`, sem varrer arquivos de feature.
- Suíte E2E pode asserter contra os utilitários (regressão de tokens visíveis na DOM como classes Tailwind).

### Negativas

- Tailwind 4 ainda é relativamente novo; algumas integrações de IDE e plugins podem exigir ajuste de configuração.
- Conhecimento dos nomes dos tokens precisa ser difundido na equipe (mitigado por documentação interna em `docs/`).

### Neutras

- A escolha por Tailwind 4 é independente do framework SPA — trocar Angular não invalidaria o mapeamento.

## Confirmação

- **Validação atual.** Os tokens Gov.br e o mapeamento Tailwind 4 via `@theme` foram validados em `apps/poc-primeng/src/styles.css`, exercitados pela suíte E2E `apps/poc-primeng-e2e/src/govbr-design-tokens.spec.ts` (46 testes) como gate de regressão visual.
- **Estado em produção.** Os apps `selecao`, `ingresso` e `portal` ainda usam `src/styles.scss` com apenas `@tailwind base/components/utilities`; não importam `@govbr-ds/core` nem expõem o `@theme` com tokens Gov.br.
- **Plano de adoção.** A adoção produtiva depende da conclusão da fundação UX/design system; será conduzida em Stories de migração dedicadas (incluindo a transição de `styles.scss` para `styles.css` e o import dos tokens antes do Tailwind), fora do escopo deste ADR.
- **Gates adicionais quando a migração ocorrer.** Lint/CI deve banir cores hardcoded (`#xxx`, `rgb(...)`) no código-fonte de apps e libs em produção; o guia interno de tokens documenta o catálogo de utilitários disponíveis.

## Mais informações

- ADR-0006 define o Gov.br DS como contrato visual.
- ADR-0007 define o uso do PrimeNG em modo unstyled.
- **Origem:** revisão da ADR interna Uni+ ADR-018 (não publicada), seção de mapeamento Tailwind `@theme`.
