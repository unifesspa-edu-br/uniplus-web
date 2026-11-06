import { HttpParams } from '@angular/common/http';
import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ORGANIZACAO_BASE_PATH, UnidadeDto } from '@uniplus/shared-data/organizacao';

/** Valor de `TipoUnidade` da Reitoria no roster fechado (`TIPOS_UNIDADE`). */
const TIPO_REITORIA = '1';

/** Tamanho da janela ao buscar as Unidades do tipo Reitoria para o select. */
const PAGE_SIZE = 100;

/**
 * As Unidades vivas do tipo Reitoria, que alimentam o select de unidade raiz e dão o nome dela na
 * ficha. A falha não bloqueia o salvamento (o vínculo é opcional): só avisa que a lista não veio.
 */
@Injectable()
export class ReitoriasStore {
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);

  private readonly leitura = useApiResource<readonly UnidadeDto[]>(() => ({
    url: `${this.basePath}/api/organizacao/unidades`,
    params: new HttpParams().set('tipo', TIPO_REITORIA).set('limit', String(PAGE_SIZE)),
    context: withVendorMime('unidade', 1),
  }));

  readonly carregando = this.leitura.isLoading;
  readonly reitorias = computed(() => this.leitura.data() ?? []);
  readonly comErro = computed(() => {
    const resposta = this.leitura.value();
    return (resposta !== undefined && !resposta.ok) || this.leitura.error() !== undefined;
  });
  /** O motivo de a lista não ter vindo, para a ficha e o formulário o explicarem; `null` se veio. */
  readonly mensagemDeErro = computed<string | null>(() => {
    if (!this.comErro()) {
      return null;
    }
    const problem = this.leitura.problem();
    return problem
      ? this.problemI18n.resolve(problem).title
      : 'Erro inesperado ao carregar as unidades.';
  });
  private readonly porId = computed(
    () => new Map(this.reitorias().map((reitoria) => [reitoria.id, reitoria] as const)),
  );

  constructor() {
    effect(() => {
      const problem = this.leitura.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  /**
   * O nome da unidade raiz para a ficha; `null` sem vínculo. Sem o nome na lista, diz por quê: a
   * leitura em andamento, a falha dela ou a ausência da unidade.
   */
  rotuloDaUnidadeRaiz(id: string | null): string | null {
    if (id === null) {
      return null;
    }
    const reitoria = this.porId().get(id);
    if (reitoria) {
      return `${reitoria.sigla} — ${reitoria.nome}`;
    }
    const mensagem = this.mensagemDeErro();
    if (mensagem !== null) {
      return `Não carregada — ${mensagem}`;
    }
    return this.carregando() ? 'Carregando…' : 'Não carregada';
  }

  /** A nova tentativa pedida pelo operador; não repete a leitura que já está em curso. */
  tentarNovamente(): void {
    if (this.carregando()) {
      return;
    }
    this.leitura.reload();
  }
}
