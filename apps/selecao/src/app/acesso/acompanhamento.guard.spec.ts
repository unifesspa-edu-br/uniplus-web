import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { AuthService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService } from '@uniplus/shared-data/config';
import {
  acessoAcompanhamentoGuard,
  redirecionaEntradaAntigaParaPainel,
} from './acompanhamento.guard';

const autenticado = signal(true);
const papeis = signal<readonly string[]>([]);
const login = vi.fn();
const configuracao = signal<{ acompanhamentoValidacaoHabilitada?: boolean } | null>(null);

const authStub = {
  authenticated: autenticado,
  hasRole: (papel: string) => papeis().includes(papel),
  login,
};

function executar(guard: typeof acessoAcompanhamentoGuard, url = '/dashboard', path = 'dashboard') {
  const rotaDaEntrada = { routeConfig: { path } } as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => guard(rotaDaEntrada, { url } as RouterStateSnapshot));
}

describe('guards de acompanhamento', () => {
  beforeEach(() => {
    autenticado.set(true);
    papeis.set([]);
    configuracao.set(null);
    login.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: AppConfigService, useValue: { config: configuracao } },
      ],
    });
  });

  function destino(resultado: unknown): string {
    return TestBed.inject(Router).serializeUrl(resultado as UrlTree);
  }

  describe('acessoAcompanhamentoGuard', () => {
    it('desligado, mantém o controle por papel do backoffice', () => {
      papeis.set(['gestor']);
      expect(executar(acessoAcompanhamentoGuard)).toBe(true);

      papeis.set([]);
      expect(destino(executar(acessoAcompanhamentoGuard))).toBe('/acesso-negado');
    });

    it('ligado, admite qualquer usuário autenticado', () => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: true });

      expect(executar(acessoAcompanhamentoGuard)).toBe(true);
    });

    it.each([false, true])('com a opção %s, manda o não autenticado ao login', (ligada) => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: ligada });
      autenticado.set(false);

      expect(executar(acessoAcompanhamentoGuard)).toBe(false);
      expect(login).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('redirecionaEntradaAntigaParaPainel', () => {
    it('desligado, deixa a entrada antiga seguir', () => {
      expect(executar(redirecionaEntradaAntigaParaPainel, '/inscricoes', 'inscricoes')).toBe(true);
    });

    it('ligado, leva ao painel', () => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: true });

      expect(
        destino(executar(redirecionaEntradaAntigaParaPainel, '/inscricoes', 'inscricoes')),
      ).toBe('/dashboard');
    });

    it.each(['/inscricoes/', '/inscricoes?pagina=2'])('ligado, redireciona %s', (url) => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: true });

      expect(destino(executar(redirecionaEntradaAntigaParaPainel, url, 'inscricoes'))).toBe(
        '/dashboard',
      );
    });

    it('ligado, não redireciona uma subrota da entrada antiga', () => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: true });

      expect(executar(redirecionaEntradaAntigaParaPainel, '/inscricoes/42', 'inscricoes')).toBe(
        true,
      );
    });
  });
});
