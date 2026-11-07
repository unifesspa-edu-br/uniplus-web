import { HttpParams } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  type CadastroDoCatalogo,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { LeituraDoDetalhe } from '../../shared/detalhe-do-catalogo';
import { recusaDe } from '../../shared/recusa-da-leitura';

@Injectable()
export class ProtecaoDoCatalogoStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly ativa = signal(false);
  private readonly versaoDaConsulta = signal(0);
  private readonly lista = useApiResource<readonly ItemDaProtecaoDoCatalogoDto[]>(() => {
    this.versaoDaConsulta();
    return this.ativa()
      ? {
          url: `${this.basePath}/api/configuracao/admin/protecao-do-catalogo`,
          params: new HttpParams().set('situacao', 'SOLICITADA'),
          context: withVendorMime('protecao-do-catalogo', 1),
        }
      : undefined;
  });
  private readonly leituraDoDetalhe = new LeituraDoDetalhe();
  private readonly itemAbertoId = signal<string | null>(null);

  readonly itens = computed(() => {
    const resultado = this.lista.value();
    return resultado?.ok ? resultado.data : [];
  });
  readonly carregando = this.lista.isLoading;
  readonly erroDeCarga = computed(() => {
    const problem = this.lista.problem();
    return problem
      ? this.problemI18n.resolve(problem).title
      : this.lista.error()
        ? 'Erro inesperado ao carregar os itens.'
        : null;
  });
  /** A fila recusada em definitivo (sem permissão): repetir a leitura não muda a resposta. */
  readonly recusa = computed(() => recusaDe(this.lista.problem(), this.erroDeCarga() ?? ''));
  /** A falha que uma nova tentativa pode resolver; a recusa tem aviso próprio. */
  readonly falhaDeCarga = computed(() => (this.recusa() ? null : this.erroDeCarga()));
  readonly itemAberto = computed(
    () => this.itens().find((item) => item.id === this.itemAbertoId()) ?? null,
  );
  readonly detalhe = this.leituraDoDetalhe.detalhe;
  readonly carregandoDetalhe = this.leituraDoDetalhe.carregando;
  readonly erroDoDetalhe = this.leituraDoDetalhe.erro;
  readonly naoEncontrado = this.leituraDoDetalhe.naoEncontrado;
  /** A falha do detalhe que uma nova tentativa pode resolver; o item inexistente tem aviso próprio. */
  readonly falhaDoDetalhe = computed(() =>
    this.naoEncontrado() ? null : this.leituraDoDetalhe.erro(),
  );

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  carregar(): void {
    if (this.ativa()) this.versaoDaConsulta.update((versao) => versao + 1);
    else this.ativa.set(true);
  }

  /** Repete a leitura que falhou; devolve `false` se nenhuma leitura começou. */
  tentarNovamente(): boolean {
    return this.lista.reload();
  }

  abrirDetalhe(item: ItemDaProtecaoDoCatalogoDto): void {
    this.itemAbertoId.set(item.id);
    this.leituraDoDetalhe.ler(item.tipo as CadastroDoCatalogo, item.id);
  }

  recarregarDetalhe(): void {
    this.leituraDoDetalhe.recarregar();
  }
}
