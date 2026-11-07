import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { coletarPaginas } from '@uniplus/shared-core/http';
import { TipoBancaDto, TiposBancaApi } from '@uniplus/shared-data/configuracao';

import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

/** Os tipos de banca do cadastro de Configuração, carregados por cursor até o fim. */
@Injectable()
export class CatalogoDeBancas {
  private readonly bancasApi = inject(TiposBancaApi);

  readonly bancas = signal<readonly TipoBancaDto[]>([]);

  /** Tipo de banca por id — o rótulo que a superfície da fase mostra. */
  readonly bancaPorId = computed<ReadonlyMap<string, TipoBancaDto>>(
    () => new Map(this.bancas().map((banca) => [banca.id, banca])),
  );

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () =>
      coletarPaginas((cursor) => this.bancasApi.listar({ cursor })).pipe(map(dadosOuNulo)),
    aplicar: (dados) => this.bancas.set(dados),
    mensagemDeErro: 'Não foi possível carregar as bancas.',
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
