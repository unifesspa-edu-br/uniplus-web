import { HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  ApiResult,
  Cursor,
  PaginationDirection,
  ProblemI18nService,
  cursorToString,
  extractNextCursor,
  extractPrevCursor,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  COMPOSICOES_VAGAS,
  CONFIGURACAO_BASE_PATH,
  ModalidadeDto,
  ModalidadesApi,
  NATUREZAS_LEGAIS,
  REGRAS_REMANEJAMENTO,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DialogComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiFilterChipOption,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026/0089). */
const PAGE_SIZE = 100;

/** Rótulo legível de um token de domínio fechado (fallback: o próprio token). */
function rotulo(roster: readonly { value: string; label: string }[], token: string | null): string {
  if (token === null) return '—';
  return roster.find((o) => o.value === token)?.label ?? token;
}

/** Variante visual da tag de Natureza legal. */
const NATUREZA_VARIANTE: Readonly<Record<string, UiTagVariant>> = {
  AMPLA: 'info',
  COTA_RESERVADA: 'success',
  SUPLEMENTAR: 'warning',
  OUTRA_MODALIDADE: 'neutral',
};

@Component({
  selector: 'cfg-modalidades-list-page',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    DialogComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Modalidade de concorrência</h1>
        <p class="page-header__desc">
          Formas de disputa de vagas de um processo — ampla concorrência e as cotas das ações
          afirmativas (Lei 12.711/2012, atualizada pela Lei 14.723/2023), com composição e cascata
          de remanejamento · UNI-REQ-0011.
        </p>
      </div>
    </div>

    <ui-alert variant="info" heading="Configuração viva — congelamento por snapshot" [dynamic]="false">
      Mudanças neste cadastro não afetam processos já publicados, que congelam os dados no momento
      da criação (RN08). Origem, destino, par e fallback referenciam outra modalidade pelo seu
      código.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar as modalidades">
        {{ errorMessage() }}
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

    <div data-scope class="cfg-modalidades-scope">
      <div class="filter-bar" role="search" aria-label="Filtrar modalidades">
        <div class="filter-bar__row">
          <div class="input-group">
            <span class="input-group__addon" aria-hidden="true"><i class="pi pi-search"></i></span>
            <input
              type="search"
              class="input"
              placeholder="Buscar por código ou descrição..."
              aria-label="Buscar por código ou descrição"
              [value]="busca()"
              (input)="busca.set(inputValue($event))"
            />
          </div>
          <button type="button" class="btn btn--tertiary btn--sm btn--rect" (click)="limparFiltros()">
            Limpar
          </button>
        </div>
        <div class="cfg-modalidades-filtro-grupo" role="group" aria-label="Filtrar por natureza legal">
          <span class="cfg-filtro-legenda">Natureza</span>
          <ui-filter-chips
            [options]="chipsNatureza()"
            [(selected)]="naturezaSelecionada"
            ariaLabel="Natureza legal"
          />
        </div>
      </div>

      <section class="panel" aria-labelledby="cfg-modalidades-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-modalidades-title">Modalidades</h2>
            <span class="list-count" aria-label="Total de modalidades exibidas">
              {{ modalidadesFiltradas().length }}
            </span>
            @if (loading()) {
              <span class="cfg-list__loading"><ui-spinner size="sm" /> Carregando</span>
            }
          </div>
          <a class="btn btn--primary" routerLink="novo">
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Nova modalidade
          </a>
        </div>

        @if (modalidadesFiltradas().length > 0) {
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Natureza</th>
                  <th scope="col">Composição de vagas</th>
                  <th scope="col">Remanejamento</th>
                  <th scope="col">Referenciada por</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                @for (m of modalidadesFiltradas(); track m.id) {
                  <tr [attr.data-codigo]="m.codigo">
                    <td data-label="Código">
                      <code>{{ m.codigo }}</code>
                      @if (m.descricao) {
                        <span class="cfg-meta">{{ m.descricao }}</span>
                      }
                    </td>
                    <td data-label="Natureza">
                      <ui-tag [variant]="naturezaVariante(m.naturezaLegal)">
                        {{ naturezaLabel(m.naturezaLegal) }}
                      </ui-tag>
                    </td>
                    <td data-label="Composição de vagas">
                      {{ composicaoLabel(m.composicaoVagas) }}
                      @if (m.composicaoOrigem) {
                        <span class="cfg-meta">de <code>{{ m.composicaoOrigem }}</code></span>
                      }
                    </td>
                    <td data-label="Remanejamento">{{ remanejamentoResumo(m) }}</td>
                    <td data-label="Referenciada por">
                      @if (referenciadaPor(m.codigo); as refs) {
                        @if (refs.length > 0) {
                          <span class="cfg-refs">
                            @for (r of refs; track r.id) {
                              <code class="cfg-ref-chip">{{ r.codigo }}</code>
                            }
                          </span>
                        } @else {
                          <span class="cfg-meta">Nenhuma</span>
                        }
                      }
                    </td>
                    <td data-label="Status"><span class="tag tag--success">Ativa</span></td>
                    <td class="table-responsive__actions" data-label="Ações">
                      <a
                        class="btn btn--tertiary btn--sm btn--rect"
                        [routerLink]="m.id"
                        [attr.aria-label]="'Editar modalidade ' + m.codigo"
                      >
                        Editar
                      </a>
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="loading()"
                        [attr.aria-label]="'Inativar modalidade ' + m.codigo"
                        (click)="pedirRemocao(m)"
                      >
                        Inativar
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (!loading() && !errorMessage()) {
          @if (temFiltroAtivo()) {
            <ui-empty-state
              heading="Nenhuma modalidade encontrada"
              description="Ajuste a busca ou os filtros de natureza para ver resultados."
            >
              <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
                Limpar filtros
              </button>
            </ui-empty-state>
          } @else {
            <ui-empty-state
              heading="Nenhuma modalidade cadastrada"
              description="Cadastre a primeira modalidade para configurar a disputa de vagas dos processos."
            >
              <a class="btn btn--primary" routerLink="novo">Nova modalidade</a>
            </ui-empty-state>
          }
        }

        @if (prevCursor() !== null || nextCursor() !== null) {
          <ui-pager
            statusText="Navegação por páginas"
            navigationLabel="Paginação de modalidades"
            [hasPrevious]="prevCursor() !== null"
            [hasNext]="nextCursor() !== null"
            [isDisabled]="loading()"
            (previous)="paginaAnterior()"
            (next)="proximaPagina()"
          />
        }
      </section>
    </div>

    <ui-dialog
      [(visible)]="dialogAberto"
      [heading]="remocaoBloqueada() ? 'Remoção bloqueada' : 'Inativar modalidade'"
      (closed)="aoFecharDialog()"
    >
      @if (modalidadeParaRemover(); as alvo) {
        @if (remocaoBloqueada()) {
          <ui-alert variant="warning" heading="Modalidade referenciada por outra viva" [dynamic]="false">
            @if (referenciadaPor(alvo.codigo).length > 0) {
              A modalidade <code>{{ alvo.codigo }}</code> não pode ser inativada porque é usada como
              origem, destino, par ou fallback das seguintes modalidades vivas:
              <ul class="cfg-refs-lista">
                @for (r of referenciadaPor(alvo.codigo); track r.id) {
                  <li><code>{{ r.codigo }}</code>@if (r.descricao) { — {{ r.descricao }} }</li>
                }
              </ul>
              Ajuste ou remova essas referências antes de inativar.
            } @else {
              {{ mensagemBloqueioServidor() ?? mensagemBloqueioPadrao }}
            }
          </ui-alert>
        } @else {
          <p>
            A modalidade <code>{{ alvo.codigo }}</code> é inativada (soft-delete) e mantida na trilha
            de auditoria. Cópias congeladas por snapshot em processos publicados não são afetadas
            (RN08). Confirma?
          </p>
        }
      }

      <div uiDialogFooter>
        @if (remocaoBloqueada()) {
          <button type="button" class="btn btn--primary btn--rect" (click)="dialogAberto.set(false)">
            Entendi
          </button>
        } @else {
          <button type="button" class="btn btn--tertiary btn--rect" (click)="dialogAberto.set(false)">
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn--danger btn--rect"
            [disabled]="removendo()"
            (click)="removerConfirmado()"
          >
            @if (removendo()) {
              <ui-spinner size="sm" />
            }
            {{ removendo() ? 'Inativando...' : 'Inativar' }}
          </button>
        }
      </div>
    </ui-dialog>
  `,
})
export class ModalidadesListPage {
  private readonly api = inject(ModalidadesApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly busca = signal('');
  protected readonly naturezaSelecionada = signal<string | null>(null);
  protected readonly dialogAberto = signal(false);
  protected readonly removendo = signal(false);
  protected readonly modalidadeParaRemover = signal<ModalidadeDto | null>(null);
  /** Bloqueio autoritativo do servidor (409) além do pré-cheque client-side. */
  protected readonly bloqueioServidor = signal(false);
  /** Mensagem do `ProblemDetails` do 409 — usada quando a referência viva não está na página carregada. */
  protected readonly mensagemBloqueioServidor = signal<string | null>(null);
  /** Fallback quando o servidor bloqueia sem título e o mapa reverso local está vazio. */
  protected readonly mensagemBloqueioPadrao =
    'Esta modalidade não pode ser inativada porque outra modalidade viva a referencia ' +
    '(possivelmente fora desta página). Ajuste ou remova essas referências antes de inativar.';

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly ModalidadeDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/modalidades`,
    params: this.montarParams(),
    context: withVendorMime('modalidade', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly ModalidadeDto[]> | undefined,
    { readonly prev: Cursor | null; readonly next: Cursor | null }
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? { prev: null, next: null };
      if (envelope === undefined) {
        return atual;
      }
      const primeiraPagina = untracked(() => this.pagina() === undefined);
      if (!envelope.ok) {
        return primeiraPagina ? { prev: null, next: null } : atual;
      }
      const link = untracked(() => this.lista.headers()?.get('Link') ?? null);
      return { prev: extractPrevCursor(link), next: extractNextCursor(link) };
    },
  });

  protected readonly prevCursor = computed(() => this.cursores().prev);
  protected readonly nextCursor = computed(() => this.cursores().next);

  protected readonly modalidades = linkedSignal<
    ApiResult<readonly ModalidadeDto[]> | undefined,
    readonly ModalidadeDto[]
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

  /**
   * Mapa reverso código → modalidades vivas que o referenciam (origem/destino/par/
   * fallback). Calculado sobre a página carregada — é uma DICA de UX (coluna
   * "Referenciada por" e pré-bloqueio de remoção); o backend é a fonte autoritativa
   * do bloqueio (409). Domínio pequeno e fechado: uma página cobre as vivas na prática.
   */
  private readonly referenciasReversas = computed(() => {
    const mapa = new Map<string, ModalidadeDto[]>();
    for (const m of this.modalidades()) {
      const alvos = [
        m.composicaoOrigem,
        m.remanejamentoDestino,
        m.remanejamentoPar,
        m.remanejamentoFallback,
      ];
      for (const alvo of alvos) {
        if (!alvo || alvo === m.codigo) continue;
        const lista = mapa.get(alvo) ?? [];
        if (!lista.some((x) => x.id === m.id)) lista.push(m);
        mapa.set(alvo, lista);
      }
    }
    return mapa;
  });

  protected readonly chipsNatureza = computed<readonly UiFilterChipOption[]>(() => {
    const todas = this.modalidades();
    return NATUREZAS_LEGAIS.map((n) => ({
      value: n.value,
      label: n.label,
      count: todas.filter((m) => m.naturezaLegal === n.value).length,
    }));
  });

  protected readonly modalidadesFiltradas = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    const natureza = this.naturezaSelecionada();
    return this.modalidades().filter((m) => {
      const casaBusca =
        termo.length === 0 ||
        m.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        (m.descricao ?? '').toLocaleLowerCase('pt-BR').includes(termo);
      const casaNatureza = natureza === null || m.naturezaLegal === natureza;
      return casaBusca && casaNatureza;
    });
  });

  protected readonly temFiltroAtivo = computed(
    () => this.busca().trim().length > 0 || this.naturezaSelecionada() !== null,
  );

  protected readonly remocaoBloqueada = computed(() => {
    if (this.bloqueioServidor()) return true;
    const alvo = this.modalidadeParaRemover();
    return alvo !== null && (this.referenciasReversas().get(alvo.codigo)?.length ?? 0) > 0;
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar modalidades.' : null;
  });

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  protected inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  protected naturezaLabel(token: string): string {
    return rotulo(NATUREZAS_LEGAIS, token);
  }

  protected naturezaVariante(token: string): UiTagVariant {
    return NATUREZA_VARIANTE[token] ?? 'neutral';
  }

  protected composicaoLabel(token: string): string {
    return rotulo(COMPOSICOES_VAGAS, token);
  }

  protected referenciadaPor(codigo: string): readonly ModalidadeDto[] {
    return this.referenciasReversas().get(codigo) ?? [];
  }

  protected remanejamentoResumo(m: ModalidadeDto): string {
    if (m.regraRemanejamento === null) return '—';
    const regra = rotulo(REGRAS_REMANEJAMENTO, m.regraRemanejamento);
    if (m.remanejamentoDestino) return `${regra} → ${m.remanejamentoDestino}`;
    if (m.remanejamentoPar || m.remanejamentoFallback) {
      return `${regra} (${m.remanejamentoPar ?? '—'} / ${m.remanejamentoFallback ?? '—'})`;
    }
    return regra;
  }

  protected proximaPagina(): void {
    const proximo = this.nextCursor();
    if (proximo !== null && !this.loading()) {
      this.pagina.set({ cursor: proximo, direction: 'next' });
    }
  }

  protected paginaAnterior(): void {
    const anterior = this.prevCursor();
    if (anterior !== null && !this.loading()) {
      this.pagina.set({ cursor: anterior, direction: 'prev' });
    }
  }

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.lista.reload();
    }
  }

  protected limparFiltros(): void {
    this.busca.set('');
    this.naturezaSelecionada.set(null);
  }

  protected pedirRemocao(m: ModalidadeDto): void {
    this.modalidadeParaRemover.set(m);
    this.bloqueioServidor.set(false);
    this.mensagemBloqueioServidor.set(null);
    this.dialogAberto.set(true);
  }

  protected aoFecharDialog(): void {
    this.modalidadeParaRemover.set(null);
    this.bloqueioServidor.set(false);
    this.mensagemBloqueioServidor.set(null);
  }

  protected removerConfirmado(): void {
    const alvo = this.modalidadeParaRemover();
    if (alvo === null || this.removendo() || this.remocaoBloqueada()) {
      return;
    }
    this.removendo.set(true);
    this.api
      .remover(alvo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.removendo.set(false);
        if (result.ok) {
          this.notifications.success('Modalidade inativada', alvo.codigo);
          this.dialogAberto.set(false);
          this.recarregar();
          return;
        }
        // 409 = bloqueio autoritativo do servidor (corrida ou referência fora da página):
        // mantém o diálogo em modo bloqueio e mostra a mensagem do servidor.
        if (result.problem.status === 409) {
          this.bloqueioServidor.set(true);
          this.mensagemBloqueioServidor.set(this.problemI18n.resolve(result.problem).title);
          this.recarregar();
          return;
        }
        this.notifications.errorFromProblem(result.problem, {
          title: this.problemI18n.resolve(result.problem).title,
        });
      });
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

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }
}
