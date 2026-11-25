import { Validators, type ValidatorFn } from '@angular/forms';
import { CODIGO_CADASTRO_FORMATO, CODIGO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';

export function validadoresDoCodigo(limite: number): ValidatorFn[] {
  return [
    Validators.maxLength(Math.min(limite, CODIGO_TAMANHO_MAXIMO)),
    Validators.pattern(CODIGO_CADASTRO_FORMATO),
  ];
}
