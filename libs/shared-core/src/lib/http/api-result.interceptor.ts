import {
  HttpErrorResponse,
  HttpEvent,
  HttpHeaders,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { ApiResult, apiFailure, apiOk } from './api-result';
import {
  CLIENT_PROBLEM_CODES,
  ProblemDetails,
  ProblemValidationError,
} from './problem-details';
import {
  VENDOR_MIME_TOKEN,
  buildVendorMimeAccept,
} from './vendor-mime';

const PROBLEM_DETAILS_MEDIA_TYPE = 'application/problem+json';

/**
 * Interceptor consolidado (ADR-0011 + ADR-0012). Em uma única passada:
 *
 * 1. Se a requisição declarou versão via `withVendorMime(...)`, injeta o header
 *    `Accept: application/vnd.uniplus.<resource>.v<N>+json` (ADR-0028).
 * 2. Em respostas 2xx, envelopa o body em `ApiResult.ok`.
 * 3. Em respostas 4xx/5xx com `application/problem+json`, parseia o
 *    `ProblemDetails` e emite `ApiResult.fail` — sem propagar erro.
 * 4. Em falhas de conexão (status 0), sintetiza `ProblemDetails` com
 *    `code: uniplus.client.network_error`.
 * 5. Em respostas de erro com body fora do contrato, sintetiza
 *    `code: uniplus.client.unexpected_response`.
 *
 * O interceptor não loga `problem.detail` nem `errors[].message` — esses
 * campos podem conter PII residual e a invariante LGPD é nunca emiti-los
 * em logs (CA-05 da issue #169).
 */
export const apiResultInterceptor: HttpInterceptorFn = (req, next) => {
  const vendorMime = req.context.get(VENDOR_MIME_TOKEN);
  const requestWithAccept = vendorMime
    ? req.clone({
        setHeaders: { Accept: buildVendorMimeAccept(vendorMime.resource, vendorMime.version) },
      })
    : req;

  return next(requestWithAccept).pipe(
    map(envelopeSuccess),
    catchError(envelopeFailure),
  );
};

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

  const problem = synthesizeOrParseProblem(error);
  const headers = error.headers ?? new HttpHeaders();
  const envelope: ApiResult<unknown> = apiFailure(problem, error.status, headers);

  return of(
    new HttpResponse({
      body: envelope,
      status: error.status,
      statusText: error.statusText,
      headers,
      url: error.url ?? undefined,
    }),
  );
}

function synthesizeOrParseProblem(error: HttpErrorResponse): ProblemDetails {
  if (error.status === 0) {
    return {
      type: 'about:blank',
      title: 'Não foi possível conectar ao servidor',
      status: 0,
      code: CLIENT_PROBLEM_CODES.NETWORK_ERROR,
      traceId: '',
    };
  }

  const body = parseBodyAsJson(error.error);
  const contentType = (error.headers?.get('content-type') ?? '').toLowerCase();
  const isProblemMime = contentType.includes(PROBLEM_DETAILS_MEDIA_TYPE);

  if (isProblemMime && isProblemShape(body)) {
    return normalizeProblem(body, error.status);
  }

  return {
    type: 'about:blank',
    title: 'Resposta inesperada do servidor',
    status: error.status,
    code: CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE,
    traceId: '',
  };
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

function normalizeProblem(body: ProblemDetails, fallbackStatus: number): ProblemDetails {
  const candidate = body as ProblemDetails & {
    readonly traceId?: unknown;
    readonly errors?: ReadonlyArray<unknown>;
  };
  return {
    type: body.type ?? 'about:blank',
    title: body.title,
    status: typeof body.status === 'number' ? body.status : fallbackStatus,
    detail: body.detail,
    instance: body.instance,
    code: body.code,
    traceId: typeof candidate.traceId === 'string' ? candidate.traceId : '',
    errors: normalizeErrors(candidate.errors),
    legalReference: body.legalReference,
    available_versions: body.available_versions,
  };
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
  return raw.flatMap<ProblemValidationError>((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate['field'] !== 'string' ||
      typeof candidate['code'] !== 'string' ||
      typeof candidate['message'] !== 'string'
    ) {
      return [];
    }
    return [
      {
        field: candidate['field'],
        code: candidate['code'],
        message: candidate['message'],
      },
    ];
  });
}
