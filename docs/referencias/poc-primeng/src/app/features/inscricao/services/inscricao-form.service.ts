import { Injectable } from '@angular/core';
import {
  FormControl,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';

export interface InscricaoForm {
  nome: FormControl<string>;
  cpf: FormControl<string>;
  email: FormControl<string>;
  cursoId: FormControl<string>;
  cidadeId: FormControl<string>;
  modalidadeCota: FormControl<string>;
  opcaoCurso: FormControl<'primeira' | 'segunda' | ''>;
}

/**
 * Validator de CPF conforme algoritmo oficial da Receita Federal.
 * - Rejeita CPFs com todos os dígitos iguais (111.111.111-11, etc.)
 * - Valida os 2 dígitos verificadores (posições 10 e 11)
 * Portado da PoC Spartan (poc/17-spartan-govbr-ds) sem alterações.
 */
export function cpfValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value?.replace(/\D/g, '');
  if (!value) return null;
  if (value.length !== 11) return { cpfInvalido: true };

  // Rejeita dígitos repetidos (CPFs como 111.111.111-11)
  if (/^(\d)\1{10}$/.test(value)) return { cpfInvalido: true };

  // 1º dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(value[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(value[9])) return { cpfInvalido: true };

  // 2º dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(value[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(value[10])) return { cpfInvalido: true };

  return null;
}

@Injectable({ providedIn: 'root' })
export class InscricaoFormService {
  createForm(): FormGroup<InscricaoForm> {
    return new FormGroup<InscricaoForm>({
      nome: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3)],
      }),
      cpf: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, cpfValidator],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      cursoId: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      cidadeId: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      modalidadeCota: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      opcaoCurso: new FormControl<'primeira' | 'segunda' | ''>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });
  }
}
