import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { contarCaracteres } from '@uniplus/shared-utils';

/**
 * O limite de tamanho contado em caracteres, como a API conta, e não em unidades UTF-16 como o
 * `Validators.maxLength`. O erro tem a mesma forma do `maxlength`.
 */
export function ateCaracteres(limite: number): ValidatorFn {
  return (controle: AbstractControl<string | null>): ValidationErrors | null => {
    const tamanho = contarCaracteres(controle.value ?? '');
    return tamanho > limite
      ? { maxlength: { requiredLength: limite, actualLength: tamanho } }
      : null;
  };
}
