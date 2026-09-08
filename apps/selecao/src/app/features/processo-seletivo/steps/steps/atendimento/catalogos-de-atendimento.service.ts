import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import {
  CondicaoAtendimentoDto,
  CondicoesAtendimentoApi,
  RecursoAcessibilidadeApi,
  RecursoAcessibilidadeDto,
  TipoDeficienciaApi,
  TipoDeficienciaDto,
} from '@uniplus/shared-data/configuracao';

/**
 * Código canônico da condição PcD no cadastro de Configuração — linha
 * protegida do catálogo, ancorada no ADR-0067
 * (`OfertaAtendimentoEspecializado.CodigoCondicaoPcd` no domínio). Não é
 * rótulo inventado pelo frontend: é o valor que a API devolve, e a regra
 * local não é escrevível sem citá-lo (exceção nomeada, §4 do plano da
 * frente).
 */
export const CODIGO_CONDICAO_PCD = 'PCD';

/**
 * Catálogos que a oferta de atendimento especializado referencia, todos de
 * Configuração: condições de atendimento, recursos de acessibilidade e tipos
 * de deficiência (UNI-REQ-0012).
 *
 * Carrega os três por cursor até o fim — uma escolha só sabe o que oferecer
 * quando conhece todas as opções — e só lista os cadastros **vivos**: um item
 * já inativado não volta a ser oferecido como escolha nova, mas uma
 * referência anterior a ele permanece no rascunho e é exibida a partir do
 * snapshot que o próprio rascunho guarda, não deste catálogo.
 */
@Injectable()
export class CatalogosDeAtendimentoService {
  private readonly condicoesApi = inject(CondicoesAtendimentoApi);
  private readonly recursosApi = inject(RecursoAcessibilidadeApi);
  private readonly tiposApi = inject(TipoDeficienciaApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly condicoes = signal<readonly CondicaoAtendimentoDto[]>([]);
  readonly recursos = signal<readonly RecursoAcessibilidadeDto[]>([]);
  readonly tiposDeficiencia = signal<readonly TipoDeficienciaDto[]>([]);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  /**
   * A condição de código `PCD`, se o cadastro a tiver — é sobre ela que a
   * invariante do ADR-0067 se apoia. `undefined` enquanto o catálogo não
   * carregou ou não tem a condição canônica cadastrada.
   */
  readonly condicaoPcd = computed(() =>
    this.condicoes().find(
      (condicao) => condicao.codigo.toUpperCase() === CODIGO_CONDICAO_PCD,
    ),
  );

  private buscaIniciada = false;

  carregar(): void {
    if (this.buscaIniciada) return;
    this.buscaIniciada = true;
    this.carregando.set(true);
    this.erro.set(null);

    forkJoin({
      condicoes: coletarPaginas((cursor) => this.condicoesApi.listar({ cursor })),
      recursos: coletarPaginas((cursor) => this.recursosApi.listar({ cursor })),
      tiposDeficiencia: coletarPaginas((cursor) => this.tiposApi.listar({ cursor })),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultados) => {
          const { condicoes, recursos, tiposDeficiencia } = resultados;

          // Um catálogo faltando deixa a tela oferecendo menos do que existe, e
          // o operador não teria como saber. Ou vêm todos, ou nenhum.
          if (!isApiOk(condicoes) || !isApiOk(recursos) || !isApiOk(tiposDeficiencia)) {
            this.anunciarErro();
            return;
          }

          this.condicoes.set(condicoes.data);
          this.recursos.set(recursos.data);
          this.tiposDeficiencia.set(tiposDeficiencia.data);
          this.carregando.set(false);
        },
        error: () => this.anunciarErro(),
      });
  }

  private anunciarErro(): void {
    this.buscaIniciada = false;
    this.erro.set(
      'Não foi possível carregar os cadastros de condições, recursos e tipos de deficiência. Tente novamente.',
    );
    this.carregando.set(false);
  }
}
