import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService } from '@uniplus/shared-data/config';
import { entradaDaSelecao, redirecionaEntradaAntigaParaPainel } from './acompanhamento.guard';

const permissoes = signal<readonly string[]>([]);
const permissoesStub = {
  garantir: (): Promise<void> => Promise.resolve(),
  tem: (codigo: string) => permissoes().includes(codigo),
  temAlguma: (...codigos: string[]) => codigos.some((codigo) => permissoes().includes(codigo)),
};
const configuracao = signal<{ acompanhamentoValidacaoHabilitada?: boolean } | null>(null);

function executar(guard: CanActivateFn, url = '/', path = 'dashboard') {
  const rotaDaEntrada = { routeConfig: { path } } as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => guard(rotaDaEntrada, { url } as RouterStateSnapshot));
}

describe('guards de acompanhamento', () => {
  beforeEach(() => {
    permissoes.set([]);
    configuracao.set(null);
    permissoesStub.garantir = () => Promise.resolve();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PermissoesService, useValue: permissoesStub },
        { provide: AppConfigService, useValue: { config: configuracao } },
      ],
    });
  });

  function destino(resultado: unknown): string {
    return TestBed.inject(Router).serializeUrl(resultado as UrlTree);
  }

  describe('entradaDaSelecao', () => {
    it('leva quem acompanha processos ao painel', async () => {
      permissoes.set(['selecao:processos:acompanhar', 'selecao:processos:configurar']);

      expect(destino(await executar(entradaDaSelecao))).toBe('/dashboard');
    });

    it('leva quem só configura processos ao cadastro, não ao acesso negado', async () => {
      permissoes.set(['selecao:processos:configurar']);

      expect(destino(await executar(entradaDaSelecao))).toBe('/processo-seletivo');
    });

    it('leva quem só consulta inscrições às inscrições, não ao acesso negado', async () => {
      permissoes.set(['selecao:inscricoes:consultar']);

      expect(destino(await executar(entradaDaSelecao))).toBe('/inscricoes');
    });

    it('leva quem só importa notas do ENEM às notas, não ao acesso negado', async () => {
      permissoes.set(['selecao:notas-enem:importar']);

      expect(destino(await executar(entradaDaSelecao))).toBe('/notas');
    });

    it('nega quem não tem permissão para nenhuma tela', async () => {
      permissoes.set(['configuracao:campi:manter']);

      expect(destino(await executar(entradaDaSelecao))).toBe('/acesso-negado');
    });
  });

  describe('redirecionaEntradaAntigaParaPainel', () => {
    const acompanha = () => permissoes.set(['selecao:processos:acompanhar']);

    it('desligado, deixa a entrada antiga seguir', async () => {
      acompanha();

      expect(await executar(redirecionaEntradaAntigaParaPainel, '/inscricoes', 'inscricoes')).toBe(
        true,
      );
    });

    it('ligado, leva ao painel quem pode abri-lo', async () => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: true });
      acompanha();

      expect(
        destino(await executar(redirecionaEntradaAntigaParaPainel, '/inscricoes', 'inscricoes')),
      ).toBe('/dashboard');
    });

    it('ligado, leva ao painel quem só tem a permissão da entrada antiga, como o menu e a raiz', async () => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: true });
      permissoes.set(['selecao:inscricoes:consultar']);

      expect(
        destino(await executar(redirecionaEntradaAntigaParaPainel, '/inscricoes', 'inscricoes')),
      ).toBe('/dashboard');
    });

    it.each(['/inscricoes/', '/inscricoes?pagina=2'])('ligado, redireciona %s', async (url) => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: true });
      acompanha();

      expect(destino(await executar(redirecionaEntradaAntigaParaPainel, url, 'inscricoes'))).toBe(
        '/dashboard',
      );
    });

    it('ligado, não redireciona uma subrota da entrada antiga', async () => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: true });
      acompanha();

      expect(
        await executar(redirecionaEntradaAntigaParaPainel, '/inscricoes/42', 'inscricoes'),
      ).toBe(true);
    });

    it('ligado, aguarda as permissões carregarem antes de decidir (entrada direta pela URL)', async () => {
      configuracao.set({ acompanhamentoValidacaoHabilitada: true });
      permissoesStub.garantir = () => {
        acompanha();
        return Promise.resolve();
      };

      expect(
        destino(await executar(redirecionaEntradaAntigaParaPainel, '/inscricoes', 'inscricoes')),
      ).toBe('/dashboard');
    });
  });
});
