import { TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeEtapa,
  valoresDaEtapa,
  valoresEmBrancoDaEtapa,
} from './tipo-etapa-form';

const tipo: TipoEtapaDto = {
  id: '1',
  codigo: 'PROVA',
  nome: 'Prova',
  descricao: null,
  ativo: true,
  admitePontuacao: false,
  admiteEliminacao: true,
  notaDeOrigemNoEnem: false,
  criadoEm: '',
};

describe('formulário de tipo de etapa', () => {
  it('nasce inválido, admitindo os dois caracteres, e exige código e nome', () => {
    const form = criarFormularioDeEtapa();
    form.reset(valoresEmBrancoDaEtapa());
    expect(form.invalid).toBe(true);
    expect(form.controls.admitePontuacao.value).toBe(true);
    expect(form.controls.admiteEliminacao.value).toBe(true);
    form.patchValue({ codigo: 'PROVA', nome: 'x'.repeat(201) });
    expect(form.controls.nome.errors).toEqual({
      maxlength: { requiredLength: 200, actualLength: 201 },
    });
    form.controls.nome.setValue('Prova');
    expect(form.valid).toBe(true);
  });

  it('carrega o tipo no formulário e apara os textos nos comandos', () => {
    const form = criarFormularioDeEtapa();
    form.reset(valoresDaEtapa(tipo));
    expect(form.getRawValue()).toEqual({
      codigo: 'PROVA',
      nome: 'Prova',
      admitePontuacao: false,
      admiteEliminacao: true,
      descricao: '',
    });
    form.patchValue({ codigo: ' NOVA ', nome: ' Nome ', descricao: '  ' });
    expect(comandoDeCriacao(form)).toEqual({
      codigo: 'NOVA',
      nome: 'Nome',
      admitePontuacao: false,
      admiteEliminacao: true,
      descricao: null,
    });
    expect(comandoDeAtualizacao('1', form)).toEqual({
      id: '1',
      nome: 'Nome',
      admitePontuacao: false,
      admiteEliminacao: true,
      descricao: null,
    });
  });

  it('liga o campo recusado pelo servidor ao controle, ignorando o desconhecido', () => {
    expect(controleDoCampoDoServidor('AdmitePontuacao')).toBe('admitePontuacao');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });
});
