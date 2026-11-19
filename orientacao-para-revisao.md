# Orientação para revisão

Complementa o [`CONTRIBUTING.md`](CONTRIBUTING.md). Registra como as regras de arquitetura do `uniplus-web` são garantidas e o que fica para quem revisa.

Atualizado em 13/11/2026.

## Regra

Regra de arquitetura só vira verificação automática quando pode ser garantida de forma declarativa, legível e estável diante de refatoração. As formas aceitas são:

- **ESLint**: regras configuradas no `eslint.config.mjs` da raiz ou do projeto. Hoje a raiz já aplica `@nx/enforce-module-boundaries` e as métricas de tamanho e complexidade. `no-restricted-imports`, `no-restricted-syntax` com seletores e `@angular-eslint/*` são as formas previstas para os substitutos abaixo;
- **compilador do TypeScript**: tipos que tornam a violação impossível de compilar;
- **teste de comportamento**: unitário (Vitest) ou E2E (Playwright), que prova o efeito, e não a forma do código.

Não são aceitos:

- spec que lê o fonte (TypeScript, HTML, CSS) com `readFileSync`, `readdirSync` ou `import.meta.glob` e o confere com regex;
- spec que reimplementa uma regra que o ESLint ou o compilador já expressam;
- ferramenta própria mantida no repositório para cobrir regra de arquitetura;
- `eslint-disable` para fazer uma regra passar.

## Quando a regra não cabe

Siga esta ordem:

1. **Desenho.** Tipo, visibilidade ou ponto de entrada público tornam a violação impossível.
2. **Teste de comportamento.**
3. **Ferramenta pronta e configurada.** Só open source e gratuita, com licença compatível (MIT, Apache-2.0, BSD, MPL-2.0 ou LGPL), sem plano pago e com manutenção ativa conferida antes da adoção.
4. **Revisão.** A regra entra na lista "Conferido na revisão" abaixo.

## Transição da dívida existente

Os specs `*.fitness.spec.ts` leem o fonte como texto. Eles continuam valendo até serem substituídos, com estas regras:

- Um spec legado só é removido no mesmo PR em que o substituto fica implementado e verde. Proteção automática não pode ficar descoberta, nem por um commit.
- PR que altera um spec legado o migra para a forma aceita. A regra é desta orientação, e não das métricas do `CONTRIBUTING.md`.
- Spec com várias garantias só sai quando cada uma tem substituto ou retenção definida.
- Verificação nova nasce na forma aceita.

## Substitutos previstos

Salvo o que a tabela marca como já ativo, os substitutos abaixo não existem ainda. Cada um entra no PR que migra o spec correspondente. Garantia sem substituto equivalente fica retida no spec legado, reduzido só a ela.

| Spec legado | O que protege | Substituto previsto |
|---|---|---|
| `libs/shared-data/src/lib/__fitness__/architecture-boundaries.fitness.spec.ts` | Restrições de tag nas arestas estáticas e ausência de ciclo em todas as arestas do grafo de projetos, inclusive as implícitas | Imports entre projetos: `@nx/enforce-module-boundaries`, já ativo, mais `linterOptions.noInlineConfig` para que nenhuma regra seja desligada por comentário (o repositório não tem `eslint-disable` hoje). Arestas implícitas (`implicitDependencies`): o lint não as vê; a garantia fica retida até haver verificação equivalente sobre o grafo do Nx |
| `libs/shared-data/src/lib/__fitness__/public-entrypoints.fitness.spec.ts` | Apps importam só subpaths permitidos das libs `shared-*`; cada entrypoint listado é um entrypoint real do ng-packagr; `tsconfig.base.json` sem alias wildcard `shared-*` | Imports das apps: `no-restricted-imports` com a lista permitida expressa como padrão de permissão, e não só a proibição dos barrels raiz e de `src/lib/*`. Existência de cada entrypoint e ausência de wildcard: sem substituto equivalente; ficam retidas |
| `libs/shared-data/src/lib/__fitness__/runtime-config-providers.fitness.spec.ts` | `provideRuntimeConfig` importado de `@uniplus/shared-data/config` e `provideAuth` de `@uniplus/shared-auth/bootstrap`; `provideRuntimeConfig()` antes de `provideAuth()`; nada de `environments/environment` | Ordem: teste de comportamento da inicialização (unitário ou E2E, decisão pendente). Origem dos dois providers e import de `environments/environment`: `no-restricted-imports` nos `app.config.ts` |
| `libs/shared-data/src/lib/api/__fitness__/api-services.fitness.spec.ts` | Classe `@Injectable`; nenhum método público devolve `Promise`; método público que devolve `Observable` devolve `Observable<ApiResult<T>>`; import de `withVendorMime` vindo de `@uniplus/shared-core/http`; ocorrência de `withVendorMime` nos `this.http.get(...)`, contada por arquivo, com dois GETs de `versoes-do-perfil.api.ts` dispensados. Mutações ficam fora do spec | Decorator e `providedIn: 'root'`: `no-restricted-syntax` com seletores que exijam os dois, porque `@angular-eslint/use-injectable-provided-in` sozinho aceita classe sem decorator e outros valores. Origem do import: `no-restricted-imports`. Proibição de `Promise`: `no-restricted-syntax` sobre o tipo de retorno dos métodos públicos dos `*.api.ts`. Tipo `Observable<ApiResult<T>>` e uso de `withVendorMime` em cada chamada: sem forma declarativa equivalente definida; ficam retidos até haver desenho (por exemplo, cliente HTTP comum que só devolve `ApiResult` e aplica o cabeçalho) com teste unitário de cada serviço |
| `apps/configuracao/src/app/features/__fitness__/nav-icons-existem-no-primeicons.fitness.spec.ts` | Ícone do menu lateral existe no PrimeIcons | Tipo `IconeDoMenu` derivado de `PrimeIcons` no app-shell: ícone inexistente não compila |

## Leituras de arquivo que continuam legítimas

- `calendario-dias-uteis.api.spec.ts` lê o contrato OpenAPI (JSON) para derivar o DTO. É dado, não fonte.
- Os specs do formulário do candidato carregam casos de teste em JSON com `import.meta.glob`.

## Conferido na revisão (não vira verificação automática)

1. Componente de página não usa `HttpClient`: o acesso HTTP passa pelos serviços de `@uniplus/shared-data`. Já é regra de ESLint em `apps/configuracao` (`no-restricted-imports` em `features`) e em `apps/selecao` (`no-restricted-syntax` contra `inject(HttpClient)` nas páginas). Nas demais apps, confira no diff.
2. Vocabulário institucional em texto exibido: confira no diff o termo usado em string de tela.
3. Tamanho de cada caso de teste e dos arquivos CSS, como já diz a seção "Revisão de código" do `CONTRIBUTING.md`.

## Decisões pendentes

- **`@uniplus/shared-data/tokens`.** Definir se é ponto de entrada público. A regra de `no-restricted-imports` depende disso.
- **Specs de estilo.** `libs/shared-ui/src/styles/base.spec.ts`, `components.spec.ts`, os specs de componentes que usam `lerFolha` e `apps/portal/src/app/layout/portal-shell.spec.ts` leem CSS como texto. Decidir quais são removidos por só detectarem mudança e quais passam a usar um parser de CSS (`postcss.parse`) em vez de regex.
- **Ordem dos providers.** Teste unitário do `app.config.ts` ou E2E da inicialização.

## Divergência registrada

A seção "Testes" do `CONTRIBUTING.md` cita Jest. O repositório usa Vitest. Corrigir no PR que tocar aquela seção.
