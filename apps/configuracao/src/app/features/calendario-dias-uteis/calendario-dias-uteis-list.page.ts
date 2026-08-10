import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import {
  ApiResult,
  Cursor,
  cursorToString,
  idempotencyKey,
  NotificationService,
  PaginationDirection, ProblemDetails,
  ProblemI18nService,
  useApiResource, withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data';
import {
  CalendarioDiasUteisApi,
  CalendarioDiasUteisDto
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DateBrPipe, DialogComponent,
  EmptyStateComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui';
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
                      aria-label="Visualizar calendário"
                      [routerLink]="[calendario.id]"
                    >
                      Ver detalhe
                    </a>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [title]="calendario.vigente ? 'Marque outro dataset como vigente' : ''"
                      [disabled]="loading() || calendario.vigente"
                      [attr.aria-label]="'Marcar vigente'"
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
                      [disabled]="loading() || calendario.vigente"
                      [attr.aria-label]="'Remover o calendário'"
                      (click)="abrirRemoverCalendario(calendario)"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
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
        <button type="button" class="btn btn--danger" (click)="removerConfirmado()">
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
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar calendários.' : null;
  });

  private readonly lista = useApiResource<readonly CalendarioDiasUteisDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/calendarios-dias-uteis`,
    params: this.montarParams(),
    context: withVendorMime('calendario-dias-uteis', 1),
  }));

  protected readonly loading = this.lista.isLoading;
  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  protected readonly calendarios = linkedSignal<
    ApiResult<readonly CalendarioDiasUteisDto[]> | undefined,
    readonly CalendarioDiasUteisDto[]
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? [];
      if (envelope === undefined) {
        return atual;
      }
      const primeiraPagina = untracked(() => this.pagina() === undefined);
      if (!envelope.ok) {
        return primeiraPagina ? [] : atual;
      }
      return [...envelope.data];
    },
  });

  readonly calendarioParaRemover = signal<CalendarioDiasUteisDto | null>(null);
  readonly confirmOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.lista.reload();
    }
  }

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private montarParams(): HttpParams {
    const pagina = this.pagina();
    if (pagina === undefined) {
      return new HttpParams().set('limit', String(PAGE_SIZE));
    }
    return new HttpParams()
      .set('cursor', cursorToString(pagina.cursor))
      .set('direction', pagina.direction);
  }

  solicitarVigenteConfirmado(calendario: CalendarioDiasUteisDto): void {
    if (this.loading() || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .criarVigente(calendario.id, calendario, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result.ok) {
          this.notifications.success('Vigência de calendário atualizada');
          this.recarregar();
          return;
        }
        this.aplicarFalha(result.problem);
      });
  }

  abrirRemoverCalendario(calendario: CalendarioDiasUteisDto): void {
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
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      return;
    }
  }
}
