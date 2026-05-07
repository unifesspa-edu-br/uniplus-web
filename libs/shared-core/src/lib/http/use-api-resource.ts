import {
  HttpHeaders,
  HttpResourceOptions,
  HttpResourceRequest,
  httpResource,
} from '@angular/common/http';
import { ResourceStatus, Signal, computed } from '@angular/core';
import { ApiResult } from './api-result';
import { ProblemDetails } from './problem-details';

/**
 * Wrapper reativo que adapta `httpResource` ao envelope `ApiResult<T>` do
 * `apiResultInterceptor` (ADR-0011 + ADR-0012). Pattern canônico para
 * **detail/list pages que fazem GET reativo por signals** (ADR-0018).
 *
 * **Quando usar:**
 * - GET cujo URL/query params dependem de signals (route param, filtro UI,
 *   cursor de paginação) — `httpResource` cancela request anterior nativamente.
 * - Composição com `computed`/`effect`/`linkedSignal` no template.
 *
 * **Quando NÃO usar (guidance Angular oficial — ADR-0018):**
 * - Mutações (POST/PUT/PATCH/DELETE) — use `HttpClient` direto via service.
 *   `httpResource` é GET-only por design e o time Angular recomenda
 *   explicitamente evitar para mutações.
 * - Fire-and-forget side effects sem mapeamento natural pra Resource.
 * - Operações que precisam controle fino do Observable (`combineLatest`,
 *   `retry` com backoff custom, `debounceTime` específico) — HttpClient
 *   continua melhor.
 *
 * **Risco residual:** `httpResource` está marcado `@experimental` desde Angular
 * 19.2 (Angular 21 ainda não promoveu). Adoção isolada por este wrapper limita
 * o blast radius de breaking changes a este arquivo.
 */
export interface UseApiResourceRef<T> {
  /**
   * Envelope `ApiResult<T>` cru — `undefined` durante loading inicial. Use
   * quando precisar inspecionar `headers`/`status` do envelope (ex.: extrair
   * cursor `Link` rel="next" pós-listagem). Para o caminho feliz de leitura,
   * prefira `data()`/`problem()`.
   */
  readonly value: Signal<ApiResult<T> | undefined>;
  /**
   * Dado tipado quando `value().ok === true`. `null` durante loading, em
   * failure (4xx/5xx) ou em erro fora do contrato. Pensado para binding
   * direto no template (`@if (resource.data(); as edital)`).
   */
  readonly data: Signal<T | null>;
  /**
   * `ProblemDetails` (RFC 9457 + extensions Uni+) quando `value().ok === false`.
   * `null` durante loading, em sucesso ou em erro fora do contrato. Pensado
   * para binding com `ProblemI18nService`.
   */
  readonly problem: Signal<ProblemDetails | null>;
  /**
   * `true` enquanto `httpResource` está em `loading` ou `reloading`. Reflete
   * exatamente `HttpResourceRef.isLoading`.
   */
  readonly isLoading: Signal<boolean>;
  /**
   * Estado bruto do `Resource` (`idle | loading | reloading | resolved |
   * error | local`). Use para casos avançados; `data()`/`problem()`/`isLoading()`
   * cobrem 99% dos templates.
   */
  readonly status: Signal<ResourceStatus>;
  /** Status HTTP da última resposta, quando disponível. */
  readonly statusCode: Signal<number | undefined>;
  /** Headers da última resposta — útil para Link rel="next" (cursor). */
  readonly headers: Signal<HttpHeaders | undefined>;
  /**
   * Erro **fora** do contrato `ApiResult` — raro, porque o
   * `apiResultInterceptor` envelopa todo `HttpErrorResponse`. Populado apenas
   * quando algo escapa de toda a chain de interceptors (ex.: erro síncrono
   * lançado por outro interceptor de auth/logging). **Nunca lança** — leitura
   * segura. Quando `error()` é truthy, `value()`/`data()`/`problem()` retornam
   * ausência (`undefined`/`null`) por contrato deste helper, isolando o caller
   * do throw nativo de `Resource.value()` em status `'error'`.
   */
  readonly error: Signal<Error | undefined>;
  /**
   * `true` se já há um `value` carregado (qualquer ApiResult). Leitura
   * point-in-time — proxy direto de `HttpResourceRef.hasValue()`. **Não é
   * signal reativo:** `@if (resource.hasValue())` no template só re-avalia
   * quando outro signal lido na mesma expressão muda; para gating reativo,
   * prefira `@if (resource.value())` (signal) ou um `computed` derivado.
   */
  hasValue(): boolean;
  /**
   * Força nova execução do `requestFn` atual (mesma URL/dependências
   * reativas). Útil pós-mutação (ex.: refetch após `POST publicar`).
   */
  reload(): boolean;
  /** Cleanup manual; o `DestroyRef` do contexto de injeção faz isto sozinho. */
  destroy(): void;
}

/**
 * Cria um `UseApiResourceRef<T>` ancorado em `httpResource` + envelope
 * `ApiResult<T>`. Deve ser chamado em contexto de injeção (constructor de
 * componente, factory, ou `runInInjectionContext`).
 *
 * Aceita as duas formas suportadas por `httpResource`:
 *
 * - **String reativa** — quando só a URL muda:
 *   ```ts
 *   const r = useApiResource<EditalDto>(() => `/api/editais/${this.id()}`);
 *   ```
 * - **`HttpResourceRequest` reativo** — quando precisa de `params`/`headers`/
 *   `context` (vendor MIME, etc.):
 *   ```ts
 *   const r = useApiResource<EditalDto>(() => ({
 *     url: `/api/editais/${this.id()}`,
 *     context: withVendorMime('edital', 1),
 *   }));
 *   ```
 *
 * Quando `request()` retorna `undefined`, nenhuma request é disparada
 * (status fica em `idle`) — útil para condicionar a presença de um valor
 * dependente.
 *
 * `options.defaultValue` e `options.parse` são vedados aqui:
 * - `defaultValue` quebraria a discriminação `value === undefined` ⇄ "ainda
 *   não carregou" — o helper já modela "ausência" como `data() === null`.
 * - `parse` violaria o contrato com o `apiResultInterceptor` (que sempre
 *   envelopa em `ApiResult<T>`).
 */
export function useApiResource<T>(
  request: () => string | HttpResourceRequest | undefined,
  options?: Omit<
    HttpResourceOptions<ApiResult<T>, unknown>,
    'defaultValue' | 'parse'
  >,
): UseApiResourceRef<T> {
  const resource = httpResource<ApiResult<T>>(() => {
    const next = request();
    if (next === undefined) {
      return undefined;
    }
    return typeof next === 'string' ? { url: next } : next;
  }, options);

  // `Resource.value()` **lança `ResourceValueError`** quando `status() ===
  // 'error'` (caso real: interceptor não-HTTP que escapa do envelope `ApiResult`
  // — vide ADR-0018 §"esta ADR não decide"). Sem o guard contra `error()`,
  // `value()`/`data()`/`problem()` propagam a exceção durante change detection
  // e a página crasha em vez de renderizar a mensagem de erro. O helper
  // padroniza: em estado de erro, todos os derivados retornam ausência
  // (`undefined`/`null`) e o caller diferencia via `error()` (que nunca lança).
  const value: Signal<ApiResult<T> | undefined> = computed(() =>
    resource.error() ? undefined : resource.value(),
  );

  const data: Signal<T | null> = computed(() => {
    if (resource.error()) {
      return null;
    }
    const envelope = resource.value();
    return envelope?.ok ? envelope.data : null;
  });

  const problem: Signal<ProblemDetails | null> = computed(() => {
    if (resource.error()) {
      return null;
    }
    const envelope = resource.value();
    return envelope && !envelope.ok ? envelope.problem : null;
  });

  return {
    value,
    data,
    problem,
    isLoading: resource.isLoading,
    status: resource.status,
    statusCode: resource.statusCode,
    headers: resource.headers,
    error: resource.error,
    hasValue: () => resource.hasValue(),
    reload: () => resource.reload(),
    destroy: () => resource.destroy(),
  };
}
