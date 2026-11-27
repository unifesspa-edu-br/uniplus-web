import { effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import { AtividadeDaPessoa } from './atividade-da-pessoa.service';
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
  private readonly atividade = inject(AtividadeDaPessoa);
  private readonly relogio = inject(RELOGIO);
  private dispensadoEm = 0;
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

  /**
   * Reabre o aviso quando a pessoa o dispensou, agiu de novo e o servidor recusou por falta de
   * sessão. Pedido automático não conta: sem ação dela, o aviso dispensado fica fechado.
   */
  reabrir(): void {
    if (this.atividade.houveDesde(this.dispensadoEm)) this._aberto.set(true);
  }

  dispensar(): void {
    this._aberto.set(false);
    // A ação que dispensou já passou; só uma posterior reabre.
    this.dispensadoEm = this.relogio().getTime() + 1;
  }
}
