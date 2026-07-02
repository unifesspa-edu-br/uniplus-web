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
import {
  Cursor,
  PaginationDirection,
  ProblemI18nService,
  extractNextCursor,
  extractPrevCursor,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { EditaisApi, EditalDto } from '@uniplus/shared-data/selecao';
import {
  UiDataTableColumn,
  DataTableComponent,
  PageHeaderComponent,
} from '@uniplus/shared-ui/components';

/**
 * Container (ADR-0017) da feature Editais — lista paginada por cursor opaco
 * bidirecional (ADR-0089 do `uniplus-api`).
 *
 * Carga inicial dispara via constructor (1ª página, sem cursor/direção).
 * Navegação **Anterior / Próximo por substituição** via outputs `loadPrev`/
 * `loadNext` do `DataTableComponent`: cada página troca a anterior (sem
 * acumular). Erro 4xx/5xx é resolvido em mensagem pt-BR via
 * `ProblemI18nService.resolve(problem).title`.
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
      [prevCursor]="prevCursor()"
      [nextCursor]="nextCursor()"
      [rowClickable]="true"
      pageStatusLabel="Lista paginada por cursor"
      emptyMessage="Nenhum edital cadastrado."
      (loadPrev)="aoAnterior($event)"
      (loadNext)="aoProxima($event)"
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
  readonly prevCursor = signal<Cursor | null>(null);
  readonly nextCursor = signal<Cursor | null>(null);
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  /** Trace context da última falha — alimenta o link "Reportar incidente" do DataTable. */
  readonly errorTraceId = signal<string | null>(null);
  /**
   * Requisição preservada da última falha, para o retry refazer exatamente a
   * mesma navegação (1ª página, próximo ou anterior). Vazia em sucesso.
   */
  private ultimaRequisicao: { cursor?: Cursor; direction?: PaginationDirection } = {};

  protected readonly rows = computed(() => this.editais() as readonly Record<string, unknown>[]);

  protected readonly colunas: UiDataTableColumn[] = [
    { field: 'numeroEdital', header: 'Número', width: '12rem', primary: true },
    { field: 'titulo', header: 'Título' },
    { field: 'status', header: 'Status', width: '10rem' },
  ];

  constructor() {
    this.carregar(undefined, undefined);
  }

  protected aoProxima(cursor: Cursor): void {
    this.carregar(cursor, 'next');
  }

  protected aoAnterior(cursor: Cursor): void {
    this.carregar(cursor, 'prev');
  }

  protected aoSelecionar(row: Record<string, unknown>): void {
    const id = row['id'];
    if (typeof id === 'string' && id.length > 0) {
      this.router.navigate(['/editais', id]);
    }
  }

  /**
   * Handler do output `retry` do `DataTableComponent`. Refaz a navegação que
   * falhou (1ª página, próximo ou anterior); sem `ultimaRequisicao`, equivale
   * a recarregar a 1ª página.
   */
  protected aoTentarNovamente(): void {
    this.carregar(this.ultimaRequisicao.cursor, this.ultimaRequisicao.direction);
  }

  private carregar(cursor: Cursor | undefined, direction: PaginationDirection | undefined): void {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.errorTraceId.set(null);

    this.api
      .listar(cursor, direction)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.loading.set(false);
        if (result.ok) {
          // Substituição (ADR-0089): cada página troca a anterior — sem
          // acumular. Os cursores prev/next vêm do header Link da resposta.
          this.editais.set([...result.data]);
          const link = result.headers.get('Link');
          this.prevCursor.set(extractPrevCursor(link));
          this.nextCursor.set(extractNextCursor(link));
          this.ultimaRequisicao = {};
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
        // Falha de navegação preserva a página atual e seus cursores (o usuário
        // não perde o contexto); guarda a requisição para o retry refazê-la.
        this.ultimaRequisicao = { cursor, direction };
      });
  }
}
