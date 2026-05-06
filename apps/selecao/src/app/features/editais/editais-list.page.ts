import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Cursor,
  ProblemI18nService,
  extractNextCursor,
} from '@uniplus/shared-core';
import { EditaisApi, EditalDto } from '@uniplus/shared-data';
import { DataTableColumn, DataTableComponent } from '@uniplus/shared-ui';

/**
 * Container (ADR-0017) da feature Editais — lista paginada por cursor opaco.
 *
 * Carga inicial dispara via constructor (1ª página, sem cursor). Paginação
 * incremental via output `loadNext` do `DataTableComponent`. Erro 4xx/5xx é
 * resolvido em mensagem pt-BR via `ProblemI18nService.resolve(problem).title`.
 */
@Component({
  selector: 'sel-editais-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent],
  template: `
    <header class="mb-5">
      <h2 class="text-2xl font-bold text-gray-800">Editais</h2>
      <p class="text-sm text-gray-600">Gestão de editais de processos seletivos.</p>
    </header>

    <ui-data-table
      [columns]="colunas"
      [data]="rows()"
      [loading]="loading()"
      [errorMessage]="errorMessage()"
      [nextCursor]="nextCursor()"
      emptyMessage="Nenhum edital cadastrado."
      (loadNext)="aoCarregarMais($event)"
    />
  `,
})
export class EditaisListPage {
  private readonly api = inject(EditaisApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly editais = signal<readonly EditalDto[]>([]);
  readonly nextCursor = signal<Cursor | null>(null);
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  protected readonly rows = computed(
    () => this.editais() as readonly Record<string, unknown>[],
  );

  protected readonly colunas: DataTableColumn[] = [
    { field: 'numeroEdital', header: 'Número', width: '12rem' },
    { field: 'titulo', header: 'Título' },
    { field: 'tipoProcesso', header: 'Tipo', width: '8rem' },
    { field: 'status', header: 'Status', width: '10rem' },
  ];

  constructor() {
    this.carregar(undefined);
  }

  protected aoCarregarMais(cursor: Cursor): void {
    this.carregar(cursor);
  }

  private carregar(cursor: Cursor | undefined): void {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api
      .listar(cursor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.loading.set(false);
        if (result.ok) {
          this.editais.update((prev) => [...prev, ...result.data]);
          this.nextCursor.set(extractNextCursor(result.headers.get('Link')));
          return;
        }
        this.errorMessage.set(this.problemI18n.resolve(result.problem).title);
        this.nextCursor.set(null);
      });
  }
}
