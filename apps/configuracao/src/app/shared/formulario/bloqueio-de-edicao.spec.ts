import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { bloquearEdicao } from './bloqueio-de-edicao';

function criar() {
  return new FormGroup({
    nome: new FormControl('Direito', { nonNullable: true }),
    codigo: new FormControl({ value: 'DIR', disabled: true }, { nonNullable: true }),
  });
}

describe('bloquearEdicao', () => {
  it('bloqueia os controles habilitados e mantém os valores', () => {
    const form = criar();

    bloquearEdicao(form);

    expect(form.controls.nome.disabled).toBe(true);
    expect(form.getRawValue()).toEqual({ nome: 'Direito', codigo: 'DIR' });
  });

  it('a liberação reabilita só o que ela bloqueou: o desabilitado por regra continua assim', () => {
    const form = criar();

    bloquearEdicao(form)();

    expect(form.controls.nome.enabled).toBe(true);
    expect(form.controls.codigo.disabled).toBe(true);
  });
});
