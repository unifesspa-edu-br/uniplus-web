import { FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  marcarConflitoNoCampo,
  marcarRecusaDoServidor,
  recusasDoControle,
  validarParaEnvio,
} from './recusa-do-servidor';

describe('validarParaEnvio', () => {
  it('descarta a recusa anterior e permite o envio válido', () => {
    const campo = new FormControl('valor', { nonNullable: true });
    const form = new FormGroup({ campo });
    marcarRecusaDoServidor(campo, 'recusa', 'Recusado');
    expect(validarParaEnvio(form)).toBe(true);
    expect(recusasDoControle(campo)).toEqual([]);
  });

  it('marca os campos quando a validação local falha', () => {
    const campo = new FormControl('', { nonNullable: true, validators: Validators.required });
    expect(validarParaEnvio(new FormGroup({ campo }))).toBe(false);
    expect(campo.touched).toBe(true);
  });

  it('permite envio com validação pendente', () => {
    const campo = new FormControl('valor');
    campo.markAsPending();
    expect(validarParaEnvio(campo)).toBe(true);
  });
});

describe('marcarConflitoNoCampo', () => {
  it('marca o campo correspondente sem página', () => {
    const codigo = new FormControl('valor');
    const form = new FormGroup({ codigo });
    expect(
      marcarConflitoNoCampo(
        { code: 'duplicado' },
        'Já existe',
        form,
        new Map([['duplicado', 'codigo']]),
      ),
    ).toBe(true);
    expect(recusasDoControle(codigo)).toEqual([
      { codigo: 'duplicado', mensagem: 'Já existe', pagina: null },
    ]);
    expect(codigo.touched).toBe(true);
  });

  it('não marca campo quando o código não é conhecido', () => {
    const codigo = new FormControl('valor');
    expect(
      marcarConflitoNoCampo(
        { code: 'outro' },
        'Erro',
        new FormGroup({ codigo }),
        new Map([['duplicado', 'codigo']]),
      ),
    ).toBe(false);
    expect(codigo.errors).toBeNull();
  });
});
