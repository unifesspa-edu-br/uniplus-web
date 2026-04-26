/**
 * Formata um valor parcial ou completo como máscara progressiva de CPF para
 * exibição durante a digitação. Diferente de `formatCpf` (em `@uniplus/shared-data`),
 * NÃO aplica padding — mostra apenas a parte da máscara correspondente aos dígitos
 * disponíveis.
 *
 * Ignora caracteres não-numéricos e limita a entrada a 11 dígitos.
 *
 * @example
 * formatCpfProgressive('123')         // '123'
 * formatCpfProgressive('1234')        // '123.4'
 * formatCpfProgressive('12345678901') // '123.456.789-01'
 * formatCpfProgressive('abc529xyz')   // '529'
 * formatCpfProgressive(null)          // ''
 */
export function formatCpfProgressive(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
