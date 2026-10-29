import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService } from '@uniplus/shared-data/config';
import { appRoutes } from './app.routes';

const autenticado = signal(true);
const permissoes = signal<readonly string[]>([]);
const permissoesStub = {
  garantir: () => Promise.resolve(),
  tem: (codigo: string) => permissoes().includes(codigo),
  temNoModulo: (modulo: string) => permissoes().some((codigo) => codigo.startsWith(`${modulo}:`)),
  temAlguma: (...codigos: string[]) => codigos.some((codigo) => permissoes().includes(codigo)),
};
const configuracao = signal<{ acompanhamentoValidacaoHabilitada?: boolean } | null>(null);
const login = vi.fn();

const authStub = { authenticated: autenticado, roles: signal<readonly string[]>([]), login };

const ROTAS_E_PERMISSOES = [
  ['/dashboard', 'selecao:processos:acompanhar'],
  ['/processo-seletivo', 'selecao:processos:configurar'],
  ['/inscricoes', 'selecao:inscricoes:consultar'],
  ['/notas', 'selecao:notas-enem:importar'],
  ['/homologacao', 'selecao:processos:acompanhar'],
  ['/classificacao', 'selecao:processos:acompanhar'],
] as const;

/**
 * Navega pela árvore real de rotas, sem outlet: guards, redirecionamentos e carga lazy rodam,
 * mas nenhuma tela é instanciada.
 */
describe('appRoutes — permissões efetivas', () => {
  let router: Router;

  beforeEach(() => {
    autenticado.set(true);
    permissoes.set([]);
    configuracao.set(null);
    login.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes),
        { provide: AuthService, useValue: authStub },
        { provide: PermissoesService, useValue: permissoesStub },
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
    it.each(ROTAS_E_PERMISSOES)('abre %s com %s', async (url, permissao) => {
      permissoes.set([permissao]);

      expect(await ir(url)).toBe(url);
    });

    it.each(ROTAS_E_PERMISSOES)('nega %s sem a permissão', async (url) => {
      permissoes.set(['selecao:regras-catalogo:consultar']);

      expect(await ir(url)).toBe('/acesso-negado');
    });

    it('leva a raiz ao painel de quem acompanha processos', async () => {
      permissoes.set(['selecao:processos:acompanhar']);

      expect(await ir('/')).toBe('/dashboard');
    });

    it('leva a raiz de quem só configura processos ao cadastro', async () => {
      permissoes.set(['selecao:processos:configurar']);

      expect(await ir('/')).toBe('/processo-seletivo');
    });

    it('leva a raiz de quem não tem nenhuma das duas ao acesso negado', async () => {
      expect(await ir('/')).toBe('/acesso-negado');
    });
  });

  describe('com a opção ligada', () => {
    beforeEach(() => configuracao.set({ acompanhamentoValidacaoHabilitada: true }));

    it.each(['/inscricoes', '/homologacao', '/notas', '/classificacao'])(
      'redireciona %s ao painel de quem o acompanha, sem loop',
      async (url) => {
        permissoes.set([
          'selecao:processos:acompanhar',
          'selecao:inscricoes:consultar',
          'selecao:notas-enem:importar',
        ]);

        expect(await ir(url)).toBe('/dashboard');
      },
    );

    it('abre o painel e a raiz a quem só tem a sessão', async () => {
      expect(await ir('/dashboard')).toBe('/dashboard');
      expect(await ir('/')).toBe('/dashboard');
    });

    it('respeita a permissão da rota antes de redirecionar', async () => {
      permissoes.set(['selecao:processos:acompanhar']);

      expect(await ir('/inscricoes')).toBe('/acesso-negado');
    });

    it.each([
      '/processo-seletivo',
      '/processo-seletivo/novo',
      '/processo-seletivo/abc/publicacoes',
      '/processo-seletivo/abc/notas-do-enem',
      '/processo-seletivo/abc/simulacao/inscricao',
    ])('não redireciona %s', async (url) => {
      permissoes.set(['selecao:processos:configurar']);

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
