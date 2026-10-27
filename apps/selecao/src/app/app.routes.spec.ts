import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService } from '@uniplus/shared-data/config';
import { appRoutes } from './app.routes';

const autenticado = signal(true);
const papeis = signal<readonly string[]>([]);
const configuracao = signal<{ acompanhamentoValidacaoHabilitada?: boolean } | null>(null);
const login = vi.fn();

const authStub = {
  authenticated: autenticado,
  roles: papeis,
  hasRole: (papel: string) => papeis().includes(papel),
  login,
};

/**
 * Navega pela árvore real de rotas, sem outlet: guards, redirecionamentos e carga lazy rodam,
 * mas nenhuma tela é instanciada.
 */
describe('appRoutes — entrada de acompanhamento', () => {
  let router: Router;

  beforeEach(() => {
    autenticado.set(true);
    papeis.set([]);
    configuracao.set(null);
    login.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes),
        { provide: AuthService, useValue: authStub },
        { provide: AppConfigService, useValue: { config: configuracao } },
      ],
    });
    router = TestBed.inject(Router);
  });

  async function ir(url: string): Promise<string> {
    await router.navigateByUrl(url);
    return router.url;
  }

  describe('com a opção desligada', () => {
    it.each(['/inscricoes', '/homologacao', '/notas', '/classificacao'])(
      'mantém %s para quem tem o papel',
      async (url) => {
        papeis.set(['admin', 'gestor', 'avaliador']);

        expect(await ir(url)).toBe(url);
      },
    );

    it('nega o painel a quem não tem papel do backoffice', async () => {
      expect(await ir('/dashboard')).toBe('/acesso-negado');
    });
  });

  describe('com a opção ligada', () => {
    beforeEach(() => configuracao.set({ acompanhamentoValidacaoHabilitada: true }));

    it('abre o painel a um usuário autenticado sem papel do backoffice', async () => {
      expect(await ir('/dashboard')).toBe('/dashboard');
    });

    it('não dá a esse usuário o cadastro nem as demais operações', async () => {
      expect(await ir('/processo-seletivo')).toBe('/acesso-negado');
      expect(await ir('/inscricoes')).toBe('/acesso-negado');
      expect(await ir('/notas')).toBe('/acesso-negado');
    });

    it.each(['/inscricoes', '/homologacao', '/notas', '/classificacao'])(
      'redireciona %s ao painel, sem loop',
      async (url) => {
        papeis.set(['admin', 'gestor', 'avaliador']);

        expect(await ir(url)).toBe('/dashboard');
      },
    );

    it('respeita o guard antigo antes de redirecionar', async () => {
      papeis.set(['avaliador']);

      expect(await ir('/inscricoes')).toBe('/acesso-negado');
    });

    it.each([
      '/processo-seletivo',
      '/processo-seletivo/novo',
      '/processo-seletivo/abc/publicacoes',
      '/processo-seletivo/abc/notas-do-enem',
      '/processo-seletivo/abc/simulacao/inscricao',
    ])('não redireciona %s', async (url) => {
      papeis.set(['plataforma-admin']);

      expect(await ir(url)).toBe(url);
    });

    it('manda o não autenticado ao login, inclusive em acesso direto', async () => {
      autenticado.set(false);

      await router.navigateByUrl('/inscricoes');

      expect(login).toHaveBeenCalledTimes(1);
      expect(login).toHaveBeenCalledWith('/inscricoes');
      expect(router.url).toBe('/');
    });
  });
});
