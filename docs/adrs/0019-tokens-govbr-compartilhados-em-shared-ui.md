---
status: "accepted"
date: "2026-05-07"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0019: Tokens Gov.br compartilhados em `libs/shared-ui/src/styles/govbr-tokens.css` + migração Tailwind 3→4 cross-app

## Contexto e enunciado do problema

A POC `apps/poc-primeng/src/styles.css` (validada como referência arquitetural pelo ADR-0006/0007/0008) declara 45 tokens Gov.br DS via `@theme {...}` Tailwind 4 e foi entregue como prova de viabilidade do contrato visual. Os 3 apps de produção (`selecao`, `ingresso`, `portal`), entretanto, ainda usam **Tailwind 3 syntax legada** (`@tailwind base; @tailwind components; @tailwind utilities;`) e cada um declara **sua própria paleta `unifesspa-*`** (`#003366` primary, `#006633` secondary etc.) num `tailwind.config.js` por app. Estado de partida:

- 3 cópias da paleta institucional em arquivos JS de config.
- 15 ocorrências de `unifesspa-*` em 10 arquivos (componentes `apps/<app>/src/...` e `libs/shared-ui/src/lib/components/...`).
- POC desconectada dos apps de produção — qualquer ajuste de token vive na POC, não chega a Selecao/Ingresso/Portal.
- Tailwind 4.2.2 já instalado no `package.json` raiz, mas os apps de produção rodam em modo de compatibilidade legado (Tailwind 4 aceita a sintaxe v3 sem reclamar).

A consequência prática: a paleta institucional não é fonte única, e qualquer mudança de token (ex.: ajuste de contraste WCAG, atualização do Gov.br DS) força edição em N lugares. Pior: Selecao está em produção dependendo de um config local que diverge silenciosamente da POC.

A questão é dupla: **(a)** como consolidar a fonte única da paleta institucional sem regredir visualmente? **(b)** como sequenciar a migração Tailwind 3 → 4 nos 3 apps sem incidente?

## Drivers da decisão

- **Fonte única dos tokens institucionais** — Gov.br DS é contrato legal (Portaria SEI-MCOM 540/2020, IN SGD/ME 94/2022); cada app não pode ter sua versão.
- **Zero regressão visual** durante a foundation — D.1 não pode mudar nenhuma cor/spacing já em produção.
- **Tailwind 4 já instalado** — não é "decisão de adotar v4", é "decisão de finalmente aproveitar o que já está no `package.json`".
- **Granularidade de PR** — refator Tailwind cross-app numa PR única seria impossível de revisar; granular demais (1 PR por arquivo) seria churn.
- **A11y baseline existente** (B.4 com `@axe-core/playwright`) — deve servir de gate na migração para detectar regressões de contraste.
- **POC convergir com produção** — após migração completa, `apps/poc-primeng/` deixa de ser "referência paralela" e passa a ser apenas "exemplo de PrimeNG unstyled" reusando os mesmos tokens.

## Opções consideradas

- **A. Foundation em `:root {...}` (CSS custom properties simples)** + migração Tailwind 4 em PRs separadas por app.
- **B. Foundation já como `@theme {...}` Tailwind 4** + apps importam direto, sem etapa intermediária.
- **C. Manter status quo** — paleta duplicada por app, POC desconectada.
- **D. Big-bang** — 1 PR migra tudo (foundation + 3 apps + 15 substituições + a11y baseline).

## Resultado da decisão

**Escolhida:** "A — Foundation em `:root {...}` + 3 PRs sequenciais (D.1/D.2/D.3)", porque é a única que combina:

1. **Zero risco visual em D.1** — declarar custom properties em `:root` sem `@theme` não gera classes Tailwind novas; nenhum componente existente muda. Apps importam o arquivo só para garantir que as variáveis estão disponíveis no DOM (futuro consumo via CSS direto ou via D.2/D.3).
2. **Caminho aberto para D.2/D.3** — em Tailwind 4, `@theme inline { --color-govbr-primary: var(--color-govbr-primary); }` referencia a variável da foundation, gerando utilities `bg-govbr-primary` etc. sem duplicar valores.
3. **Granularidade revisável** — D.1 (foundation, ~5 arquivos), D.2 (`selecao` cutover, escopo isolado, a11y baseline re-rodada), D.3 (`ingresso` + `portal` replicando D.2).
4. **Não força decisões prematuras** — `@theme` no shared-ui implicaria que TW4 já está ativo nos apps, o que é falso; opção B teria efeitos invisíveis (ou erros silenciosos) em apps ainda em modo TW3.

### Estratégia em 3 mini-PRs

| Frente | Branch | Escopo | Issue |
|---|---|---|---|
| **D.1 — foundation** (esta PR) | `feature/210-d1-shared-ui-govbr-tokens-css` | `libs/shared-ui/src/styles/govbr-tokens.css` (45 tokens em `:root`) + 3 imports nos `styles.scss` dos apps | vincula `#210` (não fecha) |
| **D.2 — `selecao` cutover** | `feature/210-d2-selecao-tailwind-4-govbr-tokens` | Migra `apps/selecao` para sintaxe TW4 (`@import "tailwindcss"` + `@theme inline` apontando para foundation), **deleta `apps/selecao/tailwind.config.js`** (decisão A consolidada), renomeia `styles.scss` → `styles.css` (sai do Sass importer; alinha com POC), substitui `unifesspa-primary` por `govbr-primary` em 11 arquivos (5 em `apps/selecao` + 6 em `libs/shared-ui` consumido por selecao). `@source` cobre `app/**`, `libs/shared-ui/lib/**` e `libs/shared-auth/lib/**`. A11y baseline re-rodada na CI. | vincula `#210` (não fecha) |
| **D.3 — `ingresso` + `portal`** | `feature/210-d3-ingresso-portal-tailwind-4-govbr-tokens` | Replica D.2 para `ingresso` e `portal`. Atualiza `CLAUDE.md` removendo "POC é referência" (agora apps de produção também são referência) | **Closes `#210`** |

### Forma do arquivo foundation (D.1)

```css
:root {
  --font-govbr: 'Rawline', 'Raleway', sans-serif;
  --color-govbr-primary: #1351b4;
  --color-govbr-success: #168821;
  --color-govbr-danger: #e52207;
  --color-govbr-gold: #c2850c;
  /* ... 45 tokens no total — paleta, feedback, neutros, tipografia, radius, spacing */
}
```

CSS custom properties puras. Sem `@theme`, sem `@layer`, sem dependência de plugin Tailwind. **Funciona em qualquer app** (TW3, TW4, ou nenhum framework).

### Pattern de import (D.1)

```scss
/* apps/<app>/src/styles.scss */
@import '../../../libs/shared-ui/src/styles/govbr-tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

Caminho relativo direto. Não precisa de `stylePreprocessorOptions.includePaths` no `project.json`. Path alias `@uniplus/shared-ui` aponta para `index.ts` (TS), não CSS — manter separação.

### Pattern de consumo em D.2/D.3 (referência futura)

```scss
/* apps/<app>/src/styles.scss em D.2/D.3 */
@import '../../../libs/shared-ui/src/styles/govbr-tokens.css';
@import 'tailwindcss';

@theme inline {
  --color-govbr-primary: var(--color-govbr-primary);
  --color-govbr-danger: var(--color-govbr-danger);
  /* ... reflete os tokens como utilities Tailwind */
}
```

`@theme inline` referencia (não duplica) os valores da foundation. Manutenção: editar `govbr-tokens.css` no shared-ui propaga aos 3 apps.

### Decisão sobre `tailwind.config.js` (D.2/D.3)

Tailwind 4 substitui o config JS por config CSS-first via `@theme`. Os 3 apps já têm `.postcssrc.json` apontando para `@tailwindcss/postcss` (plugin v4). O `tailwind.config.js` legado de cada app só declarava `content`, paleta `unifesspa-*`, e `fontFamily.sans`; as 3 responsabilidades têm equivalente nativo no CSS-first:

- `content` → `@source './app/**/*.{ts,html}'` no `styles.css`.
- Paleta `unifesspa-*` → substituída por `@theme inline` referenciando foundation D.1.
- `fontFamily.sans` (Inter) → `font-family` literal no reset `html, body`.

**Decidido (D.2 e replicado em D.3):** deletar `apps/<app>/tailwind.config.js` em vez de manter como bridge. Tailwind 4 detecta arquivos via `@source`; manter config JS adicionaria superfície de confusão sem ganho. Nenhuma utility custom dependia de `theme.extend.<foo>` além de cores e fonte.

### Mapeamento `unifesspa-*` → `govbr-*` (D.2 + D.3)

Substituições aplicadas pelas migrações D.2/D.3:

| `unifesspa-*` (TW3) | hex legado | `govbr-*` (TW4) | hex Gov.br DS | Ocorrências |
|---|---|---|---|---|
| `unifesspa-primary` | `#003366` | `govbr-primary` | `#1351b4` | 14 (selecao + shared-ui em D.2; portal/layout em D.3) |
| `unifesspa-secondary` | `#006633` | `govbr-success` | `#168821` | 1 (ingresso/layout em D.3) |

`unifesspa-accent`, `unifesspa-danger`, `unifesspa-warning`, `unifesspa-success`, `unifesspa-info` não tinham consumidores reais em apps/libs (declaravam-se em `tailwind.config.js` mas nenhum HTML usava). Foram simplesmente eliminados ao deletar o config.

### Esta ADR não decide

- **Migração de PrimeNG passthrough para PrimeNG vanilla** — fora de escopo; ADR-0007 mantém modo unstyled.
- **Adoção do JS runtime do `@govbr-ds/core`** — apenas tokens CSS via `@import`; runtime JS continua proibido (peso desnecessário, conflito com Angular/PrimeNG).
- **Substituição do focus ring overlay** — POC tem implementação em `main.ts`; D.2/D.3 podem extrair para `shared-ui/utils/` em frente futura.
- **Nomenclatura `govbr-*` vs `unifesspa-*` em código de domínio Uni+** — só substitui uso em CSS classes; identificadores de domínio (`Edital.unifesspaId`, etc.) seguem inalterados.

## Consequências

### Positivas

- 1 fonte única dos 45 tokens Gov.br para os 3 apps de produção + POC.
- Foundation pronta para D.2/D.3 sem decisão arquitetural pendente.
- Zero regressão visual em D.1 (CSS custom properties não consumidas até D.2/D.3 trocarem `unifesspa-*` por `govbr-*`).
- Caminho documentado para migração Tailwind 3→4 incremental por app.
- POC e produção convergem ao final de D.3 (CLAUDE.md atualizado para refletir).

### Negativas

- Caminho relativo de import (`../../../libs/shared-ui/...`) é feio — alternativas (path alias CSS, `stylePreprocessorOptions`) acrescentariam config sem ganho proporcional.
- Foundation ativa antes do consumo real — alguém pode confundir e usar `var(--color-govbr-primary)` em CSS direto antes de D.2/D.3 (não é erro, mas mistura estilos).
- 3 PRs em sequência aumentam tempo de entrega vs big-bang — mitigado pela revisabilidade.

### Neutras

- `tailwind.config.js` por app coexiste com a foundation sem conflito durante D.1 e é deletado em D.2/D.3 (decisão A documentada acima).
- `apps/<app>/src/styles.scss` é renomeado para `styles.css` em D.2/D.3 — não usa nenhum recurso Sass e o `@import 'tailwindcss'` no Sass importer é deprecated (Sass 3.0.0 vai remover).

## Confirmação

- `npx nx run-many --target=build --projects=selecao,ingresso,portal` verde após D.1.
- `grep -c "govbr-primary" dist/apps/<app>/browser/styles-*.css` > 0 nos 3 apps (tokens chegaram ao bundle de produção).
- Inspeção visual manual: nenhuma página existente muda renderização (foundation não consumida ainda).
- Em D.3 (último incremento), `npx playwright test --grep a11y` valida que migração não introduziu regressões de contraste WCAG 2.1 AA.

### Trigger de reavaliação

- Se Gov.br DS publicar major version com tokens incompatíveis: editar `govbr-tokens.css` (1 arquivo) propaga aos 3 apps + POC.
- Se houver decisão de adotar JS runtime do Gov.br DS: nova ADR (esta veta explicitamente).
- Se um 4º app entrar no monorepo: importa o mesmo arquivo, sem nova ADR.

## Prós e contras das opções

### A — Foundation em `:root {...}` + 3 mini-PRs (escolhida)

- **Bom**, porque D.1 tem zero risco visual — apenas adiciona arquivo + import.
- **Bom**, porque D.2/D.3 ficam isolados por app (a11y baseline re-rodada por escopo).
- **Bom**, porque foundation é Tailwind-agnostic — funciona se um dia o projeto trocar de framework de CSS.
- **Ruim**, porque adiciona 1 arquivo + 3 imports antes do consumo real (overhead percebido).

### B — Foundation já como `@theme {...}` Tailwind 4

- **Bom**, porque elimina a etapa intermediária — apps em TW4 herdariam utilities direto.
- **Ruim**, porque os 3 apps **ainda estão em sintaxe TW3** (`@tailwind base/components/utilities`); `@theme` em arquivo importado para um app que não declarou `@import "tailwindcss"` no estilo v4 pode ser ignorado silenciosamente ou gerar avisos.
- **Ruim**, porque mistura migração de tokens + migração de Tailwind syntax na mesma PR — granularidade ruim para revisão.

### C — Status quo

- **Bom**, porque zero esforço.
- **Ruim**, porque paleta institucional fica duplicada por app — risco de divergência silenciosa.
- **Ruim**, porque qualquer ajuste de token Gov.br força mudança em 3+ lugares.

### D — Big-bang

- **Bom**, porque entrega tudo em 1 PR.
- **Ruim**, porque PR fica gigante (foundation + 3 apps + 15 substituições + a11y baseline) — revisão impossível.
- **Ruim**, porque qualquer regressão obriga revert do trabalho dos 3 apps de uma vez.

## Mais informações

- [POC referência](../../apps/poc-primeng/src/styles.css) — fonte dos 45 tokens.
- [Tailwind v4 — Theme variables](https://tailwindcss.com/docs/theme) — `@theme` directive, custom properties shared via separate CSS file.
- [Tailwind v4 — `@theme inline`](https://tailwindcss.com/docs/colors) — referenciar CSS variables externas em `@theme`.
- [@govbr-ds/core](https://www.gov.br/ds/) — fonte oficial dos tokens (versão 3.7).
- [ADR-0006](0006-govbr-design-system-como-contrato-visual.md) — adoção do Gov.br DS como contrato visual.
- [ADR-0007](0007-primeng-em-modo-unstyled.md) — PrimeNG unstyled (POC base).
- [ADR-0008](0008-tailwind-css-4-com-tokens-govbr.md) — Tailwind CSS 4 com tokens Gov.br via `@theme` (esta ADR-0019 operacionaliza para apps de produção).
- Issue [`uniplus-web#210`](https://github.com/unifesspa-edu-br/uniplus-web/issues/210) — parqueamento original do plano de migração.
