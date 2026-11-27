import { DestroyRef, Injectable, inject } from '@angular/core';
import {
  TiposInstrumentoNormativoApi,
  type TipoInstrumentoNormativoComDescricao,
} from '@uniplus/shared-data/configuracao';
import { type ListaDeReferencia, listaDeReferencia } from '../../shared/lista-de-referencia';

/**
 * O vocabulário de tipos de instrumento normativo lido pela tela do cadastro: uma leitura a cada
 * abertura da tela, sem guardar o vocabulário para as demais.
 */
@Injectable()
export class CatalogoDeTiposDeInstrumento {
  private readonly api = inject(TiposInstrumentoNormativoApi);

  readonly lista: ListaDeReferencia<TipoInstrumentoNormativoComDescricao> = listaDeReferencia(
    () => this.api.listar(),
    inject(DestroyRef),
  );
}
