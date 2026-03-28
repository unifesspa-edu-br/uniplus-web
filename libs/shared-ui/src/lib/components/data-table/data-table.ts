import { Component, ChangeDetectionStrategy, input } from '@angular/core';

export interface DataTableColumn {
  field: string;
  header: string;
  sortable?: boolean;
  width?: string;
}

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
          @for (row of data(); track $index) {
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
        </tbody>
      </table>
    </div>
  `,
})
export class DataTableComponent {
  readonly columns = input.required<DataTableColumn[]>();
  readonly data = input<Record<string, unknown>[]>([]);
  readonly emptyMessage = input<string>('Nenhum registro encontrado.');
}
