import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import type { Cursor } from '@uniplus/shared-core';

export interface DataTableColumn {
  field: string;
  header: string;
  sortable?: boolean;
  width?: string;
}

/**
 * Apresentacional (ADR-0017): tabela paginada por cursor opaco.
 *
 * Estados visuais:
 * - **Loading inicial** (`loading() && data().length === 0`): mensagem
 *   `loadingLabel()` ocupa o tbody. `<table aria-busy="true">` enquanto
 *   `loading()`, sinaliza estado para tecnologia assistiva (WCAG 2.1
 *   SC 4.1.3 Status Messages).
 * - **Erro inicial** (`errorMessage() !== null && data().length === 0`):
 *   `<td role="alert">` com mensagem + botão "Tentar novamente"
 *   (output `retry`) + link "Reportar incidente" exibindo o `traceId`
 *   quando provido (`errorTraceId()`).
 * - **Erro pós-1ª página** (`errorMessage() !== null && data().length > 0`):
 *   banner não-bloqueante abaixo da tabela com botão "Tentar novamente";
 *   preserva o histórico carregado.
 * - **Vazio** (`!loading() && !errorMessage() && data().length === 0`):
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
    <div class="overflow-x-auto rounded-lg border border-gray-200">
      <table
        class="min-w-full divide-y divide-gray-200"
        role="grid"
        [attr.aria-busy]="loading() ? 'true' : null"
      >
        <thead class="bg-govbr-primary">
          <tr>
            @for (col of columns(); track col.field) {
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white"
                [style.width]="col.width || 'auto'"
              >
                {{ col.header }}
              </th>
            }
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          @if (mostrarErroNoCorpo()) {
            <tr data-testid="data-table-error-row">
              <td
                [attr.colspan]="columns().length"
                class="px-4 py-6 text-center"
                role="alert"
                data-testid="data-table-error-cell"
              >
                <div class="flex flex-col items-center gap-2">
                  <span class="text-sm font-semibold text-red-700" data-testid="data-table-error-message">{{
                    errorMessage()
                  }}</span>
                  <div class="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      class="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-govbr-primary"
                      data-testid="data-table-retry"
                      (click)="emitirRetry()"
                    >
                      {{ retryLabel() }}
                    </button>
                    @if (mostrarReporteDeIncidente()) {
                      <span class="text-xs text-red-700" data-testid="data-table-error-trace">
                        {{ reportIncidentLabel() }}
                        <code
                          class="ml-1 select-all rounded bg-red-100 px-1 py-0.5 font-mono text-[10px] text-red-900"
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
                class="px-4 py-8 text-center text-sm text-gray-500"
                aria-live="polite"
                data-testid="data-table-loading-cell"
              >
                {{ loadingLabel() }}
              </td>
            </tr>
          } @else {
            @for (row of data(); track row[trackByField()] ?? $index) {
              <tr
                class="transition-colors"
                data-testid="data-table-row"
                [class.hover:bg-gray-50]="rowClickable()"
                [class.cursor-pointer]="rowClickable()"
                [attr.role]="rowClickable() ? 'button' : null"
                [attr.tabindex]="rowClickable() ? 0 : null"
                (click)="ativarLinha(row)"
                (keydown.enter)="ativarLinha(row, $event)"
                (keydown.space)="ativarLinha(row, $event)"
              >
                @for (col of columns(); track col.field) {
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {{ row[col.field] }}
                  </td>
                }
              </tr>
            } @empty {
              <tr data-testid="data-table-empty-row">
                <td
                  [attr.colspan]="columns().length"
                  class="px-4 py-8 text-center text-sm text-gray-500"
                  data-testid="data-table-empty-cell"
                >
                  {{ emptyMessage() }}
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    @if (mostrarBannerDeErro()) {
      <div
        class="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
        data-testid="data-table-error-banner"
      >
        <div class="flex flex-col gap-1">
          <span class="font-semibold" data-testid="data-table-error-banner-message">{{ errorMessage() }}</span>
          @if (mostrarReporteDeIncidente()) {
            <span class="text-xs" data-testid="data-table-error-banner-trace">
              {{ reportIncidentLabel() }}
              <code
                class="ml-1 select-all rounded bg-red-100 px-1 py-0.5 font-mono text-[10px] text-red-900"
                data-testid="data-table-error-banner-trace-id"
              >{{ errorTraceId() }}</code>
            </span>
          }
        </div>
        <button
          type="button"
          class="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-govbr-primary"
          data-testid="data-table-retry-banner"
          (click)="emitirRetry()"
        >
          {{ retryLabel() }}
        </button>
      </div>
    }

    @if (mostrarBotaoCarregarMais()) {
      <div class="mt-3 flex justify-center">
        <button
          type="button"
          class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-govbr-primary disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="data-table-load-more"
          [disabled]="loading()"
          (click)="emitirLoadNext()"
        >
          {{ loading() ? loadingLabel() : loadMoreLabel() }}
        </button>
      </div>
    }
  `,
})
export class DataTableComponent {
  readonly columns = input.required<DataTableColumn[]>();
  readonly data = input<readonly Record<string, unknown>[]>([]);
  readonly loading = input<boolean>(false);
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
  /** Quando true, linhas ganham hover/cursor/role=button e respondem a click + Enter/Space. */
  readonly rowClickable = input<boolean>(false);

  /** Erro substitui o tbody apenas quando ainda não há dados carregados. */
  protected readonly mostrarErroNoCorpo = computed(
    () => this.errorMessage() !== null && this.data().length === 0,
  );
  /** Erro vira banner não-bloqueante quando já existem linhas — preserva
   *  o histórico carregado e permite retry via "Carregar mais". */
  protected readonly mostrarBannerDeErro = computed(
    () => this.errorMessage() !== null && this.data().length > 0,
  );
  protected readonly mostrarLoadingInicial = computed(
    () =>
      this.loading() && this.errorMessage() === null && this.data().length === 0,
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
    if (cursor !== null && !this.loading()) {
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
