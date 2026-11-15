import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthService, MotivoDoAcessoNegadoService } from '@uniplus/shared-auth/bootstrap';
import { isApiFailure, STATUS_HTTP } from '@uniplus/shared-core/http';
import type { ApiResult } from '@uniplus/shared-core/http';

/**
 * Reage a respostas já envelopadas pelo `apiResultInterceptor` de
 * `@uniplus/shared-core` (ADR-0011 + ADR-0012):
 *
 * - **401 Unauthorized** → dispara `authService.login()` (redirect OIDC).
 * - **403 Forbidden** → guarda o `detail` do problema e redireciona para `/acesso-negado`,
 *   que o mostra à pessoa.
 *
 * Como o `apiResultInterceptor` converte 4xx/5xx em `HttpResponse` carregando
 * `ApiResult.fail` (preservando o `status` HTTP original), este interceptor
 * opera apenas sobre `HttpResponse` via `tap`, sem `catchError`. Os demais
 * status são ignorados — feedback de UI fica a cargo do componente
 * consumidor a partir do `ApiResult` recebido.
 *
 * Wiring: deve ficar mais externo que `apiResultInterceptor` no array de
 * `withInterceptors([...])`, ou seja, registrado **antes** dele.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const motivo = inject(MotivoDoAcessoNegadoService);

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) reagirAoStatus(event, { authService, router, motivo });
    }),
  );
};

const ROTA_DE_ACESSO_NEGADO = '/acesso-negado';

interface Reacao {
  readonly authService: AuthService;
  readonly router: Router;
  readonly motivo: MotivoDoAcessoNegadoService;
}

function reagirAoStatus(
  resposta: HttpResponse<unknown>,
  { authService, router, motivo }: Reacao,
): void {
  if (resposta.status === STATUS_HTTP.NAO_AUTENTICADO) {
    void authService.login();
  } else if (resposta.status === STATUS_HTTP.SEM_PERMISSAO && !jaVaiAoAcessoNegado(router)) {
    motivo.registrar(detailDoProblema(resposta.body));
    void router.navigate([ROTA_DE_ACESSO_NEGADO]);
  }
}

/** Já está na página, ou o redirecionamento de um 403 anterior ainda corre: o primeiro motivo vale. */
function jaVaiAoAcessoNegado(router: Router): boolean {
  const destino = router.currentNavigation()?.finalUrl?.toString() ?? router.url;
  return destino.startsWith(ROTA_DE_ACESSO_NEGADO) || router.url.startsWith(ROTA_DE_ACESSO_NEGADO);
}

function detailDoProblema(corpo: unknown): unknown {
  const resultado = corpo as ApiResult<unknown> | null;
  return resultado && isApiFailure(resultado) ? resultado.problem.detail : undefined;
}
