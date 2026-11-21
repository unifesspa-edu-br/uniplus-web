import { TipoDeBancaCodigo } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  controleDoCampoDoServidor,
  criarFormularioDeBanca,
  valoresDaBanca,
} from './tipo-banca-form';
import { tipoDeBanca } from './tipos-banca.testing';

describe('formulário de tipo de banca', () => {
  it('preenche valores opcionais, valida campos e prepara atualização sem código', () => {
    const banca = tipoDeBanca(TipoDeBancaCodigo.BANCA_ENTREVISTA, {
      id: '1',
      nome: 'Banca',
      faseTipica: null,
    });
    const form = criarFormularioDeBanca();
    expect(form.invalid).toBe(true);
    form.reset(valoresDaBanca(banca));
    expect(form.valid).toBe(true);
    expect(form.getRawValue()).toEqual({
      codigo: 'BANCA_ENTREVISTA',
      nome: 'Banca',
      faseTipica: '',
      descricao: '',
    });
    form.controls.nome.setValue(' Nome ');
    form.controls.faseTipica.setValue(' Avaliação ');
    form.controls.descricao.setValue('  ');
    expect(comandoDeAtualizacao(banca, form)).toEqual({
      id: '1',
      papel: 'AVALIA_O_MERITO',
      exigeDuasOuMaisBancas: false,
      encerraRecursoNaPrimeiraInstancia: false,
      tiposDeDecisaoJulgados: [],
      nome: 'Nome',
      faseTipica: 'Avaliação',
      descricao: null,
    });
    expect(controleDoCampoDoServidor('Nome')).toBe('nome');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });
});
