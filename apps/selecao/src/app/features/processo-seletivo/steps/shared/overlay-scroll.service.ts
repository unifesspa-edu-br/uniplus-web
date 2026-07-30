import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OverlayScrollService {
  private readonly document = inject<Document>(DOCUMENT);
  private locks = 0;

  lock(): void {
    this.locks += 1;
    this.document.body.style.overflow = 'hidden';
  }

  unlock(): void {
    this.locks = Math.max(0, this.locks - 1);
    if (this.locks === 0) this.document.body.style.overflow = '';
  }
}
