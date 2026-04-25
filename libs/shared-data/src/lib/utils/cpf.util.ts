export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) {
      sum += parseInt(digits.charAt(i)) * (t + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    const digit = remainder === 10 ? 0 : remainder;
    if (digit !== parseInt(digits.charAt(t))) return false;
  }
  return true;
}

export function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '').padStart(11, '0');
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Formata um valor parcial ou completo como máscara progressiva de CPF para
 * exibição durante a digitação. Diferente de `formatCpf`, NÃO aplica padding
 * — mostra apenas a parte da máscara correspondente aos dígitos disponíveis.
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

export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  return `***.***.***-${digits.slice(-2)}`;
}
