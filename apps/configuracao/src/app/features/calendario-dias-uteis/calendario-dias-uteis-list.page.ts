import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  ApiResult,
  Cursor,
  PaginationDirection,
  ProblemDetails,
  ProblemI18nService,
  cursorToString,
  extractNextCursor,
  extractPrevCursor,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CalendarioDiasUteisApi,
  CalendarioDiasUteisResumoDto,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DialogComponent,
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

@Component({
  selector: 'cfg-calendario-dias-uteis-list',
  imports: [
    AlertComponent,
    SpinnerComponent,
    EmptyStateComponent,
    RouterLink,
    DateBrPipe,
    DialogComponent,
    PagerComponent,
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Calendários</h1>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os calendários de dias úteis">
        {{ errorMessage() }}
        <div class="cfg-calendario-dias-uteis__retry">
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            [disabled]="loading()"
            (click)="tentarNovamente()"
          >
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    <section class="panel" aria-labelledby="cfg-calendario-dias-uteis-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-calendario-dias-uteis-list-title">Calendários</h2>
          @if (loading()) {
            <span class="cfg-cursos__loading"><ui-spinner size="sm" /> Carregando</span>
          }
          <span aria-label="Total de calendários carregados" class="list-count">
            {{ calendarios().length }}</span
          >
        </div>
        <a [routerLink]="['novo']" class="btn btn--primary">
          <i aria-hidden="true" class="pi pi-plus btn__icon"></i>
          Novo dataset
        </a>
      </div>

      @if (calendarios().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Versão</th>
                <th scope="col">Vigência</th>
                <th scope="col">Criado em</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (calendario of calendarios(); track calendario.id) {
                <tr>
                  <td data-label="Versão">{{ calendario.versaoDataset }}</td>
                  <td data-label="Vigência">
                    @if (calendario.vigente) {
                      <span class="tag tag--success">Vigente</span>
                    } @else {
                      —
                    }
                  </td>
                  <td data-label="Data de Criação">
                    {{ calendario.criadoEm | dateBr: 'short' }}
                  </td>
                  <td data-label="Ações" class="table-responsive__actions">
                    <a
                      class="btn btn--tertiary btn--sm btn--rect"
                      [attr.aria-label]="'Visualizar calendário ' + calendario.versaoDataset"
                      [routerLink]="[calendario.id]"
                    >
                      Visualizar calendário
                    </a>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [title]="calendario.vigente ? 'Marque outro dataset como vigente' : ''"
                      [disabled]="loading() || saving() || calendario.vigente"
                      [attr.aria-label]="'Marcar vigente ' + calendario.versaoDataset"
                      (click)="solicitarVigenteConfirmado(calendario)"
                    >
                      Marcar vigente
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [title]="
                        calendario.vigente
                          ? 'Marque outro dataset como vigente antes de remover este'
                          : ''
                      "
                      [disabled]="loading() || saving() || calendario.vigente"
                      [attr.aria-label]="'Remover calendário ' + calendario.versaoDataset"
                      (click)="abrirRemoverCalendario(calendario)"
                    >
                      Remover calendário
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loading() && !errorMessage()) {
        <ui-empty-state
          heading="Nenhum calendário encontrado"
          description="Cadastre o primeiro calendário de dias úteis."
        >
          <a [routerLink]="['/calendario-dias-uteis/novo']" class="btn btn--primary">
            <i aria-hidden="true" class="pi pi-plus btn__icon"></i>
            Novo dataset
          </a>
        </ui-empty-state>
      }
      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de calendários de dias úteis"
          [hasPrevious]="prevCursor() !== null"
          [hasNext]="nextCursor() !== null"
          [isDisabled]="loading() || saving()"
          (previous)="paginaAnterior()"
          (next)="proximaPagina()"
        />
      }
    </section>
    <ui-dialog
      [(visible)]="confirmOpen"
      heading="Remover calendário?"
      (closed)="confirmOpen.set(false)"
    >
      <p>
        Você está prestes a remover o calendário
        <strong>{{ calendarioParaRemover()?.versaoDataset }}.</strong>
        Tem certeza que deseja remover o calendário atual?
      </p>
      <div uiDialogFooter>
        <button type="button" class="btn btn--tertiary" (click)="confirmOpen.set(false)">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn--danger"
          [disabled]="saving()"
          (click)="removerConfirmado()"
        >
          Confirmar remoção
        </button>
      </div>
    </ui-dialog>
  `,
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisListPage {
  private readonly api = inject(CalendarioDiasUteisApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);
  private readonly lista = signal<ApiResult<readonly CalendarioDiasUteisResumoDto[]> | undefined>(
    undefined,
  );
  private readonly cursores = signal<{
    readonly prev: Cursor | null;
    readonly next: Cursor | null;
  }>({ prev: null, next: null });
  protected readonly loading = signal(false);
  protected readonly calendarios = computed(() => {
    const resultado = this.lista();
    return resultado?.ok ? resultado.data : [];
  });
  protected readonly prevCursor = computed(() => this.cursores().prev);
  protected readonly nextCursor = computed(() => this.cursores().next);
  protected readonly errorMessage = computed<string | null>(() => {
    const resultado = this.lista();
    return resultado && !resultado.ok ? this.problemI18n.resolve(resultado.problem).title : null;
  });

  readonly calendarioParaRemover = signal<CalendarioDiasUteisResumoDto | null>(null);
  readonly confirmOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  constructor() {
    this.carregarPagina();
  }

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.carregarPagina();
    }
  }

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.carregarPagina();
    } else {
      this.pagina.set(undefined);
      this.carregarPagina();
    }
  }

  private carregarPagina(): void {
    const pagina = this.pagina();
    this.loading.set(true);
    this.api
      .listar({
        cursor: pagina ? cursorToString(pagina.cursor) : undefined,
        direction: pagina?.direction,
        limit: PAGE_SIZE,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.loading.set(false);
        this.lista.set(result);
        if (!result.ok) {
          return;
        }
        const link = result.headers?.get('Link') ?? null;
        this.cursores.set({
          prev: extractPrevCursor(link),
          next: extractNextCursor(link),
        });
      });
  }

  protected proximaPagina(): void {
    const cursor = this.nextCursor();
    if (cursor !== null && !this.loading()) {
      this.pagina.set({ cursor, direction: 'next' });
      this.carregarPagina();
    }
  }

  protected paginaAnterior(): void {
    const cursor = this.prevCursor();
    if (cursor !== null && !this.loading()) {
      this.pagina.set({ cursor, direction: 'prev' });
      this.carregarPagina();
    }
  }

  solicitarVigenteConfirmado(calendario: CalendarioDiasUteisResumoDto): void {
    if (this.loading() || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .marcarVigente(calendario.id, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        this.renovarIdempotencyKey();
        if (result.ok) {
          this.notifications.success('Vigência de calendário atualizada');
          this.recarregar();
          return;
        }
        this.aplicarFalha(result.problem);
      });
  }

  abrirRemoverCalendario(calendario: CalendarioDiasUteisResumoDto): void {
    this.calendarioParaRemover.set(calendario);
    this.confirmOpen.set(true);
  }

  removerConfirmado(): void {
    const calendario = this.calendarioParaRemover();
    if (calendario === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(calendario.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleRemoverResult(result));
  }

  private handleRemoverResult(result: ApiResult<void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success('Calendário removido');
      this.confirmOpen.set(false);
      this.calendarioParaRemover.set(null);
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarFalha(problem: ProblemDetails): void {
    this.notifications.errorFromProblem(problem);
  }
}
