import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'ui-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        @if (level() === 1) {
          <h1 class="page-header__title" #titulo tabindex="-1">{{ heading() }}</h1>
        } @else {
          <h2 class="page-header__title" #titulo tabindex="-1">{{ heading() }}</h2>
        }
        @if (description()) {
          <p class="page-header__desc">{{ description() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content select="[uiPageActions]" />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly description = input<string>('');
  readonly level = input<1 | 2>(1);

  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  /**
   * Leva o foco ao título, para o leitor de tela anunciar a página que acabou de chegar. O título
   * não entra na ordem de tabulação.
   */
  focar(): void {
    this.titulo()?.nativeElement.focus();
  }
}
