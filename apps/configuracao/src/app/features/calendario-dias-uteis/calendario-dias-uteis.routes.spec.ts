import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Route, UrlTree, provideRouter } from '@angular/router';
import { AuthService, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSOES_DAS_TELAS } from '../../acesso/permissoes-das-telas';
import { appRoutes } from '../../app.routes';
import { CalendarioDiasUteisDetalhePage } from './calendario-dias-uteis-detalhe.page';
import { CalendarioDiasUteisListPage } from './calendario-dias-uteis-list.page';
import { CalendarioDiasUteisNovoPage } from './calendario-dias-uteis-novo.page';
import { CALENDARIO_DIAS_UTEIS_ROUTES } from './calendario-dias-uteis.routes';

const rotaDaTela = (): Route => {
  const encontrada = appRoutes
    .flatMap((item) => item.children ?? [])
    .find((item) => item.path === 'calendario-dias-uteis');
  if (!encontrada) throw new Error('rota ausente: calendario-dias-uteis');
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
    guarda({} as never, { url: '/calendario-dias-uteis' } as never),
  );
}

describe('rotas do calendário de dias úteis', () => {
  it('a rota da tela carrega as rotas da feature', async () => {
    const carregarRotas = rotaDaTela().loadChildren as () => Promise<unknown>;
    expect(await carregarRotas()).toBe(CALENDARIO_DIAS_UTEIS_ROUTES);
  });

  it.each([
    ['', CalendarioDiasUteisListPage],
    ['novo', CalendarioDiasUteisNovoPage],
    [':id', CalendarioDiasUteisDetalhePage],
  ])('a rota "%s" abre a página própria', async (caminho, pagina) => {
    const rota = CALENDARIO_DIAS_UTEIS_ROUTES.find((item) => item.path === caminho);
    const carregar = rota?.loadComponent as () => Promise<unknown>;
    expect(await carregar()).toBe(pagina);
  });

  it('a rota "novo" vem antes de ":id", para não ser tomada como identificador', () => {
    const caminhos = CALENDARIO_DIAS_UTEIS_ROUTES.map((item) => item.path);
    expect(caminhos.indexOf('novo')).toBeLessThan(caminhos.indexOf(':id'));
  });

  it.each(PERMISSOES_DAS_TELAS['calendario-dias-uteis'])(
    'abre para quem tem %s, em todas as rotas da tela',
    async (permissao) => {
      expect(await decidirAcesso([permissao])).toBe(true);
    },
  );

  it('leva ao acesso negado sem a permissão da tela, mesmo com a de outra', async () => {
    const exigidas: readonly string[] = PERMISSOES_DAS_TELAS['calendario-dias-uteis'];
    const deOutra = PERMISSOES_DAS_TELAS['tipos-processo'].filter((p) => !exigidas.includes(p));
    expect(deOutra.length).toBeGreaterThan(0);
    for (const concedidas of [[], deOutra]) {
      const decisao = await decidirAcesso(concedidas);
      expect(decisao).toBeInstanceOf(UrlTree);
      expect((decisao as UrlTree).toString()).toBe('/acesso-negado');
    }
  });
});
