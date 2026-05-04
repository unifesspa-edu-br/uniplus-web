---
status: "accepted"
date: "2026-05-03"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0011: Consumer adapter `ApiResult<T>` em nova lib `libs/shared-http`

## Contexto e enunciado do problema

A `uniplus-api` adotou um contrato REST canônico V1 (umbrella ADR-0022 do `uniplus-api`): wire format de erro RFC 9457 ProblemDetails, wire format de sucesso como body direto, paginação cursor opaco com `Link` header, `Idempotency-Key`, versionamento per-resource via content negotiation, OpenAPI 3.1 contract-first. Esse contrato precisa de um adapter no `uniplus-web` que (i) traduza respostas HTTP em um tipo TypeScript narrow-able pelo consumidor, (ii) consolide o tratamento de erro hoje espalhado em três fragmentos, (iii) ofereça hook de internacionalização por `code` para complementar mensagens do backend.

Estado atual no `uniplus-web` tem três pontos de tratamento HTTP distribuídos entre libs:

- **`shared-data/services/api-error-handler.service.ts`** — parsing de RFC 7807 ProblemDetails (predecessora da 9457).
- **`shared-core/interceptors/error.interceptor.ts`** — toast direto para status 0 e 5xx.
- **`shared-auth/interceptors/auth-error.interceptor.ts`** — redirect para 401/403; pure auth, sem parsing.

Sem consolidação, cada slice futura inventa o próprio adapter — débito acumula. A migração para o contrato V1 é o momento natural para fechar essa fragmentação.

## Drivers da decisão

- **Fronteira HTTP isolada.** A camada que traduz request/response HTTP em valor tipado é cross-cutting, deve ser explícita e separada de UI, dados e auth.
- **Narrowing tipado por consumidor.** Componentes/serviços precisam discriminar sucesso e erro sem branchings ad-hoc — TypeScript já oferece discriminated union, basta materializar.
- **Consolidação dos 3 fragmentos.** Parsing fica em um lugar; auth permanece em `shared-auth` consumindo o resultado parseado.
- **Hook de i18n por `code`.** Mensagens do backend são em pt-BR mas algumas precisam ser sobrescritas por contexto de UI ou complementadas com call-to-action. `code` da taxonomia `uniplus.<modulo>.<razao>` (ADR-0023 do `uniplus-api`) é a chave estável.
- **Coerência com módulos boundaries do Nx.** Tags `scope`, `type`, `domain` e `@nx/enforce-module-boundaries` já ditam o que pode importar de quem. Adicionar HTTP infrastructure como tipo dedicado é o padrão idiomático.
- **`auth-error.interceptor` permanece como está.** Pure auth/redirect; refatorar consome esforço sem retorno proporcional. Apenas passa a ler `ApiResult` parseado pelo novo interceptor downstream.

## Opções consideradas

- **A. Nova lib `libs/shared-http`** com `ApiResult<T>`, `ProblemDetails`, `apiResultInterceptor`, `ProblemI18nService` e helpers de teste; tags `scope:shared, type:http`; `@uniplus/shared-http` como path alias.
- **B. Estender `libs/shared-data`** — colocar `ApiResult<T>` e o interceptor consolidado dentro da lib que já hospeda DTOs e validators.
- **C. Colocar dentro de `libs/shared-core`** — junto com `NotificationService`, `LoadingOverlayComponent` e demais infra cross-cutting.
- **D. Inline parsing por componente** — sem lib dedicada; cada componente trata o response do `HttpClient` diretamente.

## Resultado da decisão

**Escolhida:** "A — Nova lib `libs/shared-http`", porque é a única opção que entrega fronteira explícita entre HTTP-protocol concerns e demais camadas, materializa a consolidação dos 3 fragmentos sob um único owner, e permite evoluir features de cliente do contrato V1 (idempotency-key client, cursor parsing, content negotiation builder) sem poluir libs existentes.

### Forma do `ApiResult<T>`

```typescript
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; problem: ProblemDetails };
```

Discriminator é `result.ok` (boolean). Narrowing é nativo do TypeScript:

```typescript
const result = await api.editais.byId(id);

if (result.ok) {
  console.log(result.data.numero); // T tipado
} else {
  notify.error(result.problem); // ProblemDetails tipado
  if (result.problem.code === 'uniplus.edital.nao_encontrado') {
    router.navigate(['/editais']);
  }
}
```

### Forma do `ProblemDetails`

Tipo TypeScript matching RFC 9457 + extensions Uni+ (campos exatos definidos pela [ADR-0023 do `uniplus-api`](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0023-wire-formato-erro-rfc-9457.md)):

```typescript
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  // Extensions Uni+
  code: string;
  traceId: string;
  errors?: ProblemValidationError[];
  legal_reference?: LegalReference;
  available_versions?: number[];
}
```

Tipos hand-authored inicialmente; follow-up futuro é gerar a partir de `contracts/openapi.<modulo>.json` da `uniplus-api` via `@openapitools/openapi-generator-cli` para eliminar drift.

### Conteúdo da nova lib

`libs/shared-http/src/lib/`:

- **`api-result.ts`** — discriminated union + helpers de construção (`ok(data)`, `fail(problem)`).
- **`problem-details.ts`** — tipos do wire format e suas extensions.
- **`api-result.interceptor.ts`** — `HttpInterceptor` único consolidado. Parseia 4xx/5xx em `ProblemDetails`; sintetiza `ProblemDetails` para falhas de conexão (status 0) com `code: uniplus.client.network_error`. Retorna response body tipado como `ApiResult<T>`.
- **`problem-i18n.service.ts`** — registro de overrides keyed por `problem.code`. Default: renderiza `title`/`detail` do backend. Override permite customizar título, detalhe e adicionar `action` (rota + label).
- **`api-result.testing.ts`** — utilitários de teste: `okResult<T>(data)`, `errorResult(problem)`, `mockProblemDetails(code, status)`.

### Migração dos artefatos existentes

- **`shared-data/services/api-error-handler.service.ts`** — **deletado**. Parsing migra para `apiResultInterceptor` em `shared-http`.
- **`shared-core/interceptors/error.interceptor.ts`** — **deletado**. Responsabilidade de toast desacoplada: `apiResultInterceptor` produz `ApiResult` parseado; quem dispara o toast é o `NotificationService` (já existente em `shared-core`) chamado pelo código de aplicação ou por interceptor chain downstream.
- **`shared-auth/interceptors/auth-error.interceptor.ts`** — **mantido em `shared-auth`** sem refactor estrutural. Apenas passa a consumir `ApiResult` do `shared-http` upstream para checar `result.problem.status === 401 || 403` antes de disparar o fluxo de auth. Fica intocado quanto a redirect/login behavior.

### Tags e module boundaries

`libs/shared-http/project.json` declara tags `scope:shared`, `type:http`. ESLint `@nx/enforce-module-boundaries` permite que `type:feature`, `type:ui`, `type:auth`, `type:data`, `type:core` importem de `type:http`; mas `type:http` só pode depender de `type:core` e pacotes externos. Isso impede que HTTP-infra acumule import de UI/data/auth/feature por engano.

Path alias em `tsconfig.base.json`:

```json
"@uniplus/shared-http": ["libs/shared-http/src/index.ts"]
```

### Wiring nos apps

`apps/portal`, `apps/selecao`, `apps/ingresso` registram interceptors em `app.config.ts`:

```typescript
provideHttpClient(
  withInterceptors([
    apiResultInterceptor, // @uniplus/shared-http (parsing)
    authErrorInterceptor, // @uniplus/shared-auth (consumer de ApiResult)
  ])
);
```

Ordem importa: `apiResultInterceptor` produz o `ApiResult`; `authErrorInterceptor` consome.

### Esta ADR não decide

- Estrutura interna de pastas dentro da lib além do listado — escolha de organização durante a implementação.
- Estratégia futura de codegen do `ProblemDetails` a partir de OpenAPI — follow-up; tipos hand-authored cobrem V1.
- Comportamento de retry automático em status transitórios (5xx) — explicitamente fora de escopo; cliente pode adicionar retry policy externa se necessário.
- Como `Idempotency-Key` é gerado no cliente para endpoints `[RequiresIdempotencyKey]` — virá em ADR/task separada quando o adapter idempotency ficar maduro; lib reserva espaço para o helper.

### Por que B, C e D foram rejeitadas

- **B (estender `shared-data`).** Conflata data shapes (DTOs, validators) com HTTP-protocol concerns; fronteira "o que a API retorna" vs "como a camada HTTP se comporta" fica implícita; migrar HTTP types para lib dedicada depois custa mais quando consumidores já dependem do path antigo.
- **C (dentro de `shared-core`).** Cross-cutting infra fica colocalizado, mas `shared-core` vira broader e menos focado; HTTP infra é stratum conceitualmente distinto de UI infra. Evolução futura (idempotency client, cursor helpers, content negotiation builder) misturaria com mudanças de UI infra em PR review.
- **D (inline por componente).** Sem narrowing tipado consistente; cada componente reinventa parsing; impossível enforçar consolidação ou migração futura. Padrão regressivo.

## Consequências

### Positivas

- **Fronteira HTTP explícita e enforçada.** Scope da lib é inequívoco; ESLint impede leakage.
- **Migração com destino único.** Os 3 fragmentos atuais têm um lugar para ir; consolidação é refactor bounded.
- **Evolução futura localizada.** Novas features do contrato V1 (idempotency-key client, cursor parsing helpers, content negotiation accept-header builder) entram em `shared-http` sem afetar outras libs.
- **Testabilidade.** Lib tem suíte Vitest dedicada; `api-result.testing.ts` exportado para uso em testes de libs downstream.
- **Convergência com convenção da indústria.** Padrão `shared-http`/`shared-api` é amplamente reconhecido em workspaces Nx — onboarding de novos contribuidores tem menos atrito.

### Negativas

- **Mais uma lib para manter.** Novo `project.json`, novos tsconfig references, novo ESLint config, novo path alias.
- **Migração toca código existente.** Os 3 fragmentos em `shared-data`, `shared-core`, `shared-auth` precisam ser atualizados; imports em feature libs e apps quebram. Custo único, escopo Milestone B do contrato V1.
- **Janela de coexistência.** Até todos os consumidores migrarem para `@uniplus/shared-http`, padrão antigo e novo coexistem; PR review precisa pegar código novo que use os fragmentos antigos.

### Neutras

- Tipos hand-authored inicialmente — sustentável para V1; follow-up de codegen vira issue separada quando o spec OpenAPI estiver estável.
- `auth-error.interceptor` permanece em `shared-auth` por design (auth concern), apenas passa a consumir `ApiResult` upstream — fronteira responsável-por-quê fica clara.

## Confirmação

1. **ESLint module boundaries** — regra `@nx/enforce-module-boundaries` configurada com `type:http` no allow-list correto; PR que importe `shared-ui`, `shared-data`, `shared-auth` de dentro de `shared-http` falha.
2. **Suíte Vitest da lib** — cobre construtores `ok`/`fail`, parsing de status 0 (network error sintetizado), parsing de 4xx/5xx (ProblemDetails), comportamento do `ProblemI18nService` com e sem override registrado.
3. **Playwright E2E pós-migração** — fluxos existentes (login error, access denied, network error, validation error) continuam passando após migração; PR de migração falha se algum fluxo regredir.
4. **Revisão arquitetural de PR** — checklist do PR template de `uniplus-web` inclui verificação de que novos services HTTP usam `apiResultInterceptor` + `ApiResult<T>`, nunca os fragmentos antigos.

## Mais informações

- [ADR-0007](0007-primeng-em-modo-unstyled.md) — UI components consumirão `ApiResult` para differenciar loading/error/empty states.
- [ADR-0009](0009-keycloak-como-identity-provider-oidc.md) — `auth-error.interceptor` em `shared-auth` permanece pure auth; consome `ApiResult` upstream.
- ADR-0022 do `uniplus-api` — umbrella do contrato REST canônico V1 que esta ADR consome no lado client.
- ADR-0023 do `uniplus-api` — wire format de erro RFC 9457 que `apiResultInterceptor` parseia.
- ADR-0025 do `uniplus-api` — wire format de sucesso (body direto) que `ApiResult<T>` envelopa em `{ ok: true, data: T }`.
- ADR-0028 do `uniplus-api` — versionamento per-resource; `apiResultInterceptor` injeta `Accept: application/vnd.uniplus.<resource>.v<N>+json` quando declarado pelo serviço chamador.
- [Nx — Library generation](https://nx.dev/recipes/angular/library).
- [Nx — Module boundaries enforcement](https://nx.dev/features/enforce-module-boundaries).
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) — tipo de wire format consumido pelo adapter.
