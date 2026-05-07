---
status: "accepted"
date: "2026-05-07"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0018: Adoção de `httpResource` Angular 21 via wrapper `useApiResource` em `shared-core`

## Contexto e enunciado do problema

A `EditaisDetailPage` (entregue na F8 do Milestone B) implementa GET reativo por route param `:id` com pattern manual: `signal<EditalDto | null>` + `signal<boolean>(loading)` + `effect(() => { id; untracked(() => { reset; executarObterPorId(id); }) })` + `subscribe()` ao Observable do service + race guard explícito (`if (this.id() !== id) return`) para descartar respostas stale quando o usuário navega entre `/editais/:id1` e `/editais/:id2` (Angular reusa a instância do componente).

Esse pattern repete-se ~80 linhas só para load + race + error handling. Quando aparecer a 2ª/3ª detail page (Inscrição, Recurso, Classificação), a duplicação custa caro — inclusive o risco de cada caller esquecer alguma defesa (race guard, reset de estado prévio, cleanup via `takeUntilDestroyed`).

Angular 21 expõe `httpResource` (`@experimental` desde 19.2) — wrapper reativo de `HttpClient` que retorna `HttpResourceRef<T>` com signals nativos para `value`/`status`/`error`/`isLoading` e cancela request anterior automaticamente quando dependências reativas mudam. Adotar resolveria o boilerplate, mas levanta duas perguntas: **(a) como compor com `apiResultInterceptor`** que envelopa todas respostas em `ApiResult<T>` (RFC 9457 + extensions Uni+) — o `httpResource` veria o envelope ou o body cru? **(b) qual escopo adotar** — qualquer GET, qualquer HTTP request, só este caso?

A guidance oficial Angular (`https://angular.dev/guide/http/http-resource` § Best practices) é explícita: **"Avoid using `httpResource` for mutations like POST or PUT. Instead, prefer directly using the underlying HttpClient APIs."** O status `@experimental` reforça cautela — a API pode mudar antes de promoção a stable.

## Drivers da decisão

- **Eliminar boilerplate de race guard manual** — cada detail page hoje paga ~30 linhas só para descartar response stale; `httpResource` resolve nativamente.
- **Preservar a discriminated union `ApiResult<T>`** — F1–F8 + fitness suite (B.5) consomem `ApiResult<T>` em todos os pontos. Mudar essa invariante requer refator cross-cutting.
- **Limitar blast radius do status experimental** — se a API do `httpResource` mudar entre 19.2 e GA, o impacto deve ficar contido a 1 arquivo.
- **Respeitar guidance Angular oficial** — GET-only (mutações continuam HttpClient direto via service).
- **Pattern reusável para futuras detail pages** — Inscrição, Recurso, Classificação devem consumir o mesmo helper sem reinvenção.
- **Testabilidade** — pattern deve permitir specs Vitest determinísticos sem `fakeAsync`/`flushMicrotasks` (incompatíveis com Vitest no Angular 21).

## Opções consideradas

- **A. Adoção direta nativa** — `EditaisDetailPage` chama `httpResource(() => ({ url: ..., context: withVendorMime('edital', 1) }))` direto e lê `resource.value()?.ok ? resource.value()!.data : null` no template.
- **B. Wrapper `useApiResource<T>` em `libs/shared-core/src/lib/http/`** — encapsula `httpResource<ApiResult<T>>` e expõe signals derivados (`data()`, `problem()`) que extraem do envelope, mantendo `value()` como escape-hatch.
- **C. Manter pattern manual** — não migrar; aceitar boilerplate até quando refator cross-cutting compensar.

## Resultado da decisão

**Escolhida:** "B — Wrapper `useApiResource<T>` em `shared-core/http`", porque é a única opção que combina:

1. **Preserva `ApiResult<T>`** — services continuam retornando `Observable<ApiResult<T>>` para mutações (POST publish/criar continuam idênticos); o wrapper apenas adapta o envelope para signals derivados sem mudar o contrato cross-cutting.
2. **Aproveita race-cancellation nativa** — `httpResource` cancela request anterior quando signal reativo do `request()` muda; o spec valida explicitamente (`expect(reqAntiga.cancelled).toBe(true)`).
3. **Centraliza adaptação `ApiResult → Resource`** em UM ponto — futuras detail pages reusam direto sem reinventar a extração `.data`/`.problem`.
4. **Limita blast radius do experimental** — mudanças na API de `httpResource` afetam apenas `use-api-resource.ts` (1 arquivo, ~70 linhas), não cada caller.
5. **Respeita guidance Angular** — wrapper é GET-only (encadeia apenas overloads de `httpResource` que aceitam request signal), forçando mutações pelo HttpClient direto.

### Forma do helper

```ts
export interface UseApiResourceRef<T> {
  readonly value: Signal<ApiResult<T> | undefined>;
  readonly data: Signal<T | null>;
  readonly problem: Signal<ProblemDetails | null>;
  readonly isLoading: Signal<boolean>;
  readonly status: Signal<ResourceStatus>;
  readonly statusCode: Signal<number | undefined>;
  readonly headers: Signal<HttpHeaders | undefined>;
  readonly error: Signal<Error | undefined>;
  hasValue(): boolean;
  reload(): boolean;
  destroy(): void;
}

export function useApiResource<T>(
  request: () => string | HttpResourceRequest | undefined,
  options?: Omit<HttpResourceOptions<ApiResult<T>, unknown>, 'defaultValue' | 'parse'>,
): UseApiResourceRef<T>;
```

### Comportamento ApiResult ↔ httpResource (validado por specs)

O `apiResultInterceptor` neutraliza o canal de erro do RxJS — captura `HttpErrorResponse` em 4xx/5xx e re-emite via `of(new HttpResponse({ body: apiFailure(...), status: error.status }))`. Consequência observável no wrapper:

| Resposta backend | `httpResource.status()` | `httpResource.value()` | `data()` | `problem()` | `error()` |
|---|---|---|---|---|---|
| 200/201/204 | `'resolved'` | `ApiOk<T>` | `T` | `null` | `undefined` |
| 4xx/5xx + `application/problem+json` | `'resolved'` | `ApiFailure` | `null` | `ProblemDetails` | `undefined` |
| Network error (status 0) | `'resolved'` | `ApiFailure` (NETWORK\_ERROR) | `null` | sintetizado | `undefined` |
| Body fora do contrato | `'resolved'` | `ApiFailure` (UNEXPECTED\_RESPONSE) | `null` | sintetizado | `undefined` |
| Erro fora do interceptor (ex.: throw síncrono em interceptor de auth/logging) | `'error'` | `undefined` | `null` | `null` | `Error` |

Isso significa que `error()` é praticamente sempre `undefined` no contrato Uni+ — toda discriminação success/failure é via `value().ok`, e o helper expõe `data()` / `problem()` como atalhos signal-based.

**Invariante crítica do helper:** o `Resource.value()` nativo do Angular **lança `ResourceValueError` quando `status()` é `'error'`** (vide `_resource-chunk.mjs` em `@angular/core` 21). O wrapper guarda explicitamente — `value`/`data`/`problem` checam `error()` antes de ler `value()` interno e retornam ausência segura (`undefined`/`null`). Sem este guard, qualquer leitura desses signals em estado de erro propagaria a exceção durante change detection e crasharia a página em vez de renderizar a mensagem de erro. Specs do helper validam (`expect(() => resource.data()).not.toThrow()`).

**Callers PODEM tratar `error()` como fallback opcional** — para distinguir "escape de interceptor" de "ainda carregando" e exibir mensagem específica. Sem o tratamento, o usuário vê o spinner sumir sem feedback. O `EditaisDetailPage` consolida o fallback no `errorMessage` computed:

```ts
readonly errorMessage = computed<string | null>(() => {
  const httpProblem = this.editalResource.problem();
  if (httpProblem) return this.problemI18n.resolve(httpProblem).title;
  if (this.editalResource.error()) return 'Erro inesperado ao carregar edital.';
  return this.publishErrorMessage();
});
```

### Esta ADR não decide

- **Mutações via `httpResource`** — proibido pela guidance Angular oficial. POST/PUT/PATCH/DELETE continuam via service + `HttpClient` + `Observable<ApiResult<T>>`. O publish flow do `EditaisDetailPage` mantém `EditaisApi.publicar()` + `subscribe()` + race guard manual no closure (mutação one-shot).
- **Cursor pagination via `httpResource`** — a `EditaisListPage` (F6) consome cursor + `Link` header via service Observable; migração fica para frente futura quando 2ª list page aparecer.
- **`useApiResource` como obrigatório em todo GET reativo** — recomendado, mas serviços que precisam de controle fino do Observable (combineLatest, retry com backoff custom, debounceTime específico) podem continuar com HttpClient direto.

### Pattern de teste (lição)

`fakeAsync`/`flushMicrotasks` exigem Zone.js test mode e são **incompatíveis com Vitest** no Angular 21 (per documentação oficial). O pattern que funciona:

- **Specs do helper isolado:** `await ApplicationRef.whenStable()` após `controller.flush(...)` propaga valores aos signals do resource.
- **Specs com `ComponentFixture`:** `await Promise.resolve(); appRef.tick();` (helper `propagate()`) — `whenStable()` deadlocka na presença de subscriptions Observable concorrentes (publish flow).

## Consequências

### Positivas

- `EditaisDetailPage` perde ~50 linhas (signals manuais, `effect`, `untracked`, `executarObterPorId`, race guard manual) e ganha 4 linhas de `useApiResource(...)`.
- Race-cancellation testada como invariante explícita — substitui guard "if id mudou, descarta" por comportamento nativo do framework.
- Pattern reusável documentado — futuras detail pages (Inscrição, Recurso, Classificação) consomem o mesmo helper.
- Risco do status experimental fica isolado a 1 arquivo (`use-api-resource.ts`).
- Specs do helper documentam comportamento contratual — fitness contra regressões na adaptação `ApiResult → Resource`.

### Negativas

- 1 indireção a mais entre componente e `httpResource` — leitor precisa abrir o helper para entender o adapter (mitigado por JSDoc rico no helper e por specs auto-documentados).
- Dependência de API `@experimental` — breaking change entre 19.2 e GA forçaria atualização do helper (mas nada além).
- Pattern de teste assíncrono (`await propagate()` ou `await whenStable()`) é mais verboso que o pattern síncrono do Observable + subscribe — inerente ao modelo signal-based, não específico do wrapper.

### Neutras

- Helper coexiste com `EditaisApi.obter()` Observable (que continua exportado para callers que ainda precisam de Observable, ex.: testes legados, código fora de injection context).

## Confirmação

- **Spec do helper:** `libs/shared-core/src/lib/http/use-api-resource.spec.ts` cobre 11 cenários — carga inicial, race-cancellation, 4xx/5xx, network error, reload, undefined request, HttpContext arbitrário, headers, hasValue, 422 com errors[].
- **Spec da page refatorada:** `apps/selecao/src/app/features/editais/editais-detail.page.spec.ts` mantém 12 cenários, validando que a UX externa não muda — mesma assinatura para `edital()`, `loading()`, `errorMessage()`, `confirmarPublicacao()`.
- **Race guard nativo testado explicitamente:** `expect(reqAntiga.cancelled).toBe(true)` após mudança do input `id`.
- **Não há fitness test cross-app proibindo uso de `httpResource` direto fora do wrapper** — a recomendação é capturada na guidance da ADR; revisão de PR pode citar quando aplicável.

### Trigger de reavaliação

- Se `httpResource` for promovido a stable sem breaking changes, ADR fica firme e nenhuma ação é necessária.
- Se houver breaking change na API entre 19.2 e GA, atualizar APENAS `use-api-resource.ts` para acomodar — callers permanecem inalterados.
- Se aparecer caso real de necessidade de mutação reativa (ex.: PATCH baseado em signals), reabrir e considerar `rxResource` ou `resource()` (reactive primitives mais genéricos).

## Prós e contras das opções

### A — Adoção direta nativa

- **Bom**, porque é o caminho documentado pelo Angular team — sem indireção.
- **Ruim**, porque acopla cada caller à extração `value().ok ? value().data : null` — duplicação cresce a cada nova detail page e a chance de erro de leitura também (`value()` durante loading é `undefined`, fácil esquecer no template).
- **Ruim**, porque expõe diretamente `httpResource` a múltiplos call sites — breaking changes futuros têm blast radius proporcional ao número de callers.

### B — Wrapper `useApiResource<T>` (escolhida)

- **Bom**, porque centraliza adaptação `ApiResult → Resource` num único ponto auditável.
- **Bom**, porque limita blast radius de breaking changes a 1 arquivo.
- **Bom**, porque mantém o vocabulário familiar (`data()`, `problem()`) já consolidado pelo `apiResultInterceptor`.
- **Ruim**, porque adiciona 1 indireção (leitor precisa abrir o helper para ver o adapter).
- **Ruim**, porque o helper precisa ser mantido em paridade com a API de `httpResource` (mas é isolado, e specs documentam regressões).

### C — Manter pattern manual

- **Bom**, porque zero risco de adoção de API experimental.
- **Bom**, porque pattern já está em produção (entregue na F8) — funciona.
- **Ruim**, porque cada detail page paga ~30 linhas de race guard manual + cleanup via `takeUntilDestroyed` + `effect` para reset de estado.
- **Ruim**, porque race guard manual depende de disciplina do autor — esquecimentos viram bugs sutis (response stale sobrescrevendo state correto).
- **Ruim**, porque adia decisão sem reduzir custo — quando 2ª/3ª detail page aparecer, refator vai precisar tocar mais código.

## Mais informações

- [Angular guide — HTTP Resource](https://angular.dev/guide/http/http-resource) — fonte da guidance binding "avoid mutations".
- [`HttpResourceFn` API reference](https://angular.dev/api/common/http/HttpResourceFn) — forms (`url` vs `request`), overloads, status `@experimental`.
- [`HttpResourceRequest` API reference](https://angular.dev/api/common/http/HttpResourceRequest) — propriedades suportadas (incluindo `context: HttpContext` para `withVendorMime`).
- [`HttpResourceRef` API reference](https://angular.dev/api/common/http/HttpResourceRef) — signals expostos (`value`, `status`, `error`, `isLoading`, `headers`, `statusCode`).
- [ADR-0011](0011-consumer-adapter-api-result.md) — origem do `ApiResult<T>`.
- [ADR-0012](0012-placement-api-result-em-shared-core.md) — placement em `shared-core`.
- [ADR-0014](0014-idempotency-key-cliente-via-http-context.md) — pattern HttpContext (referência para `withVendorMime`).
- [ADR-0016](0016-vendor-mime-consumer-via-http-context.md) — vendor MIME via HttpContext (composto pelo helper).
- [ADR-0017](0017-pattern-feature-page-container-presentational.md) — `EditaisDetailPage` é container; helper é consumido na camada container.
- Issue [`uniplus-web#206`](https://github.com/unifesspa-edu-br/uniplus-web/issues/206) — parqueamento original do plano de adoção.
