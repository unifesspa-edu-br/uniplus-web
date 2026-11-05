import { HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  API_MAX_PAGE_SIZE,
  lookupCompleto,
  resolverVinculo,
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  CampiApi,
  CampusDto,
  LocalOfertaDto,
} from '@uniplus/shared-data/configuracao';
import { UiLookupFalho } from '@uniplus/shared-ui/components';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

const PAGE_SIZE = 50;
const rotularCampus = (campus: CampusDto): string => `${campus.sigla} — ${campus.nome}`;

@Injectable()
export class LocaisOfertaStore {
  private readonly campiApi = inject(CampiApi);
  private readonly destroyRef = inject(DestroyRef);
  private campiIniciado = false;
  readonly campi = lookupCompleto(
    (cursor) => this.campiApi.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    this.destroyRef,
  );
  private readonly campiPorId = computed(
    () => new Map(this.campi.opcoes().map((campus) => [campus.id, campus] as const)),
  );

  readonly lookupsComFalha = computed<readonly UiLookupFalho[]>(() =>
    this.campi.comErro() ? [{ nome: 'campi', recarregar: () => this.campi.recarregar() }] : [],
  );

  readonly resolucoes = computed(
    () =>
      new Map(
        this.locais().flatMap((local) =>
          local.campusResponsavelId === null
            ? []
            : [
                [
                  local.campusResponsavelId,
                  resolverVinculo(
                    this.campi,
                    this.campiPorId().get(local.campusResponsavelId),
                    rotularCampus,
                  ),
                ] as const,
              ],
        ),
      ),
  );

  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  private readonly lista = useApiResource<readonly LocalOfertaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/locais-oferta`,
    params: this.montarParams(),
    context: withVendorMime('local-oferta', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly locais = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar locais de oferta.' : null;
  });

  constructor() {
    effect(() => {
      if (this.locais().some((local) => local.campusResponsavelId !== null)) {
        untracked(() => this.iniciarCampi());
      }
    });
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  iniciarCampi(): void {
    if (this.campiIniciado) return;
    this.campiIniciado = true;
    this.campi.recarregar();
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

  recarregar(): void {
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
}
