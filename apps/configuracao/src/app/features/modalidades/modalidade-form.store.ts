import { HttpParams } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  API_MAX_PAGE_SIZE,
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  FatoCandidatoView,
  ModalidadeDto,
} from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

@Injectable()
export class ModalidadeFormStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  private readonly pagina = signal<CursorPagina | undefined>(undefined);
  private readonly detalhe = useApiResource<ModalidadeDto>(() =>
    this.id === null
      ? undefined
      : {
          url: `${this.basePath}/api/configuracao/modalidades/${this.id}`,
          context: withVendorMime('modalidade', 1),
        },
  );
  readonly catalogo = useApiResource<readonly FatoCandidatoView[]>(() => ({
    url: `${this.basePath}/api/configuracao/fatos-candidato`,
    context: withVendorMime('fato-candidato', 1),
  }));
  private readonly lista = useApiResource<readonly ModalidadeDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/modalidades`,
    params: this.montarParams(),
    context: withVendorMime('modalidade', 1),
  }));
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);
  private acumuladas: readonly ModalidadeDto[] = [];
  readonly opcoes = signal<readonly ModalidadeDto[]>([]);
  readonly modalidade = this.detalhe.data;
  readonly carregando = this.detalhe.isLoading;
  readonly erroCarregar = computed(() => {
    const problem = this.detalhe.problem();
    return problem
      ? this.problemI18n.resolve(problem).title
      : this.detalhe.error()
        ? 'Erro inesperado ao carregar a modalidade.'
        : null;
  });
  readonly catalogoComErro = computed(
    () => this.catalogo.problem() !== null || this.catalogo.error() !== undefined,
  );

  constructor() {
    effect(() => {
      const resultado = this.lista.value();
      if (!resultado?.ok) return;
      const proximo = this.navegacao.proximo();
      untracked(() => {
        this.acumuladas = [...this.acumuladas, ...resultado.data];
        if (proximo !== null) this.navegacao.irParaProxima();
        else this.opcoes.set(this.acumuladas);
      });
    });
  }

  private montarParams(): HttpParams {
    const pagina = this.pagina();
    return pagina === undefined
      ? new HttpParams().set('limit', String(API_MAX_PAGE_SIZE))
      : new HttpParams()
          .set('cursor', cursorToString(pagina.cursor))
          .set('direction', pagina.direction)
          .set('limit', String(API_MAX_PAGE_SIZE));
  }
}
