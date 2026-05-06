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
 * - **Loading inicial** (`loading() && data().length === 0`): mensagem de
 *   carregamento ocupa o tbody.
 * - **Erro** (`errorMessage() !== null`): banner role=alert ocupa o tbody.
 *   Render preserva tabela vazia para manter altura previsível.
 * - **Vazio** (`!loading() && !errorMessage() && data().length === 0`):
 *   mensagem `emptyMessage()` ocupa o tbody.
 * - **Com dados**: tabela renderizada normalmente; quando `nextCursor()` for
 *   truthy, exibe botão "Carregar mais" abaixo da tabela.
 *
 * Output `loadNext` emite o cursor atual (não-null) quando o usuário clica em
 * "Carregar mais". O container resolve o `loading` durante a próxima request
 * — o botão fica disabled enquanto `loading()`.
 */
@Component({
  selector: 'ui-data-table',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto rounded-lg border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200" role="grid">
        <thead class="bg-unifesspa-primary">
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
            <tr>
              <td
                [attr.colspan]="columns().length"
                class="px-4 py-6 text-center"
                role="alert"
              >
                <span class="text-sm font-semibold text-red-700">{{ errorMessage() }}</span>
              </td>
            </tr>
          } @else if (mostrarLoadingInicial()) {
            <tr>
              <td
                [attr.colspan]="columns().length"
                class="px-4 py-8 text-center text-sm text-gray-500"
                aria-live="polite"
              >
                {{ loadingLabel() }}
              </td>
            </tr>
          } @else {
            @for (row of data(); track row[trackByField()] ?? $index) {
              <tr class="hover:bg-gray-50 transition-colors">
                @for (col of columns(); track col.field) {
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {{ row[col.field] }}
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="columns().length" class="px-4 py-8 text-center text-sm text-gray-500">
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
        class="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        <span class="font-semibold">{{ errorMessage() }}</span>
      </div>
    }

    @if (mostrarBotaoCarregarMais()) {
      <div class="mt-3 flex justify-center">
        <button
          type="button"
          class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-unifesspa-primary disabled:cursor-not-allowed disabled:opacity-60"
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
  readonly nextCursor = input<Cursor | null>(null);
  readonly emptyMessage = input<string>('Nenhum registro encontrado.');
  readonly loadMoreLabel = input<string>('Carregar mais');
  readonly loadingLabel = input<string>('Carregando…');
  /**
   * Campo do row usado pelo `track` do `@for`. Default `id` cobre todos os
   * DTOs do contrato V1 (UUID v7 estável). Para listas sem `id`, o consumer
   * pode trocar por outro campo único; ausência do campo cai em `$index`.
   */
  readonly trackByField = input<string>('id');

  readonly loadNext = output<Cursor>();

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

  protected emitirLoadNext(): void {
    const cursor = this.nextCursor();
    if (cursor !== null && !this.loading()) {
      this.loadNext.emit(cursor);
    }
  }
}
