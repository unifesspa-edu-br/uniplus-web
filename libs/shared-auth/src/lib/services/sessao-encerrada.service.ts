import { effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Conduz a pessoa quando a sessão termina: avisa e, só a pedido dela, leva ao login voltando à
 * mesma rota. Não redireciona sozinho, para que o aviso possa ser lido, e não guarda nada do que
 * a pessoa preencheu.
 */
@Injectable({ providedIn: 'root' })
export class SessaoEncerrada {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly _aberto = signal(false);

  /** Verdadeiro enquanto o aviso de sessão encerrada está aberto. */
  readonly aberto = this._aberto.asReadonly();

  constructor() {
    effect(() => {
      if (this.auth.sessaoEncerrada()) this._aberto.set(true);
    });
  }

  entrarNovamente(): void {
    void this.auth.login(this.router.url);
  }

  /** Reabre o aviso quando a pessoa o dispensou e o servidor recusou de novo por falta de sessão. */
  reabrir(): void {
    this._aberto.set(true);
  }

  dispensar(): void {
    this._aberto.set(false);
  }
}
