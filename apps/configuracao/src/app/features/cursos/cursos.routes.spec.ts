import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Route, UrlTree, provideRouter } from '@angular/router';
import { AuthService, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSOES_DAS_TELAS } from '../../acesso/permissoes-das-telas';
import { appRoutes } from '../../app.routes';
import { CursosPage } from './cursos.page';
import { CURSOS_ROUTES } from './cursos.routes';

const rotaDaTela = (): Route => {
  const encontrada = appRoutes
    .flatMap((item) => item.children ?? [])
    .find((item) => item.path === 'cursos');
  if (!encontrada) throw new Error('rota ausente: cursos');
  return encontrada;
};

async function decidirAcesso(concedidas: readonly string[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { authenticated: () => true, login: vi.fn() } },
      {
        provide: PermissoesService,
        useValue: {
          garantir: () => Promise.resolve(),
          temAlguma: (...codigos: string[]) => codigos.some((c) => concedidas.includes(c)),
        },
      },
    ],
  });
  const [guarda] = rotaDaTela().canActivate as CanActivateFn[];
  return TestBed.runInInjectionContext(() => guarda({} as never, { url: '/cursos' } as never));
}

describe('rotas dos cursos', () => {
  it('a rota da tela carrega as rotas da feature, que abrem a página na raiz', async () => {
    const carregarRotas = rotaDaTela().loadChildren as () => Promise<unknown>;
    expect(await carregarRotas()).toBe(CURSOS_ROUTES);
    expect(CURSOS_ROUTES).toHaveLength(1);
    expect(CURSOS_ROUTES[0].path).toBe('');
    const carregar = CURSOS_ROUTES[0].loadComponent as () => Promise<unknown>;
    expect(await carregar()).toBe(CursosPage);
  });

  it.each(PERMISSOES_DAS_TELAS['cursos'])('abre para quem tem %s', async (permissao) => {
    expect(await decidirAcesso([permissao])).toBe(true);
  });

  it('leva ao acesso negado sem a permissão da tela, mesmo com a de outra', async () => {
    const exigidas: readonly string[] = PERMISSOES_DAS_TELAS['cursos'];
    const deOutra = PERMISSOES_DAS_TELAS['tipos-etapa'].filter((p) => !exigidas.includes(p));
    expect(deOutra.length).toBeGreaterThan(0);
    for (const concedidas of [[], deOutra]) {
      const decisao = await decidirAcesso(concedidas);
      expect(decisao).toBeInstanceOf(UrlTree);
      expect((decisao as UrlTree).toString()).toBe('/acesso-negado');
    }
  });
});
