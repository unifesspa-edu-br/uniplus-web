import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { describe, expect, it } from 'vitest';
import { aguardarPermissoes } from './guardas-de-acesso';

describe('aguardarPermissoes', () => {
  it('libera a rota só depois de as permissões da sessão chegarem, sem exigir nenhuma', async () => {
    let chegou = false;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PermissoesService,
          useValue: { garantir: () => Promise.resolve().then(() => (chegou = true)) },
        },
      ],
    });

    const decisao = await TestBed.runInInjectionContext(() =>
      aguardarPermissoes({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(decisao).toBe(true);
    expect(chegou).toBe(true);
  });
});
