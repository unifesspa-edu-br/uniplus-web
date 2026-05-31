import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'ui-pager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="pager" [attr.aria-label]="navigationLabel()">
      <button
        type="button"
        class="pager__btn"
        data-pager="prev"
        [disabled]="!hasPrevious() || isDisabled()"
        aria-label="Página anterior"
        (click)="previous.emit()"
      >
        Anterior
      </button>
      <span class="pager__status" aria-live="polite">
        <span class="pager__page">{{ statusText() }}</span>
      </span>
      <button
        type="button"
        class="pager__btn"
        data-pager="next"
        [disabled]="!hasNext() || isDisabled()"
        aria-label="Próxima página"
        (click)="next.emit()"
      >
        Próximo
      </button>
    </nav>
  `,
})
export class PagerComponent {
  readonly statusText = input<string>('Resultados carregados');
  readonly navigationLabel = input<string>('Paginação');
  readonly hasPrevious = input<boolean>(false);
  readonly hasNext = input<boolean>(false);
  readonly isDisabled = input<boolean>(false);
  readonly previous = output<void>();
  readonly next = output<void>();
}
