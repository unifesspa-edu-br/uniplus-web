import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isValidCpf } from '../utils/cpf.util';

/**
 * Validator de CPF para Reactive Forms baseado em `isValidCpf`.
 *
 * Valida o algoritmo dos dígitos verificadores (Lei do Cadastro de Pessoas
 * Físicas, Receita Federal). Retorna `null` quando o valor é válido ou vazio
 * (a obrigatoriedade deve ser composta com `Validators.required`).
 *
 * @example
 * new FormControl('', [Validators.required, cpfValidator]);
 * // se inválido: { cpfInvalido: true }
 */
export const cpfValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = control.value as string | null | undefined;
  if (value == null || value === '') return null;
  return isValidCpf(value) ? null : { cpfInvalido: true };
};
