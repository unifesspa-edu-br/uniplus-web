import { computed, effect, inject, signal, untracked } from '@angular/core';
import {
  ProblemI18nService,
  STATUS_HTTP,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  type CadastroDoCatalogo,
  type DetalheDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';

interface Pedido {
  readonly cadastro: CadastroDoCatalogo;
  readonly id: string;
}

const SEGMENTOS: Readonly<Record<CadastroDoCatalogo, string>> = {
  TIPO_DOCUMENTO: 'tipos-documento',
  FATO: 'fatos',
};

/** Leitura reativa do detalhe de um item do catálogo; a falha do servidor (5xx) também é avisada. */
export class LeituraDoDetalhe {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly pedido = signal<Pedido | null>(null);
  private readonly recurso = useApiResource<DetalheDaProtecaoDoCatalogoDto>(() => {
    const pedido = this.pedido();
    return pedido === null
      ? undefined
      : {
          url: `${this.basePath}/api/configuracao/admin/protecao-do-catalogo/${SEGMENTOS[pedido.cadastro]}/${pedido.id}`,
          context: withVendorMime('protecao-do-catalogo-detalhe', 1),
        };
  });

  readonly detalhe = this.recurso.data;
  readonly carregando = this.recurso.isLoading;
  readonly naoEncontrado = computed(
    () => this.recurso.problem()?.status === STATUS_HTTP.NAO_ENCONTRADO,
  );
  readonly erro = computed(() => {
    const problem = this.recurso.problem();
    if (this.naoEncontrado()) return 'O item não existe mais no catálogo.';
    if (problem) return this.problemI18n.resolve(problem).title;
    return this.recurso.error() ? 'Não foi possível carregar o detalhe.' : null;
  });

  private readonly avisoDoServidor = effect(() => {
    const problem = this.recurso.problem();
    if (problem && problem.status >= 500) {
      const titulo = this.problemI18n.resolve(problem).title;
      untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
    }
  });

  ler(cadastro: CadastroDoCatalogo, id: string): void {
    this.pedido.set({ cadastro, id });
  }

  recarregar(): void {
    this.recurso.reload();
  }
}
