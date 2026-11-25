import { FormaDoConceitoCodigo, TipoEtapaDto } from '@uniplus/shared-data/configuracao';
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
  avaliacao: {
    admitePontuacao: false,
    admiteEliminacao: true,
    notaDeOrigemNoEnem: false,
    exigeCorrecaoIndependente: false,
    conceitosAdmitidos: [
      {
        codigo: 'CONCEITO_A',
        nome: 'Conceito A',
        natureza: { codigo: FormaDoConceitoCodigo.POR_OPCOES, rotulo: 'Por opções' },
      },
    ],
  },
  criadoEm: '',
};

const comandoEsperado = {
  nome: 'Nome',
  avaliacao: {
    admitePontuacao: false,
    admiteEliminacao: true,
    exigeCorrecaoIndependente: false,
    conceitosAdmitidos: ['CONCEITO_A'],
  },
  descricao: null,
};

describe('formulário de tipo de etapa', () => {
  it('nasce inválido, admitindo os dois caracteres, e exige código e nome', () => {
    const form = criarFormularioDeEtapa();
    form.reset(valoresEmBrancoDaEtapa());
    expect(form.invalid).toBe(true);
    expect(form.controls.admitePontuacao.value).toBe(true);
    expect(form.controls.admiteEliminacao.value).toBe(true);
    expect(form.controls.exigeCorrecaoIndependente.value).toBe(false);
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
      exigeCorrecaoIndependente: false,
      descricao: '',
      conceitosAdmitidos: ['CONCEITO_A'],
    });
  });

  it('preserva o código e apara os demais textos nos comandos', () => {
    const form = criarFormularioDeEtapa();
    form.reset(valoresDaEtapa(tipo));
    form.patchValue({ codigo: ' NOVA ', nome: ' Nome ', descricao: '  ' });
    expect(comandoDeCriacao(form)).toEqual({ codigo: ' NOVA ', ...comandoEsperado });
  });

  it('atualiza com textos aparados e avaliação preservada', () => {
    const form = criarFormularioDeEtapa();
    form.reset(valoresDaEtapa(tipo));
    form.patchValue({ codigo: ' NOVA ', nome: ' Nome ', descricao: '  ' });
    expect(comandoDeAtualizacao('1', form)).toEqual({ id: '1', ...comandoEsperado });
  });

  it('cria o tipo sem conceitos admitidos e mantém os que o tipo já tinha ao atualizar', () => {
    const novo = criarFormularioDeEtapa();
    novo.reset(valoresEmBrancoDaEtapa());
    novo.patchValue({ codigo: 'NOVA', nome: 'Nova' });
    expect(comandoDeCriacao(novo).avaliacao?.conceitosAdmitidos).toEqual([]);

    const existente = criarFormularioDeEtapa();
    existente.reset(
      valoresDaEtapa({ ...tipo, avaliacao: { ...tipo.avaliacao, conceitosAdmitidos: [] } }),
    );
    expect(comandoDeAtualizacao('1', existente).avaliacao?.conceitosAdmitidos).toEqual([]);
  });

  it('devolve nos dois comandos a exigência de correção independente que o tipo declara', () => {
    const form = criarFormularioDeEtapa();
    form.reset(
      valoresDaEtapa({
        ...tipo,
        avaliacao: { ...tipo.avaliacao, exigeCorrecaoIndependente: true },
      }),
    );
    expect(form.controls.exigeCorrecaoIndependente.value).toBe(true);
    expect(comandoDeCriacao(form).avaliacao?.exigeCorrecaoIndependente).toBe(true);
    expect(comandoDeAtualizacao('1', form).avaliacao?.exigeCorrecaoIndependente).toBe(true);

    form.controls.exigeCorrecaoIndependente.setValue(false);
    expect(comandoDeCriacao(form).avaliacao?.exigeCorrecaoIndependente).toBe(false);
    expect(comandoDeAtualizacao('1', form).avaliacao?.exigeCorrecaoIndependente).toBe(false);
  });

  it('liga o campo recusado pelo servidor ao controle, ignorando o desconhecido', () => {
    expect(controleDoCampoDoServidor('AdmitePontuacao')).toBe('admitePontuacao');
    expect(controleDoCampoDoServidor('ExigeCorrecaoIndependente')).toBe(
      'exigeCorrecaoIndependente',
    );
    expect(controleDoCampoDoServidor('Avaliacao.AdmiteEliminacao')).toBe('admiteEliminacao');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });
});
