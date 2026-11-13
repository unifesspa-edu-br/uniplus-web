import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { ateCaracteres } from './ate-caracteres';

describe('ateCaracteres', () => {
  it('aceita o texto no limite contado em caracteres, mesmo que passe em unidades UTF-16', () => {
    const controle = new FormControl('😀😀', { validators: [ateCaracteres(2)] });

    expect(controle.value?.length).toBe(4);
    expect(controle.valid).toBe(true);
  });

  it('recusa o texto acima do limite com o erro maxlength', () => {
    const controle = new FormControl('abc', { validators: [ateCaracteres(2)] });

    expect(controle.errors).toEqual({ maxlength: { requiredLength: 2, actualLength: 3 } });
  });

  it('aceita o valor nulo', () => {
    expect(new FormControl<string | null>(null, { validators: [ateCaracteres(2)] }).valid).toBe(
      true,
    );
  });
});
