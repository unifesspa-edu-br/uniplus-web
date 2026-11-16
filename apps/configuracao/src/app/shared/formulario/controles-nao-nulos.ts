import { FormControl, ValidatorFn } from '@angular/forms';

/** Controle de texto que nunca vale `null`: limpo, volta ao texto vazio. */
export function controleDeTexto(...validadores: ValidatorFn[]): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators: validadores });
}

/** Controle de marca (caixa de seleção) que nunca vale `null`: limpo, volta ao valor inicial. */
export function controleDeMarca(valorInicial: boolean): FormControl<boolean> {
  return new FormControl(valorInicial, { nonNullable: true });
}
