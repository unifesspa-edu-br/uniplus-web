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
  ProblemI18nService,
  extractNextCursor,
  extractPrevCursor,
  type Cursor,
  type PaginationDirection,
} from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi, ProcessoSeletivoResumoDto } from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

/** Janela da primeira página; a navegação segue o cursor, que já a carrega. */
const PAGE_SIZE = 50;

/**
 * Ciclo de vida do certame como a API o projeta: `StatusProcesso.ToString()`,
 * em PascalCase. Um token fora deste conjunto é exibido cru, para que um
 * status introduzido por um backend mais novo apareça ao operador em vez de
 * sumir atrás de um rótulo genérico.
 *
 * `Map` e não objeto literal: a chave vem do servidor, e num objeto literal
 * um token como `constructor` ou `toString` resolveria para o membro herdado
 * de `Object.prototype` — uma função, que o `??` não trata como ausência.
 */
const STATUS_LABEL = new Map<string, string>([
  ['Rascunho', 'Rascunho'],
  ['Publicado', 'Publicado'],
  ['Encerrado', 'Encerrado'],
  ['Cancelado', 'Cancelado'],
]);

const STATUS_VARIANTE = new Map<string, UiTagVariant>([
  ['Rascunho', 'warning'],
  ['Publicado', 'success'],
  ['Encerrado', 'neutral'],
  ['Cancelado', 'danger'],
]);

/**
 * Listagem administrativa dos Processos Seletivos (Story #478, CA-01).
 *
 * A leitura passa pelo client tipado `ProcessosSeletivosApi` — a página não
 * monta URL nem injeta `HttpClient` (ADR-0017, coberto pelo fitness test
 * `no-direct-http-in-pages`). A navegação é Anterior/Próximo por cursor opaco
 * do header `Link`, com as invariantes de erro da ADR-0026.
 *
 * Só apresenta o que `ProcessoSeletivoResumoDto` devolve. Inscritos, prazo e
 * progresso por dimensão não têm endpoint e por isso não aparecem — nem como
 * total agregado, que exigiria varrer a coleção inteira a cada abertura.
 */
@Component({
  selector: 'sel-processos-seletivos-lista',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    AlertComponent,
    EmptyStateComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './processos-seletivos-lista.page.css',
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Processos Seletivos</h1>
        <p class="page-header__desc">Processos seletivos cadastrados no sistema.</p>
      </div>

      @if (podeCadastrarProcesso()) {
        <a class="btn btn--primary" routerLink="/processo-seletivo/novo">
          <i class="pi pi-plus" aria-hidden="true"></i>
          Novo Processo
        </a>
      }
    </div>

    @if (erro()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os processos seletivos">
        {{ erro() }}

        <div class="cfg-list__retry">
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

    <section class="panel" aria-labelledby="sel-processos-seletivos-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="sel-processos-seletivos-title">Processos Seletivos</h2>

          <span class="list-count" aria-label="Processos seletivos nesta página">
            {{ processos().length }}
          </span>

          @if (loading()) {
            <span class="cfg-list__loading">
              <ui-spinner spinnerSize="sm" />
              Carregando
            </span>
          }
        </div>
      </div>

      <div [attr.aria-busy]="loading() ? 'true' : null">
        @if (processos().length > 0) {
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th scope="col">Processo</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Status</th>
                  <th scope="col">Data de criação</th>
                  <th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>

              <tbody>
                @for (processo of processos(); track processo.id) {
                  <tr>
                    <td data-label="Processo">
                      <div class="table-responsive__primary">{{ processo.nome }}</div>
                    </td>

                    <td data-label="Tipo">
                      <div class="table-responsive__primary">{{ processo.tipoProcesso.nome }}</div>

                      @if (processo.tipoProcesso.codigo) {
                        <div class="table-responsive__meta">{{ processo.tipoProcesso.codigo }}</div>
                      }
                    </td>

                    <td data-label="Status">
                      <ui-tag [variant]="statusVariante(processo.status)">
                        {{ statusLabel(processo.status) }}
                      </ui-tag>
                    </td>

                    <td data-label="Data de criação">
                      {{ processo.criadoEm | dateBr: 'datetime' }}
                    </td>

                    <td class="table-responsive__actions" data-label="Ações">
                      <a
                        class="btn btn--tertiary btn--sm btn--rect"
                        [routerLink]="['/processo-seletivo', processo.id]"
                        [attr.aria-label]="'Abrir ' + processo.nome"
                      >
                        Abrir
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (!loading() && !erro()) {
          <ui-empty-state
            heading="Nenhum processo seletivo cadastrado"
            description="Cadastre um processo seletivo para iniciar sua configuração."
          >
            @if (podeCadastrarProcesso()) {
              <a class="btn btn--primary" routerLink="/processo-seletivo/novo">Novo Processo</a>
            }
          </ui-empty-state>
        }
      </div>

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
export class ProcessosSeletivosListaPage {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly authService = inject(AuthService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** `undefined` é a primeira página — sem cursor e sem `direction`. */
  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly itens = signal<readonly ProcessoSeletivoResumoDto[]>([]);
  private readonly cursores = signal<{
    readonly prev: Cursor | null;
    readonly next: Cursor | null;
  }>({ prev: null, next: null });

  protected readonly loading = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly processos = this.itens.asReadonly();
  protected readonly prevCursor = computed(() => this.cursores().prev);
  protected readonly nextCursor = computed(() => this.cursores().next);

  /**
   * O atalho só aparece para quem a rota admite — sem isso, um gestor clicaria
   * em "Novo Processo" para cair em `/acesso-negado`.
   */
  protected readonly podeCadastrarProcesso = computed(() =>
    this.authService.roles().includes('plataforma-admin'),
  );

  constructor() {
    this.carregarPagina();
  }

  private carregarPagina(): void {
    const pagina = this.pagina();
    const primeiraPagina = pagina === undefined;

    this.loading.set(true);

    this.api
      .listar({ cursor: pagina?.cursor, direction: pagina?.direction, limit: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.loading.set(false);

        if (!resultado.ok) {
          this.erro.set(this.problemI18n.resolve(resultado.problem).title);
          // ADR-0026: falha na primeira página limpa a lista, porque o que
          // estava em tela pode não valer mais; falha de navegação preserva a
          // página atual e os cursores, para o pager não sumir sob o operador.
          if (primeiraPagina) {
            this.itens.set([]);
            this.cursores.set({ prev: null, next: null });
          }
          return;
        }

        this.erro.set(null);
        this.itens.set(resultado.data);

        const link = resultado.headers?.get('Link') ?? null;
        this.cursores.set({ prev: extractPrevCursor(link), next: extractNextCursor(link) });
      });
  }

  protected proximaPagina(): void {
    const proximo = this.nextCursor();

    if (proximo !== null && !this.loading()) {
      this.pagina.set({ cursor: proximo, direction: 'next' });
      this.carregarPagina();
    }
  }

  protected paginaAnterior(): void {
    const anterior = this.prevCursor();

    if (anterior !== null && !this.loading()) {
      this.pagina.set({ cursor: anterior, direction: 'prev' });
      this.carregarPagina();
    }
  }

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.carregarPagina();
    }
  }

  protected statusLabel(status: string): string {
    return STATUS_LABEL.get(status) ?? status;
  }

  protected statusVariante(status: string): UiTagVariant {
    return STATUS_VARIANTE.get(status) ?? 'neutral';
  }
}
