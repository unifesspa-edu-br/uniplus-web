import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '@uniplus/shared-auth/bootstrap';

import {
  ApiResult,
  extractNextCursor,
  extractPrevCursor,
  ProblemI18nService,
  type Cursor,
} from '@uniplus/shared-core/http';

import {
  ProcessosSeletivosApi,
  type ProcessoSeletivoResumoDto,
} from '@uniplus/shared-data/selecao';

import {
  AlertComponent,
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';

const PAGE_SIZE = 50;

@Component({
  selector: 'sel-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    AlertComponent,
    EmptyStateComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.page.css',
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Processos Seletivos</h1>
        <p class="page-header__desc">Consulte e retome os processos seletivos cadastrados.</p>
      </div>

      @if (podeCadastrarProcesso()) {
        <a class="btn btn--primary" routerLink="/processo-seletivo/novo">
          <i class="pi pi-plus" aria-hidden="true"></i>
          Novo Processo
        </a>
      }
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os processos seletivos">
        {{ errorMessage() }}

        <div class="sel-dashboard__retry">
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

    <div class="kpis">
      <div class="kpi">
        <span class="kpi__label">Total de processos</span>
        <span class="kpi__num">{{ totalProcessos() }}</span>
        <span class="kpi__delta">Processos cadastrados</span>
      </div>

      <div class="kpi">
        <span class="kpi__label">Publicados</span>
        <span class="kpi__num">{{ processosPublicados() }}</span>
        <span class="kpi__delta">Processos publicados</span>
      </div>

      <div class="kpi">
        <span class="kpi__label">Em elaboração</span>
        <span class="kpi__num">{{ processosEmElaboracao() }}</span>
        <span class="kpi__delta">Processos em rascunho</span>
      </div>

      <div class="kpi">
        <span class="kpi__label">Encerrados</span>
        <span class="kpi__num">{{ processosEncerrados() }}</span>
        <span class="kpi__delta is-down">Processos encerrados</span>
      </div>
    </div>


    <section class="panel" aria-labelledby="sel-processos-seletivos-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="sel-processos-seletivos-title">Processos Seletivos</h2>

          <span class="list-count" aria-label="Total de processos seletivos exibidos">
            {{ processos().length }}
          </span>

          @if (loading()) {
            <span class="sel-dashboard__loading">
              <ui-spinner size="sm" />
              Carregando
            </span>
          }
        </div>
      </div>

      @if (processos().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Processo</th>
                <th scope="col">Tipo</th>
                <th scope="col">Status</th>
                <th scope="col">Data de criação</th>
                <th scope="col">
                  <span class="sr-only">Ações</span>
                </th>
              </tr>
            </thead>

            <tbody>
              @for (processo of processos(); track processo.id) {
                <tr>
                  <td data-label="Processo">
                    <div class="table-responsive__primary">
                      {{ processo.nome }}
                    </div>
                  </td>

                  <td data-label="Tipo">
                    <div class="table-responsive__primary">
                      {{ processo.tipoProcesso.nome }}
                    </div>

                    @if (processo.tipoProcesso.codigo) {
                      <div class="table-responsive__meta">
                        {{ processo.tipoProcesso.codigo }}
                      </div>
                    }
                  </td>

                  <td data-label="Status">
                    <ui-tag [variant]="statusVariante(processo.status)">
                      {{ statusLabel(processo.status) }}
                    </ui-tag>
                  </td>

                  <td data-label="Data de criação">
                    {{ processo.criadoEm | date: 'dd/MM/yyyy HH:mm' }}
                  </td>

                  <td class="table-responsive__actions" data-label="Ações">
                    <a
                      class="btn btn--tertiary btn--sm btn--rect"
                      [routerLink]="['/processo-seletivo', processo.id]"
                      [attr.aria-label]="'Abrir processo ' + processo.nome"
                    >
                      Abrir
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loading() && !errorMessage()) {
        <ui-empty-state
          heading="Nenhum processo seletivo cadastrado"
          description="Cadastre um processo seletivo para iniciar sua configuração."
        >
          @if (podeCadastrarProcesso()) {
            <a class="btn btn--primary" routerLink="/processo-seletivo/novo"> Novo Processo </a>
          }
        </ui-empty-state>
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de processos seletivos"
          [hasPrevious]="prevCursor() !== null"
          [hasNext]="nextCursor() !== null"
          [isDisabled]="loading()"
          (previous)="paginaAnterior()"
          (next)="proximaPagina()"
        />
      }
    </section>
  `,
  host: {
    class: 'cfg-page',
  },
})
export class DashboardPage {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly authService = inject(AuthService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly pagina = signal<
    | {
        readonly cursor: Cursor;
        readonly direction: 'next' | 'prev';
      }
    | undefined
  >(undefined);

  private readonly lista = signal<ApiResult<readonly ProcessoSeletivoResumoDto[]> | undefined>(
    undefined,
  );

  protected readonly loading = signal(false);

  private readonly cursores = signal<{
    readonly prev: Cursor | null;
    readonly next: Cursor | null;
  }>({
    prev: null,
    next: null,
  });

  protected readonly processos = computed(() => {
    const resultado = this.lista();

    if (!resultado?.ok) {
      return [];
    }

    return resultado.data;
  });

  protected readonly totalProcessos = computed(() => this.processos().length);

  protected readonly processosPublicados = computed(
    () => this.processos().filter((processo) => processo.status === 'PUBLICADO').length,
  );

  protected readonly processosEmElaboracao = computed(
    () =>
      this.processos().filter(
        (processo) => processo.status === 'RASCUNHO' || processo.status === 'EM_ELABORACAO',
      ).length,
  );

  protected readonly processosEncerrados = computed(
    () => this.processos().filter((processo) => processo.status === 'ENCERRADO').length,
  );

  /**
   * Processos publicados na página atual.
   */
  protected readonly prevCursor = computed(() => this.cursores().prev);

  protected readonly nextCursor = computed(() => this.cursores().next);

  protected readonly errorMessage = computed<string | null>(() => {
    const resultado = this.lista();

    if (resultado && !resultado.ok) {
      return this.problemI18n.resolve(resultado.problem).title;
    }

    return null;
  });

  protected readonly podeCadastrarProcesso = computed(() =>
    this.authService.roles().includes('plataforma-admin'),
  );

  constructor() {
    this.carregarPagina();
  }

  private carregarPagina(): void {
    const pagina = this.pagina();

    this.loading.set(true);

    this.api
      .listar({
        cursor: pagina?.cursor,
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
    const proximo = this.nextCursor();

    if (proximo !== null && !this.loading()) {
      this.pagina.set({
        cursor: proximo,
        direction: 'next',
      });

      this.carregarPagina();
    }
  }

  protected paginaAnterior(): void {
    const anterior = this.prevCursor();

    if (anterior !== null && !this.loading()) {
      this.pagina.set({
        cursor: anterior,
        direction: 'prev',
      });

      this.carregarPagina();
    }
  }

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.carregarPagina();
    }
  }

  protected statusLabel(status: string): string {
    switch (status) {
      case 'RASCUNHO':
        return 'Rascunho';

      case 'EM_ELABORACAO':
        return 'Em elaboração';

      case 'PUBLICADO':
        return 'Publicado';

      case 'ENCERRADO':
        return 'Encerrado';

      default:
        return status;
    }
  }

  protected statusVariante(status: string): UiTagVariant {
    switch (status) {
      case 'PUBLICADO':
        return 'success';

      case 'ENCERRADO':
        return 'neutral';

      case 'RASCUNHO':
      case 'EM_ELABORACAO':
        return 'warning';

      default:
        return 'neutral';
    }
  }
}
