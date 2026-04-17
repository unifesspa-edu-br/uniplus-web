import { TestBed } from '@angular/core/testing';
import { RouterStateSnapshot, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

function runGuard(): boolean | UrlTree {
  return TestBed.runInInjectionContext(() => {
    const result = authGuard({} as never, {} as RouterStateSnapshot);
    if (typeof result === 'object' && result !== null && 'subscribe' in (result as object)) {
      throw new Error('authGuard should be sync');
    }
    return result as boolean | UrlTree;
  });
}

describe('authGuard', () => {
  function setup(authenticated: boolean) {
    const login = vi.fn();
    const authServiceMock = {
      authenticated: signal(authenticated).asReadonly(),
      login,
    } as unknown as AuthService;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    });
    return { login };
  }

  it('permite navegação quando o usuário está autenticado', () => {
    const { login } = setup(true);
    expect(runGuard()).toBe(true);
    expect(login).not.toHaveBeenCalled();
  });

  it('bloqueia e dispara login() quando o usuário NÃO está autenticado', () => {
    const { login } = setup(false);
    expect(runGuard()).toBe(false);
    expect(login).toHaveBeenCalledTimes(1);
  });
});
