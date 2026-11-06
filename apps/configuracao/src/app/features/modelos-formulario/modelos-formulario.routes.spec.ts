import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService, PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { describe, expect, it } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';
import { ModelosFormularioPage } from './modelos-formulario.page';
import { MODELOS_FORMULARIO_ROUTES } from './modelos-formulario.routes';

@Component({ template: '' })
class SimuladorFalso {}

describe('MODELOS_FORMULARIO_ROUTES', () => {
  it('o endereço antigo da simulação do modelo leva ao simulador com o modelo', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'modelos-formulario', children: MODELOS_FORMULARIO_ROUTES },
          { path: 'simulador-de-formulario', component: SimuladorFalso },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/modelos-formulario/abc/simulacao', SimuladorFalso);

    expect(TestBed.inject(Router).url).toBe('/simulador-de-formulario?modelo=abc');
  });

  it.each([
    ['a lista', '', ModelosFormularioPage],
    ['a edição', ':id', ModeloFormularioEdicaoPage],
  ])('carrega %s sob demanda', async (_nome, caminho, pagina) => {
    const rota = MODELOS_FORMULARIO_ROUTES.find((r) => r.path === caminho);

    await expect((rota?.loadComponent as () => Promise<unknown>)()).resolves.toBe(pagina);
  });

  describe('a edição exige a permissão de manter modelos', () => {
    @Component({ template: '' })
    class EdicaoFalsa {}

    async function navegar(permitida: boolean): Promise<string> {
      const pedidas: string[] = [];
      const rotas = MODELOS_FORMULARIO_ROUTES.map((rota) =>
        rota.path === ':id' ? { ...rota, loadComponent: () => EdicaoFalsa } : rota,
      );
      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            { path: 'modelos-formulario', children: rotas },
            { path: 'acesso-negado', component: EdicaoFalsa },
          ]),
          {
            provide: PermissoesService,
            useValue: {
              garantir: () => Promise.resolve(),
              temAlguma: (...permissoes: string[]) => {
                pedidas.push(...permissoes);
                return permitida;
              },
            },
          },
          { provide: AuthService, useValue: { authenticated: () => true } },
        ],
      });
      await RouterTestingHarness.create().then((harness) =>
        harness.navigateByUrl('/modelos-formulario/abc'),
      );
      expect(pedidas).toContain(PERMISSAO.configuracao.modelosFormularioManter);
      return TestBed.inject(Router).url;
    }

    it('com a permissão, a página abre', async () => {
      expect(await navegar(true)).toBe('/modelos-formulario/abc');
    });

    it('sem a permissão, a página é recusada', async () => {
      expect(await navegar(false)).toBe('/acesso-negado');
    });
  });
});
