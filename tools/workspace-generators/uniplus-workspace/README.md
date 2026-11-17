# `@uniplus/workspace`

Workspace generators locais do Uni+ — usados para fabricar feature libs taggeadas dentro do monorepo Nx.

## Disponível

### `feature-lib`

Cria uma feature lib em `libs/<scope>/<name>/` com:

- `project.json` taggeada `["scope:<scope>", "type:<type>"]`.
- Builder `@nx/angular:ng-packagr-lite` (uniformidade com `shared-*`, conforme [ADR-0021](../../../docs/adrs/0021-runtime-config-via-token.md), Onda 1).
- `vite.config.mts` + `tsconfig.spec.json` com Vitest + `@analogjs/vite-plugin-angular` (paridade com `shared-utils`).
- `src/index.ts` (barrel) + `src/lib/<name>.ts` (placeholder) + `src/test-setup.ts`.
- Path mapping `@uniplus/<scope>-<name>` registrado em `tsconfig.base.json`.
- `eslint.config.mjs` com as métricas de qualidade em erro (`max-lines`, `max-lines-per-function`, `complexity`, `max-params`, `sonarjs/cognitive-complexity`): a lib nasce sem dívida e o CI a barra.

#### Uso

```bash
npx nx g @uniplus/workspace:feature-lib <scope>/<name> --type=<feature|data-access>
```

Exemplos:

```bash
npx nx g @uniplus/workspace:feature-lib selecao/feature-editais-detail --type=feature
npx nx g @uniplus/workspace:feature-lib portal/data-access-inscricoes --type=data-access
```

#### Validações

- `<scope>` ∈ `{selecao, ingresso, portal, configuracao}`. Outros valores são rejeitados pelo generator com mensagem listando os scopes válidos. O `shared` fica fora do conjunto porque as libs `shared-*` têm criação própria (CONTRIBUTING § Arquitetura de bibliotecas).
- `<name>` em kebab-case ASCII começando por letra, sem hífen no início, no fim nem repetido (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`). O generator é a fonte única dessa validação: o nome é testado como foi informado, sem normalização, antes de gravar qualquer arquivo.
- `<type>` ∈ `{feature, data-access}`. Validado pelo schema `enum` antes do factory rodar.

#### Tags emitidas

| `--type` | Tags do `project.json` gerado |
|---|---|
| `feature` | `["scope:<scope>", "type:feature"]` |
| `data-access` | `["scope:<scope>", "type:data-access"]` |

#### Builder em V1

Uniformidade com `shared-*` — todos `@nx/angular:ng-packagr-lite`. `@nx/js:tsc` para `--type=data-access` puro fica para V2 / Onda 2 (ADR-0021 *Roadmap V2*).
