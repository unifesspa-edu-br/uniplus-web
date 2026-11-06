import { DestroyRef, Injectable, inject } from '@angular/core';
import {
  TiposInstrumentoNormativoApi,
  type TipoInstrumentoNormativoVocabularioDto,
} from '@uniplus/shared-data/configuracao';
import { type ListaDeReferencia, listaDeReferencia } from '../../shared/lista-de-referencia';

/**
 * O vocabulário de tipos de instrumento normativo em memória. Vive no injector raiz: dado de
 * referência de baixo volume que não muda entre navegações, e a instância raiz evita pedi-lo a
 * cada visita à tela.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoDeTiposDeInstrumento {
  private readonly api = inject(TiposInstrumentoNormativoApi);

  readonly lista: ListaDeReferencia<TipoInstrumentoNormativoVocabularioDto> = listaDeReferencia(
    () => this.api.listar(),
    inject(DestroyRef),
  );
}
