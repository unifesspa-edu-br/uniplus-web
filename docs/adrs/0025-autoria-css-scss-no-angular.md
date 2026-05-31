---
status: "accepted"
date: "2026-05-31"
decision-makers:
  - "Tech Lead (CTIC)"
consulted:
  - "Equipe Uni+"
informed:
  - "Apps selecao, ingresso e portal"
---

# ADR-0025: Autoria CSS/SCSS nos componentes Angular

## Contexto e enunciado do problema

A ADR-0023 definiu o `uniplus-ds` como contrato visual vigente e estabeleceu que
a foundation ativa do `uniplus-web` e formada por `tokens.css`, `base.css` e
`components.css`. Essa decisao protege a portabilidade do contrato visual: temas
runtime, tokens semanticos, anatomia HTML, foco e responsividade precisam poder
ser consumidos por Angular e por outros frontends futuros.

Essa escolha nao significa que todo detalhe de implementacao Angular precise ser
escrito em CSS puro. O `uniplus-ds` demonstra a interface esperada; a tecnologia
de autoria dos wrappers Angular pertence ao time de desenvolvimento do
`uniplus-web`. Com o crescimento previsto do sistema, componentes locais podem
precisar de organizacao que CSS puro nao oferece com a mesma ergonomia.

A documentacao oficial do Angular usa CSS como default do CLI, mas tambem afirma
que Angular funciona com qualquer ferramenta que gere CSS, incluindo Sass/SCSS.
O proprio workspace ja configura o gerador Nx de componentes com `style: "scss"`.
Precisamos formalizar a fronteira para evitar dois problemas opostos: bloquear
SCSS por dogma agora e precisar voltar atras depois, ou permitir SCSS sem regra
e criar um segundo design system em paralelo aos tokens runtime.

## Drivers da decisão

- Manter `uniplus-ds` e a foundation compartilhada portaveis, legiveis e
  independentes de pre-processador.
- Permitir que componentes Angular crescam com uma ferramenta de autoria
  adequada quando houver ganho real de organizacao.
- Preservar temas runtime por CSS custom properties, sem duplicar tokens em
  variaveis Sass.
- Evitar mistura acidental de estilos globais, estilos de contrato e estilos
  locais de componente.
- Manter consistencia com o gerador Nx atual e com a orientacao Angular de
  consistencia por projeto.

## Opções consideradas

- **A. CSS puro em todas as camadas**.
- **B. SCSS como padrao para todas as camadas, inclusive foundation**.
- **C. CSS para foundation/contrato e SCSS permitido em componentes Angular**.
- **D. Livre escolha por arquivo, sem regra de camada**.

## Resultado da decisão

**Escolhida:** "C. CSS para foundation/contrato e SCSS permitido em componentes
Angular", porque separa a representacao publica e runtime do design system da
ferramenta de autoria usada para implementar componentes.

Os arquivos de contrato visual compartilhado permanecem em CSS puro:
`libs/shared-ui/src/styles/tokens.css`, `base.css`, `components.css`,
`uniplus-ds.css` e os `apps/*/src/styles.css` que importam a foundation antes do
Tailwind. Esses arquivos sao a fronteira entre `uniplus-ds`, `shared-ui` e apps;
nao devem depender de Sass, nesting SCSS, mixins ou funcoes de pre-processador.

Componentes Angular podem usar SCSS para estilos locais quando isso melhorar
manutencao. O uso esperado e em componentes com estados, variantes,
composicoes internas, responsividade local ou integracao com PrimeNG/CDK
encapsulada. Componentes pequenos podem continuar com `styles: \`` inline ou CSS
simples; nao ha obrigacao de migrar o que ja esta claro e pequeno.

SCSS e ferramenta de autoria, nao fonte de verdade visual. Variaveis, mapas e
mixins Sass nao devem recriar tokens de cor, espacamento, tipografia, raio,
sombra ou z-index. O valor runtime deve continuar vindo de CSS custom properties
do Uni+ DS, por exemplo `var(--color-primary)`, `var(--space-4)` e
`var(--radius-md)`. SCSS pode organizar seletores, modularizar regras locais e
reduzir repeticao estrutural, mas nao pode criar uma paleta ou escala paralela.

O gerador Nx pode continuar configurado com `style: "scss"` para novos
componentes Angular. Isso e uma escolha de autoria local, nao uma mudanca no
contrato visual. Mudancas na foundation compartilhada continuam sendo feitas em
CSS puro e validadas como parte do contrato do Uni+ DS.

## Consequências

### Positivas

- Evita retrabalho futuro: componentes Angular podem crescer com SCSS sem
  quebrar a portabilidade do design system.
- Mantem tokens e temas em CSS custom properties, preservando troca runtime de
  tema, contraste e fonte legivel.
- Reduz o risco de misturar estilos de contrato com detalhes internos de
  componente.
- Alinha o workspace ao gerador Nx atual sem transformar SCSS em obrigacao para
  arquivos globais.

### Negativas

- O projeto passa a aceitar duas extensoes de estilo, exigindo disciplina de
  revisao por camada.
- SCSS mal usado pode esconder duplicacao de tokens ou criar especificidade
  excessiva.
- Fitness tests ou lint rules podem ser necessarios se o uso indevido de SCSS
  crescer.

### Neutras

- Arquivos `.scss` vazios existentes podem permanecer ate serem removidos ou
  usados por uma mudanca real.
- Esta ADR nao muda a decisao da ADR-0023: o contrato visual vigente continua
  sendo o `uniplus-ds` CSS-only.

## Confirmação

- `libs/shared-ui/src/styles/*.css` e `apps/*/src/styles.css` permanecem CSS
  puro.
- Novos tokens visuais entram como CSS custom properties, nao como variaveis
  Sass.
- Estilos locais em `.scss` devem consumir tokens via `var(--token)` e nao por
  constantes Sass paralelas.
- Revisoes de PR devem rejeitar SCSS que duplica paleta, escala de espacamento,
  tipografia, radius, sombra ou z-index do DS.
- Componentes pequenos podem manter estilos inline ou CSS simples; migracao para
  SCSS so e necessaria quando melhorar manutencao.
- `npm run lint:all`, `npm run test:all` e `npm run build:all` devem passar
  antes de merge de mudancas de UI compartilhada.

## Prós e contras das opções

### A. CSS puro em todas as camadas

- Bom, porque simplifica a toolchain e aproxima tudo do contrato CSS-only.
- Ruim, porque transforma uma escolha de contrato visual em restricao de
  implementacao Angular.
- Ruim, porque pode gerar arrependimento em componentes grandes, com muitas
  variantes e estados.

### B. SCSS como padrao para todas as camadas

- Bom, porque uniformiza a autoria e aproveita recursos de organizacao do Sass.
- Ruim, porque acopla a foundation do DS a pre-processador sem necessidade.
- Ruim, porque facilita duplicar tokens runtime em variaveis/mixins de build.

### C. CSS para foundation/contrato e SCSS em componentes Angular

- Bom, porque preserva o contrato visual portavel e permite ergonomia local.
- Bom, porque casa com a configuracao Nx atual e com a evolucao prevista do
  sistema.
- Ruim, porque exige revisao consciente para manter a fronteira entre camadas.

### D. Livre escolha por arquivo

- Bom, porque da autonomia maxima a cada implementacao.
- Ruim, porque escala para inconsistencia e dificulta orientar revisao,
  onboarding e refatoracoes.

## Mais informações

- [ADR-0023](0023-uniplus-ds-como-contrato-visual-vigente.md) — Uni+ DS como contrato visual vigente.
- [ADR-0024](0024-uso-seletivo-primeng-wrappers-ui.md) — Uso seletivo de PrimeNG em wrappers `ui-*`.
- [Angular docs: Styling components](https://angular.dev/guide/components/styling).
- [Angular CLI: generate component](https://angular.dev/cli/generate/component).
- [Angular coding style guide](https://angular.dev/style-guide).
