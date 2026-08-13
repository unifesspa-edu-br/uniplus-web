import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  ApiResult,
  Cursor,
  PaginationDirection,
  ProblemI18nService,
  cursorToString,
  extractNextCursor,
  extractPrevCursor,
} from '@uniplus/shared-core/http';

import {
  FORMAS_ACEITE,
  TermoConsentimentoResumoDto,
  TermosConsentimentoApi,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';

import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
/** Tamanho da janela de cada página (cursor pagination, ADR-0026/0089). */
const PAGE_SIZE = 50;

/** Rótulo legível de um token de domínio fechado (fallback: o próprio token). */
function rotulo(roster: readonly { value: string; label: string }[], token: string): string {
  return roster.find((o) => o.value === token)?.label ?? token;
}

/** Variante visual da tag de Forma de aceite. */
const FORMA_ACEITE_VARIANTE: Readonly<Record<string, UiTagVariant>> = {
  A_DEFINIR: 'neutral',
  REGISTRO_DIGITAL_SEM_LOG_IP: 'info',
  REGISTRO_DIGITAL_COM_LOG_IP: 'success',
};

@Component({
  selector: 'cfg-termos-consentimento-list-page',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    EmptyStateComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Termo de Consentimento</h1>
        <p class="page-header__desc">
          Catálogo administrável de termos de consentimento/declaração (declaração de veracidade,
          consentimento LGPD, declaração de residência para cota territorial) que um Processo
          Seletivo pode vir a exigir do candidato — o texto de um termo nunca é digitado livre no
          processo, sempre vem deste cadastro.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os termos de consentimento">
        {{ errorMessage() }}
        <div class="cfg-termos-consentimento__retry">
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

    <div class="filter-bar" role="search" aria-label="Filtrar termos de consentimento">
      <div class="filter-bar__row">
        <div class="input-group">
          <span class="input-group__addon" aria-hidden="true"><i class="pi pi-search"></i></span>
          <input
            type="search"
            class="input"
            placeholder="Buscar por nome..."
            aria-label="Buscar por nome"
            maxlength="200"
            [value]="busca()"
            (input)="alterarBusca(inputValue($event))"
          />
        </div>
        <button type="button" class="btn btn--tertiary btn--sm btn--rect" (click)="limparFiltros()">
          Limpar
        </button>
      </div>
    </div>

    <section class="panel" aria-labelledby="cfg-termos-consentimento-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-termos-consentimento-title">Termos de consentimento</h2>
          <span class="list-count" aria-label="Total de termos de consentimento exibidos">
            {{ termosFiltrados().length }}
          </span>
          @if (loading()) {
            <span class="cfg-termos-consentimento__loading"
              ><ui-spinner size="sm" /> Carregando</span
            >
          }
        </div>
        <a class="btn btn--primary" routerLink="novo">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo termo
        </a>
      </div>

      @if (termosFiltrados().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Forma de aceite</th>
                <th scope="col">Status de revisão</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (t of termosFiltrados(); track t.id) {
                <tr>
                  <td data-label="Nome">
                    <div class="table-responsive__primary">{{ t.nome }}</div>
                  </td>
                  <td data-label="Forma de aceite">
                    <ui-tag [variant]="formaAceiteVariante(t.formaAceiteRascunho)">
                      {{ formaAceiteLabel(t.formaAceiteRascunho) }}
                    </ui-tag>
                  </td>
                  <td data-label="Status de revisão">
                    <ui-tag [variant]="t.revisado ? 'success' : 'warning'">
                      {{ t.revisado ? 'Revisado' : 'Em elaboração' }}
                    </ui-tag>
                  </td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <a
                      class="btn btn--tertiary btn--sm btn--rect"
                      [routerLink]="t.id"
                      [attr.aria-label]="'Abrir termo ' + t.nome"
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
        @if (temFiltroAtivo()) {
          <ui-empty-state
            heading="Nenhum termo encontrado"
            description="Ajuste a busca por nome para ver resultados."
          >
            <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
              Limpar filtros
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhum termo de consentimento cadastrado"
            description="Cadastre o primeiro termo para disponibilizá-lo ao catálogo institucional."
          >
            <a class="btn btn--primary" routerLink="novo">Novo termo</a>
          </ui-empty-state>
        }
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de termos de consentimento"
          [hasPrevious]="prevCursor() !== null"
          [hasNext]="nextCursor() !== null"
          [isDisabled]="loading()"
          (previous)="paginaAnterior()"
          (next)="proximaPagina()"
        />
      }
    </section>
  `,
  host: { class: 'cfg-page' },
})
export class TermosConsentimentoListPage {
  private readonly api = inject(TermosConsentimentoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private requisicaoAtual = 0;

  protected readonly busca = signal('');
  protected alterarBusca(valor: string): void {
    this.busca.set(valor);
    this.buscaAlterada$.next(valor);
  }

  private readonly filtroAplicado = signal('');
  private readonly buscaAlterada$ = new Subject<string>();
  private aplicarNovoFiltro(filtro: string): void {
    this.filtroAplicado.set(filtro);
    this.pagina.set(undefined);
    this.lista.set(undefined);
    this.cursores.set({ prev: null, next: null });

    this.carregarPagina();
  }

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = signal<ApiResult<readonly TermoConsentimentoResumoDto[]> | undefined>(
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

  protected readonly prevCursor = computed(() => this.cursores().prev);
  protected readonly nextCursor = computed(() => this.cursores().next);

  protected readonly termos = computed(() => {
    const resultado = this.lista();

    if (!resultado?.ok) {
      return [];
    }

    return resultado.data;
  });

  protected readonly termosFiltrados = computed(() => this.termos());

  protected readonly temFiltroAtivo = computed(() => this.filtroAplicado().length > 0);

  protected readonly errorMessage = computed<string | null>(() => {
    const resultado = this.lista();

    if (resultado && !resultado.ok) {
      return this.problemI18n.resolve(resultado.problem).title;
    }

    return null;
  });

  constructor() {
    this.carregarPagina();

    this.buscaAlterada$
      .pipe(
        map((valor) => valor.trim()),
        distinctUntilChanged(),
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filtro) => {
        if (filtro !== this.busca().trim()) {
          return;
        }

        if (filtro === this.filtroAplicado() && this.pagina() === undefined) {
          return;
        }

        this.aplicarNovoFiltro(filtro);
      });
  }

  private carregarPagina(): void {
    const requisicao = ++this.requisicaoAtual;
    const pagina = this.pagina();
    const q = this.filtroAplicado();

    this.loading.set(true);

    this.api
      .listar({
        cursor: pagina ? cursorToString(pagina.cursor) : undefined,
        direction: pagina?.direction,
        limit: PAGE_SIZE,
        q: q.length > 0 ? q : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))

      .subscribe((result) => {
        if (requisicao !== this.requisicaoAtual) {
          return;
        }

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

  protected inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  protected formaAceiteLabel(token: string): string {
    return rotulo(FORMAS_ACEITE, token);
  }

  protected formaAceiteVariante(token: string): UiTagVariant {
    return FORMA_ACEITE_VARIANTE[token] ?? 'neutral';
  }

  protected limparFiltros(): void {
    if (!this.busca() && !this.filtroAplicado()) {
      return;
    }
    this.busca.set('');
    this.buscaAlterada$.next('');
    this.aplicarNovoFiltro('');
  }
}
