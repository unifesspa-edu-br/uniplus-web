import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Route, UrlTree, provideRouter } from '@angular/router';
import { AuthService, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../app.routes';
import { PERMISSOES_DAS_TELAS } from '../../acesso/permissoes-das-telas';
import { TIPOS_DOCUMENTO_ROUTES } from './tipos-documento.routes';
import { TiposDocumentoPage } from './tipos-documento.page';

const rotaDaTela = (): Route => {
  const encontrada = appRoutes
    .flatMap((item) => item.children ?? [])
    .find((item) => item.path === 'tipos-documento');
  if (!encontrada) throw new Error('rota ausente: tipos-documento');
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
  return TestBed.runInInjectionContext(() =>
    guarda({} as never, { url: '/tipos-documento' } as never),
  );
}

describe('rotas dos tipos de documento', () => {
  it('a rota da tela carrega as rotas da feature, que abrem a página na raiz', async () => {
    const carregarRotas = rotaDaTela().loadChildren as () => Promise<unknown>;
    expect(await carregarRotas()).toBe(TIPOS_DOCUMENTO_ROUTES);
    expect(TIPOS_DOCUMENTO_ROUTES).toHaveLength(1);
    expect(TIPOS_DOCUMENTO_ROUTES[0].path).toBe('');
    const carregar = TIPOS_DOCUMENTO_ROUTES[0].loadComponent as () => Promise<unknown>;
    expect(await carregar()).toBe(TiposDocumentoPage);
  });

  it.each(PERMISSOES_DAS_TELAS['tipos-documento'])('abre para quem tem %s', async (permissao) => {
    expect(await decidirAcesso([permissao])).toBe(true);
  });

  it('leva ao acesso negado sem a permissão da tela, mesmo com a de outra', async () => {
    const exigidas: readonly string[] = PERMISSOES_DAS_TELAS['tipos-documento'];
    const deOutra = PERMISSOES_DAS_TELAS['tipos-processo'].filter((p) => !exigidas.includes(p));
    expect(deOutra.length).toBeGreaterThan(0);
    for (const concedidas of [[], deOutra]) {
      const decisao = await decidirAcesso(concedidas);
      expect(decisao).toBeInstanceOf(UrlTree);
      expect((decisao as UrlTree).toString()).toBe('/acesso-negado');
    }
  });
});
