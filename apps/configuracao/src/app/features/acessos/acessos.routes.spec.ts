import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Route, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { PERMISSOES_DAS_TELAS } from '../../acesso/permissoes-das-telas';
import { ACESSOS_ROUTES } from './acessos.routes';

const raiz = ACESSOS_ROUTES[0] as Route;
const filhas = (raiz.children ?? []) as Route[];
const rota = (caminho: string): Route => {
  const encontrada = filhas.find((item) => item.path === caminho);
  if (!encontrada) throw new Error(`rota ausente: ${caminho}`);
  return encontrada;
};

/** Executa a guarda da rota para quem tem sessão e as permissões informadas. */
async function decidirAcesso(caminho: string, concedidas: readonly string[]) {
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
  const [guarda] = rota(caminho).canActivate as CanActivateFn[];
  return TestBed.runInInjectionContext(() =>
    guarda({} as never, { url: `/acessos/${caminho}` } as never),
  );
}

const PROTEGIDAS = [
  ['fila-do-gestor', 'acessos/fila-do-gestor'],
  ['fila-da-protecao-de-dados', 'acessos/fila-da-protecao-de-dados'],
  ['historico', 'acessos/historico'],
  ['concessoes', 'acessos/concessoes'],
  ['perfis', 'acessos/perfis'],
  ['perfis/:id', 'acessos/perfis'],
  ['versoes-de-perfil/gestao-de-acessos', 'acessos/versoes-de-perfil/gestao-de-acessos'],
  ['versoes-de-perfil/protecao-de-dados', 'acessos/versoes-de-perfil/protecao-de-dados'],
] as const;

const permissoesDa = (tela: (typeof PROTEGIDAS)[number][1]): readonly string[] =>
  PERMISSOES_DAS_TELAS[tela];

describe('rotas dos acessos', () => {
  it('abre nos próprios pedidos e espera as permissões antes de qualquer tela', () => {
    expect(raiz.canActivate).toHaveLength(1);
    expect(rota('').redirectTo).toBe('pedidos');
  });

  describe.each(PROTEGIDAS)('%s', (caminho, tela) => {
    const exigidas = permissoesDa(tela);

    it.each(exigidas)('abre com a permissão %s', async (permissao) => {
      expect(await decidirAcesso(caminho, [permissao])).toBe(true);
    });

    it('leva ao acesso negado sem nenhuma permissão', async () => {
      const decisao = await decidirAcesso(caminho, []);
      expect(decisao).toBeInstanceOf(UrlTree);
      expect((decisao as UrlTree).toString()).toBe('/acesso-negado');
    });

    it('leva ao acesso negado com a permissão de outra tela', async () => {
      const dasOutras = PROTEGIDAS.filter(([, outra]) => outra !== tela).flatMap(([, outra]) =>
        permissoesDa(outra).filter((permissao) => !exigidas.includes(permissao)),
      );
      expect(dasOutras.length).toBeGreaterThan(0);
      expect(await decidirAcesso(caminho, dasOutras)).toBeInstanceOf(UrlTree);
    });
  });

  it.each(['pedidos', 'pedidos/novo', 'pedidos/:id'])(
    '%s fica aberta a quem tem sessão, sem permissão de administração',
    (caminho) => {
      expect(rota(caminho).canActivate).toBeUndefined();
    },
  );

  it.each([
    ['pedidos', 'meus'],
    ['fila-do-gestor', 'gestor'],
    ['fila-da-protecao-de-dados', 'protecao_de_dados'],
    ['historico', 'todos'],
  ])('%s lista a fila %s', (caminho, fila) => {
    expect(rota(caminho).data?.['fila']).toBe(fila);
  });

  it.each([
    ['versoes-de-perfil/gestao-de-acessos', 'gestao_de_acessos'],
    ['versoes-de-perfil/protecao-de-dados', 'protecao_de_dados'],
  ])('%s lista a etapa %s', (caminho, etapa) => {
    expect(rota(caminho).data?.['etapa']).toBe(etapa);
  });

  it('carrega cada tela sob demanda', async () => {
    const carregaveis = filhas.filter((item) => item.loadComponent !== undefined);
    expect(carregaveis).toHaveLength(11);
    for (const item of carregaveis) {
      expect(await (item.loadComponent as () => Promise<unknown>)()).toBeTypeOf('function');
    }
  });
});
