import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  IDEMPOTENCY_PROBLEM_CODES,
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CalendarioDiasUteisApi,
  CalendarioDiasUteisResumoDto,
} from '@uniplus/shared-data/configuracao';
import type { ItemDaConfirmacao } from '../../shared/confirmacao-de-remocao';
import { aguardarRecarga } from '../../shared/foco';
import { CalendariosStore } from './calendarios.store';
import type { AndamentoDaEscrita } from '../../shared/escrita';

type Escrita = 'removendo' | 'marcando';

/** O botão da linha que abriu a confirmação cuja recusa mandou reler a lista. */
export interface AcionadorDaConfirmacao {
  readonly acao: 'remover' | 'marcar';
  readonly id: string;
}

const ROTULO_DA_ESCRITA: Readonly<Record<Escrita, string>> = {
  removendo: 'Removendo...',
  marcando: 'Marcando como vigente...',
};

/**
 * A recusa que diz que a lista está desatualizada (calendário já removido, já vigente, alterado
 * por outra pessoa). O conflito de processamento da chave não diz nada da lista: a execução
 * anterior ainda pode concluir.
 */
function listaDesatualizada(problem: ProblemDetails): boolean {
  if (problem.code === IDEMPOTENCY_PROBLEM_CODES.PROCESSING_CONFLICT) return false;
  return problem.status === STATUS_HTTP.NAO_ENCONTRADO || problem.status === STATUS_HTTP.CONFLITO;
}

interface Verbo {
  readonly infinitivo: string;
  readonly gerundio: string;
}

const VERBO_REMOVER: Verbo = { infinitivo: 'remover', gerundio: 'Removendo' };
const VERBO_MARCAR: Verbo = {
  infinitivo: 'marcar como vigente',
  gerundio: 'Marcando como vigente',
};

function itemDaConfirmacao(
  calendario: CalendarioDiasUteisResumoDto | null,
  abertura: string,
): ItemDaConfirmacao | null {
  return calendario ? { abertura, nome: calendario.versaoDataset } : null;
}

/** O que o diálogo anuncia: o andamento e a recusa, que só fazem sentido com ele aberto. */
function anuncioDaConfirmacao(
  calendario: CalendarioDiasUteisResumoDto | null,
  emCurso: boolean,
  motivo: string | null,
  verbo: Verbo,
): string {
  if (calendario === null) return '';
  const versao = calendario.versaoDataset;
  if (emCurso) return `${verbo.gerundio} o calendário ${versao}.`;
  return motivo ? `Não foi possível ${verbo.infinitivo} o calendário ${versao}. ${motivo}` : '';
}

/**
 * Todas as escritas da lista de calendários: a remoção e a marcação do vigente, cada uma com
 * confirmação. É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDosCalendarios {
  private readonly api = inject(CalendarioDiasUteisApi);
  private readonly store = inject(CalendariosStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  private readonly emAndamento = signal<AndamentoDaEscrita | null>(null);
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly marcando = computed(() => this.escrita() === 'marcando');
  readonly andamento = computed(() => (this.gravando() ? this.emAndamento() : null));

  readonly confirmandoRemocao = signal(false);
  readonly erroRemocao = signal<string | null>(null);
  readonly confirmandoVigencia = signal(false);
  readonly erroVigencia = signal<string | null>(null);
  private readonly paraRemover = signal<CalendarioDiasUteisResumoDto | null>(null);
  private readonly paraMarcar = signal<CalendarioDiasUteisResumoDto | null>(null);
  private readonly resultado = signal('');
  private readonly chaveDaVigencia = signal(idempotencyKey.create());
  private acionadorAposRecusa: AcionadorDaConfirmacao | null = null;

  /** O calendário que cada confirmação nomeia antes da mensagem. */
  readonly itemDaRemocao = computed(() =>
    itemDaConfirmacao(this.paraRemover(), 'Você está prestes a remover o calendário'),
  );
  readonly itemDaVigencia = computed(() =>
    itemDaConfirmacao(this.paraMarcar(), 'Você está prestes a marcar como vigente o calendário'),
  );
  readonly anuncioDaRemocao = computed(() =>
    anuncioDaConfirmacao(this.paraRemover(), this.removendo(), this.erroRemocao(), VERBO_REMOVER),
  );
  readonly anuncioDaVigencia = computed(() =>
    anuncioDaConfirmacao(this.paraMarcar(), this.marcando(), this.erroVigencia(), VERBO_MARCAR),
  );
  /** Na página: o desfecho, anunciado quando nenhum diálogo está aberto para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmandoRemocao() || this.confirmandoVigencia() ? '' : this.resultado(),
  );

  /**
   * Quem pediu a confirmação cuja recusa mandou reler a lista, para o foco ter destino ao fechá-la:
   * a releitura pode ter tirado a linha ou deixado o botão indisponível. Entrega uma vez só.
   */
  consumirAcionadorAposRecusa(): AcionadorDaConfirmacao | null {
    const acionador = this.acionadorAposRecusa;
    this.acionadorAposRecusa = null;
    return acionador;
  }

  pedirRemocao(calendario: CalendarioDiasUteisResumoDto): void {
    if (this.gravando()) return;
    this.acionadorAposRecusa = null;
    this.resultado.set('');
    this.erroRemocao.set(null);
    this.paraRemover.set(calendario);
    this.confirmandoRemocao.set(true);
  }

  pedirVigencia(calendario: CalendarioDiasUteisResumoDto): void {
    if (this.gravando()) return;
    this.acionadorAposRecusa = null;
    this.resultado.set('');
    this.erroVigencia.set(null);
    this.paraMarcar.set(calendario);
    this.chaveDaVigencia.set(idempotencyKey.create());
    this.confirmandoVigencia.set(true);
  }

  removerConfirmado(): void {
    const calendario = this.paraRemover();
    if (calendario === null) return;
    this.erroRemocao.set(null);
    this.gravar('removendo', calendario.id, this.api.remover(calendario.id), (result) =>
      this.concluirRemocao(calendario, result),
    );
  }

  marcarConfirmado(): void {
    const calendario = this.paraMarcar();
    if (calendario === null) return;
    this.erroVigencia.set(null);
    const contexto = withIdempotencyKey(this.chaveDaVigencia());
    this.gravar(
      'marcando',
      calendario.id,
      this.api.marcarVigente(calendario.id, contexto),
      (result) => this.concluirVigencia(calendario, result),
    );
  }

  private gravar(
    tipo: Escrita,
    id: string,
    operacao: Observable<ApiResult<void>>,
    concluir: (result: ApiResult<void>) => void,
  ): void {
    if (this.escrita() !== null) return;
    this.escrita.set(tipo);
    this.emAndamento.set({ id, rotulo: ROTULO_DA_ESCRITA[tipo] });
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      concluir(result);
      this.escrita.set(null);
    });
  }

  private concluirRemocao(calendario: CalendarioDiasUteisResumoDto, result: ApiResult<void>): void {
    if (!result.ok) {
      this.erroRemocao.set(this.recusar(result.problem, { acao: 'remover', id: calendario.id }));
      return;
    }
    this.acionadorAposRecusa = null;
    this.resultado.set(`Calendário ${calendario.versaoDataset} removido.`);
    this.notifications.success('Calendário removido');
    this.confirmandoRemocao.set(false);
    this.paraRemover.set(null);
    this.recarregar();
  }

  private concluirVigencia(
    calendario: CalendarioDiasUteisResumoDto,
    result: ApiResult<void>,
  ): void {
    if (!result.ok) {
      if (deveRotacionarIdempotencyKey(result.problem)) {
        this.chaveDaVigencia.set(idempotencyKey.create());
      }
      this.erroVigencia.set(this.recusar(result.problem, { acao: 'marcar', id: calendario.id }));
      return;
    }
    this.acionadorAposRecusa = null;
    this.resultado.set(`Calendário ${calendario.versaoDataset} marcado como vigente.`);
    this.notifications.success('Vigência de calendário atualizada');
    this.chaveDaVigencia.set(idempotencyKey.create());
    this.confirmandoVigencia.set(false);
    this.paraMarcar.set(null);
    this.recarregar();
  }

  /**
   * A mensagem da recusa para o diálogo; só a falha do servidor (5xx) avisa também por toast. A
   * recusa por lista desatualizada pede a leitura nova, e o diálogo segue aberto com a mensagem.
   */
  private recusar(problem: ProblemDetails, acionador: AcionadorDaConfirmacao): string {
    const titulo = this.problemI18n.resolve(problem).title;
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem, { title: titulo });
    }
    if (listaDesatualizada(problem)) {
      this.acionadorAposRecusa = acionador;
      this.recarregar();
    }
    return titulo;
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }
}
