import { DestroyRef, Injectable, Signal, computed, inject } from '@angular/core';
import { lookupCompleto, type LookupCompleto } from '@uniplus/shared-core/http';
import {
  TiposInstrumentoNormativoApi,
  type TipoInstrumentoNormativoVocabularioDto,
} from '@uniplus/shared-data/configuracao';

/**
 * Vocabulário fechado de Tipo de Instrumento Normativo, compartilhado pelo
 * cadastro de Base Legal de Bônus Regional.
 *
 * Vive no injector raiz pelo mesmo motivo de `CatalogoCategoriasDocumento`:
 * dado de referência de baixo volume que não muda entre navegações — a
 * instância root evita repetir a requisição a cada abertura do formulário.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoTiposInstrumentoNormativo
  implements LookupCompleto<TipoInstrumentoNormativoVocabularioDto>
{
  private readonly api = inject(TiposInstrumentoNormativoApi);
  private readonly lookup = lookupCompleto<TipoInstrumentoNormativoVocabularioDto>(
    () => this.api.listar(),
    inject(DestroyRef),
  );
  private iniciado = false;

  readonly opcoes: Signal<readonly TipoInstrumentoNormativoVocabularioDto[]> = this.lookup.opcoes;
  readonly comErro: Signal<boolean> = this.lookup.comErro;
  readonly pendente: Signal<boolean> = this.lookup.pendente;

  /** Índice por código — é por ele que a Base Legal referencia o tipo de instrumento. */
  readonly porCodigo = computed(
    () => new Map(this.opcoes().map((tipo) => [tipo.codigo, tipo] as const)),
  );

  /** Busca o vocabulário na primeira vez e reaproveita o que já está em memória. */
  garantirCarregado(): void {
    if (this.iniciado && (this.pendente() || !this.comErro())) {
      return;
    }
    this.iniciado = true;
    this.lookup.recarregar();
  }

  /** Busca de novo por pedido explícito, descartando o que estiver em andamento. */
  recarregar(): void {
    this.iniciado = true;
    this.lookup.recarregar();
  }
}
