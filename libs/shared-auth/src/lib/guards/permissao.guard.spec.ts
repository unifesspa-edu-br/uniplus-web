import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import type { CodigoDePermissao } from '../permissoes/catalogo';
import { AuthService } from '../services/auth.service';
import { PermissoesService } from '../services/permissoes.service';
import { permissaoGuard, permissaoNoModuloGuard } from './permissao.guard';

describe('permissaoGuard', () => {
  const login = vi.fn();
  const garantir = vi.fn(() => Promise.resolve());
  const concedidas = new Set<string>();
  const arvore = { acessoNegado: true } as unknown as UrlTree;

  beforeEach(() => {
    login.mockReset();
    garantir.mockClear();
    concedidas.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { authenticated: signal(true), login } },
        {
          provide: PermissoesService,
          useValue: {
            garantir,
            temAlguma: (...codigos: string[]) => codigos.some((c) => concedidas.has(c)),
            temNoModulo: (...modulos: string[]) =>
              [...concedidas].some((c) => modulos.some((m) => c.startsWith(`${m}:`))),
          },
        },
        { provide: Router, useValue: { createUrlTree: () => arvore } },
      ],
    });
  });

  function executar(guarda: ReturnType<typeof permissaoGuard>, url = '/campi') {
    return TestBed.runInInjectionContext(() =>
      guarda({} as never, { url } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
  }

  it('libera quando a pessoa tem a permissão', async () => {
    concedidas.add('configuracao:campi:manter');

    expect(await executar(permissaoGuard('configuracao:campi:manter'))).toBe(true);
    expect(garantir).toHaveBeenCalledTimes(1);
  });

  it('aceita qualquer uma das permissões listadas', async () => {
    concedidas.add('configuracao:fatos-candidato:consultar');
    const codigos: CodigoDePermissao[] = [
      'configuracao:fatos-candidato:manter',
      'configuracao:fatos-candidato:consultar',
    ];

    expect(await executar(permissaoGuard(...codigos))).toBe(true);
  });

  it('leva a /acesso-negado quando falta a permissão ou a lista veio vazia', async () => {
    expect(await executar(permissaoGuard('configuracao:campi:manter'))).toBe(arvore);
  });

  it('libera o módulo a quem tem qualquer permissão dele', async () => {
    concedidas.add('publicacoes:tipos-ato:manter');

    expect(await executar(permissaoNoModuloGuard('configuracao', 'publicacoes'))).toBe(true);
    concedidas.clear();
    expect(await executar(permissaoNoModuloGuard('configuracao', 'publicacoes'))).toBe(arvore);
  });

  it('dispara o login sem consultar as permissões quando não há sessão', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { authenticated: signal(false), login } },
        { provide: PermissoesService, useValue: { garantir } },
        { provide: Router, useValue: { createUrlTree: () => arvore } },
      ],
    });

    expect(await executar(permissaoGuard('configuracao:campi:manter'), '/campi')).toBe(false);
    expect(login).toHaveBeenCalledWith('/campi');
    expect(garantir).not.toHaveBeenCalled();
  });
});
