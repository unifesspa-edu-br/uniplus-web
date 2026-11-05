import { HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  TermoConsentimentoResumoDto,
} from '@uniplus/shared-data/configuracao';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

@Injectable()
export class TermosConsentimentoStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  readonly busca = signal('');
  private readonly filtro = signal('');
  private readonly buscaAlterada = new Subject<string>();
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: this.filtro,
    computation: () => undefined,
  });
  private readonly lista = useApiResource<readonly TermoConsentimentoResumoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/termos-consentimento`,
    params: this.montarParams(),
    context: withVendorMime('termo-consentimento', 1),
  }));
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);
  readonly loading = this.lista.isLoading;
  readonly termos = this.navegacao.itens;
  readonly prevCursor = this.navegacao.anterior;
  readonly nextCursor = this.navegacao.proximo;
  readonly temFiltroAtivo = computed(() => this.filtro().length > 0);
  readonly errorMessage = computed(() => {
    const problem = this.lista.problem();
    return problem
      ? this.problemI18n.resolve(problem).title
      : this.lista.error()
        ? 'Erro inesperado ao carregar os termos.'
        : null;
  });
  constructor() {
    this.buscaAlterada
      .pipe(
        map((valor) => valor.trim()),
        distinctUntilChanged(),
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filtro) => {
        if (filtro === this.busca().trim() && (filtro !== this.filtro() || this.pagina()))
          this.aplicarFiltro(filtro);
      });
  }
  alterarBusca(valor: string): void {
    this.busca.set(valor);
    this.buscaAlterada.next(valor);
  }
  limparFiltros(): void {
    if (!this.busca() && !this.filtro()) return;
    this.busca.set('');
    this.buscaAlterada.next('');
    if (this.filtro() === '' && this.pagina() === undefined) this.lista.reload();
    else this.aplicarFiltro('');
  }
  proximaPagina(): void {
    if (!this.loading()) this.navegacao.irParaProxima();
  }
  paginaAnterior(): void {
    if (!this.loading()) this.navegacao.irParaAnterior();
  }
  tentarNovamente(): void {
    if (!this.loading()) this.lista.reload();
  }
  private aplicarFiltro(filtro: string): void {
    this.filtro.set(filtro);
    this.pagina.set(undefined);
    this.navegacao.esvaziar();
  }
  private montarParams(): HttpParams {
    let params = new HttpParams();
    if (this.filtro()) params = params.set('q', this.filtro());
    const pagina = this.pagina();
    return pagina
      ? params.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction)
      : params.set('limit', '50');
  }
}
