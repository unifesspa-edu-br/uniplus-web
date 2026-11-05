---
status: "accepted"
date: "2026-11-05"
decision-makers:
  - "Tech Lead (CTIC)"
consulted:
  - "Equipe Uni+"
informed:
  - "Apps selecao, configuracao, ingresso e portal"
---

# ADR-0029: Reset do Tailwind como base dos apps

## Contexto e enunciado do problema

Os quatro apps importam o Tailwind 4 antes dos estilos próprios, e o `preflight` do Tailwind (o reset) já
chega a todos eles: ele zera margens, marcador e recuo de listas, moldura de `fieldset`, tamanho e peso de
títulos e o visual de controles de formulário. Isso nunca foi decidido nem registrado: as ADRs 0008, 0019,
0023 e 0025 definem tokens, `@theme`, foundation CSS e autoria de estilos, mas nenhuma diz que o reset é a
base. O resultado foi um DS escrito como se o navegador entregasse os padrões (listas com marcador, títulos
com tamanho), convivendo com um reset que os remove. As recusas da API em lista, por exemplo, apareciam como
linhas soltas.

A Configuração agravava a inconsistência: importava o Tailwind mas não processava o CSS, então o reset
entrava pela metade, com o tema e as utilidades ausentes.

## Drivers da decisão

- Aparência igual entre navegadores, sem depender dos estilos padrão de cada um.
- O DS é a fonte do estilo: o visual do conteúdo de leitura é declarado por ele, não herdado do navegador.
- Os quatro apps se comportarem do mesmo jeito sob a mesma base.
- Não quebrar menus e listas de navegação, que não têm marcador por desenho.

## Opções consideradas

- Manter o estado atual: reset presente, sem decisão, estilo de leitura ad hoc em cada tela.
- Restaurar os padrões do navegador de forma geral (por exemplo, marcador em toda lista).
- Reset do Tailwind como base declarada dos apps, com o DS declarando o estilo por papel.

## Resultado da decisão

**Escolhida:** "Reset do Tailwind como base declarada dos apps, com o DS declarando o estilo por papel",
porque dá uma base única e previsível sem desfazer o reset em geral.

O `preflight` do Tailwind é a base dos quatro apps, carregado por cada app com o Tailwind processado. A
Configuração passa a processar o Tailwind como Seleção, Ingresso e Portal. O DS não restaura padrão do
navegador de forma geral: declara, por papel, o estilo do conteúdo de leitura, em classes próprias (lista
de leitura, grupo de campos com legenda, níveis de título). Lista, título e grupo de texto corrido usam a
classe do papel; menus, navegação e componentes `ui-*` continuam com o estilo próprio.

## Consequências

### Positivas

- Uma base de reset única e registrada, igual nos quatro apps e em todos os navegadores.
- O estilo do conteúdo de leitura passa a existir no DS e a ser reutilizado, em vez de repetido por tela.
- A Configuração gera as utilidades que os componentes do `shared-ui` usam.

### Negativas

- Todo elemento de conteúdo precisa do papel declarado; elemento sem classe aparece sem estilo.
- A mudança tornou visíveis marcadores e recuos que as listas de leitura nunca tiveram em Seleção e Portal.

### Neutras

- O `base.css` mantém um reset enxuto próprio que repete parte do `preflight`, para o DS poder ser usado
  sem Tailwind.

## Confirmação

Specs de matriz do DS e visuais cobrem os temas claro, escuro e de contraste. Na revisão, elemento de
leitura sem classe de papel é achado, e o `base.css` é o único lugar onde o estilo de leitura é definido.

## Prós e contras das opções

### Manter o estado atual

- Bom, porque não exige trabalho.
- Ruim, porque o conteúdo de leitura segue inconsistente e a Configuração segue com a base pela metade.

### Restaurar os padrões do navegador de forma geral

- Bom, porque devolve marcador e recuo sem tocar nos templates.
- Ruim, porque quebra menus e listas de navegação e traz de volta a variação entre navegadores.

### Reset do Tailwind como base declarada

- Bom, porque a base é previsível e o estilo vem do DS.
- Ruim, porque exige aplicar a classe de papel nos conteúdos de leitura.

## Mais informações

- Relaciona-se com a [ADR-0008](0008-tailwind-css-4-com-tokens-govbr.md) (Tailwind 4 e `@theme`), a
  [ADR-0019](0019-tokens-govbr-compartilhados-em-shared-ui.md) (tokens compartilhados), a
  [ADR-0023](0023-uniplus-ds-como-contrato-visual-vigente.md) (DS como contrato visual) e a
  [ADR-0025](0025-autoria-css-scss-no-angular.md) (autoria de CSS): nenhuma é revogada.
