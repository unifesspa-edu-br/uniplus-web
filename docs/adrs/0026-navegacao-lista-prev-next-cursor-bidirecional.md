---
status: "accepted"
date: "2026-06-16"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0026: Navegação de lista por prev/next sobre cursor bidirecional

## Contexto e enunciado do problema

O contrato V1 da `uniplus-api` pagina coleções por cursor opaco cifrado, propagado no header `Link` (RFC 5988/8288). A [ADR-0015](0015-cursor-pagination-consumer-link-header.md) registrou o consumo desse cursor no cliente, mas apenas na forma **forward-only** (`extractNextCursor` sobre `rel="next"`), porque o backend só emitia `rel="next"`. A primeira lista filtrada e paginada do `uniplus-web` (Unidades, na Configuração) nasceu com uma montagem reativa **interina**: paginação "Carregar mais" (acumulação forward), adequada a *infinite-scroll* mas não à navegação administrativa típica.

Decisão de produto do Tech Lead: a navegação padrão das listas administrativas do `uniplus-web` é **Anterior / Próximo (prev/next)** — mais clara para o usuário do que "Carregar mais", que pressupõe um cenário de rolagem infinita inexistente no sistema hoje. Isso exige um cursor **bidirecional** no backend, entregue na `uniplus-api` (issue #656): o header `Link` passou a emitir `rel="prev"` e `rel="next"`, com um parâmetro `direction` cifrado dentro do próprio cursor (ADR-0089 do `uniplus-api`).

Resta registrar, como decisão arquitetural do frontend, o **padrão de view de lista reativa** resultante: como compor `httpResource`/`useApiResource`, signals e o parser do `Link`; qual o modelo de estado (substituição vs acumulação); e quais invariantes de tratamento de erro a paginação por substituição precisa garantir. Esta ADR registra esse padrão, agora que existe um exemplar implementado (listas de Editais e Unidades, issue #401).

## Drivers da decisão

- **Clareza de UX** — prev/next é mais previsível que "Carregar mais" para listas administrativas; acumulação só se justifica em rolagem infinita, ausente no produto.
- **Aderência ao cursor bidirecional do backend** — o servidor fornece `prev` e `next` a cada página, com `direction` vinculado ao cursor; o cliente deve seguir os links opacos sem inferir a convenção.
- **Cliente sem estado de pilha** — com o servidor emitindo `prev`/`next`, fabricar "Anterior" empilhando cursores no cliente seria estado redundante e frágil.
- **Idiomático Angular 21** — signals, `httpResource` via `useApiResource` ([ADR-0018](0018-adocao-httpresource-via-wrapper-use-api-resource.md)), `linkedSignal` para estado derivado (nunca `effect` para atualizar outro signal).
- **Container/presentational** — separar a página inteligente do componente de tabela reutilizável ([ADR-0017](0017-pattern-feature-page-container-presentational.md)).
- **Robustez de erro** — a substituição introduz uma janela de recarga que precisa de regras explícitas (retry, limpeza, gate de ações, preservação de cursores).
- **Consistência cross-feature** — o padrão deve valer para qualquer lista paginada (Editais, Unidades e futuras), evitando reinvenção.

## Opções consideradas

- **A. prev/next por substituição sobre cursor bidirecional** — o servidor fornece `prev`/`next` no `Link`; cada página substitui a anterior; o cliente não mantém pilha de cursores.
- **B. Manter "Carregar mais" (acumulação forward-only)** — a montagem interina entregue inicialmente, sobre o cursor forward-only.
- **C. prev/next com pilha de cursores no cliente** — fabricar "Anterior" empilhando localmente os cursores `next` já visitados, sobre um cursor forward-only.
- **D. Paginação numerada (offset/limit com números de página)** — abandonar cursor em favor de offset.

## Resultado da decisão

**Escolhida:** "A — prev/next por substituição sobre cursor bidirecional", porque é a única opção que casa o padrão de UX desejado com o contrato do backend sem introduzir estado redundante no cliente. Com o servidor emitindo `rel="prev"` e `rel="next"`, o cliente segue links opacos auto-suficientes: navegar é **substituir** a página atual pela seguinte/anterior, e o estado do cliente é apenas o cursor da página corrente — não uma pilha.

A composição canônica de uma view de lista reativa paginada é:

1. **Requisição reativa** via `useApiResource` ([ADR-0018](0018-adocao-httpresource-via-wrapper-use-api-resource.md)) com `params` derivados de signals (filtro + cursor + `direction`); o `httpResource` cancela a requisição anterior nativamente.
2. **Estado de página**: um signal `{ cursor, direction } | undefined` (`undefined` = primeira página). Um `linkedSignal` com `source` na chave de filtro reseta para a primeira página sempre que o filtro muda.
3. **Consumo do `Link`**: `extractPrevCursor` / `extractNextCursor` ([ADR-0015](0015-cursor-pagination-consumer-link-header.md), estendida nesta entrega com o helper simétrico de `rel="prev"`) e o tipo `PaginationDirection` (`'next' | 'prev'`).
4. **Contrato com o backend (ADR-0089 do `uniplus-api`)**: a primeira página não envia `cursor` nem `direction` (o servidor coage para `next`); a navegação envia o `cursor` opaco **e** o `direction` casado à direção cifrada nele (o boundary rejeita divergência como adulteração); `limit` é omitido na navegação (o cursor carrega a janela).
5. **Lista derivada** por `linkedSignal` (não `effect`): na resposta de sucesso **substitui** a lista; durante `loading` preserva (não pisca); em falha da **primeira página** (troca de filtro ou refetch pós-mutação) limpa, pois a lista anterior pode estar desatualizada; em falha de **navegação** preserva a página atual.
6. **Cursores de navegação** também derivados por `linkedSignal` que espelha a lista, para que `prev`/`next` sejam **preservados** quando uma navegação falha — a resposta de erro não traz `Link`, e ler o header diretamente faria o pager desaparecer enquanto a página segue visível.
7. **Apresentação** ([ADR-0017](0017-pattern-feature-page-container-presentational.md)): a barra Anterior/Próximo é o `ui-pager`, embutido no `data-table` reutilizável; durante `isLoading` as linhas exibidas são da página anterior e ficam **não-clicáveis** (substituição poderia navegar para um item prestes a sair).

### Invariantes de tratamento de erro (checklist)

A paginação por substituição herda a janela de recarga das listas filtradas e exige:

- [ ] Retry da página atual via `reload()` (ou output `retry` do componente) — re-`set` do mesmo cursor não dispara nova requisição.
- [ ] Falha de refetch que substitui a **primeira página** limpa a lista; falha em **navegação** preserva a página atual.
- [ ] Cursores `prev`/`next` preservados na falha de navegação, para o pager não sumir.
- [ ] Ações de linha desabilitadas durante a recarga substitutiva, gateando **todos** os caminhos (tabela, hierarquia, drawer de detalhe); no `data-table`, linhas não-clicáveis enquanto `isLoading`.
- [ ] Seletor auxiliar (ex.: unidade superior) com `resource` próprio, **sem** o filtro da lista, com busca server-side e sinalização de falha com retry.
- [ ] Cache monotônico de rótulos por id, para que um item filtrado para fora da página continue resolvendo.
- [ ] Reset **síncrono** do termo de busca aplicado na reabertura de formulário, sem esperar o debounce.

## Consequências

### Positivas

- **UX consistente e previsível** — Anterior/Próximo como padrão único de listas administrativas.
- **Cliente sem pilha** — o estado é apenas o cursor da página corrente; o servidor é a autoridade sobre `prev`/`next`.
- **Aderência ao backend** — `direction` casado ao cursor honra o anti-adulteração da ADR-0089; `limit` omitido na navegação espelha o servidor.
- **Reuso** — `ui-pager` + `data-table` + helpers servem qualquer lista paginada futura; o gate de clique durante recarga vale para todos os consumidores do `data-table`.

### Negativas

- **`httpResource` é `@experimental`** — caveat herdado da [ADR-0018](0018-adocao-httpresource-via-wrapper-use-api-resource.md); blast radius contido no wrapper `useApiResource`.
- **Sem cache de páginas visitadas** — cada navegação refaz o fetch; navegar de volta não reusa a página anterior.
- **Perda do contexto acumulado** — diferente do "Carregar mais", a página anterior some ao navegar; é o comportamento desejado, mas elimina a leitura contínua de muitos itens.

### Neutras

- A acumulação ("Carregar mais") permanece um padrão válido, **reservado** a um eventual cenário de rolagem infinita; até lá, não é usada.

## Confirmação

- O fitness test `no-direct-http-in-pages` exige `useApiResource` (proíbe `HttpClient` direto na página).
- Specs Vitest cobrem: substituição (não acumulação), `direction` casado ao cursor, primeira página sem `cursor`/`direction`, preservação de página e de cursores em falha de navegação, e o gate de clique de linha durante `isLoading`.
- Exemplar de referência: `editais-list.page.ts`, `unidades.page.ts`, o `data-table` e o `ui-pager` (issue #401).

## Prós e contras das opções

### A. prev/next por substituição sobre cursor bidirecional

- Bom, porque casa o padrão de UX desejado com o contrato do backend sem estado redundante no cliente.
- Bom, porque os links são auto-suficientes (RFC 5988) — o cliente segue cursores opacos sem inferir a convenção.
- Ruim, porque não há cache de páginas visitadas — navegar de volta refaz o fetch.

### B. Manter "Carregar mais" (acumulação forward-only)

- Bom, porque é a montagem já existente e adequada a rolagem infinita.
- Ruim, porque "Carregar mais" é confuso como navegação administrativa e não oferece "Anterior".

### C. prev/next com pilha de cursores no cliente

- Bom, porque ofereceria "Anterior" mesmo sobre um cursor forward-only.
- Ruim, porque mantém estado redundante e frágil no cliente quando o servidor já fornece `prev`; fabricar navegação reversa é anti-padrão validado contra a literatura de cursor pagination.

### D. Paginação numerada (offset/limit)

- Bom, porque permite saltar para uma página arbitrária.
- Ruim, porque abandona a estabilidade do keyset sob inserções/remoções e contraria o contrato de cursor opaco do backend (ADR-0026 do `uniplus-api`).

## Mais informações

- [ADR-0015](0015-cursor-pagination-consumer-link-header.md) — consumo de cursor via parser de `Link`; estendida com `extractPrevCursor` e o tipo `PaginationDirection`.
- [ADR-0017](0017-pattern-feature-page-container-presentational.md) — container/presentational (`XxxPage` smart + `ui-*` dumb).
- [ADR-0018](0018-adocao-httpresource-via-wrapper-use-api-resource.md) — `httpResource` via wrapper `useApiResource`; caveat `@experimental`.
- [ADR-0089 do `uniplus-api`](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0089-navegacao-bidirecional-cursor-keyset-reverso.md) — keyset reverso, `direction` vinculado ao cursor, flags via `EXISTS`.
- Backend bidirecional: [unifesspa-edu-br/uniplus-api#656](https://github.com/unifesspa-edu-br/uniplus-api/issues/656). Origem do pivô: [unifesspa-edu-br/uniplus-web#397](https://github.com/unifesspa-edu-br/uniplus-web/issues/397). Adoção no frontend: [unifesspa-edu-br/uniplus-web#401](https://github.com/unifesspa-edu-br/uniplus-web/issues/401).
