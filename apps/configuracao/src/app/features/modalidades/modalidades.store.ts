import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  API_MAX_PAGE_SIZE,
  ProblemDetails,
  ProblemI18nService,
  lookupCompleto,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  fatoComOperadores,
  FatoDoCatalogoDto,
  ModalidadesApi,
} from '@uniplus/shared-data/configuracao';
import { tap } from 'rxjs';
import { recusaDe } from '../../shared/recusa-da-leitura';

const MENSAGEM_DOS_FATOS =
  'A coluna “Quem concorre” mostra “Quem atende às condições da regra” até os fatos serem lidos de novo.';

@Injectable()
export class ModalidadesStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly api = inject(ModalidadesApi);
  private readonly problema = signal<ProblemDetails | null>(null);
  /** A lista inteira: origem, destino, par, alternativa e "Referenciada por" resolvem por qualquer modalidade, não só pelas da página lida. */
  private readonly lista = lookupCompleto(
    (cursor) =>
      this.api
        .listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE })
        .pipe(tap((resultado) => this.problema.set(resultado.ok ? null : resultado.problem))),
    inject(DestroyRef),
  );
  readonly catalogo = useApiResource<readonly FatoDoCatalogoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/fatos-candidato`,
    context: withVendorMime('fato-candidato', 1),
  }));
  /** Os fatos com os operadores; `null` enquanto o catálogo não foi lido. */
  readonly fatos = computed(() => this.catalogo.data()?.map(fatoComOperadores) ?? null);
  /** Os fatos recusados em definitivo: repetir a leitura não muda a resposta. */
  readonly recusaDosFatos = computed(() => {
    const problem = this.catalogo.problem();
    return recusaDe(problem, problem ? this.problemI18n.resolve(problem).title : '');
  });
  /** A falha dos fatos que uma nova tentativa pode resolver; a coluna "Quem concorre" depende deles. */
  readonly falhaDosFatos = computed(() => {
    if (this.recusaDosFatos() !== null) return null;
    return this.catalogo.problem() || this.catalogo.error() ? MENSAGEM_DOS_FATOS : null;
  });
  /** `true` desde a nova tentativa que seguiu uma falha, até a leitura terminar. */
  private readonly recuperandoDeFalha = signal(false);
  /** Vazia quando a última leitura falhou e enquanto a nova tentativa não termina: a tela não mostra dado que pode estar desatualizado. */
  readonly modalidades = computed(() =>
    this.lista.comErro() || (this.recuperandoDeFalha() && this.lista.pendente())
      ? []
      : this.lista.opcoes(),
  );
  readonly carregando = this.lista.pendente;
  readonly mensagemDeErro = computed(() => {
    const problem = this.problema();
    return problem
      ? this.problemI18n.resolve(problem).title
      : this.lista.comErro()
        ? 'Erro inesperado ao carregar modalidades.'
        : null;
  });

  constructor() {
    effect(() => {
      const problem = this.problema();
      if (problem && problem.status >= 500) {
        const title = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title }));
      }
    });
    this.recarregar();
  }

  tentarNovamente(): void {
    if (!this.carregando()) this.recarregar();
  }

  recarregar(): void {
    this.recuperandoDeFalha.set(this.lista.comErro());
    this.problema.set(null);
    this.lista.recarregar();
  }
}
