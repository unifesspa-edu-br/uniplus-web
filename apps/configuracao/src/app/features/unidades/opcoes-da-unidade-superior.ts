import { HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ORGANIZACAO_BASE_PATH, UnidadeDto } from '@uniplus/shared-data/organizacao';
import { ATRASO_DA_BUSCA_EM_MS, TAMANHO_DA_PAGINA } from './unidades.store';

/**
 * As unidades que o campo "unidade superior" do formulário oferece. Tem busca própria no
 * servidor, desacoplada do filtro da listagem, para que um pai fora da primeira página continue
 * selecionável. A consulta só existe depois da primeira abertura do formulário e é refeita a cada
 * abertura, para incluir as unidades criadas desde então.
 */
@Injectable()
export class OpcoesDaUnidadeSuperior {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);
  private readonly destroyRef = inject(DestroyRef);

  /** O termo digitado no campo de busca. */
  readonly termo = signal('');
  /** O termo já aplicado à consulta; zerado na hora, sem esperar o debounce, ao abrir o formulário. */
  private readonly termoAplicado = signal('');
  private readonly ativa = signal(false);

  private readonly lista = useApiResource<readonly UnidadeDto[]>(() => {
    if (!this.ativa()) {
      return undefined;
    }
    let params = new HttpParams().set('limit', String(TAMANHO_DA_PAGINA));
    const busca = this.termoAplicado();
    if (busca.length > 0) {
      params = params.set('q', busca);
    }
    return {
      url: `${this.basePath}/api/organizacao/unidades`,
      params,
      context: withVendorMime('unidade', 1),
    };
  });

  readonly opcoes = computed(() => this.lista.data() ?? []);
  readonly carregando = this.lista.isLoading;
  /** A carga falhou: distingue "sem opções" de "não carregou", que deixaria só a raiz no select. */
  readonly comErro = computed(
    () => this.lista.problem() !== null || this.lista.error() !== undefined,
  );

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
    toObservable(this.termo)
      .pipe(
        map((termo) => termo.trim()),
        debounceTime(ATRASO_DA_BUSCA_EM_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((termo) => this.termoAplicado.set(termo));
  }

  /** Chamado a cada abertura do formulário: zera a busca e garante dados frescos. */
  preparar(): void {
    const tinhaTermo = this.termoAplicado().length > 0;
    this.termo.set('');
    this.termoAplicado.set('');
    if (!this.ativa()) {
      this.ativa.set(true);
    } else if (!tinhaTermo) {
      // Sem termo anterior o reset não muda os parâmetros: o refetch é forçado. Com termo, o
      // reset já dispara a consulta sem `q`.
      this.lista.reload();
    }
  }

  recarregar(): void {
    if (!this.carregando()) {
      this.lista.reload();
    }
  }
}
