import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@uniplus/shared-core/http';

/**
 * Rodapé de paginação padrão das tabelas (ADR-0017 — apresentacional).
 *
 * Anatomia fixa, sempre renderizada (inclusive sem registros) para que a
 * altura e o layout da tabela não oscilem:
 *
 * ```
 * [ 50 por página ▾ ]                       [ ‹ Anterior ] 51–100 [ Próximo › ]
 * ```
 *
 * **Lado esquerdo** — seletor "N por página". As opções são
 * {@link PAGE_SIZE_OPTIONS} e o valor inicial é {@link DEFAULT_PAGE_SIZE}
 * (ponto único de verdade em `@uniplus/shared-core/http`). Trocar o valor
 * emite `pageSizeChange`; o container refaz a consulta a partir da 1ª página.
 *
 * **Lado direito** — navegação por cursor (ADR-0026/ADR-0089). A API não
 * expõe total de registros nem total de páginas, então o indicador central
 * mostra a **faixa de registros** da página corrente (`rangeStart`–`rangeEnd`),
 * calculada a partir de `pageIndex` (1-based, contado no container pelos
 * cliques) e `currentCount` (linhas efetivamente exibidas).
 *
 * - `previous` fica desabilitado quando `hasPrevious` é `false` (1ª página).
 * - `next` fica desabilitado quando `hasNext` é `false` (última página).
 * - `isDisabled` (recarga em curso) desabilita ambos e o seletor.
 */
@Component({
  selector: 'ui-pagination-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="table-pagination" [attr.aria-label]="navigationLabel()">
      <label class="table-pagination__size">
        <span class="sr-only">Registros por página</span>
        <select
          class="table-pagination__size-select"
          data-testid="pagination-page-size"
          [disabled]="isDisabled()"
          [value]="pageSize()"
          (change)="aoTrocarTamanho($event)"
        >
          @for (opcao of pageSizeOptions(); track opcao) {
            <option [value]="opcao">{{ opcao }} por página</option>
          }
        </select>
      </label>

      <div class="table-pagination__nav">
        <button
          type="button"
          class="pager__btn"
          data-pager="prev"
          [disabled]="!hasPrevious() || isDisabled()"
          aria-label="Página anterior"
          (click)="previous.emit()"
        >
          <span aria-hidden="true">‹</span> Anterior
        </button>
        <span class="table-pagination__range" aria-live="polite" data-testid="pagination-range">
          {{ rangeLabel() }}
        </span>
        <button
          type="button"
          class="pager__btn"
          data-pager="next"
          [disabled]="!hasNext() || isDisabled()"
          aria-label="Próxima página"
          (click)="next.emit()"
        >
          Próximo <span aria-hidden="true">›</span>
        </button>
      </div>
    </nav>
  `,
})
export class PaginationFooterComponent {
  /** Tamanho de página vigente. Default {@link DEFAULT_PAGE_SIZE}. */
  readonly pageSize = input<number>(DEFAULT_PAGE_SIZE);
  /** Opções do seletor "N por página". Default {@link PAGE_SIZE_OPTIONS}. */
  readonly pageSizeOptions = input<readonly number[]>(PAGE_SIZE_OPTIONS);
  /** Página corrente, 1-based — contada no container pelos cliques de navegação. */
  readonly pageIndex = input<number>(1);
  /** Quantidade de linhas exibidas na página corrente (dados reais, sem mock). */
  readonly currentCount = input<number>(0);
  /** `true` quando existe cursor `rel="prev"` (não é a 1ª página). */
  readonly hasPrevious = input<boolean>(false);
  /** `true` quando existe cursor `rel="next"` (não é a última página). */
  readonly hasNext = input<boolean>(false);
  /** Recarga em curso — desabilita navegação e seletor. */
  readonly isDisabled = input<boolean>(false);
  readonly navigationLabel = input<string>('Paginação');

  readonly previous = output<void>();
  readonly next = output<void>();
  readonly pageSizeChange = output<number>();

  private readonly rangeStart = computed(() =>
    this.currentCount() === 0 ? 0 : (this.pageIndex() - 1) * this.pageSize() + 1,
  );
  private readonly rangeEnd = computed(
    () => (this.pageIndex() - 1) * this.pageSize() + this.currentCount(),
  );

  protected readonly rangeLabel = computed(() =>
    this.currentCount() === 0
      ? 'Nenhum registro'
      : `${this.rangeStart().toLocaleString('pt-BR')}–${this.rangeEnd().toLocaleString('pt-BR')}`,
  );

  protected aoTrocarTamanho(event: Event): void {
    const valor = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(valor) && valor > 0 && valor !== this.pageSize()) {
      this.pageSizeChange.emit(valor);
    }
  }
}
