import { HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import {
  ApiResult,
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, CampiApi, CampusDto } from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/**
 * Estado da listagem de campi e da remoção. A gravação (remover ou salvar) tem um só indicador:
 * enquanto uma está em curso a outra não parte.
 */
@Injectable()
export class CampiStore {
  private readonly api = inject(CampiApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  readonly gravando = signal(false);
  readonly confirmando = signal(false);
  readonly campusParaRemover = signal<CampusDto | null>(null);

  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  private readonly lista = useApiResource<readonly CampusDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/campi`,
    params: this.montarParams(),
    context: withVendorMime('campus', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly campi = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar campi.' : null;
  });

  readonly mensagemDaConfirmacao = computed(() => {
    const campus = this.campusParaRemover();
    return campus
      ? `Deseja remover ${campus.sigla}? A remoção é lógica (soft-delete) e preserva o histórico.`
      : 'Deseja remover este campus?';
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

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  tentarNovamente(): void {
    if (!this.carregando()) {
      this.lista.reload();
    }
  }

  /** Volta à primeira página, para a lista refletir o que acabou de ser gravado. */
  recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  pedirRemocao(campus: CampusDto): void {
    this.campusParaRemover.set(campus);
    this.confirmando.set(true);
  }

  removerConfirmado(): void {
    const campus = this.campusParaRemover();
    if (campus === null) {
      return;
    }
    this.gravar(this.api.remover(campus.id), (result) => {
      if (result.ok) {
        this.notifications.success('Campus removido', campus.sigla);
        this.confirmando.set(false);
        this.campusParaRemover.set(null);
        this.recarregar();
        return;
      }
      this.notifications.errorFromProblem(result.problem, {
        title: this.problemI18n.resolve(result.problem).title,
      });
    });
  }

  /** Executa uma gravação se nenhuma outra estiver em curso e entrega o resultado a `aoConcluir`. */
  gravar<T>(operacao: Observable<ApiResult<T>>, aoConcluir: (result: ApiResult<T>) => void): void {
    if (this.gravando()) {
      return;
    }
    this.gravando.set(true);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.gravando.set(false);
      aoConcluir(result);
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
}
