import { describe, expect, it } from 'vitest';
import { criarFormularioDePerfil, valoresDoPerfil } from './perfil-form';

describe('formulário de perfil', () => {
  it('começa vazio e exige nome e descrição', () => {
    const form = criarFormularioDePerfil();
    expect(form.invalid).toBe(true);
    expect(form.getRawValue()).toEqual(valoresDoPerfil(null));
    form.setValue({ nome: 'Consulta', descricao: 'Permite consultar.' });
    expect(form.valid).toBe(true);
  });
});
