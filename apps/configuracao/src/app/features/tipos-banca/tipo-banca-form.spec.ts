import {
  PapelDaBancaCodigo,
  TipoDeBancaCodigo,
  TipoMotivoDeDecisaoCodigo,
} from '@uniplus/shared-data/configuracao';
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
      papel: 'AVALIA_O_MERITO',
      exigeDuasOuMaisBancas: false,
      encerraRecursoNaPrimeiraInstancia: false,
      tiposDeDecisaoJulgados: [],
    });
    form.controls.nome.setValue(' Nome ');
    form.controls.faseTipica.setValue(' Avaliação ');
    form.controls.descricao.setValue('  ');
    expect(comandoDeAtualizacao(banca, form)).toEqual({
      id: '1',
      nome: 'Nome',
      faseTipica: 'Avaliação',
      descricao: null,
      papel: 'AVALIA_O_MERITO',
      exigeDuasOuMaisBancas: false,
      encerraRecursoNaPrimeiraInstancia: false,
      tiposDeDecisaoJulgados: [],
    });
    expect(controleDoCampoDoServidor('Nome')).toBe('nome');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });
  it('preserva papel e decisões e envia as marcas como booleanos', () => {
    const papel = PapelDaBancaCodigo.JULGA_A_PRIMEIRA_INSTANCIA;
    const decisao = TipoMotivoDeDecisaoCodigo.CLASSIFICACAO;
    const banca = tipoDeBanca(TipoDeBancaCodigo.BANCA_ENTREVISTA, {
      id: '1',
      papel: { codigo: papel, rotulo: 'Julga o recurso em 1ª instância' },
      exigeDuasOuMaisBancas: true,
      tiposDeDecisaoJulgados: [{ codigo: decisao, rotulo: 'Classificação' }],
    });
    const form = criarFormularioDeBanca();
    form.reset(valoresDaBanca(banca));
    expect(comandoDeAtualizacao(banca, form)).toMatchObject({
      id: '1',
      papel,
      tiposDeDecisaoJulgados: [decisao],
      exigeDuasOuMaisBancas: true,
      encerraRecursoNaPrimeiraInstancia: false,
    });
    form.controls.exigeDuasOuMaisBancas.setValue(false);
    form.controls.encerraRecursoNaPrimeiraInstancia.setValue(true);
    expect(comandoDeAtualizacao(banca, form)).toMatchObject({
      exigeDuasOuMaisBancas: false,
      encerraRecursoNaPrimeiraInstancia: true,
    });
  });
  it.each([
    ['papel', 'papel'],
    ['exigeDuasOuMaisBancas', 'exigeDuasOuMaisBancas'],
    ['encerraRecursoNaPrimeiraInstancia', 'encerraRecursoNaPrimeiraInstancia'],
    ['tiposDeDecisaoJulgados[2]', 'tiposDeDecisaoJulgados'],
  ])('liga o campo %s ao controle %s', (campo, controle) => {
    expect(controleDoCampoDoServidor(campo)).toBe(controle);
  });
});
