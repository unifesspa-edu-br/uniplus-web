import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

/**
 * Trava o scroll do documento enquanto houver overlay aberto no wizard.
 *
 * Usa classe própria, e não `uni-drawer-open`: o `DrawerComponent` de
 * shared-ui mantém o próprio contador, e compartilhar a classe faria um
 * liberar o scroll ainda com o overlay do outro aberto. Cada `lock()` exige um
 * `unlock()` — inclusive quando o dono é destruído com o overlay aberto.
 */
@Injectable({ providedIn: 'root' })
export class OverlayScrollService {
  private static readonly CLASSE = 'sel-overlay-open';

  private readonly document = inject<Document>(DOCUMENT);
  private locks = 0;

  lock(): void {
    this.locks += 1;
    this.document.body.classList.add(OverlayScrollService.CLASSE);
  }

  unlock(): void {
    this.locks = Math.max(0, this.locks - 1);
    if (this.locks === 0) {
      this.document.body.classList.remove(OverlayScrollService.CLASSE);
    }
  }
}
