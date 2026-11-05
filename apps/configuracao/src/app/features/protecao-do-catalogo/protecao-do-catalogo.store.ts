import { HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type CadastroDoCatalogo,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { LeituraDoDetalhe } from '../../shared/detalhe-do-catalogo';

@Injectable()
export class ProtecaoDoCatalogoStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
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
  readonly itemAberto = computed(
    () => this.itens().find((item) => item.id === this.itemAbertoId()) ?? null,
  );
  readonly detalhe = this.leituraDoDetalhe.detalhe;
  readonly carregandoDetalhe = this.leituraDoDetalhe.carregando;
  readonly erroDoDetalhe = this.leituraDoDetalhe.erro;
  readonly naoEncontrado = this.leituraDoDetalhe.naoEncontrado;

  carregar(): void {
    if (this.ativa()) this.versaoDaConsulta.update((versao) => versao + 1);
    else this.ativa.set(true);
  }

  abrirDetalhe(item: ItemDaProtecaoDoCatalogoDto): void {
    this.itemAbertoId.set(item.id);
    this.leituraDoDetalhe.ler(item.tipo as CadastroDoCatalogo, item.id);
  }

  recarregarDetalhe(): void {
    this.leituraDoDetalhe.recarregar();
  }
}
