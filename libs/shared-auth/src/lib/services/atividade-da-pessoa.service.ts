import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, NgZone } from '@angular/core';
import { RELOGIO } from '@uniplus/shared-core/relogio';

const EVENTOS_DA_PESSOA = ['keydown', 'pointerdown', 'wheel'] as const;

/**
 * Sabe quando a pessoa agiu na página pela última vez. Guarda só o instante: não lê tecla, alvo
 * nem posição. Um esbarrão no mouse não conta, por isso `pointermove` não é ouvido.
 */
@Injectable({ providedIn: 'root' })
export class AtividadeDaPessoa {
  private readonly relogio = inject(RELOGIO);
  private readonly documento = inject(DOCUMENT);
  private ultimaAtividadeEm = this.relogio().getTime();
  private aguardando: Array<() => void> = [];

  constructor() {
    const pararDeOuvir = inject(NgZone).runOutsideAngular(() => this.ouvirAPessoa());
    inject(DestroyRef).onDestroy(pararDeOuvir);
  }

  /** Verdadeiro se a pessoa agiu no instante dado ou depois dele (milissegundos). */
  houveDesde(instante: number): boolean {
    return this.ultimaAtividadeEm >= instante;
  }

  /** Resolve na próxima ação da pessoa. */
  proxima(): Promise<void> {
    return new Promise((resolve) => this.aguardando.push(resolve));
  }

  /** Liga os ouvintes e devolve a função que os desliga. */
  private ouvirAPessoa(): () => void {
    const opcoes = { capture: true, passive: true };
    const aoAgir = () => this.registrar();
    const aoMostrar = () => this.registrarSeVisivel();
    for (const evento of EVENTOS_DA_PESSOA) {
      this.documento.addEventListener(evento, aoAgir, opcoes);
    }
    this.documento.addEventListener('visibilitychange', aoMostrar);
    return () => {
      for (const evento of EVENTOS_DA_PESSOA) {
        this.documento.removeEventListener(evento, aoAgir, opcoes);
      }
      this.documento.removeEventListener('visibilitychange', aoMostrar);
    };
  }

  private registrarSeVisivel(): void {
    if (this.documento.visibilityState === 'visible') this.registrar();
  }

  private registrar(): void {
    this.ultimaAtividadeEm = this.relogio().getTime();
    const esperando = this.aguardando;
    this.aguardando = [];
    esperando.forEach((retomar) => retomar());
  }
}
