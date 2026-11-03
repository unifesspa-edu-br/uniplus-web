import { inject } from '@angular/core';
import { ControlContainer } from '@angular/forms';

/**
 * Deixa o `formControlName` de um filho enxergar o grupo do pai. A diretiva procura o grupo só
 * até o elemento que hospeda o componente; entregar nele o grupo do pai evita que cada filho
 * repita o `formGroup` e mantém um formulário só.
 */
export const FORMULARIO_DO_PAI = {
  provide: ControlContainer,
  useFactory: () => inject(ControlContainer, { skipSelf: true }),
};
