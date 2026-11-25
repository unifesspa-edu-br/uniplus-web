---
status: accepted
date: 2026-11-17
decision-makers:
  - 'Tech Lead (CTIC)'
---

# ADR-0032: Apoio de teste unitário em lib restrita aos testes

## Contexto e enunciado do problema

O agendador do RxJS depende de `setInterval` e de `Date`. Quando o teste simula só parte dos
temporizadores, o `debounceTime` não avança e o teste passa a esperar tempo real, que varia com a
carga da máquina. A ordem de simular `setTimeout`, `setInterval` e `Date`, e de deixar a tela assentar
antes e depois de avançar o tempo, é a mesma em qualquer projeto, mas não tem lugar comum: cada
projeto a repetiria. O lugar comum não pode chegar ao código de produção nem ao build dos apps. O
ambiente do teste segue a [ADR-0004](0004-vitest-como-framework-de-testes-unitarios.md).

## Drivers da decisão

- Um único lugar decide o que se simula do tempo.
- O apoio de teste e o Vitest nunca entram no programa de produção nem no pacote de uma lib.
- A fronteira é verificada pelo lint, sem depender de disciplina de quem escreve.
- Teste unitário mais rápido e sem dependência da carga da máquina.

## Opções consideradas

- Lib própria sem build, restrita por lint aos arquivos de teste.
- Entry point de teste numa lib existente.
- Apoio repetido em cada projeto.

## Resultado da decisão

**Escolhida:** "Lib própria sem build, restrita por lint aos arquivos de teste", porque é a única opção
sem repetição cuja fronteira o lint consegue verificar.

A lib `shared-testing` (`@uniplus/shared-testing`) não tem build nem pacote e carrega a tag
`type:testing`. Só `*.spec.ts`, `*.testing.ts` e arquivos de setup a importam. Código de produção não
importa a lib nem o Vitest. A fronteira vive no `@nx/enforce-module-boundaries` da configuração
raiz, com regras distintas para arquivo de produção e para arquivo de teste; o `noInlineConfig` impede
silenciá-la por comentário.

A lib oferece o relógio controlado: liga a simulação de `setTimeout`, `setInterval` e `Date` e avança o
tempo deixando a tela assentar antes e depois. Usa o apoio o teste que monta componente e controla o
tempo do agendador do RxJS. O teste de classe ou de serviço, sem tela, segue com a API do Vitest. A
espera de tempo real em teste unitário dá lugar ao relógio controlado, salvo o teste da ordem real
entre temporizador e atualização da tela previsto na ADR-0004. A lib também reexporta as respostas
simuladas da API que o `shared-core` mantém em arquivo de teste próprio; a dependência vai só da lib
ao `shared-core`, que não a importa, e assim não há ciclo.

> **Emenda (2026-11-25).** A [ADR-0033](0033-conferencia-dos-testes-com-o-contrato-da-api.md)
> propõe que a `shared-testing` ofereça um ponto de entrada sem Angular para a conferência do
> contrato da API, quando implementado. Ele dependerá dos documentos
> OpenAPI de `shared-data`, acessados por apelido de caminho. A dependência continua em um só
> sentido: `shared-core` não importa `shared-testing`, e seus testes ficam fora da obrigação de
> conferir o contrato. A `shared-testing` continua restrita a arquivos de teste, sem integrar
> o build nem o pacote de produção.

## Consequências

### Positivas

- Um único lugar decide o que simular do tempo.
- Os testes ficam mais rápidos e sem dependência da carga.

### Negativas

- A regra de fronteira tem dois blocos, um para produção e outro para teste.
- Os apps excluem `*.testing.ts` do programa de produção.

### Neutras

- O ambiente do teste continua o da ADR-0004.

## Confirmação

Um teste do lint prova que a importação do apoio e do Vitest é recusada em arquivo de produção e
aceita em `*.spec.ts` e `*.testing.ts`. Arquivo de produção não importa nem reexporta arquivo de
teste identificado pelo nome (`*.spec`, `*.testing`, setup, ponto de entrada `/testing`), inclusive por
caminho relativo: uma regra do núcleo do ESLint, com nome próprio, cobre o que o
`@nx/enforce-module-boundaries` não vê dentro do mesmo projeto, e o teste do lint prova a recusa nos
projetos que redefinem regras de import. O build de produção dos apps não contém o Vitest nem o apoio.

## Prós e contras das opções

### Lib própria sem build, restrita por lint aos arquivos de teste

- Bom, porque a regra de fronteira por tag distingue a lib de apoio de qualquer outra.
- Ruim, porque exige uma lib a mais e dois blocos na regra.

### Entry point de teste numa lib existente

- Bom, porque não cria lib.
- Ruim, porque a lib hospedeira passa a ter o Vitest como dependência e a fronteira deixa de ser por lib.

### Apoio repetido em cada projeto

- Bom, porque não há fronteira nova.
- Ruim, porque cada projeto decide de novo o que simular.

## Mais informações

- [ADR-0003](0003-nx-como-build-system-do-monorepo-frontend.md): tags e fronteiras do workspace.
- [ADR-0004](0004-vitest-como-framework-de-testes-unitarios.md): ambiente e relógio do teste unitário.
