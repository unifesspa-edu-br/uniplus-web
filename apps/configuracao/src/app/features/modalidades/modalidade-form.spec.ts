import { FormControl, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  criarFormularioDeModalidade,
  ehDaRegra,
  marcarCodigoRepetido,
  mensagemDoCampo,
  reconciliarCondicionais,
  resumoCondicional,
  controleDoCampoDoServidor,
} from './modalidade-form';

describe('modalidade-form', () => {
  it('reconhece a recusa da regra pelo caminho, com ou sem índices', () => {
    expect(ehDaRegra('regraDeAplicabilidade')).toBe(true);
    expect(ehDaRegra('RegraDeAplicabilidade[0][1].Valor')).toBe(true);
    expect(ehDaRegra('Descricao')).toBe(false);
  });

  it('mapeia o campo do servidor no controle do formulário', () => {
    expect(controleDoCampoDoServidor('BaseLegal')).toBe('baseLegal');
    expect(controleDoCampoDoServidor('Inexistente')).toBeNull();
  });

  it('marca e desmarca o código repetido sem perder os demais erros', () => {
    const control = new FormControl('A-', [Validators.pattern(/^[A-Z]+$/u)]);
    marcarCodigoRepetido(control, true);
    expect(control.errors).toEqual({ pattern: expect.anything(), duplicado: true });
    marcarCodigoRepetido(control, false);
    expect(control.hasError('duplicado')).toBe(false);
    expect(control.hasError('pattern')).toBe(true);
  });

  it('diz o formato do código e a repetição só depois de tocado o campo', () => {
    const { codigo } = criarFormularioDeModalidade().controls;
    codigo.setValue('a-b');
    expect(mensagemDoCampo(codigo)).toBeNull();
    codigo.markAsTouched();
    expect(mensagemDoCampo(codigo)).toBe('Use apenas maiúsculas, dígitos e sublinhado.');
    marcarCodigoRepetido(codigo, true);
    expect(mensagemDoCampo(codigo)).toBe('Código já utilizado por outra modalidade viva.');
  });

  it('descreve o remanejamento cruzado só quando par e fallback foram informados', () => {
    const form = criarFormularioDeModalidade();
    const condicionais = {
      natureza: 'ACAO_AFIRMATIVA',
      composicao: 'RESIDUAL_DO_VO',
      regra: 'CRUZADO',
    } as const;
    expect(resumoCondicional(condicionais, form.getRawValue())[1]).toBe(
      'Remanejamento cruzado (informe o par e o fallback).',
    );
    form.patchValue({ remanejamentoPar: 'A', remanejamentoFallback: 'B' });
    expect(resumoCondicional(condicionais, form.getRawValue())[1]).toBe(
      'Remanejamento cruzado entre A e B.',
    );
  });

  it('exige a origem só na composição que retira de outra modalidade', () => {
    const form = criarFormularioDeModalidade();
    reconciliarCondicionais(form, 'AMPLA', 'RETIRA_DE');
    expect(form.controls.composicaoOrigem.invalid).toBe(true);
    reconciliarCondicionais(form, 'AMPLA', 'RESIDUAL_DO_VO');
    expect(form.controls.composicaoOrigem.valid).toBe(true);
  });
});
