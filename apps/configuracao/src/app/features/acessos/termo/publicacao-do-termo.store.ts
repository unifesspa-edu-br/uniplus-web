import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type VersaoDoTermoDto,
  type VersaoDoTermoResumoDto,
} from '@uniplus/shared-data/autorizacao';
import { navegacaoPorCursor } from '../../../shared/navegacao-por-cursor';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';

/** O tipo de mídia das leituras do termo (ADR-0016), o mesmo do cliente da API. */
const RECURSO = 'versao-do-termo';

/** A falta de versão publicada não é falha: a tela diz que ainda não há termo. */
const SEM_VERSAO_VIGENTE = 'uniplus.autorizacao.termo.sem_versao_vigente';

/** A versão vigente do termo e o histórico das versões, da 1 à mais recente. */
@Injectable()
export class PublicacaoDoTermoStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly raiz = `${this.basePath}/api/autorizacao/termos-de-responsabilidade`;
  private readonly pagina = signal<CursorPagina | undefined>(undefined);
  private readonly consultaDaVigente = useApiResource<VersaoDoTermoDto>(() => ({
    url: `${this.raiz}/vigente`,
    context: withVendorMime(RECURSO, 1),
  }));
  private readonly consultaDoHistorico = useApiResource<readonly VersaoDoTermoResumoDto[]>(() => {
    const pagina = this.pagina();
    const params: Record<string, string> = pagina
      ? { cursor: cursorToString(pagina.cursor), direction: pagina.direction }
      : {};
    return { url: `${this.raiz}/versoes`, params, context: withVendorMime(RECURSO, 1) };
  });
  private readonly navegacao = navegacaoPorCursor(this.consultaDoHistorico, this.pagina);
  /** Sem versão publicada a vigente responde 404: isso não é falha da leitura. */
  readonly semVersaoVigente = computed(
    () => this.consultaDaVigente.problem()?.code === SEM_VERSAO_VIGENTE,
  );
  private readonly desfecho = desfechoDaLeitura(
    [
      {
        problem: computed(() =>
          this.semVersaoVigente() ? null : this.consultaDaVigente.problem(),
        ),
        error: this.consultaDaVigente.error,
      },
      this.consultaDoHistorico,
    ],
    this.problemas,
  );
  readonly vigente = computed(() => this.consultaDaVigente.data() ?? null);
  /**
   * A vigente foi lida, ou a API disse que não há versão publicada. Só então a publicação sabe sobre
   * qual versão vai; durante a leitura, ou depois de uma falha, ela espera.
   */
  readonly vigenteConhecida = computed(
    () =>
      !this.consultaDaVigente.isLoading() &&
      (this.consultaDaVigente.data() !== null || this.semVersaoVigente()),
  );
  readonly historico = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly carregando = computed(
    () => this.consultaDaVigente.isLoading() || this.consultaDoHistorico.isLoading(),
  );
  readonly falha = this.desfecho.falha;
  readonly recusa = this.desfecho.recusa;
  readonly mensagemDeErro = this.desfecho.mensagem;

  constructor() {
    notificarFalhasDeLeitura(this.problemas, inject(NotificationService), [
      this.consultaDaVigente.problem,
      this.consultaDoHistorico.problem,
    ]);
  }

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  /** Relê a vigente e o histórico desde a primeira página. */
  recarregar(): void {
    this.consultaDaVigente.reload();
    if (this.pagina() === undefined) this.consultaDoHistorico.reload();
    else this.pagina.set(undefined);
  }

  /** Repete as leituras que falharam; devolve `false` se nenhuma começou. */
  tentarNovamente(): boolean {
    const daVigente = this.consultaDaVigente.reload();
    return this.consultaDoHistorico.reload() || daVigente;
  }
}
