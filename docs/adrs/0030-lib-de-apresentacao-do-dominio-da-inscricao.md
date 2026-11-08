---
status: "accepted"
date: "2026-11-08"
decision-makers:
  - "Tech Lead (CTIC)"
consulted:
  - "Equipe Uni+"
informed:
  - "Apps selecao e portal"
---

# ADR-0030: Lib de apresentação do domínio da inscrição

## Contexto e enunciado do problema

O comprovante de inscrição passa a ser emitido pelo Portal (candidato) e pela Seleção (gestão), com o
mesmo corpo de documento. A apresentação sabe o que é um comprovante, um envio e uma resposta da
inscrição; por isso não cabe no `shared-ui`, que é `type:ui` e não conhece domínio, e copiar a tela
para os dois apps duplicaria o que a pessoa lê no papel. A [ADR-0017](0017-pattern-feature-page-container-presentational.md)
separa a página que lê a API da apresentação, mas não diz onde mora a apresentação quando dois apps
a usam.

## Drivers da decisão

- Uma única apresentação do agregado, igual nos dois apps.
- A lib não importa o cliente da API: quem o conhece é o app.
- Respeitar as fronteiras entre tipos de lib do workspace.

## Opções consideradas

- Duplicar a apresentação em cada app.
- Subpasta do `shared-ui`, como na ADR-0012.
- Lib própria `shared-inscricao`, com a tag `type:domain-ui`.

## Resultado da decisão

**Escolhida:** "Lib própria `shared-inscricao`, com a tag `type:domain-ui`", porque é a única opção sem
duplicação que respeita as fronteiras de tipo.

A lib guarda a apresentação do agregado inscrição, compartilhada entre apps, e é dona da exibição do
comprovante de um envio, inclusive dos estados da leitura (carregando, falha, recusa e pronto). O app
entrega a fonte da leitura, porque só ele conhece o cliente da API, e a lib só importa **tipos** de
`@uniplus/shared-data`. Cada app traduz a recusa para o seu público e projeta as ações que são só dele.
Cada conceito é um entry point secundário (o primeiro é `@uniplus/shared-inscricao/comprovante`). A tag
`type:domain-ui` pode depender de `type:ui`, `type:util`, `type:core` e `type:data`, e as libs
`type:feature` passam a poder depender dela.

A [ADR-0012](0012-placement-api-result-em-shared-core.md) preferiu subpasta a uma lib nova, e aqui isso
não se aplica: `type:ui` não pode importar `type:data`, e `type:data` não pode importar `type:ui`, então
nem o `shared-ui` nem o `shared-data` podem abrigar a apresentação; e há dois consumidores reais.

## Consequências

### Positivas

- O comprovante tem um dono só, e portal e seleção o exibem do mesmo jeito.
- O `shared-ui` segue sem conhecer domínio.

### Negativas

- Mais uma lib buildable para manter, com entry points e `package.json` próprios.

## Confirmação

O `@nx/enforce-module-boundaries` aplica a tag `type:domain-ui`, e o `no-restricted-imports` da lib barra
importação de valor de `@uniplus/shared-data`.

## Mais informações

- Complementa a [ADR-0017](0017-pattern-feature-page-container-presentational.md); não a revoga.
- A [ADR-0012](0012-placement-api-result-em-shared-core.md) segue valendo para o caso que decidiu.
