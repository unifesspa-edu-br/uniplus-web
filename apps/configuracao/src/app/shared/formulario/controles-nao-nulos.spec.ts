import { Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { controleDeMarca, controleDeTexto } from './controles-nao-nulos';

describe('controleDeTexto', () => {
  it('começa vazio e volta ao texto vazio quando limpo', () => {
    const controle = controleDeTexto();
    controle.setValue('abc');

    controle.reset();

    expect(controle.value).toBe('');
  });

  it('aplica os validadores recebidos', () => {
    const controle = controleDeTexto(Validators.required, Validators.maxLength(3));

    expect(controle.hasError('required')).toBe(true);
    controle.setValue('abcd');
    expect(controle.hasError('maxlength')).toBe(true);
    controle.setValue('abc');
    expect(controle.valid).toBe(true);
  });
});

describe('controleDeMarca', () => {
  it('volta ao valor inicial quando limpo', () => {
    const marcada = controleDeMarca(true);
    marcada.setValue(false);

    marcada.reset();

    expect(marcada.value).toBe(true);
  });
});
