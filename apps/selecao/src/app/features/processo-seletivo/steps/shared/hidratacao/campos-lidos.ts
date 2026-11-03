/** Ausente vira campo vazio, não zero. */
export function comoTexto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return String(valor);
}

/**
 * A ordem é posição na lista. Ausente vira zero, que a validação recusa: ordem não declarada
 * precisa aparecer como pendência.
 */
export function comoInteiro(valor: number | null | undefined): number {
  return valor ?? 0;
}
