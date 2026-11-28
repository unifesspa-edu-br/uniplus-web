import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '@uniplus/shared-auth/bootstrap';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { describe, expect, it } from 'vitest';

import { ROTA_REUSE_KEY } from '../../../editor-route-reuse.strategy';
import { PROCESSO_SELETIVO_ROUTES } from '../processo-seletivo.routes';
import { RetificacaoDoProcessoPage } from './retificacao-do-processo.page';

const rota = PROCESSO_SELETIVO_ROUTES.find((r) => r.path === ':id/retificacao');

describe('rota :id/retificacao', () => {
  it('vem antes de :id, para não ser lida como um identificador', () => {
    const caminhos = PROCESSO_SELETIVO_ROUTES.map((r) => r.path);
    expect(caminhos.indexOf(':id/retificacao')).toBeGreaterThanOrEqual(0);
    expect(caminhos.indexOf(':id/retificacao')).toBeLessThan(caminhos.indexOf(':id'));
  });

  it('carrega a página da retificação e não reaproveita a tela do editor', async () => {
    const carregado = await (rota?.loadComponent as () => Promise<unknown>)();

    expect(carregado).toBe(RetificacaoDoProcessoPage);
    expect(rota?.data?.[ROTA_REUSE_KEY]).toBeUndefined();
  });

  describe('guarda', () => {
    function decidir(permissoes: readonly string[]): Promise<unknown> {
      TestBed.configureTestingModule({
        providers: [
          { provide: AuthService, useValue: { authenticated: () => true } },
          {
            provide: PermissoesService,
            useValue: {
              garantir: () => Promise.resolve(),
              temAlguma: (...codigos: string[]) => codigos.some((c) => permissoes.includes(c)),
            },
          },
          { provide: Router, useValue: { createUrlTree: () => 'acesso-negado' } },
        ],
      });
      const guarda = rota?.canActivate?.[0] as (
        r: ActivatedRouteSnapshot,
        s: RouterStateSnapshot,
      ) => unknown;
      return TestBed.runInInjectionContext(
        () =>
          guarda(
            {} as ActivatedRouteSnapshot,
            { url: '/x' } as RouterStateSnapshot,
          ) as Promise<unknown>,
      );
    }

    it('admite quem configura o processo', async () => {
      expect(await decidir(['selecao:processos:configurar'])).toBe(true);
    });

    it('recusa quem só publica', async () => {
      expect(await decidir(['selecao:processos:publicar'])).toBe('acesso-negado');
    });
  });
});
