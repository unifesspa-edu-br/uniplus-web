import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Cursor, ProblemI18nService, extractNextCursor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { EditaisApi, EditalDto } from '@uniplus/shared-data/selecao';
import {
  UiDataTableColumn,
  DataTableComponent,
  PageHeaderComponent,
} from '@uniplus/shared-ui/components';

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
  imports: [DataTableComponent, PageHeaderComponent, RouterLink],
  template: `
    <ui-page-header heading="Editais" description="Gestão de editais de processos seletivos.">
      <a uiPageActions routerLink="novo" class="btn"> Novo edital </a>
    </ui-page-header>

    <ui-data-table
      [columns]="colunas"
      [records]="rows()"
      [isLoading]="loading()"
      [errorMessage]="errorMessage()"
      [errorTraceId]="errorTraceId()"
      [nextCursor]="nextCursor()"
      [rowClickable]="true"
      pageStatusLabel="Lista paginada por cursor"
      emptyMessage="Nenhum edital cadastrado."
      (loadNext)="aoCarregarMais($event)"
      (rowClick)="aoSelecionar($event)"
      (retry)="aoTentarNovamente()"
    />
  `,
})
export class EditaisListPage {
  private readonly api = inject(EditaisApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly editais = signal<readonly EditalDto[]>([]);
  readonly nextCursor = signal<Cursor | null>(null);
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  /** Trace context da última falha — alimenta o link "Reportar incidente" do DataTable. */
  readonly errorTraceId = signal<string | null>(null);
  /** Cursor preservado da última falha pós-1ª página, para o retry retomar do mesmo ponto. */
  private cursorUltimaFalha: Cursor | undefined = undefined;

  protected readonly rows = computed(() => this.editais() as readonly Record<string, unknown>[]);

  protected readonly colunas: UiDataTableColumn[] = [
    { field: 'numeroEdital', header: 'Número', width: '12rem', primary: true },
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

  protected aoSelecionar(row: Record<string, unknown>): void {
    const id = row['id'];
    if (typeof id === 'string' && id.length > 0) {
      this.router.navigate(['/editais', id]);
    }
  }

  /**
   * Handler do output `retry` do `DataTableComponent`. Reusa o cursor
   * pré-falha (paginação) ou recomeça do zero (carga inicial). Sem
   * `cursorUltimaFalha`, equivale a retentar a 1ª página.
   */
  protected aoTentarNovamente(): void {
    this.carregar(this.cursorUltimaFalha);
  }

  private carregar(cursor: Cursor | undefined): void {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.errorTraceId.set(null);

    this.api
      .listar(cursor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.loading.set(false);
        if (result.ok) {
          this.editais.update((prev) => [...prev, ...result.data]);
          this.nextCursor.set(extractNextCursor(result.headers.get('Link')));
          this.cursorUltimaFalha = undefined;
          return;
        }
        const mensagem = this.problemI18n.resolve(result.problem).title;
        this.errorMessage.set(mensagem);
        this.errorTraceId.set(result.problem.traceId.length > 0 ? result.problem.traceId : null);
        // 5xx vira toast persistente em paralelo ao banner local — usuário
        // pode copiar o `traceId` para reportar incidente sem precisar
        // navegar até a tabela. 4xx mantém apenas o banner inline.
        if (result.problem.status >= 500) {
          this.notifications.errorFromProblem(result.problem, { title: mensagem });
        }
        // Em falha pós-1ª página, preserva o cursor original — usuário consegue
        // retentar via "Carregar mais" sem perder os items já carregados. Em
        // falha de carga inicial, o cursor já é null por construção.
        this.cursorUltimaFalha = cursor;
      });
  }
}
