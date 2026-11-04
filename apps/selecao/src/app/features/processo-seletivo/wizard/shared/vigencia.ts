/** O período de vigência de um item do catálogo, em dias de calendário (`AAAA-MM-DD`). */
export interface Vigencia {
  readonly vigenciaInicio: string;
  readonly vigenciaFim: string | null;
}

/**
 * O item vigora no dia. A data de fim é o primeiro dia sem validade: uma vigência que termina em
 * 30/06 já não vale no dia 30. É a mesma conferência que o servidor faz ao resolver o código.
 */
export function vigenteNoDia(vigencia: Vigencia, dia: string): boolean {
  return vigencia.vigenciaInicio <= dia && (vigencia.vigenciaFim === null || dia < vigencia.vigenciaFim);
}
