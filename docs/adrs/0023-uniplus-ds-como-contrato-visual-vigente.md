---
status: "accepted"
date: "2026-05-30"
decision-makers:
  - "Tech Lead (CTIC)"
consulted:
  - "Equipe Uni+"
informed:
  - "Apps selecao, ingresso e portal"
---

# ADR-0023: Uni+ DS como contrato visual vigente

## Contexto e enunciado do problema

As ADRs 0006, 0007, 0008 e 0019 consolidaram uma etapa anterior do `uniplus-web`: POC PrimeNG em modo unstyled, tokens Gov.br e uma foundation compartilhada `govbr-tokens.css`. Essa decisao foi suficiente para validar Tailwind 4, acessibilidade inicial e convergencia entre apps, mas deixou o frontend preso a uma POC historica e a um contrato visual que nao representa mais o produto Uni+.

O repositório `uniplus-ds` passou a ser a fonte canonica do design system: CSS-only, mobile-first, temas `light`, `dark` e `contrast`, tokens semanticos, anatomia HTML, ARIA, foco, responsividade e padroes de interacao documentados. O `uniplus-web` precisa consumir esse contrato sem criar um design system paralelo e sem preservar artificialmente APIs antigas de `shared-ui`.

## Drivers da decisão

- Fonte unica de verdade para tokens, anatomia, estados e temas.
- Componentes Angular reutilizaveis por qualquer app Uni+, sem dependencia de dominio, router de app, HTTP, auth ou `shared-data`.
- Acessibilidade de producao como gate: teclado, foco visivel, leitores de tela, 320 px, zoom 200% e tema de contraste.
- Tailwind 4 apenas como ponte auxiliar via tokens semanticos, nao como paleta paralela.
- Liberdade para breaking changes internos quando o legado conflitar com o contrato vigente.
- Evitar dependencia estrutural em PrimeNG para componentes simples; usar HTML nativo e Angular CDK quando bastarem.

## Opções consideradas

- **A. Manter PrimeNG unstyled + Gov.br DS** como estrategia visual canônica.
- **B. Criar um design system proprio dentro do `uniplus-web`** e tratar `uniplus-ds` apenas como inspiracao.
- **C. Adotar `uniplus-ds` CSS-only como contrato canonico** e recriar `libs/shared-ui` como wrappers Angular de producao.
- **D. Publicar imediatamente `@uniplus/shared-ui` como pacote workspace com exports CSS** para permitir imports CSS `@uniplus/...` nos apps.

## Resultado da decisão

**Escolhida:** "C. Adotar `uniplus-ds` CSS-only como contrato canonico", porque separa corretamente o contrato visual CSS-only dos wrappers Angular e remove a dependencia da POC historica como referencia de implementacao.

`libs/shared-ui` passa a ser a biblioteca Angular de producao do Uni+: standalone components, `ChangeDetectionStrategy.OnPush`, signal inputs/outputs/models, Reactive Forms tipados e APIs pequenas orientadas a estado/configuracao. Os componentes devem consumir classes, tokens, anatomia HTML e ARIA do `uniplus-ds`; nao devem expor classes CSS como API publica nem depender de dominio.

A foundation ativa no workspace passa a ser `libs/shared-ui/src/styles/tokens.css`, `base.css` e `components.css`, sincronizada a partir do contrato CSS-only do `uniplus-ds`. Os apps importam esses arquivos globais antes do Tailwind e expõem tokens semanticos no `@theme inline`.

No workspace Angular, a faixa institucional usa o namespace `.institutional-bar`/`.institutional-bar__*` como contrato vigente. O namespace historico `.gov-bar` pode aparecer em analises de origem do DS, mas nao e emitido pelos wrappers Angular desta decisao.

PrimeNG deixa de ser a estrategia obrigatoria. Ele pode continuar como dependencia enquanto houver uso legado ou ganho claro em comportamento complexo, mas sempre encapsulado atras de um componente `ui-*`. Para componentes simples, a preferencia e HTML nativo e Angular CDK.

Imports TypeScript seguem pelos aliases `@uniplus/shared-*`. Imports CSS `@uniplus/...` ficam fora desta decisao: o builder CSS do Angular nao resolve `tsconfig.paths`; para faze-lo corretamente sera necessario tratar `@uniplus/shared-ui` como pacote resolvivel por CSS, com package/workspace exports e lockfile proprio. Ate la, os imports globais de CSS usam caminhos relativos explicitos.

## Consequências

### Positivas

- `shared-ui` passa a refletir o contrato visual real do Uni+ DS, sem camada de compatibilidade com a POC antiga.
- Temas `light`, `dark`, `contrast` e `data-font-mode="legible"` ficam disponiveis para os shells.
- Componentes `ui-*` ganham anatomia e comportamento reutilizaveis entre `selecao`, `ingresso` e `portal`.
- O contrato visual fica testavel por lint, unit tests, build e validacao visual/a11y.

### Negativas

- APIs antigas de `shared-ui` podem quebrar e consumidores precisam migrar.
- Enquanto `shared-ui` nao for pacote CSS resolvivel, imports globais de estilo permanecem relativos.
- A copia dos CSS do `uniplus-ds` dentro do `uniplus-web` exige rotina explicita de sincronizacao ate haver empacotamento compartilhado.

### Neutras

- ADRs 0006, 0007, 0008 e 0019 permanecem como historico da etapa Gov.br/PrimeNG, mas nao governam novas implementacoes.
- A POC em `docs/referencias/poc-primeng/` continua arquivada e navegavel, sem papel normativo para o workspace ativo.

## Confirmação

- `libs/shared-ui/src/styles/govbr-tokens.css` nao existe mais no workspace ativo.
- Apps importam `tokens.css`, `base.css` e `components.css` do `shared-ui` antes de `tailwindcss`.
- Novos componentes reutilizaveis entram por `@uniplus/shared-ui` e usam selectors/tokens do Uni+ DS.
- A faixa institucional do shell renderiza `.institutional-bar` e nao publica links sem `href` valido.
- `npm run lint:all`, `npm run test:all` e `npm run build:all` devem passar antes de merge.
- Validacoes E2E/a11y devem cobrir pelo menos shell e piloto `selecao/editais` em 320 px, 768 px e desktop, com temas `light`, `dark` e `contrast`.

## Prós e contras das opções

### A. Manter PrimeNG unstyled + Gov.br DS

- Bom, porque aproveita a validacao historica e reduz mudanca imediata.
- Ruim, porque perpetua contrato visual desatualizado e uma POC como fonte de verdade.

### B. Criar um design system proprio dentro do `uniplus-web`

- Bom, porque daria autonomia total ao frontend.
- Ruim, porque duplicaria o `uniplus-ds`, fragmentaria tokens e criaria dois contratos visuais concorrentes.

### C. Adotar `uniplus-ds` CSS-only como contrato canonico

- Bom, porque mantém CSS, tokens, temas e anatomia em uma fonte de verdade.
- Bom, porque deixa Angular responsavel apenas por comportamento, estado, forms e composicao.
- Ruim, porque exige migração dos consumidores e disciplina para sincronizar CSS enquanto nao houver pacote compartilhado.

### D. Publicar imediatamente exports CSS `@uniplus/...`

- Bom, porque removeria imports relativos em `styles.css`.
- Ruim, porque mistura a migração visual com uma mudanca de empacotamento/workspaces e lockfile, ampliando o risco desta branch.

## Mais informações

- Issue: [#377](https://github.com/unifesspa-edu-br/uniplus-web/issues/377)
- Fonte canonica do DS: [`uniplus-ds`](https://github.com/unifesspa-edu-br/uniplus-ds)
- Autoria CSS/SCSS dos wrappers Angular: [ADR-0025](0025-autoria-css-scss-no-angular.md)
- Supersede para novas implementacoes: [ADR-0006](0006-govbr-design-system-como-contrato-visual.md), [ADR-0007](0007-primeng-em-modo-unstyled.md), [ADR-0008](0008-tailwind-css-4-com-tokens-govbr.md), [ADR-0019](0019-tokens-govbr-compartilhados-em-shared-ui.md)
