import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../app.routes';
import { TIPOS_DEFICIENCIA_ROUTES } from './tipos-deficiencia.route';
import { TiposDeficienciaListPage } from './tipos-deficiencia-list.page';

const PERMISSAO = 'configuracao:tipos-deficiencia:manter';
const concedidas = signal<readonly string[]>([]);

describe('rota dos tipos de deficiência', () => {
  let router: Router;

  beforeEach(() => {
    concedidas.set([]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes),
        { provide: AuthService, useValue: { authenticated: () => true, login: vi.fn() } },
        {
          provide: PermissoesService,
          useValue: {
            garantir: () => Promise.resolve(),
            temAlguma: (...codigos: string[]) =>
              codigos.some((codigo) => concedidas().includes(codigo)),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('abre com a permissão de manter o cadastro', async () => {
    concedidas.set([PERMISSAO]);
    await router.navigateByUrl('/tipos-deficiencia');
    expect(router.url).toBe('/tipos-deficiencia');
  });

  it('leva ao acesso negado sem a permissão, ainda que haja a de outra tela', async () => {
    concedidas.set(['configuracao:condicoes-atendimento:manter']);
    await router.navigateByUrl('/tipos-deficiencia');
    expect(router.url).toBe('/acesso-negado');
  });

  it('carrega a página da tela na rota raiz', async () => {
    const [raiz] = TIPOS_DEFICIENCIA_ROUTES;
    expect(raiz.path).toBe('');
    expect(await (raiz.loadComponent as () => Promise<unknown>)()).toBe(TiposDeficienciaListPage);
  });
});
