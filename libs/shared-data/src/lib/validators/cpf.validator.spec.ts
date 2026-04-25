import { FormControl, Validators } from '@angular/forms';
import { cpfValidator } from './cpf.validator';

describe('cpfValidator', () => {
  it('aceita CPF válido formatado', () => {
    const control = new FormControl('529.982.247-25', [cpfValidator]);
    expect(control.errors).toBeNull();
  });

  it('aceita CPF válido sem máscara', () => {
    const control = new FormControl('52998224725', [cpfValidator]);
    expect(control.errors).toBeNull();
  });

  it('rejeita CPF com dígitos verificadores incorretos', () => {
    const control = new FormControl('123.456.789-00', [cpfValidator]);
    expect(control.errors).toEqual({ cpfInvalido: true });
  });

  it('rejeita CPF com todos os dígitos iguais', () => {
    const control = new FormControl('111.111.111-11', [cpfValidator]);
    expect(control.errors).toEqual({ cpfInvalido: true });
  });

  it('rejeita CPF com menos de 11 dígitos', () => {
    const control = new FormControl('123456', [cpfValidator]);
    expect(control.errors).toEqual({ cpfInvalido: true });
  });

  it('aceita valor vazio (obrigatoriedade fica para Validators.required)', () => {
    const control = new FormControl('', [cpfValidator]);
    expect(control.errors).toBeNull();
  });

  it('aceita null (obrigatoriedade fica para Validators.required)', () => {
    const control = new FormControl(null, [cpfValidator]);
    expect(control.errors).toBeNull();
  });

  it('compõe com Validators.required: vazio rejeitado por required, não por cpfValidator', () => {
    const control = new FormControl('', [Validators.required, cpfValidator]);
    expect(control.errors).toEqual({ required: true });
  });

  it('compõe com Validators.required: CPF inválido reportado por cpfValidator', () => {
    const control = new FormControl('123.456.789-00', [Validators.required, cpfValidator]);
    expect(control.errors).toEqual({ cpfInvalido: true });
  });
});
