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

# ADR-0024: Uso seletivo de PrimeNG em wrappers `ui-*`

## Contexto e enunciado do problema

A ADR-0023 definiu o `uniplus-ds` CSS-only como contrato visual vigente e
reposicionou `libs/shared-ui` como biblioteca Angular de wrappers `ui-*` para
os apps `selecao`, `ingresso` e `portal`. Essa decisao tambem retirou PrimeNG
do papel de estrategia obrigatoria, mas permitiu seu uso quando houver ganho
claro em comportamento complexo.

O workspace ainda possui PrimeNG como dependencia e preserva a POC historica em
`docs/referencias/poc-primeng/`. A POC validou acessibilidade, PassThrough API e
modo unstyled, mas tambem evidenciou custo de bundle e limitacoes pontuais
(`p-confirmdialog` em unstyled e `p-table` com templates manuais). Ao mesmo
tempo, os componentes reais atuais de `libs/shared-ui` sao em grande parte
wrappers proprios sobre HTML nativo e CSS do Uni+ DS.

A pergunta de arquitetura passa a ser: quando um componente `ui-*` deve
delegar comportamento ao PrimeNG, e quando deve permanecer implementado em
HTML nativo, Angular e CSS do Uni+ DS?

## Drivers da decisão

- Manter `@uniplus/shared-ui` e seus selectors `ui-*` como API publica das apps.
- Nao expor `p-*`, modulos PrimeNG ou objetos PassThrough diretamente em pages
  de dominio.
- Evitar reimplementar manualmente comportamento interativo dificil, como
  overlay, foco, teclado, virtualizacao e widgets compostos.
- Evitar acoplamento e bundle desnecessarios em componentes simples.
- Preservar o `uniplus-ds` CSS-only como fonte de verdade visual, incluindo
  tokens, anatomia, estados, foco, temas e responsividade.
- Permitir trocar a implementacao interna de um wrapper sem migrar as apps.

## Opções consideradas

- **A. PrimeNG-first em todos os componentes `ui-*`**.
- **B. HTML nativo/Angular proprio para todos os componentes**.
- **C. Uso seletivo de PrimeNG, sempre encapsulado atras de wrappers `ui-*`**.
- **D. Expor PrimeNG diretamente nas apps de dominio**.

## Resultado da decisão

**Escolhida:** "C. Uso seletivo de PrimeNG", porque equilibra produtividade e
acessibilidade em widgets complexos sem transformar PrimeNG na API publica nem
impor custo aos componentes simples.

Os apps de dominio devem consumir componentes por `@uniplus/shared-ui` e
selectors `ui-*`. Imports `primeng/*`, providers PrimeNG e componentes `p-*`
ficam proibidos em pages, layouts e componentes de feature, salvo POCs
explicitamente isoladas em `docs/referencias/` ou spikes aprovados. Quando
PrimeNG for necessario, `libs/shared-ui` encapsula a dependencia e preserva a
API `ui-*`.

Componentes simples devem continuar preferindo HTML nativo, Angular e CSS do
Uni+ DS. Exemplos: botao, card, alert, tag, badge, text input, textarea,
form-field, page header, breadcrumb, pager, skeleton, skip link e spinner.
Nesses casos, PrimeNG nao compra comportamento suficiente para justificar
acoplamento, configuracao global ou aumento de bundle.

PrimeNG passa a ser candidato quando o componente tiver comportamento composto
que exige acessibilidade e interacao robustas: dialog/modal com foco e scroll
lock, select avancado ou multiselect, autocomplete, tabs, stepper/wizard,
calendario, menu/popover, tabela com ordenacao/filtros/selecao/virtualizacao e
upload com fila, progresso ou retry. A decisao de usar PrimeNG deve ficar
local ao wrapper e ser acompanhada de testes de teclado, foco, ARIA e
responsividade.

Quando usado, PrimeNG deve operar em modo unstyled e sem temas visuais
proprios. O estilo final continua vindo de tokens e classes do Uni+ DS. Nao
devem ser importados temas PrimeNG como Aura, Lara, Saga ou similares. O
mapeamento de classes por PassThrough, quando existir, pertence a uma camada
compartilhada de `shared-ui`, nao a cada app.

Componentes `ui-*` existentes nao precisam ser migrados automaticamente. A
migracao so deve ocorrer quando a implementacao atual passar a carregar regra
interativa complexa, falhar em requisitos de acessibilidade, ou quando a
manutencao manual ficar mais cara que encapsular PrimeNG.

## Consequências

### Positivas

- As apps preservam uma API de UI estavel (`ui-*`) independente de PrimeNG.
- `shared-ui` pode aproveitar comportamento maduro de PrimeNG sem vazar a
  biblioteca para pages de dominio.
- Componentes simples continuam leves, auditaveis e alinhados diretamente ao
  HTML/CSS do Uni+ DS.
- A troca futura de PrimeNG por HTML nativo, CDK ou outra lib fica restrita ao
  wrapper afetado.

### Negativas

- Cada wrapper complexo exige uma decisao explicita e testes proprios, em vez
  de uma regra mecanica unica.
- `shared-ui` passa a ter dois estilos internos de implementacao: nativo para
  componentes simples e PrimeNG encapsulado para widgets complexos.
- Quando um wrapper usar PrimeNG, os apps podem precisar receber providers
  globais exportados/configurados por `shared-ui`, mesmo sem importar `p-*`.
- Bundle e lazy chunks precisam ser observados nos componentes que ativarem
  infraestrutura PrimeNG.

### Neutras

- ADR-0007 permanece como historico da estrategia PrimeNG-first anterior, ja
  superseded pela ADR-0023.
- A POC em `docs/referencias/poc-primeng/` continua servindo como referencia
  tecnica, mas nao como contrato normativo do workspace ativo.

## Confirmação

- Novas pages e componentes de feature nao devem importar `primeng/*` nem usar
  selectors `p-*`; devem consumir `@uniplus/shared-ui`.
- Qualquer import `primeng/*` em `libs/shared-ui` deve estar atras de um
  wrapper `ui-*` e acompanhado de justificativa no PR.
- Nao deve existir import de temas PrimeNG (`primeng/themes/*`, Aura, Lara,
  Saga ou equivalentes) no workspace ativo.
- Mudancas em wrappers PrimeNG devem validar teclado, foco visivel, ARIA,
  estados de erro/loading e responsividade minima em 320 px.
- `bash tools/adr-lint/validate.sh`, `npm run lint:all`, `npm run test:all` e
  `npm run build:all` devem passar antes de merge de mudancas de UI
  compartilhada.

## Prós e contras das opções

### A. PrimeNG-first em todos os componentes `ui-*`

- Bom, porque padroniza a implementacao interna e aproveita o catalogo amplo.
- Ruim, porque aumenta acoplamento e bundle em componentes que HTML nativo ja
  resolve bem.
- Ruim, porque recoloca uma lib de componentes no centro do contrato visual,
  contrariando a ADR-0023.

### B. HTML nativo/Angular proprio para todos os componentes

- Bom, porque minimiza dependencias e mantem controle total sobre DOM e CSS.
- Ruim, porque força a equipe a manter manualmente widgets complexos de alto
  risco em acessibilidade e teclado.
- Ruim, porque tende a duplicar infraestrutura que PrimeNG ja oferece de forma
  madura.

### C. Uso seletivo de PrimeNG encapsulado em `ui-*`

- Bom, porque usa PrimeNG onde ele reduz risco real e mantem nativo onde ele
  nao agrega.
- Bom, porque preserva `ui-*` como fronteira publica e permite trocar a
  implementacao interna sem migrar apps.
- Ruim, porque exige disciplina de revisao para evitar usos oportunistas ou
  vazamento de `p-*`.

### D. Expor PrimeNG diretamente nas apps de dominio

- Bom, porque acelera prototipos locais.
- Ruim, porque espalha decisoes visuais/comportamentais por pages de dominio e
  quebra a fronteira de `shared-ui`.
- Ruim, porque torna futuras trocas de implementacao caras e inconsistentes.

## Mais informações

- [ADR-0023](0023-uniplus-ds-como-contrato-visual-vigente.md) — Uni+ DS como contrato visual vigente.
- [ADR-0022](0022-retirada-poc-primeng-do-workspace-ativo.md) — POC PrimeNG arquivada fora do workspace Nx ativo.
- [ADR-0007](0007-primeng-em-modo-unstyled.md) — Historico da estrategia PrimeNG-first anterior.
- [Findings da POC PrimeNG](../referencias/poc-primeng/findings.md) — validacoes e limitacoes observadas.
