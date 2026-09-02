import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

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
      @if (pageSizeOptions().length > 0) {
        <span class="pager__status">
          <label class="pager__per-page">
            <span>{{ pageSizeLabel() }}</span>
            <select
              data-pager="page-size"
              [value]="pageSize()"
              [disabled]="isDisabled()"
              [attr.aria-label]="pageSizeLabel()"
              (change)="aoTrocarLimite($event)"
            >
              @for (opcao of pageSizeOptions(); track opcao) {
                <option [value]="opcao" [selected]="opcao === pageSize()">{{ opcao }}</option>
              }
            </select>
          </label>
        </span>
      } @else {
        <span class="pager__status" aria-live="polite">
          <span class="pager__page">{{ statusText() }}</span>
        </span>
      }
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
  /**
   * Opções de "itens por página". Vazio (padrão) mantém o rodapé só com o texto
   * de status; com opções, o texto dá lugar a um seletor de limite (anatomia
   * `.pager__per-page` do Uni+ DS). Trocar o limite é responsabilidade do
   * container: ele deve reagir ao `pageSize` e recarregar a primeira página (o
   * cursor da página atual carrega o limite antigo, ADR-0026).
   */
  readonly pageSizeOptions = input<readonly number[]>([]);
  readonly pageSizeLabel = input<string>('Itens por página');
  readonly pageSize = model<number | null>(null);
  readonly previous = output<void>();
  readonly next = output<void>();

  protected aoTrocarLimite(event: Event): void {
    const valor = Number((event.target as HTMLSelectElement).value);
    if (!Number.isNaN(valor)) {
      this.pageSize.set(valor);
    }
  }
}
