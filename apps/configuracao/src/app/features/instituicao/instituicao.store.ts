import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import {
  ProblemI18nService,
  STATUS_HTTP,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { InstituicaoDto, ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { contadorDeFalhas } from '../../shared/contador-de-falhas';

/**
 * A leitura da Instituição, que é singleton: há uma, ou o 404 diz que nenhuma foi cadastrada. O
 * 404 não é falha de carga: é o estado em que a tela oferece o cadastro.
 */
@Injectable()
export class InstituicaoStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);

  private readonly leitura = useApiResource<InstituicaoDto>(() => ({
    url: `${this.basePath}/api/organizacao/instituicao`,
    context: withVendorMime('instituicao', 1),
  }));

  readonly carregando = this.leitura.isLoading;
  readonly instituicao = this.leitura.data;
  /** A leitura respondeu que nenhuma Instituição foi cadastrada. */
  readonly naoCadastrada = computed(() => {
    const resposta = this.leitura.value();
    return resposta !== undefined && !resposta.ok && resposta.status === STATUS_HTTP.NAO_ENCONTRADO;
  });

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.leitura.problem();
    if (problem && !this.naoCadastrada()) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.leitura.error() ? 'Erro inesperado ao carregar a instituição.' : null;
  });

  private readonly falhas = contadorDeFalhas();
  /** Falhas seguidas das tentativas do operador, para o alerta anunciar uma falha repetida. */
  readonly tentativasSemSucesso = this.falhas.valor;
  private tentativaPedida = false;

  constructor() {
    effect(() => {
      if (this.carregando()) {
        return;
      }
      const falhou = this.mensagemDeErro() !== null;
      untracked(() => this.registrarDesfecho(falhou));
    });
    effect(() => {
      const problem = this.leitura.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  tentarNovamente(): void {
    if (this.carregando()) {
      return;
    }
    this.tentativaPedida = true;
    this.leitura.reload();
  }

  /** Lê de novo, para a tela refletir o que acabou de ser gravado. */
  recarregar(): void {
    this.leitura.reload();
  }

  private registrarDesfecho(falhou: boolean): void {
    if (falhou) {
      this.falhas.registrarFalha(this.tentativaPedida);
    } else {
      this.falhas.registrarSucesso();
    }
    this.tentativaPedida = false;
  }
}
