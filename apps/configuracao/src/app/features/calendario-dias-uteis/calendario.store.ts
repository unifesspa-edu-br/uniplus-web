import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CalendarioDiasUteisDto, CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { agruparPorMes, anosDoCalendario } from './calendario-mensal.util';

/** A leitura do calendário aberto, do dataset inteiro, para o resumo e a grade de meses. */
@Injectable()
export class CalendarioStore {
  private readonly route = inject(ActivatedRoute);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** O Router reaproveita a página ao navegar entre duas rotas `:id`, então o id acompanha a rota. */
  readonly calendarioId = toSignal(this.route.params.pipe(map((params) => params['id'] ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  private readonly recurso = useApiResource<CalendarioDiasUteisDto>(() => ({
    url: `${this.basePath}/api/configuracao/calendarios-dias-uteis/${this.calendarioId()}`,
    context: withVendorMime('calendario-dias-uteis', 1),
  }));

  readonly calendario = this.recurso.data;
  readonly carregando = this.recurso.isLoading;

  /**
   * `carregando` também cobre a recarga que sucede uma inclusão, e trocar a grade pelo spinner
   * desmontaria a subárvore: o mês em que a pessoa estava, a rolagem e o foco do dia se perderiam.
   * Na recarga a grade anterior fica à vista até o dataset novo chegar.
   */
  readonly carregandoPrimeiraVez = computed(() => this.carregando() && this.calendario() === null);

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.recurso.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.recurso.error() ? 'Erro inesperado ao carregar o calendário.' : null;
  });

  readonly meses = computed(() => {
    const dias = this.calendario()?.diasNaoUteis ?? [];
    return anosDoCalendario(dias).flatMap((ano) => agruparPorMes(dias, ano));
  });

  /**
   * Registros do dataset, não datas. Duas ocorrências no mesmo dia, de abrangências diferentes, são
   * duas entradas próprias, e é por entrada que o dataset é conferido antes de virar vigente.
   */
  readonly totalDiasNaoUteis = computed(() => this.calendario()?.diasNaoUteis.length ?? 0);

  constructor() {
    effect(() => {
      const problem = this.recurso.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  tentarNovamente(): void {
    if (!this.carregando()) {
      this.recurso.reload();
    }
  }

  recarregar(): void {
    this.recurso.reload();
  }
}
