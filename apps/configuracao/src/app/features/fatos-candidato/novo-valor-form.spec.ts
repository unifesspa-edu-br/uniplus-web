import { describe, expect, it } from 'vitest';
import { comandoDoNovoValor, criarFormularioDoNovoValor } from './fato-candidato-edicao-form';

describe('código do valor de domínio', () => {
  it.each(['valor', ' VALOR', 'VALOR_', 'VALOR__A', 'A'.repeat(51)])('recusa %s', (codigo) => {
    const form = criarFormularioDoNovoValor();
    form.controls.codigo.setValue(codigo);
    expect(form.controls.codigo.invalid).toBe(true);
  });

  it('aceita e envia o código sem conversão', () => {
    const form = criarFormularioDoNovoValor();
    form.controls.codigo.setValue('A'.repeat(50));
    expect(form.controls.codigo.valid).toBe(true);
    expect(comandoDoNovoValor(form, 0).codigo).toBe('A'.repeat(50));
  });
});
