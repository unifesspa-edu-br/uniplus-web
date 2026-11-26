import { describe, expect, it } from 'vitest';
import { criarFormularioDeModelo, mensagemDoCampo } from './modelo-formulario-form';
import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';

describe('citação do tipo de processo no modelo', () => {
  it('aceita código de 80 caracteres e recusa um código maior', () => {
    const controle = criarFormularioDeModelo().controls.tipoProcessoCodigo;
    controle.setValue('A'.repeat(80));
    expect(controle.valid).toBe(true);
    controle.setValue('A'.repeat(81));
    expect(controle.hasError('maxlength')).toBe(true);
  });

  it('descreve o formato com o limite da citação', () => {
    const controle = criarFormularioDeModelo().controls.tipoProcessoCodigo;
    controle.setValue('invalido');
    controle.markAsTouched();
    expect(mensagemDoCampo(controle, 80)).toBe(textoDoFormatoDoCodigo(80));
  });
});
