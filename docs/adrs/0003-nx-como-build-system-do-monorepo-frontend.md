---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0003: Nx como build system do monorepo frontend

## Contexto e enunciado do problema

O `uniplus-web` mantém três aplicações Angular (Seleção, Ingresso, Portal — ver ADR-0001) que compartilham lógica de autenticação, componentes de UI e modelos de dados. Sem uma ferramenta de monorepo, o código compartilhado teria de ser publicado como pacotes npm internos ou duplicado entre repositórios, com overhead de versionamento e divergência inevitável de configuração (ESLint, Tailwind, Docker).

A escolha precisa cobrir cache de builds/testes, execução afetada por diff (`affected`), generators padronizados e module boundaries enforçáveis via lint.

## Drivers da decisão

- Três apps + bibliotecas compartilhadas em um único repositório.
- Necessidade de cache de builds/testes para reduzir tempo de CI.
- Module boundaries explícitos para impedir dependências indevidas (ex.: `portal` consumir código de `selecao`).
- Generators padronizados para criar libs e features sem reinventar layout de pastas.

## Opções consideradas

- Nx como orquestrador do monorepo Angular.
- Multi-repo (um repositório por aplicação), com libs compartilhadas publicadas como pacotes npm internos.
- Monorepo com apenas npm workspaces, sem orquestrador.
- Turborepo como orquestrador de monorepo.

## Resultado da decisão

**Escolhida:** Nx como build system e orquestrador do monorepo. Estrutura adotada:

```text
apps/
  selecao/  selecao-e2e/
  ingresso/ ingresso-e2e/
  portal/   portal-e2e/
  poc-primeng/ poc-primeng-e2e/
libs/
  shared-ui/
  shared-auth/
  shared-data/
```

Path aliases:

- `@uniplus/shared-ui` → `libs/shared-ui/src/index.ts`
- `@uniplus/shared-auth` → `libs/shared-auth/src/index.ts`
- `@uniplus/shared-data` → `libs/shared-data/src/index.ts`

Module boundaries são enforçados via `@nx/enforce-module-boundaries` no ESLint, impedindo, por exemplo, que `apps/portal` importe diretamente de `apps/selecao`.

## Consequências

### Positivas

- Código compartilhado versionado junto com as apps, sem publicação de pacotes internos.
- Cache local e remoto de builds/testes reduz tempo de CI em PRs que tocam poucas libs.
- `nx affected` executa apenas targets impactados por um diff.
- Grafo de dependências explícito (`nx graph`) facilita a visualização da arquitetura.
- Refatorações cross-cutting (ex.: renomear DTO em `shared-data`) ficam atômicas em um único commit.

### Negativas

- Curva de aprendizado para quem nunca usou Nx.
- Repositório único cresce em tamanho; clones iniciais são mais lentos.
- Atualizações de versão do Nx podem exigir migrações coordenadas.

### Neutras

- A escolha de Nx é independente da escolha de Angular como framework — é possível remover o Nx no futuro sem reescrever código de negócio, apenas reorganizando configs de build.

## Confirmação

- Pipeline de CI executa `nx affected --target=build`, `vite:test` e `lint`.
- ESLint roda `@nx/enforce-module-boundaries` em todos os projetos.

## Mais informações

- ADR-0001 detalha a separação em três aplicações.
- **Origem:** revisão da ADR interna Uni+ ADR-007 (não publicada).
