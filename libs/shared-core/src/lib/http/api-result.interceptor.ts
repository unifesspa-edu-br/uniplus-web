import {
  HttpErrorResponse,
  HttpEvent,
  HttpHeaders,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { ApiResult, apiFailure, apiOk } from './api-result';
import { IDEMPOTENCY_KEY_TOKEN } from './idempotency-token';
import {
  CLIENT_PROBLEM_CODES,
  CODIGO_CATALOGO_DESATUALIZADO,
  MENSAGEM_CATALOGO_DESATUALIZADO,
  ProblemDetails,
  ProblemValidationError,
} from './problem-details';
import { VENDOR_MIME_TOKEN, buildVendorMimeAccept } from './vendor-mime';

const PROBLEM_DETAILS_MEDIA_TYPE = 'application/problem+json';

/**
 * Interceptor consolidado (ADR-0011 + ADR-0012 + ADR-0014). Em uma única
 * passada:
 *
 * 1. Se a requisição declarou versão via `withVendorMime(...)`, injeta o header
 *    `Accept: application/vnd.uniplus.<resource>.v<N>+json` (ADR-0028).
 * 2. Se a requisição declarou idempotência via `withIdempotencyKey(...)`,
 *    injeta o header `Idempotency-Key: <value>` (ADR-0014; consumido pela
 *    ADR-0027 do `uniplus-api`).
 * 3. Em respostas 2xx, envelopa o body em `ApiResult.ok`.
 * 4. Em respostas 4xx/5xx com `application/problem+json`, parseia o
 *    `ProblemDetails` e emite `ApiResult.fail` — sem propagar erro.
 * 5. Em falhas de conexão (status 0), sintetiza `ProblemDetails` com
 *    `code: uniplus.client.network_error`.
 * 6. Em respostas de erro com body fora do contrato, sintetiza
 *    `code: uniplus.client.unexpected_response`.
 *
 * O interceptor não loga `problem.detail` nem `errors[].message` — esses
 * campos podem conter PII residual e a invariante LGPD é nunca emiti-los
 * em logs.
 */
export const apiResultInterceptor: HttpInterceptorFn = (req, next) => {
  const requestWithHeaders = appendContextHeaders(req);

  return next(requestWithHeaders).pipe(map(envelopeSuccess), catchError(envelopeFailure));
};

/**
 * Lê tokens declarados no `HttpContext` e anexa headers correspondentes.
 * Mantém o pattern simétrico — vendor MIME e idempotência saem do mesmo
 * leitor de contexto (ADR-0014).
 */
function appendContextHeaders(req: HttpRequest<unknown>): HttpRequest<unknown> {
  const headers = { ...cabecalhoDeVendorMime(req), ...cabecalhoDeIdempotencia(req) };
  return Object.keys(headers).length === 0 ? req : req.clone({ setHeaders: headers });
}

function cabecalhoDeVendorMime(req: HttpRequest<unknown>): Record<string, string> {
  const vendorMime = req.context.get(VENDOR_MIME_TOKEN);
  return vendorMime
    ? { Accept: buildVendorMimeAccept(vendorMime.resource, vendorMime.version) }
    : {};
}

function cabecalhoDeIdempotencia(req: HttpRequest<unknown>): Record<string, string> {
  const idempotencyKey = req.context.get(IDEMPOTENCY_KEY_TOKEN);
  return idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
}

function envelopeSuccess(event: HttpEvent<unknown>): HttpEvent<unknown> {
  if (!(event instanceof HttpResponse)) {
    return event;
  }
  const envelope: ApiResult<unknown> = apiOk(event.body, event.status, event.headers);
  return event.clone({ body: envelope });
}

function envelopeFailure(error: unknown): Observable<HttpEvent<unknown>> {
  if (!(error instanceof HttpErrorResponse)) {
    throw error;
  }
  return of(respostaComFalha(error));
}

function respostaComFalha(error: HttpErrorResponse): HttpResponse<ApiResult<unknown>> {
  const headers = error.headers ?? new HttpHeaders();
  return new HttpResponse({
    body: apiFailure(synthesizeOrParseProblem(error), error.status, headers),
    status: error.status,
    statusText: error.statusText,
    headers,
    url: error.url ?? undefined,
  });
}

function synthesizeOrParseProblem(error: HttpErrorResponse): ProblemDetails {
  if (error.status === 0) {
    return problemaDeRede();
  }
  const body = parseBodyAsJson(error.error);
  return declaraProblemMime(error) && isProblemShape(body)
    ? normalizeProblem(body, error.status)
    : problemaInesperado(error.status);
}

function problemaDeRede(): ProblemDetails {
  return problemaDoCliente(
    'Não foi possível conectar ao servidor',
    0,
    CLIENT_PROBLEM_CODES.NETWORK_ERROR,
  );
}

function problemaInesperado(status: number): ProblemDetails {
  return problemaDoCliente(
    'Resposta inesperada do servidor',
    status,
    CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE,
  );
}

function problemaDoCliente(title: string, status: number, code: string): ProblemDetails {
  return { type: 'about:blank', title, status, code, traceId: '' };
}

function declaraProblemMime(error: HttpErrorResponse): boolean {
  const contentType = (error.headers?.get('content-type') ?? '').toLowerCase();
  return contentType.includes(PROBLEM_DETAILS_MEDIA_TYPE);
}

function parseBodyAsJson(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isProblemShape(body: unknown): body is ProblemDetails {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate['code'] === 'string' &&
    typeof candidate['title'] === 'string' &&
    typeof candidate['status'] === 'number'
  );
}

/**
 * Campos do envelope RFC 9457 que já têm normalização própria abaixo — o
 * restante do objeto são extensions (`ProblemDetails.Extensions` do backend,
 * ADR-0023) que este interceptor não conhece por nome e não pode filtrar.
 *
 * Endpoints específicos anexam extensions próprias — `pendencias` e
 * `obrigatoriedadesReprovadas` do preflight de publicação de Processo
 * Seletivo (`ProcessoSeletivoController`) são um exemplo, não a
 * lista inteira. Reconstruir o objeto só com os campos abaixo, como a versão
 * anterior desta função fazia, descartava toda extension nomeada por um
 * endpoint específico antes de ela chegar ao componente que a lê.
 */
const CAMPOS_NORMALIZADOS = new Set<string>([
  'type',
  'title',
  'status',
  'detail',
  'instance',
  'code',
  'traceId',
  'errors',
  'legalReference',
  'available_versions',
]);

function normalizeProblem(body: ProblemDetails, fallbackStatus: number): ProblemDetails {
  return { ...extensoesNaoMapeadas(body), ...camposNormalizados(body, fallbackStatus) };
}

function extensoesNaoMapeadas(body: ProblemDetails): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body as unknown as Record<string, unknown>).filter(
      ([chave]) => !CAMPOS_NORMALIZADOS.has(chave),
    ),
  );
}

type ProblemaDoWire = ProblemDetails & {
  readonly traceId?: unknown;
  readonly errors?: ReadonlyArray<unknown>;
};

function camposNormalizados(body: ProblemaDoWire, fallbackStatus: number): ProblemDetails {
  return {
    type: body.type ?? 'about:blank',
    ...apresentacaoDe(body),
    status: typeof body.status === 'number' ? body.status : fallbackStatus,
    instance: body.instance,
    code: body.code,
    traceId: typeof body.traceId === 'string' ? body.traceId : '',
    errors: normalizeErrors(body.errors),
    legalReference: body.legalReference,
    available_versions: body.available_versions,
  };
}

function apresentacaoDe(body: ProblemDetails): Pick<ProblemDetails, 'title' | 'detail'> {
  return body.code === CODIGO_CATALOGO_DESATUALIZADO
    ? MENSAGEM_CATALOGO_DESATUALIZADO
    : { title: body.title, detail: body.detail };
}

/**
 * Normaliza o array `errors[]` da extension Uni+. Trata um array vazio
 * (`errors: []`) como ausência de erros — o consumer não precisa diferenciar
 * "campo ausente" de "campo presente vazio", que carregam a mesma semântica
 * para a UI ("nada a exibir por campo").
 */
function normalizeErrors(
  raw: ReadonlyArray<unknown> | undefined,
): ReadonlyArray<ProblemValidationError> | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  return raw.filter(ehErroDeCampo).map(({ field, code, message }) => ({ field, code, message }));
}

function ehErroDeCampo(entry: unknown): entry is ProblemValidationError {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }
  const candidate = entry as Record<string, unknown>;
  return ['field', 'code', 'message'].every((chave) => typeof candidate[chave] === 'string');
}
