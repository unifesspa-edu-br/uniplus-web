---
status: "accepted"
date: "2026-05-05"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0013: Gerador OpenAPI Node-only (`openapi-typescript`) em vez de `openapi-generator-cli`

## Contexto e enunciado do problema

A Frente 2 do plano Frontend Milestone B prevê consumir o Contrato V1 (umbrella ADR-0022 do `uniplus-api`) através de **clientes tipados gerados a partir do OpenAPI 3.1 do backend**. O script `libs/shared-data/scripts/generate-api-clients.sh` já existia em `main`, configurado para `@openapitools/openapi-generator-cli` (template `typescript-angular`), mas **nunca rodou**: os baselines em `libs/shared-data/openapi/{selecao,ingresso}.openapi.yaml` são stubs vazios (`paths: {}`). Antes de popular os baselines reais a partir de `repositories/uniplus-api/contracts/openapi.{selecao,ingresso}.json`, é o momento natural de revalidar a escolha do gerador.

A revalidação parte de quatro fatos novos pós-merge da F1 (PR #176):

1. **`apiResultInterceptor` consolidado.** Toda response cruza um único interceptor que envelopa em `ApiResult<T>` e injeta `Accept` de versionamento per-resource a partir de `HttpContext` (`withVendorMime(...)`). A injeção via `HttpContext` será reutilizada por `withIdempotencyKey(...)` (Frente 3) e por helpers futuros do contrato V1.
2. **Standalone-only é binding.** A [ADR-0002](0002-angular-21-como-framework-spa.md) e o `CLAUDE.md` do repo proíbem `NgModule` em código novo. Componentes, services e providers nascem standalone.
3. **Backend emite OpenAPI 3.1.** A ADR-0030 do `uniplus-api` (contract-first) define 3.1 como spec canônica; geradores que só suportam 3.0 forçam downgrade lossy.
4. **Wire format de erro RFC 9457.** O `ProblemDetails` (extensions Uni+ inclusas) já vive em `@uniplus/shared-core/http`. Tipos do generator que tentem reemitir `ProblemDetails` colidem com a fonte canônica.

O problema é definir qual gerador usar daqui para frente. A solução afeta CI, padrões de feature service, drift checks e custo cognitivo de manter um codebase 100% standalone.

## Drivers da decisão

- **Aderência a Angular 21 standalone-only.** Templates que emitem `ApiModule` (NgModule) introduzem deadweight obrigado a ser ignorado em todo onboarding e revisão.
- **Compatibilidade com `HttpContext` pattern.** Services gerados precisam permitir que o caller anexe `HttpContext` populado por `withVendorMime`, `withIdempotencyKey` e tokens futuros — sem fork de templates do gerador.
- **Stack 100% Node.** Toolchain do `uniplus-web` é Node 22 LTS + Nx 22 + npm. Adicionar JRE cria fricção em dev local, devcontainer, docker images e CI runners.
- **Drift check em ciclo curto.** Geração instantânea (≈1s) habilita pre-commit hook + CI step que falha se o codegen committed divergir do spec do backend; geração lenta (≈30s) força mover esse check para fora do pre-commit.
- **OpenAPI 3.1 nativo.** Reduzir conversão lossy entre 3.1 e 3.0.
- **Manutenção e reputação.** Preferir mantenedores com presença ativa nos níveis 3-4 da hierarquia de pesquisa (Drew Powers, time Hey API), com ciclos de release previsíveis e issues respondidas.

## Opções consideradas

- **A. `openapi-typescript`** (drwpow). Gera só types `.d.ts` (`paths`, `components`). Combina com **service Angular escrito manualmente** (~30 LOC por endpoint group). Sem runtime, sem NgModule, sem service factory.
- **B. Manter `@openapitools/openapi-generator-cli` template `typescript-angular`.** Gera services `@Injectable`, modelos, `Configuration`, `ApiModule` (NgModule).
- **C. `@hey-api/openapi-ts`.** Sucessor moderno do `openapi-typescript-codegen`. Templates configuráveis (fetch, axios, angular). Gera client + types num único toolchain Node.
- **D. `orval`.** Codegen Node com forte ecossistema React (react-query, swr, zod). Suporte Angular via template community/custom.

## Resultado da decisão

**Escolhida:** "A — `openapi-typescript` + service Angular manual thin", porque é a única opção que:

1. Não emite `NgModule` (zero conflito com ADR-0002).
2. Deixa explícito no service quem injeta `HttpContext` — encaixa por design com `withVendorMime`/`withIdempotencyKey`.
3. Roda em Node puro, sem JRE, em ≈1s.
4. Suporta OpenAPI 3.1 sem downgrade.
5. Tem mantenedor reconhecido (Drew Powers, fontes Nível 4) com release stream ativo.

### Estrutura adotada

```text
libs/shared-data/
├── openapi/
│   ├── selecao.openapi.json     ← baseline copiado de uniplus-api/contracts/
│   └── ingresso.openapi.json
├── scripts/
│   └── generate-api-clients.sh  ← reescrito para openapi-typescript
└── src/lib/api/
    ├── selecao/
    │   ├── schema.ts            ← GERADO: paths + components
    │   ├── tokens.ts            ← MANUAL: SELECAO_BASE_PATH InjectionToken
    │   └── editais.api.ts       ← MANUAL: @Injectable thin
    └── ingresso/
        ├── schema.ts
        ├── tokens.ts
        └── chamadas.api.ts
```

### Forma do service manual

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core';
import type { components, paths } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

export type EditalDto = components['schemas']['EditalDto'];
export type CriarEditalCommand = components['schemas']['CriarEditalCommand'];

@Injectable({ providedIn: 'root' })
export class EditaisApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  listar(cursor?: string): Observable<ApiResult<EditalDto[]>> {
    return this.http.get<ApiResult<EditalDto[]>>(`${this.basePath}/api/editais`, {
      params: cursor ? { cursor } : undefined,
      context: withVendorMime('edital', 1),
    });
  }
}
```

`SELECAO_BASE_PATH` e `INGRESSO_BASE_PATH` são `InjectionToken<string>` providos uma vez por aplicação no `app.config.ts` a partir de `environment.apiUrl`. Não há classe `Configuration`, não há `ApiModule`. Bearer continua sendo injetado pelo `tokenInterceptor` (ADR-0009) — `accessToken` da Configuration nunca é usado.

### Drift check

`nx run shared-data:codegen-api` regenera localmente; CI roda o mesmo target e falha se houver diff entre `schema.ts` committed e o regenerado. Espelha o `OpenApiEndpointTests` do backend (ADR-0030 do `uniplus-api`).

### Migração

A migração é trivial porque o gerador atual nunca produziu artefato em `main`:

1. Reescrever `scripts/generate-api-clients.sh` para invocar `npx openapi-typescript`.
2. Sincronizar `libs/shared-data/openapi/{selecao,ingresso}.openapi.json` com os baselines reais do backend (formato JSON, não YAML).
3. Adicionar Nx target `codegen-api` consumido por CI e pre-commit.
4. Escrever os primeiros services thin (`EditaisApi`) na Story de implementação da Frente 2.

### Esta ADR não decide

- Qual o conteúdo exato do `EditaisApi` ou de qualquer outro service de feature — código vai junto com a Story de implementação.
- Schema de teste de drift (formato do diff, política de bloqueio) — vai com o PR de implementação.
- Convenção de naming dos `InjectionToken` para `BASE_PATH` — definida no PR de implementação após o codegen real existir.
- Estratégia de runtime para `Idempotency-Key` (Frente 3) — separado.

### Por que B, C e D foram rejeitadas

- **B (`openapi-generator-cli`).** Emite `ApiModule` mesmo com `providedInRoot=true`; conflita com [ADR-0002](0002-angular-21-como-framework-spa.md). Services gerados ignoram `HttpContext`, forçando wrappers manuais — anula o benefício do codegen. Requer JRE no CI e dev local. Geração ≈30s impede pre-commit hook. Suporte a OpenAPI 3.1 vem por conversão lossy. O custo de manter forks de template `mustache` para emitir standalone moderno não compensa: a quantidade de service code ativo no `uniplus-web` é pequena, e escrever os services manualmente fica em ~30 LOC cada.
- **C (`@hey-api/openapi-ts`).** Promissor e Node-only, com generator Angular declarado. Mas o template Angular é menos battle-tested que os de fetch/axios; histórico recente de breaking changes em majors; suporte a `HttpContext` exige verificação caso a caso. O ganho sobre a opção A é marginal (gera o service que precisaríamos escrever de qualquer modo) e o risco de manutenção é maior.
- **D (`orval`).** Sem template Angular oficial. Forte para projetos React + react-query/zod. Adoção em monorepos Angular Nx é minoritária. Manter um template custom para emitir o que `openapi-typescript` + 30 LOC já entrega é trabalho desnecessário.

## Consequências

### Positivas

- **Zero `NgModule` no caminho.** Código gerado naturalmente respeita o invariante standalone-only.
- **Service code é nosso e explícito.** Cada feature service controla `HttpContext`, naming dos métodos e mapeamento de erros — alinhado com `ApiResult<T>` por design.
- **CI sem JRE.** Pipeline mais leve, `e2e-runner-image.yml` não precisa instalar Java; dev local mais rápido.
- **Drift check em pre-commit.** Geração instantânea torna `nx run shared-data:codegen-api` viável como gate síncrono.
- **OpenAPI 3.1 nativo.** Sem downgrade para 3.0.
- **Output mínimo.** Dois `schema.ts` por módulo + tokens; sem `ApiModule.deprecated`, sem `Configuration` redundante por módulo.

### Negativas

- **Service Angular precisa ser escrito à mão.** Mitigação: ~30 LOC por service de feature; cada service é descrito numa Task; padrão é repetitivo o suficiente para usar como snippet.
- **Sem `Configuration` global.** `BASE_PATH` continua existindo (como `InjectionToken`) mas ferramentas de tooling que esperam `Configuration` não funcionam — não usamos nenhuma.
- **Tipos hand-authored para extensions Uni+** (ex.: `_links` HATEOAS) podem precisar augment manual no `schema.ts` ou em arquivo `.d.ts` colateral. A própria ADR-0011 já antecipa isso para `ProblemDetails` — o pattern se estende.

### Neutras

- Pode evoluir para **B** ou **C** se um cenário futuro justificar (ex.: codebase explodir para >50 services e o boilerplate manual virar gargalo). Decisão baixo lock-in: trocar gerador é refactor mecânico (regerar `schema.ts`, ajustar imports do service manual).

## Confirmação

1. **Lint do PR de implementação** rejeita qualquer arquivo gerado contendo `@NgModule` ou `forRoot(`.
2. **Nx target `codegen-api`** roda em CI e como pre-commit hook; diff em `schema.ts` falha o build.
3. **Drift contra backend.** Workflow CI compara `libs/shared-data/openapi/*.json` com `uniplus-api/contracts/openapi.*.json` (via download artifact ou submodule reference) e falha se houver divergência sem PR de sincronização.

## Mais informações

- [ADR-0002](0002-angular-21-como-framework-spa.md) — Angular 21 standalone (binding).
- [ADR-0009](0009-keycloak-como-identity-provider-oidc.md) — `tokenInterceptor` é a fonte única do Bearer.
- [ADR-0011](0011-consumer-adapter-api-result.md) — `ApiResult<T>` consumido pelos services.
- ADR-0028 do `uniplus-api` — versionamento per-resource (vendor MIME).
- ADR-0030 do `uniplus-api` — OpenAPI 3.1 contract-first.
- [`openapi-typescript`](https://openapi-ts.dev/) — gerador escolhido.
- [`@openapitools/openapi-generator-cli`](https://www.npmjs.com/package/@openapitools/openapi-generator-cli) — gerador descontinuado para o `uniplus-web`.
- Plano Frontend Milestone B (Frente 2) — implementação que consome esta decisão.

## Implementação (2026-05-05)

A entrega da issue [#172](https://github.com/unifesspa-edu-br/uniplus-web/issues/172) (US-F2-01) materializa esta decisão. Status promovido de `proposed` para `accepted` no merge do PR de implementação.

### O que foi entregue

- `libs/shared-data/openapi/{selecao,ingresso}.openapi.json` — baselines reais sincronizados a partir de `repositories/uniplus-api/contracts/`. Os YAML stubs anteriores foram removidos.
- `libs/shared-data/scripts/generate-api-clients.sh` — reescrito para `npx openapi-typescript` (~40 ms para os dois módulos). Emite `--immutable` (`readonly` em todos os campos) e `--enum` (TS enums em vez de unions).
- `libs/shared-data/src/lib/api/selecao/schema.ts` — gerado (paths para `/api/auth/me`, `/api/profile/me`, `/api/editais`, `/api/editais/{id}`, `/api/editais/{id}/publicar`; components: `EditalDto`, `CriarEditalCommand`, `TipoProcesso`, `AuthenticatedUserResponse`, `UserProfileResponse`, `ProblemDetails`).
- `libs/shared-data/src/lib/api/ingresso/schema.ts` — gerado (paths `/api/auth/me`, `/api/profile/me`).
- `libs/shared-data/src/lib/api/{selecao,ingresso}/tokens.ts` — `SELECAO_BASE_PATH` e `INGRESSO_BASE_PATH` (`InjectionToken<string>`).
- `libs/shared-data/src/lib/api/selecao/editais.api.ts` — primeiro service thin de referência (`listar()`, `obter()`); demais métodos (`criar`, `publicar`) ficam para PRs subsequentes que dependem das Frentes 3 (idempotência) e 8 (HATEOAS).
- `libs/shared-data/src/lib/api/selecao/editais.api.spec.ts` — 3 testes Vitest cobrindo `listar`, `obter` (com encoding seguro) e tratamento de 404 envelopado em `ApiFailure`.
- `package.json` — `@openapitools/openapi-generator-cli` removido; `openapi-typescript@^7.13.0` adicionado como `devDependency`.
- `libs/shared-data/project.json` — targets `codegen-api` (regen) e `codegen-api-check` (regen + `git diff --exit-code`).
- `.github/workflows/ci.yml` — step "Verificar drift do codegen OpenAPI" rodando `nx run shared-data:codegen-api-check` antes dos gates principais.
- `apps/{selecao,ingresso,portal}/src/environments/environment.ts` — `apiUrl` corrigido para a origin absoluta (`http://localhost:5000`), sem o sufixo `/api/v1` que era incompatível com os paths absolutos do contrato V1.
- `apps/{selecao,ingresso,portal}/src/app/app.config.ts` — providers de `SELECAO_BASE_PATH` e `INGRESSO_BASE_PATH` apontando para `environment.apiUrl`.
- `libs/shared-data/README.md` — workflow de regeneração + pattern dos services thin documentados.

### Pontos não-óbvios capturados na implementação

- **`ProblemDetails` no schema gerado.** `openapi-typescript` emite `components['schemas']['ProblemDetails']` espelhando o tipo default da .NET (RFC 7807, sem extensions Uni+). Esse tipo **não deve ser consumido**: a fonte canônica continua sendo `ProblemDetails` de `@uniplus/shared-core/http`. JSDoc no `editais.api.ts` reforça a regra; futura limpeza pode adicionar regra ESLint específica.
- **Sem Configuration class.** Não há classe de configuração própria de cada módulo gerado. `BASE_PATH` continua único por módulo via `InjectionToken<string>`. `accessToken` da Configuration **não existe** — Bearer é responsabilidade exclusiva do `tokenInterceptor` (ADR-0009).
- **Versionamento por recurso continua via vendor MIME.** Nenhum prefixo `/v1` na URL — paths declarados pelo contrato são absolutos (`/api/editais`). `withVendorMime('edital', 1)` injeta `Accept: application/vnd.uniplus.edital.v1+json` no `HttpContext` (ADR-0028 do `uniplus-api`).
- **`number | string` para `int32`.** `openapi-typescript` mapeia `format: int32` para `number | string` por compatibilidade com serializers que emitem números grandes como string. Nos services consumidores, normalmente forçar `number` é aceitável; se o backend nunca emitir string, a flag `--alphabetize` ou um pos-processador podem normalizar — fora de escopo deste PR.
