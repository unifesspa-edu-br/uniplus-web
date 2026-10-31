import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { acessoNegadoGuard } from './acesso-negado.guard';

describe('acessoNegadoGuard', () => {
  function executar(autenticado: boolean) {
    const login = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { authenticated: signal(autenticado).asReadonly(), login },
        },
      ],
    });
    const resultado = TestBed.runInInjectionContext(() =>
      acessoNegadoGuard({} as never, { url: '/acesso-negado' } as RouterStateSnapshot),
    );
    return { resultado, login };
  }

  it('mostra a página a quem está autenticado', () => {
    const { resultado, login } = executar(true);
    expect(resultado).toBe(true);
    expect(login).not.toHaveBeenCalled();
  });

  it('sem sessão, leva ao login de volta à raiz do app, e não à página de acesso negado', () => {
    const { resultado, login } = executar(false);
    expect(resultado).toBe(false);
    expect(login).toHaveBeenCalledWith('/');
  });
});
