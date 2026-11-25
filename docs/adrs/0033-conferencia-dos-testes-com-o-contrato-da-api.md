---
status: proposed
date: 2026-11-25
decision-makers:
  - 'Tech Lead (CTIC)'
consulted: []
informed: []
---

# ADR-0033: Conferência dos testes com o contrato da API

## Contexto e enunciado do problema

Respostas simuladas e dados de teste repetiam códigos escritos à mão. Testes passaram mesmo
com tipo do catálogo do cronograma em minúsculas, `forward` na paginação e `Confirmado` como
situação. Os documentos OpenAPI versionados descrevem o contrato de pedidos e respostas.
O valor do filtro do catálogo só poderá ser conferido após a correção do contrato da API.

## Drivers da decisão

- Detectar divergências antes de enviar pedidos à API real.
- Conferir OpenAPI 3.1, inclusive os tipos de conteúdo próprios do Uni+.
- Manter o apoio restrito a testes e proteger dados nas mensagens de erro.

## Opções consideradas

- `openapi-backend` para pedidos e `ajv` com `ajv-formats` para respostas.
- `ajv` sozinho.
- `express-openapi-validator`.
- `@stoplight/prism-http`.
- `oas3-chow-chow`, `jest-openapi` ou `openapi-response-validator`.

## Prós e contras das opções

- A combinação escolhida confere pedidos e respostas com tipos de conteúdo próprios, mas usa
  duas bibliotecas.
- `ajv` sozinho exigiria construir a localização da operação pelo método e caminho e a
  conferência do pedido.
- `express-openapi-validator` depende do Express, ausente desse caminho de teste.
- `@stoplight/prism-http` é voltado à simulação e intermediação de pedidos e usa API interna.
- As três últimas opções são voltadas a OpenAPI 3.0 e têm manutenção insuficiente.

## Resultado da decisão

**Escolhida:** `openapi-backend` 5.x para pedidos e `ajv` 8, com dialeto 2020-12 e
`ajv-formats`, para respostas. A prova inicial mostrou que o `openapi-backend` não confere
respostas com `application/vnd.uniplus.*+json`.

Nos projetos migrados, pedidos e respostas simuladas da API nos testes unitários e de ponta a
ponta serão conferidos contra os documentos versionados em `libs/shared-data/openapi`. Nos testes
de ponta a ponta, ficam fora pedidos `OPTIONS` e os que não pertencem a `/api/`. Os testes de
`shared-core` ficam fora da obrigatoriedade. A API deve publicar `operationId` em toda operação,
com teste que reprove operações sem nome (api#2883). As cópias versionadas ainda não cumprem
essa exigência. A conferência localizará a operação pelo `operationId` do contrato.

A resposta é conferida pelo esquema do código de resposta e do tipo de conteúdo correspondente.
Nos testes de ponta a ponta, uma resposta simulada sem `Content-Type` usa o `Accept` do pedido,
desde que esteja declarado em uma resposta 2xx da operação. Sem correspondência, o teste falha.

O núcleo sem Angular ficará em `@uniplus/shared-testing/contrato` e acessará os documentos de
`shared-data` por apelido de caminho. `shared-testing` é restrita a arquivos de teste e não
integra o build nem o pacote de produção; `shared-core` não depende dela, conforme a ADR-0032.
Nos unitários, o interceptador de conferência será o último da cadeia e o teste reprovará ao fim
se houver divergência. Em `shared-e2e`, um apoio automático do Playwright fará a conferência e
reprovará o teste ao fim se houver divergência.

O lint será ativado por projeto após a migração e impedirá o uso de provedores HTTP de teste que
contornem a conferência e a importação direta do `test` do Playwright que contorne esse apoio.
A mensagem identificará método, caminho da operação sem valores concretos ou com parâmetros
ocultados, campo e regra; não mostrará valores de parâmetros, cabeçalhos ou corpos.

Serviços e dados de teste são tipados pelo contrato gerado; valores de enumeração vêm das
constantes geradas, sem repetir listas de códigos à mão.

**FATO CONFERIDO:** Em uma prova temporária, o Playwright resolveu o apelido definido no
`tsconfig` para o arquivo gerado `schema.ts` e importou os valores das enumerações em tempo
de execução. O `tsc` recusou a grafia antiga `'forward'` onde a enumeração gerada era exigida.

## Consequências

### Positivas

- Pedidos e respostas simuladas divergentes são identificados durante os testes.
- Tipos gerados e documentos versionados passam a orientar os dados dos testes.

### Negativas

- A coordenação técnica aceitou até 10% de aumento no tempo dos testes por projeto; acima
  desse limite, o Tech Lead decide como proceder.
- Dados de teste precisam incluir os campos obrigatórios do contrato.
- O trabalho nos projetos do web só começa após a API publicar `operationId` em todas as
  operações e corrigir os filtros com código de enumeração no contrato.

## Confirmação

- Testes negativos rejeitam as três grafias já ocorridas: tipo do catálogo em minúsculas,
  `forward` na paginação e `Confirmado` literal. O caso de filtro depende da correção na API.
- Testes do lint comprovam a obrigatoriedade em cada projeto migrado e a fronteira de teste.
- `ngc` e `tsc`, conforme o projeto, conferem os specs e os tipos gerados.

## Mais informações

- [ADR-0004](0004-vitest-como-framework-de-testes-unitarios.md): testes unitários.
- [ADR-0013](0013-gerador-openapi-node-only.md): geração de tipos OpenAPI.
- [ADR-0032](0032-apoio-de-teste-unitario-em-lib-restrita-aos-testes.md): apoio de teste.
