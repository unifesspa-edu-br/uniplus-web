import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { redirecionaEntradaAntigaParaPainel } from './acompanhamento.guard';

function executar(url: string, path: string) {
  const rota = { routeConfig: { path } } as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() =>
    redirecionaEntradaAntigaParaPainel(rota, { url } as RouterStateSnapshot),
  );
}

describe('redirecionaEntradaAntigaParaPainel', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function destino(resultado: unknown): string {
    return TestBed.inject(Router).serializeUrl(resultado as UrlTree);
  }

  it.each(['/homologacao', '/homologacao/', '/homologacao?pagina=2', '/homologacao#topo'])(
    'leva %s ao painel',
    (url) => {
      expect(destino(executar(url, 'homologacao'))).toBe('/dashboard');
    },
  );

  it.each(['/homologacao/42', '/homologacao/42?x=1'])('deixa a subrota %s seguir', (url) => {
    expect(executar(url, 'homologacao')).toBe(true);
  });
});
