import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  controleDoCampoDoServidor,
  criarFormularioDeBanca,
  valoresDaBanca,
} from './tipo-banca-form';

describe('formulário de tipo de banca', () => {
  it('preenche valores opcionais, valida campos e prepara atualização sem código', () => {
    const form = criarFormularioDeBanca();
    expect(form.invalid).toBe(true);
    form.reset(
      valoresDaBanca({
        id: '1',
        codigo: 'BANCA',
        nome: 'Banca',
        faseTipica: null,
        descricao: null,
        criadoEm: '',
      }),
    );
    expect(form.valid).toBe(true);
    expect(form.getRawValue()).toEqual({
      codigo: 'BANCA',
      nome: 'Banca',
      faseTipica: '',
      descricao: '',
    });
    form.controls.nome.setValue(' Nome ');
    form.controls.faseTipica.setValue(' Avaliação ');
    form.controls.descricao.setValue('  ');
    expect(comandoDeAtualizacao('1', form)).toEqual({
      id: '1',
      nome: 'Nome',
      faseTipica: 'Avaliação',
      descricao: null,
    });
    expect(controleDoCampoDoServidor('Nome')).toBe('nome');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });
});
