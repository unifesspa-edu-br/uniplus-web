import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { coletarPaginas } from '@uniplus/shared-core/http';
import { TipoEtapaDto, TiposEtapaApi } from '@uniplus/shared-data/configuracao';

import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

/** Os tipos de etapa do cadastro de Configuração, ativos e inativos, carregados até o fim. */
@Injectable()
export class CatalogoDeTiposDeEtapa {
  private readonly tiposEtapaApi = inject(TiposEtapaApi);

  readonly tiposEtapa = signal<readonly TipoEtapaDto[]>([]);

  /**
   * Tipos de etapa escolhíveis. O catálogo devolve ativos e inativos juntos, e
   * um inativo não volta a ser opção nova — mas continua exibível quando já
   * referenciado, o que `rotuloDoTipoEtapa` resolve.
   */
  readonly tiposEtapaAtivos = computed(() => this.tiposEtapa().filter((tipo) => tipo.ativo));

  /** Rótulo de um tipo de etapa, ativo ou não — um vínculo gravado precisa de nome. */
  readonly rotuloDoTipoEtapa = computed<ReadonlyMap<string, string>>(
    () => new Map(this.tiposEtapa().map((tipo) => [tipo.id, tipo.nome])),
  );

  /**
   * O tipo de etapa pelo id, ativo ou não. É por aqui que a tela sabe quais caracteres aquele
   * tipo admite — e, por consequência, se a etapa pode ter peso e nota mínima. A série completa
   * importa: uma etapa já gravada num tipo desde então desativado continua tendo de exibir o
   * que aquele tipo admitia.
   */
  readonly tipoEtapaPorId = computed<ReadonlyMap<string, TipoEtapaDto>>(
    () => new Map(this.tiposEtapa().map((tipo) => [tipo.id, tipo])),
  );

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () =>
      coletarPaginas((cursor) => this.tiposEtapaApi.listar({ cursor })).pipe(map(dadosOuNulo)),
    aplicar: (dados) => this.tiposEtapa.set(dados),
    mensagemDeErro: 'Não foi possível carregar os tipos de etapa. Tente novamente.',
  });

  readonly carregando = this.leitura.carregando;
  readonly erro = this.leitura.erro;

  carregar(): void {
    this.leitura.carregar();
  }

  /** Busca de novo, descartando a resposta de uma busca anterior ainda em voo. */
  recarregar(): void {
    this.leitura.recarregar();
  }
}
