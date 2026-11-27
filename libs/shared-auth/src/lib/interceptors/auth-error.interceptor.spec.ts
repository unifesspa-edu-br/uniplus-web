import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ApiResult,
  apiResultInterceptor,
  comRecusaDePermissaoTratadaNaChamada,
  ProblemDetails,
} from '@uniplus/shared-core/http';
import { authErrorInterceptor } from './auth-error.interceptor';
import { AuthService } from '../services/auth.service';
import { SessaoEncerrada } from '../services/sessao-encerrada.service';
import { MotivoDoAcessoNegadoService } from '../services/motivo-do-acesso-negado.service';

const PROBLEM_HEADERS = { 'Content-Type': 'application/problem+json' };

const baseProblem: ProblemDetails = {
  type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.auth.unauthorized',
  title: 'Não autenticado',
  status: 401,
  code: 'uniplus.auth.unauthorized',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
};

const problemaProibido: ProblemDetails = {
  ...baseProblem,
  code: 'uniplus.auth.forbidden',
  status: 403,
  title: 'Acesso negado',
};

describe('authErrorInterceptor (consumindo ApiResult)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup(
    rotaAtual = '/inicio',
    navegandoPara: string | null = null,
    sessao: {
      autenticada: boolean;
      encerrada: boolean;
      acessoVencido?: boolean;
      tokenAtual?: string;
    } = {
      autenticada: false,
      encerrada: false,
    },
  ) {
    const login = vi.fn();
    const encerrarSessao = vi.fn();
    const navigate = vi.fn();
    const reabrir = vi.fn();
    const authServiceMock = {
      login,
      encerrarSessao,
      authenticated: () => sessao.autenticada,
      sessaoEncerrada: () => sessao.encerrada,
      isTokenExpired: () => sessao.acessoVencido ?? false,
      getToken: () => sessao.tokenAtual,
    } as unknown as AuthService;
    const routerMock = {
      navigate,
      url: rotaAtual,
      currentNavigation: () => (navegandoPara ? { finalUrl: navegandoPara } : null),
    } as unknown as Router;

    TestBed.configureTestingModule({
      providers: [
        // A ordem aqui replica a registrada nos apps:
        // authErrorInterceptor é mais externo que apiResultInterceptor,
        // portanto recebe o HttpResponse já envelopado pelo apiResult.
        provideHttpClient(withInterceptors([authErrorInterceptor, apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: SessaoEncerrada, useValue: { reabrir } },
      ],
    });

    return {
      http: TestBed.inject(HttpClient),
      httpMock: TestBed.inject(HttpTestingController),
      login,
      encerrarSessao,
      reabrir,
      navigate,
    };
  }

  type Contexto = ReturnType<typeof setup>;

  async function receberProblema(
    { http, httpMock }: Contexto,
    url: string,
    problema: ProblemDetails,
  ): Promise<ApiResult<unknown>> {
    const promise = firstValueFrom(http.get<ApiResult<unknown>>(url));
    const resposta = { status: problema.status, statusText: 'error', headers: PROBLEM_HEADERS };
    httpMock.expectOne(url).flush(problema, resposta);
    return promise;
  }

  async function receberFalhaDeRede({ http, httpMock }: Contexto, url: string) {
    const promise = firstValueFrom(http.get<ApiResult<unknown>>(url));
    httpMock.expectOne(url).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown' });
    return promise;
  }

  function esperarSemRedirecionamento({ login, navigate }: Contexto): void {
    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  }

  it('401 (envelopado em ApiFailure) chama authService.login() e devolve ApiFailure ao consumer', async () => {
    const ctx = setup();

    const result = await receberProblema(ctx, '/api/protegido', baseProblem);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(ctx.login).toHaveBeenCalledTimes(1);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('403 (envelopado em ApiFailure) redireciona para /acesso-negado', async () => {
    const ctx = setup();

    const result = await receberProblema(ctx, '/api/admin', problemaProibido);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(ctx.navigate).toHaveBeenCalledWith(['/acesso-negado']);
    expect(ctx.login).not.toHaveBeenCalled();
  });

  it('403 de chamada que trata a recusa na tela entrega a falha sem navegar nem guardar o detail', async () => {
    const ctx = setup();
    const url = '/api/apoio';

    const promise = firstValueFrom(
      ctx.http.get<ApiResult<unknown>>(url, { context: comRecusaDePermissaoTratadaNaChamada() }),
    );
    ctx.httpMock
      .expectOne(url)
      .flush(
        { ...problemaProibido, detail: 'Sem permissão.' },
        { status: 403, statusText: 'error', headers: PROBLEM_HEADERS },
      );

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    esperarSemRedirecionamento(ctx);
    expect(TestBed.inject(MotivoDoAcessoNegadoService).motivo()).toBeNull();
  });

  it('401 com a pessoa autenticada encerra a sessão, sem levar ao login na hora', async () => {
    const ctx = setup('/inicio', null, { autenticada: true, encerrada: false });

    await receberProblema(ctx, '/api/protegido', baseProblem);

    expect(ctx.encerrarSessao).toHaveBeenCalledTimes(1);
    expect(ctx.login).not.toHaveBeenCalled();
  });

  it('401 com o acesso em memória vencido não encerra a sessão: foi pedido automático sem renovação', async () => {
    const ctx = setup('/inicio', null, {
      autenticada: true,
      encerrada: false,
      acessoVencido: true,
    });

    await receberProblema(ctx, '/api/protegido', baseProblem);

    expect(ctx.encerrarSessao).not.toHaveBeenCalled();
    expect(ctx.login).not.toHaveBeenCalled();
  });

  it('401 de pedido enviado com o acesso antigo, depois de uma renovação, não encerra a sessão', async () => {
    const ctx = setup('/inicio', null, { autenticada: true, encerrada: false, tokenAtual: 'novo' });

    const promise = firstValueFrom(
      ctx.http.get('/api/protegido', { headers: { Authorization: 'Bearer antigo' } }),
    );
    ctx.httpMock.expectOne('/api/protegido').flush(baseProblem, {
      status: 401,
      statusText: 'error',
      headers: PROBLEM_HEADERS,
    });
    await promise;

    expect(ctx.encerrarSessao).not.toHaveBeenCalled();
  });

  it('401 de pedido enviado com o acesso atual encerra a sessão', async () => {
    const ctx = setup('/inicio', null, {
      autenticada: true,
      encerrada: false,
      tokenAtual: 'atual',
    });

    const promise = firstValueFrom(
      ctx.http.get('/api/protegido', { headers: { Authorization: 'Bearer atual' } }),
    );
    ctx.httpMock.expectOne('/api/protegido').flush(baseProblem, {
      status: 401,
      statusText: 'error',
      headers: PROBLEM_HEADERS,
    });
    await promise;

    expect(ctx.encerrarSessao).toHaveBeenCalledTimes(1);
  });

  it('401 com a sessão já encerrada reabre o aviso, sem repetir o encerramento nem abrir o login', async () => {
    const ctx = setup('/inicio', null, { autenticada: false, encerrada: true });

    await receberProblema(ctx, '/api/protegido', baseProblem);

    expect(ctx.reabrir).toHaveBeenCalledTimes(1);
    expect(ctx.encerrarSessao).not.toHaveBeenCalled();
    expect(ctx.login).not.toHaveBeenCalled();
  });

  it('401 de chamada que trata a recusa na tela ainda leva ao login', async () => {
    const ctx = setup();
    const url = '/api/apoio';

    const promise = firstValueFrom(
      ctx.http.get<ApiResult<unknown>>(url, { context: comRecusaDePermissaoTratadaNaChamada() }),
    );
    ctx.httpMock
      .expectOne(url)
      .flush(baseProblem, { status: 401, statusText: 'error', headers: PROBLEM_HEADERS });
    await promise;

    expect(ctx.login).toHaveBeenCalledTimes(1);
  });

  it('403 com detail guarda o detail para a página de acesso negado', async () => {
    const ctx = setup();
    const detail = 'É preciso a permissão de manter perfis.';

    await receberProblema(ctx, '/api/admin', { ...problemaProibido, detail });

    expect(TestBed.inject(MotivoDoAcessoNegadoService).motivo()).toBe(detail);
  });

  it('403 sem detail apaga o detail de uma recusa anterior', async () => {
    const ctx = setup();
    const motivo = TestBed.inject(MotivoDoAcessoNegadoService);
    motivo.registrar('Recusa anterior.');

    await receberProblema(ctx, '/api/admin', problemaProibido);

    expect(motivo.motivo()).toBeNull();
  });

  it('401 não guarda detail', async () => {
    const ctx = setup();

    await receberProblema(ctx, '/api/protegido', { ...baseProblem, detail: 'Sessão expirada.' });

    expect(TestBed.inject(MotivoDoAcessoNegadoService).motivo()).toBeNull();
  });

  it('403 já na página de acesso negado não troca o detail nem navega de novo', async () => {
    const ctx = setup('/acesso-negado');
    const motivo = TestBed.inject(MotivoDoAcessoNegadoService);
    motivo.registrar('Motivo original.');

    await receberProblema(ctx, '/api/pedidos', problemaProibido);

    expect(motivo.motivo()).toBe('Motivo original.');
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('403 durante o redirecionamento de outro 403 mantém o primeiro detail', async () => {
    const ctx = setup('/processos', '/acesso-negado');
    const motivo = TestBed.inject(MotivoDoAcessoNegadoService);
    motivo.registrar('Primeiro motivo.');

    await receberProblema(ctx, '/api/catalogo', { ...problemaProibido, detail: 'Segundo.' });

    expect(motivo.motivo()).toBe('Primeiro motivo.');
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it.each([500, 404])(
    'status %i entrega ApiFailure ao consumer sem login nem navigate',
    async (status) => {
      const ctx = setup();
      const problema = { ...baseProblem, status, code: `uniplus.test.${status}` };

      const result = await receberProblema(ctx, `/api/x${status}`, problema);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(status);
      esperarSemRedirecionamento(ctx);
    },
  );

  it('status 0 (falha de rede) entrega ApiFailure ao consumer sem login nem navigate', async () => {
    const ctx = setup();

    const result = await receberFalhaDeRede(ctx, '/api/x0');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    esperarSemRedirecionamento(ctx);
  });

  it('resposta 2xx envelopa em ApiOk sem disparar redirect', async () => {
    const ctx = setup();

    const promise = firstValueFrom(ctx.http.get<ApiResult<{ ok: boolean }>>('/api/ok'));
    ctx.httpMock.expectOne('/api/ok').flush({ ok: true });

    const result = await promise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ ok: true });
    }
    esperarSemRedirecionamento(ctx);
  });
});
