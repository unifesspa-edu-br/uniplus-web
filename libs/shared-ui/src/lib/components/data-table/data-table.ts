import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import type { Cursor } from '@uniplus/shared-core';

export interface UiDataTableColumn {
  field: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'start' | 'end';
  primary?: boolean;
}

/**
 * Apresentacional (ADR-0017): tabela paginada por cursor opaco.
 *
 * Estados visuais:
 * - **Loading inicial** (`isLoading() && records().length === 0`): mensagem
 *   `loadingLabel()` ocupa o tbody. `<table aria-busy="true">` enquanto
 *   `isLoading()`, sinaliza estado para tecnologia assistiva (WCAG 2.1
 *   SC 4.1.3 Status Messages).
 * - **Erro inicial** (`errorMessage() !== null && records().length === 0`):
 *   `<td role="alert">` com mensagem + botão "Tentar novamente"
 *   (output `retry`) + link "Reportar incidente" exibindo o `traceId`
 *   quando provido (`errorTraceId()`).
 * - **Erro pós-1ª página** (`errorMessage() !== null && records().length > 0`):
 *   banner não-bloqueante abaixo da tabela com botão "Tentar novamente";
 *   preserva o histórico carregado.
 * - **Vazio** (`!isLoading() && !errorMessage() && records().length === 0`):
 *   mensagem `emptyMessage()` ocupa o tbody.
 * - **Com dados**: tabela renderizada normalmente; quando `nextCursor()`
 *   for truthy, exibe botão "Carregar mais" abaixo da tabela.
 *
 * Outputs:
 * - `loadNext` — emite o cursor atual quando "Carregar mais" é clicado.
 * - `retry` — emite quando "Tentar novamente" é clicado em qualquer
 *   estado de erro. Container decide se reusa cursor pré-falha ou
 *   recomeça do zero.
 * - `rowClick` — emite quando uma linha clicável é ativada.
 */
@Component({
  selector: 'ui-data-table',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-responsive">
      <table
        role="grid"
        [attr.aria-busy]="isLoading() ? 'true' : null"
      >
        <thead>
          <tr>
            @for (col of columns(); track col.field) {
              <th
                scope="col"
                [style.width]="col.width || 'auto'"
                [class.table-responsive__num]="col.align === 'end'"
              >
                {{ col.header }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (mostrarErroNoCorpo()) {
            <tr data-testid="data-table-error-row">
              <td
                [attr.colspan]="columns().length"
                data-label=""
                role="alert"
                data-testid="data-table-error-cell"
              >
                <div class="empty-state empty-state--error">
                  <div class="empty-state__icon" aria-hidden="true">!</div>
                  <p class="empty-state__title" data-testid="data-table-error-message">{{ errorMessage() }}</p>
                  <div class="page-header__actions">
                    <button
                      type="button"
                      class="btn btn--secondary btn--sm"
                      data-testid="data-table-retry"
                      (click)="emitirRetry()"
                    >
                      {{ retryLabel() }}
                    </button>
                    @if (mostrarReporteDeIncidente()) {
                      <span class="u-caption" data-testid="data-table-error-trace">
                        {{ reportIncidentLabel() }}
                        <code
                          class="ui-code"
                          data-testid="data-table-error-trace-id"
                        >{{ errorTraceId() }}</code>
                      </span>
                    }
                  </div>
                </div>
              </td>
            </tr>
          } @else if (mostrarLoadingInicial()) {
            <tr data-testid="data-table-loading-row">
              <td
                [attr.colspan]="columns().length"
                data-label=""
                aria-live="polite"
                data-testid="data-table-loading-cell"
              >
                <span class="spinner spinner--sm" aria-hidden="true"></span>
                <span class="u-body-sm">{{ loadingLabel() }}</span>
              </td>
            </tr>
          } @else {
            @for (row of records(); track row[trackByField()] ?? $index) {
              <tr
                data-testid="data-table-row"
                [class.table-responsive__row--clickable]="rowClickable()"
                [attr.tabindex]="rowClickable() ? 0 : null"
                (click)="ativarLinha(row)"
                (keydown.enter)="ativarLinha(row, $event)"
                (keydown.space)="ativarLinha(row, $event)"
              >
                @for (col of columns(); track col.field) {
                  <td
                    [attr.data-label]="col.header"
                    [class.table-responsive__num]="col.align === 'end'"
                    [class.table-responsive__primary]="col.primary"
                  >
                    {{ row[col.field] }}
                  </td>
                }
              </tr>
            } @empty {
              <tr data-testid="data-table-empty-row">
                <td
                  [attr.colspan]="columns().length"
                  data-label=""
                  data-testid="data-table-empty-cell"
                >
                  <div class="empty-state">
                    <p class="empty-state__title">{{ emptyMessage() }}</p>
                  </div>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    @if (mostrarBannerDeErro()) {
      <div
        class="alert alert--danger"
        role="alert"
        data-testid="data-table-error-banner"
      >
        <span class="alert__icon" aria-hidden="true">!</span>
        <div class="alert__body">
          <p class="alert__title" data-testid="data-table-error-banner-message">{{ errorMessage() }}</p>
          @if (mostrarReporteDeIncidente()) {
            <p class="alert__msg" data-testid="data-table-error-banner-trace">
              {{ reportIncidentLabel() }}
              <code
                class="ui-code"
                data-testid="data-table-error-banner-trace-id"
              >{{ errorTraceId() }}</code>
            </p>
          }
        </div>
        <button
          type="button"
          class="btn btn--secondary btn--sm"
          data-testid="data-table-retry-banner"
          (click)="emitirRetry()"
        >
          {{ retryLabel() }}
        </button>
      </div>
    }

    @if (mostrarBotaoCarregarMais()) {
      <nav class="pager" aria-label="Paginação">
        <span class="pager__status" aria-live="polite">{{ pageStatusLabel() }}</span>
        <button
          type="button"
          class="pager__btn"
          data-pager="next"
          data-testid="data-table-load-more"
          [disabled]="isLoading()"
          (click)="emitirLoadNext()"
        >
          {{ isLoading() ? loadingLabel() : loadMoreLabel() }}
        </button>
      </nav>
    }
  `,
  styles: `
    .table-responsive__row--clickable {
      cursor: pointer;
    }

    .table-responsive__row--clickable:hover {
      background: var(--surface-page);
    }

    .ui-code {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      background: var(--surface-subtle);
      color: var(--text-primary);
      border-radius: var(--radius-sm);
      padding: 0 var(--space-1);
      user-select: all;
    }
  `,
})
export class DataTableComponent {
  readonly columns = input.required<UiDataTableColumn[]>();
  readonly records = input<readonly Record<string, unknown>[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  /**
   * Trace context (W3C) opcional acompanhando o erro atual. Quando provido
   * (string não-vazia), o estado de erro renderiza o link "Reportar
   * incidente: <traceId>" para o usuário copiar e referenciar ao reportar
   * o problema. Em falhas client-side (`uniplus.client.*` codes) o trace
   * pode vir vazio — neste caso o link é suprimido.
   */
  readonly errorTraceId = input<string | null>(null);
  readonly nextCursor = input<Cursor | null>(null);
  readonly emptyMessage = input<string>('Nenhum registro encontrado.');
  readonly loadMoreLabel = input<string>('Carregar mais');
  readonly loadingLabel = input<string>('Carregando…');
  readonly retryLabel = input<string>('Tentar novamente');
  readonly reportIncidentLabel = input<string>('Reportar incidente:');
  readonly pageStatusLabel = input<string>('Paginação por cursor');
  /**
   * Campo do row usado pelo `track` do `@for`. Default `id` cobre todos os
   * DTOs do contrato V1 (UUID v7 estável). Para listas sem `id`, o consumer
   * pode trocar por outro campo único; ausência do campo cai em `$index`.
   */
  readonly trackByField = input<string>('id');

  readonly loadNext = output<Cursor>();
  readonly rowClick = output<Record<string, unknown>>();
  /**
   * Emitido quando o usuário clica em "Tentar novamente" em qualquer
   * estado de erro (corpo da tabela ou banner pós-1ª página). Container
   * decide a estratégia: refazer carga inicial, retentar com o mesmo
   * cursor pré-falha, etc.
   */
  readonly retry = output<void>();
  /** Quando true, linhas ganham hover/cursor/tabindex e respondem a click + Enter/Space. */
  readonly rowClickable = input<boolean>(false);

  /** Erro substitui o tbody apenas quando ainda não há dados carregados. */
  protected readonly mostrarErroNoCorpo = computed(
    () => this.errorMessage() !== null && this.records().length === 0,
  );
  /** Erro vira banner não-bloqueante quando já existem linhas — preserva
   *  o histórico carregado e permite retry via "Carregar mais". */
  protected readonly mostrarBannerDeErro = computed(
    () => this.errorMessage() !== null && this.records().length > 0,
  );
  protected readonly mostrarLoadingInicial = computed(
    () =>
      this.isLoading() && this.errorMessage() === null && this.records().length === 0,
  );
  /** Botão segue disponível mesmo em erro pós-1ª página, para permitir retry. */
  protected readonly mostrarBotaoCarregarMais = computed(
    () => this.nextCursor() !== null,
  );
  /** Renderiza link "Reportar incidente" apenas quando há trace context não-vazio. */
  protected readonly mostrarReporteDeIncidente = computed(() => {
    const traceId = this.errorTraceId();
    return typeof traceId === 'string' && traceId.length > 0;
  });

  protected emitirLoadNext(): void {
    const cursor = this.nextCursor();
    if (cursor !== null && !this.isLoading()) {
      this.loadNext.emit(cursor);
    }
  }

  protected emitirRetry(): void {
    this.retry.emit();
  }

  /**
   * Emite `rowClick` quando a linha é ativada via mouse ou teclado. Para
   * Enter/Space, cancela o default do browser — Space sem preventDefault
   * rola a página, e Enter pode submeter forms ancestrais.
   */
  protected ativarLinha(row: Record<string, unknown>, event?: Event): void {
    if (!this.rowClickable()) {
      return;
    }
    event?.preventDefault();
    this.rowClick.emit(row);
  }
}
