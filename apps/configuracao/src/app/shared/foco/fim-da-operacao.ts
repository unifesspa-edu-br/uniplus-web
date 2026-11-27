import { Signal } from '@angular/core';

/**
 * Devolve uma consulta que, a cada chamada, diz se a operação que estava em curso terminou desde a
 * chamada anterior. Chamar dentro de um `effect`, para que ele acompanhe `emCurso`.
 */
export function detectarFimDaOperacao(emCurso: Signal<boolean>): () => boolean {
  let estavaEmCurso = false;
  return () => {
    if (emCurso()) {
      estavaEmCurso = true;
      return false;
    }
    const terminou = estavaEmCurso;
    estavaEmCurso = false;
    return terminou;
  };
}
