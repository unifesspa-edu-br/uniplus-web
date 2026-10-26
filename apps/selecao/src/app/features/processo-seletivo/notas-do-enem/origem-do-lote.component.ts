import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { LoteDeNotasDoEnemDto } from '@uniplus/shared-data/selecao';

import { hashCurto } from './resultado-do-lote';

/** A versão do leiaute e o hash do arquivo do lote, em texto discreto ao lado do título. */
@Component({
  selector: 'sel-origem-do-lote',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <span class="sr-only">Leiaute </span>{{ lote().leiauteVersao }} ·
    <span class="sr-only">hash do arquivo </span
    ><span [attr.title]="lote().arquivoHash">{{ hash() }}</span>
  `,
})
export class OrigemDoLoteComponent {
  readonly lote = input.required<LoteDeNotasDoEnemDto>();

  protected hash(): string {
    return hashCurto(this.lote().arquivoHash);
  }
}
