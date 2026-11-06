import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Route, UrlTree, provideRouter } from '@angular/router';
import { AuthService, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSOES_DAS_TELAS } from '../../acesso/permissoes-das-telas';
import { appRoutes } from '../../app.routes';
import { TERMOS_CONSENTIMENTO_ROUTES } from './termos-consentimento.routes';

const raiz = appRoutes
  .find((rota) => rota.path === '')
  ?.children?.find((rota) => rota.path === 'termos-consentimento') as Route;

async function decidirAcesso(concedidas: readonly string[]): Promise<boolean | UrlTree> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { authenticated: () => true, login: vi.fn() } },
      {
        provide: PermissoesService,
        useValue: {
          garantir: () => Promise.resolve(),
          temAlguma: (...codigos: string[]) =>
            codigos.some((codigo) => concedidas.includes(codigo)),
        },
      },
    ],
  });
  const [guarda] = raiz.canActivate as CanActivateFn[];
  const decisao = await TestBed.runInInjectionContext(() =>
    guarda({} as never, { url: '/termos-consentimento' } as never),
  );
  return decisao as boolean | UrlTree;
}

describe('rotas dos termos de consentimento', () => {
  const exigidas = PERMISSOES_DAS_TELAS['termos-consentimento'];

  it.each(exigidas)('abre a tela com a permissão %s', async (permissao) => {
    expect(await decidirAcesso([permissao])).toBe(true);
  });

  it('leva ao acesso negado sem a permissão da tela', async () => {
    const decisao = await decidirAcesso(['outra.permissao']);
    expect(decisao).toBeInstanceOf(UrlTree);
    expect((decisao as UrlTree).toString()).toBe('/acesso-negado');
  });

  it('carrega a árvore de rotas sob demanda, com a lista, a criação e o termo', async () => {
    const filhas = await (raiz.loadChildren as () => Promise<Route[]>)();
    expect(filhas).toBe(TERMOS_CONSENTIMENTO_ROUTES);
    expect(filhas.map((rota) => rota.path)).toEqual(['', 'novo', ':id']);
    for (const rota of filhas) {
      expect(await (rota.loadComponent as () => Promise<unknown>)()).toBeTypeOf('function');
    }
    expect(filhas[1].data?.['breadcrumb']).toBe('Novo termo');
    expect(filhas[2].data?.['breadcrumb']).toBe('Editar termo');
  });
});
