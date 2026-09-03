import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { PagerComponent } from '../pager/pager';

/** Opções de "itens por página" padrão das listas paginadas por cursor. */
export const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/** Itens por página inicial das listas paginadas por cursor. */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Rodapé padrão de lista paginada por cursor: seletor de "itens por página" +
 * Anterior/Próximo (`ui-pager`), montado só quando há o que paginar
 * (`hasRows` **ou** cursores). O container (página) continua dono do estado do
 * cursor e do limite — este componente só reflete e emite, espelhando o
 * contrato do `ui-pager`.
 */
@Component({
  selector: 'ui-list-footer',
  standalone: true,
  imports: [PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visivel()) {
      <ui-pager
        [navigationLabel]="navigationLabel()"
        [statusText]="statusText()"
        [pageSizeOptions]="pageSizeOptions()"
        [pageSize]="pageSize()"
        [pageSizeLabel]="pageSizeLabel()"
        [hasPrevious]="hasPrevious()"
        [hasNext]="hasNext()"
        [isDisabled]="isDisabled()"
        (pageSizeChange)="pageSize.set($event)"
        (previous)="previous.emit()"
        (next)="next.emit()"
      />
    }
  `,
})
export class ListFooterComponent {
  /**
   * Há linhas exibidas? Mantém o rodapé (e o seletor de limite) acessível numa
   * página única — sem isso, escolher 100 e caber tudo esconderia o seletor.
   */
  readonly hasRows = input<boolean>(false);
  readonly hasPrevious = input<boolean>(false);
  readonly hasNext = input<boolean>(false);
  readonly isDisabled = input<boolean>(false);
  readonly navigationLabel = input<string>('Paginação');
  readonly statusText = input<string>('Navegação por páginas');
  /** Vazio = rodapé só com Anterior/Próximo; com opções, mostra o seletor. */
  readonly pageSizeOptions = input<readonly number[]>([]);
  readonly pageSizeLabel = input<string>('Itens por página');
  readonly pageSize = model<number | null>(null);
  readonly previous = output<void>();
  readonly next = output<void>();

  protected readonly visivel = computed(
    () => this.hasRows() || this.hasPrevious() || this.hasNext(),
  );
}
