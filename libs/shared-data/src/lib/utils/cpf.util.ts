const COMPRIMENTO_DO_CPF = 11;
const POSICOES_DOS_DIGITOS_VERIFICADORES = [9, 10] as const;

export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  return (
    digits.length === COMPRIMENTO_DO_CPF &&
    !/^(\d)\1{10}$/.test(digits) &&
    POSICOES_DOS_DIGITOS_VERIFICADORES.every(
      (posicao) => digitoVerificadorEm(digits, posicao) === parseInt(digits.charAt(posicao)),
    )
  );
}

/** Dígito verificador esperado na posição, calculado pelos dígitos que a antecedem (módulo 11). */
function digitoVerificadorEm(digits: string, posicao: number): number {
  let soma = 0;
  for (let i = 0; i < posicao; i++) {
    soma += parseInt(digits.charAt(i)) * (posicao + 1 - i);
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}
