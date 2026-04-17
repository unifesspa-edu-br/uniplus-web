import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

function runGuard(requiredRoles: string[]): boolean | UrlTree {
  return TestBed.runInInjectionContext(() => {
    const guard = roleGuard(...requiredRoles);
    const result = guard(
      {} as never,
      {} as RouterStateSnapshot,
    );
    if (result instanceof Promise || typeof result === 'object' && result !== null && 'subscribe' in (result as object)) {
      throw new Error('roleGuard should be sync');
    }
    return result as boolean | UrlTree;
  });
}

describe('roleGuard', () => {
  function setup(opts: { authenticated: boolean; roles?: string[] }) {
    const login = vi.fn();
    const authServiceMock = {
      authenticated: signal(opts.authenticated).asReadonly(),
      hasRole: (role: string) => (opts.roles ?? []).includes(role),
      login,
    } as unknown as AuthService;

    const router = {
      createUrlTree: vi.fn((segments: unknown[]) => ({ __urlTree: true, segments })),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: router },
      ],
    });
    return { login, router };
  }

  it('cenário 1 — não autenticado → dispara login() e bloqueia (401)', () => {
    const { login, router } = setup({ authenticated: false });

    const result = runGuard(['admin']);

    expect(result).toBe(false);
    expect(login).toHaveBeenCalledTimes(1);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('cenário 2 — autenticado sem role esperada → redireciona para /acesso-negado (403)', () => {
    const { login, router } = setup({ authenticated: true, roles: ['candidato'] });

    const result = runGuard(['avaliador']);

    expect(login).not.toHaveBeenCalled();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/acesso-negado']);
    expect(result).toMatchObject({ __urlTree: true });
  });

  it('cenário 3 — autenticado e com role esperada → permite navegação', () => {
    const { login, router } = setup({ authenticated: true, roles: ['admin', 'gestor'] });

    const result = runGuard(['gestor']);

    expect(result).toBe(true);
    expect(login).not.toHaveBeenCalled();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('aceita OR entre roles: qualquer uma delas passa', () => {
    const { router } = setup({ authenticated: true, roles: ['avaliador'] });

    const result = runGuard(['admin', 'gestor', 'avaliador']);

    expect(result).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });
});
