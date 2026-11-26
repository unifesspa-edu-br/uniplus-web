import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import {
  AuthService,
  MotivoDoAcessoNegadoService,
  SessaoEncerrada,
} from '@uniplus/shared-auth/bootstrap';
import {
  isApiFailure,
  RECUSA_DE_PERMISSAO_TRATADA_NA_CHAMADA,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import type { ApiResult } from '@uniplus/shared-core/http';

/**
 * Reage a respostas já envelopadas pelo `apiResultInterceptor` de
 * `@uniplus/shared-core` (ADR-0011 + ADR-0012):
 *
 * - **401 Unauthorized** → com a pessoa autenticada, a sessão terminou: encerra-a para abrir o
 *   aviso, que leva ao login a pedido, e o reabre se a pessoa o dispensou e tentou de novo; sem
 *   sessão, dispara `authService.login()`.
 * - **403 Forbidden** → guarda o `detail` do problema e redireciona para `/acesso-negado`,
 *   que o mostra à pessoa — salvo quando a chamada marca que trata a recusa na própria tela.
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
  const injector = inject(Injector);

  return next(req).pipe(
    tap((event) => {
      if (!(event instanceof HttpResponse)) return;
      const recusaTratada = req.context.get(RECUSA_DE_PERMISSAO_TRATADA_NA_CHAMADA);
      reagirAoStatus(event, { authService, router, motivo, injector }, recusaTratada);
    }),
  );
};

const ROTA_DE_ACESSO_NEGADO = '/acesso-negado';

interface Reacao {
  readonly authService: AuthService;
  readonly router: Router;
  readonly motivo: MotivoDoAcessoNegadoService;
  readonly injector: Injector;
}

function reagirAoStatus(
  resposta: HttpResponse<unknown>,
  reacao: Reacao,
  recusaTratada: boolean,
): void {
  if (resposta.status === STATUS_HTTP.NAO_AUTENTICADO) {
    reagirAoNaoAutenticado(reacao);
  } else if (resposta.status === STATUS_HTTP.SEM_PERMISSAO && !recusaTratada) {
    levarAoAcessoNegado(resposta, reacao);
  }
}

function reagirAoNaoAutenticado({ authService, injector }: Reacao): void {
  if (authService.sessaoEncerrada()) {
    injector.get(SessaoEncerrada).reabrir();
    return;
  }
  if (authService.authenticated()) authService.encerrarSessao();
  else void authService.login();
}

function levarAoAcessoNegado(resposta: HttpResponse<unknown>, { router, motivo }: Reacao): void {
  if (jaVaiAoAcessoNegado(router)) return;
  motivo.registrar(detailDoProblema(resposta.body));
  void router.navigate([ROTA_DE_ACESSO_NEGADO]);
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
