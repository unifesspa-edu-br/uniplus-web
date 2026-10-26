import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  ProblemI18nService,
  isApiOk,
  type ApiFailure,
  type ApiResult,
} from '@uniplus/shared-core/http';
import {
  NotasDoEnemApi,
  ProcessosSeletivosApi,
  type GeracaoDeEnvioDto,
  type LeiauteDoInepDto,
  type LoteDeNotasDoEnemDto,
  StatusProcesso,
  type ProcessoSeletivoDto,
  type TipoDeLeiaute,
} from '@uniplus/shared-data/selecao';

import { LENDO, type Leitura } from '../leitura';
import { ESCOPO_DE_RASCUNHO, escopoDoEnem, type EscopoDoEnem } from './escopo-do-enem';

/** O que identifica a edição de uma etapa na API: os três ids que toda rota de notas pede. */
export interface EscopoEscolhido {
  readonly processoId: string;
  readonly etapaId: string;
  readonly edicao: string;
}

/** O pedido ainda é do escopo em tela: a resposta de um escopo trocado não se aplica ao novo. */
export function mesmoEscopo(atual: EscopoEscolhido | null, pedido: EscopoEscolhido): boolean {
  return (
    atual?.processoId === pedido.processoId &&
    atual.etapaId === pedido.etapaId &&
    atual.edicao === pedido.edicao
  );
}

/**
 * A edição escolhida num card e o histórico dela. O contador distingue a leitura mais recente das
 * que ficaram para trás: toda leitura, inclusive a de recarga, invalida as anteriores.
 */
class HistoricoDaEdicao<T> {
  private leituraAtual = 0;
  readonly edicao = signal('');
  readonly leitura = signal<Leitura<T>>(LENDO);
  readonly escolhido: Signal<EscopoEscolhido | null>;

  constructor(
    escopoDa: (edicao: string) => EscopoEscolhido | null,
    private readonly listar: (escolhido: EscopoEscolhido) => Observable<ApiResult<T>>,
    private readonly comoLeitura: (resultado: ApiResult<T>) => Leitura<T>,
  ) {
    this.escolhido = computed(() => escopoDa(this.edicao()));
  }

  reiniciar(): void {
    this.leituraAtual++;
    this.edicao.set('');
    this.leitura.set(LENDO);
  }

  async escolher(edicao: string): Promise<void> {
    this.edicao.set(edicao);
    this.leitura.set(LENDO);
    await this.ler();
  }

  /** Relê sem esvaziar a lista em tela, que continua à vista até a nova chegar. */
  async ler(): Promise<void> {
    const leitura = ++this.leituraAtual;
    const escolhido = this.escolhido();
    if (escolhido === null) return;
    const resultado = await firstValueFrom(this.listar(escolhido));
    if (leitura !== this.leituraAtual) return;
    this.leitura.set(this.comoLeitura(resultado));
  }
}

/**
 * O que a tela de notas do ENEM sabe: o processo, o catálogo de leiautes e, para cada um dos dois
 * cards, a edição escolhida nele e o histórico dela. O envio e a importação têm edição própria e
 * independente. Provido pela página, e não pela raiz, porque descreve um processo só.
 */
@Injectable()
export class NotasDoEnemDoProcesso {
  private readonly processosApi = inject(ProcessosSeletivosApi);
  private readonly api = inject(NotasDoEnemApi);
  private readonly problemI18n = inject(ProblemI18nService);

  /** Cada contador distingue a leitura mais recente da que ficou para trás quando o escopo muda. */
  private leituraDoProcesso = 0;
  private readonly leituraDosLeiautes: Record<TipoDeLeiaute, number> = { envio: 0, retorno: 0 };

  readonly processoId = signal<string | null>(null);
  readonly processo = signal<Leitura<ProcessoSeletivoDto>>(LENDO);
  readonly leiautesDeEnvio = signal<Leitura<readonly LeiauteDoInepDto[]>>(LENDO);
  readonly leiautesDeRetorno = signal<Leitura<readonly LeiauteDoInepDto[]>>(LENDO);

  private readonly escopoLido = signal<EscopoDoEnem | null>(null);

  /**
   * Como o processo se presta à tela; nulo enquanto ele não foi lido. Vem da versão publicada, a
   * mesma que a API usa para resolver a etapa e as edições.
   */
  readonly escopo = this.escopoLido.asReadonly();

  /** O escopo quando o processo está pronto para receber envios e importações. */
  readonly escopoPronto = computed(() => {
    const escopo = this.escopo();
    return escopo?.situacao === 'pronto' ? escopo : null;
  });

  readonly nomeDoProcesso = computed(() => {
    const processo = this.processo();
    return processo.estado === 'lido' ? processo.dados.nome : null;
  });

  /** As edições que o processo aceita; vazio enquanto o processo não está pronto. */
  readonly edicoes = computed(() => this.escopoPronto()?.edicoes ?? []);

  private readonly historicoDeEnvios = new HistoricoDaEdicao<readonly GeracaoDeEnvioDto[]>(
    (edicao) => this.escopoDa(edicao),
    ({ processoId, etapaId, edicao }) => this.api.listarEnvios(processoId, etapaId, edicao),
    (resultado) => this.comoLeitura(resultado),
  );
  private readonly historicoDeLotes = new HistoricoDaEdicao<readonly LoteDeNotasDoEnemDto[]>(
    (edicao) => this.escopoDa(edicao),
    ({ processoId, etapaId, edicao }) => this.api.listarLotes(processoId, etapaId, edicao),
    (resultado) => this.comoLeitura(resultado),
  );

  readonly edicaoDeEnvio = this.historicoDeEnvios.edicao.asReadonly();
  readonly edicaoDeRetorno = this.historicoDeLotes.edicao.asReadonly();
  readonly envios = this.historicoDeEnvios.leitura.asReadonly();
  readonly lotes = this.historicoDeLotes.leitura.asReadonly();
  /** O escopo completo para as rotas do envio, quando processo, etapa e edição estão definidos. */
  readonly escolhidoDeEnvio = this.historicoDeEnvios.escolhido;
  /** O mesmo para a importação, que tem a própria edição. */
  readonly escolhidoDeRetorno = this.historicoDeLotes.escolhido;

  /** Lê o processo e o catálogo de leiautes, para o processo indicado. */
  async abrir(processoId: string): Promise<void> {
    this.leituraDoProcesso++;
    this.historicoDeEnvios.reiniciar();
    this.historicoDeLotes.reiniciar();
    this.processoId.set(processoId);
    this.processo.set(LENDO);
    this.escopoLido.set(null);

    await Promise.all([
      this.lerProcesso(processoId),
      this.recarregarLeiautes('envio'),
      this.recarregarLeiautes('retorno'),
    ]);
  }

  async recarregarProcesso(): Promise<void> {
    const processoId = this.processoId();
    if (processoId === null) return;
    this.leituraDoProcesso++;
    this.processo.set(LENDO);
    await this.lerProcesso(processoId);
  }

  async recarregarLeiautes(tipo: TipoDeLeiaute): Promise<void> {
    const leitura = ++this.leituraDosLeiautes[tipo];
    const destino = tipo === 'envio' ? this.leiautesDeEnvio : this.leiautesDeRetorno;
    destino.set(LENDO);

    const resultado = await firstValueFrom(this.api.listarLeiautes(tipo));
    if (leitura !== this.leituraDosLeiautes[tipo]) return;
    destino.set(this.comoLeitura(resultado));
  }

  /** Troca a edição do envio e lê os envios dela; vazia, o histórico fica sem leitura e some. */
  escolherEdicaoDeEnvio(edicao: string): Promise<void> {
    return this.historicoDeEnvios.escolher(edicao);
  }

  /** Troca a edição da importação e lê os lotes dela; vazia, o histórico fica sem leitura e some. */
  escolherEdicaoDeRetorno(edicao: string): Promise<void> {
    return this.historicoDeLotes.escolher(edicao);
  }

  /** Relê os envios da edição escolhida, por exemplo depois de gerar um. */
  recarregarEnvios(): Promise<void> {
    return this.historicoDeEnvios.ler();
  }

  /** Relê os lotes da edição escolhida, por exemplo depois de importar um. */
  recarregarLotes(): Promise<void> {
    return this.historicoDeLotes.ler();
  }

  /** A mensagem de uma recusa de leitura, no texto do catálogo de problemas. */
  mensagemDaFalha(resultado: ApiFailure): string {
    return this.problemI18n.resolve(resultado.problem).title;
  }

  private async lerProcesso(processoId: string): Promise<void> {
    const leitura = this.leituraDoProcesso;
    const resultado = await firstValueFrom(this.processosApi.obter(processoId));
    if (leitura !== this.leituraDoProcesso) return;
    if (!isApiOk(resultado)) {
      this.processo.set(this.comoLeitura(resultado));
      return;
    }

    const escopo = await this.lerEscopo(processoId, resultado.data);
    if (leitura !== this.leituraDoProcesso) return;
    if ('ok' in escopo) {
      this.processo.set({ estado: 'falha', mensagem: this.mensagemDaFalha(escopo) });
      return;
    }
    this.escopoLido.set(escopo);
    this.processo.set({ estado: 'lido', dados: resultado.data });
  }

  /** O processo sem versão publicada (rascunho ou snapshot ausente) não tem edital a operar. */
  private async lerEscopo(
    processoId: string,
    processo: ProcessoSeletivoDto,
  ): Promise<EscopoDoEnem | ApiFailure> {
    if (processo.status === StatusProcesso.rascunho) return ESCOPO_DE_RASCUNHO;

    const snapshot = await firstValueFrom(this.processosApi.obterSnapshotVigente(processoId));
    if (isApiOk(snapshot)) return escopoDoEnem(snapshot.data.configuracao);
    return snapshot.status === 404 ? ESCOPO_DE_RASCUNHO : snapshot;
  }

  private escopoDa(edicao: string): EscopoEscolhido | null {
    const escopo = this.escopoPronto();
    const processoId = this.processoId();
    if (escopo === null || processoId === null || edicao === '') return null;
    return { processoId, etapaId: escopo.etapa.id, edicao };
  }

  private comoLeitura<T>(resultado: ApiResult<T>): Leitura<T> {
    return isApiOk(resultado)
      ? { estado: 'lido', dados: resultado.data }
      : { estado: 'falha', mensagem: this.mensagemDaFalha(resultado) };
  }
}
