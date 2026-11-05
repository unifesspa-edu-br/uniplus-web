import { type OutputEmitterRef } from '@angular/core';

import { type ConteudoDoFormulario, type ResultadoDaEdicao } from './modelo/tipos';

/** As saídas por onde uma parte do editor devolve o conteúdo editado e o que anunciar. */
export interface SaidasDaEdicao {
  readonly conteudoChange: OutputEmitterRef<ConteudoDoFormulario>;
  readonly anuncio: OutputEmitterRef<string>;
}

/** Aplica a edição aceita e segue com `depois`, ou anuncia a recusa sem mexer no conteúdo. */
export function aplicarEdicao(
  resultado: ResultadoDaEdicao,
  saidas: SaidasDaEdicao,
  depois: (conteudo: ConteudoDoFormulario) => void,
): void {
  if (!resultado.ok) {
    saidas.anuncio.emit(resultado.recusa);
    return;
  }
  saidas.conteudoChange.emit(resultado.conteudo);
  depois(resultado.conteudo);
}
