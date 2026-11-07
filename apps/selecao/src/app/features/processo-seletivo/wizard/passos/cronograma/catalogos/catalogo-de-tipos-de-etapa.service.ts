import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { coletarPaginas } from '@uniplus/shared-core/http';
import { TipoEtapaDto, TiposEtapaApi } from '@uniplus/shared-data/configuracao';

import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

/** Os tipos de etapa do cadastro de Configuração, carregados até o fim. A API só devolve os que ainda existem no cadastro. */
@Injectable()
export class CatalogoDeTiposDeEtapa {
  private readonly tiposEtapaApi = inject(TiposEtapaApi);

  readonly tiposEtapa = signal<readonly TipoEtapaDto[]>([]);

  /**
   * O tipo de etapa pelo id. É por aqui que a tela sabe quais caracteres aquele tipo admite — e,
   * por consequência, se a etapa pode ter peso e nota mínima.
   */
  readonly tipoEtapaPorId = computed<ReadonlyMap<string, TipoEtapaDto>>(
    () => new Map(this.tiposEtapa().map((tipo) => [tipo.id, tipo])),
  );

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () =>
      coletarPaginas((cursor) => this.tiposEtapaApi.listar({ cursor })).pipe(map(dadosOuNulo)),
    aplicar: (dados) => this.tiposEtapa.set(dados),
    mensagemDeErro: 'Não foi possível carregar os tipos de etapa.',
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
