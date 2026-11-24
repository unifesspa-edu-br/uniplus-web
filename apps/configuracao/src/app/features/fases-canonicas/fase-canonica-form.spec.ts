import { ORIGENS_DE_DATA } from './origens-de-data.testing';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  controleDoCampoDoServidor,
  criarFormularioDeFase,
  derivarMarcaDeIsencao,
  sinalizadoresAdmitidos,
  valoresDaFase,
} from './fase-canonica-form';

const fase: FaseCanonicaDto = {
  id: 'f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: true,
  permiteComplementacao: true,
  admiteAgruparEtapas: true,
  admiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: ORIGENS_DE_DATA.NO_EDITAL,
  criadoEm: '',
};

describe('formulário de fase canônica', () => {
  it('preenche os opcionais em branco, valida e prepara a atualização sem o código', () => {
    const form = criarFormularioDeFase();
    expect(form.invalid).toBe(true);
    form.reset(valoresDaFase(fase));
    expect(form.valid).toBe(true);
    expect(form.getRawValue()).toMatchObject({
      descricao: '',
      baseLegal: '',
      unidadeSugeridaId: '',
    });
    form.controls.nome.setValue(' Nome ');
    form.controls.baseLegal.setValue(' Lei ');
    const comando = comandoDeAtualizacao('f1', form);
    expect(comando).toMatchObject({ id: 'f1', nome: 'Nome', baseLegal: 'Lei', descricao: null });
    expect(comando).not.toHaveProperty('codigo');
  });

  it('devolve no comando os sinalizadores como foram lidos, sem consultar o código da fase', () => {
    const homologacao = { ...fase, codigo: 'HOMOLOGACAO_INSCRICOES', agrupaEtapas: false };
    const form = criarFormularioDeFase();
    form.reset(valoresDaFase({ ...homologacao, permiteComplementacao: true }));
    expect(comandoDeAtualizacao('f1', form)).toMatchObject({
      agrupaEtapas: false,
      permiteComplementacao: true,
    });

    form.reset(valoresDaFase({ ...homologacao, permiteComplementacao: false }));
    expect(comandoDeAtualizacao('f1', form)).toMatchObject({ permiteComplementacao: false });
  });

  it.each([
    ['AVALIACAO', true, false],
    ['MATRICULA', true, true],
    ['HOMOLOGACAO_INSCRICOES', false, true],
  ])(
    'a fase %s lida com agrupa=%s e complementação=%s volta igual no comando',
    (codigo, agrupaEtapas, permiteComplementacao) => {
      const form = criarFormularioDeFase();
      form.reset(valoresDaFase({ ...fase, codigo, agrupaEtapas, permiteComplementacao }));
      expect(comandoDeAtualizacao('f1', form)).toMatchObject({
        agrupaEtapas,
        permiteComplementacao,
      });
    },
  );

  it.each([
    [true, false],
    [false, true],
    [false, false],
  ])(
    'oferece agrupar etapas=%s e complementação=%s conforme o que a fase admite, qualquer que seja o código',
    (admiteAgruparEtapas, admiteComplementacao) => {
      expect(
        sinalizadoresAdmitidos({
          ...fase,
          codigo: 'QUALQUER',
          admiteAgruparEtapas,
          admiteComplementacao,
        }),
      ).toEqual({ agrupaEtapas: admiteAgruparEtapas, permiteComplementacao: admiteComplementacao });
    },
  );

  it('não oferece nenhum sinalizador sem fase em edição', () => {
    expect(sinalizadoresAdmitidos(null)).toEqual({
      agrupaEtapas: false,
      permiteComplementacao: false,
    });
  });

  it('deriva a marca de isenção do código e retira a coleta de inscrição da fase de isenção', () => {
    const form = criarFormularioDeFase();
    form.controls.coletaInscricao.setValue(true);
    derivarMarcaDeIsencao(form, 'SOLICITACAO_ISENCAO');
    expect(form.controls.coletaSolicitacaoIsencao.value).toBe(true);
    expect(form.controls.coletaInscricao.value).toBe(false);
    derivarMarcaDeIsencao(form, 'AVALIACAO');
    expect(form.controls.coletaSolicitacaoIsencao.value).toBe(false);
  });

  it('mapeia o campo recusado pelo servidor ao controle, ou a nenhum', () => {
    expect(controleDoCampoDoServidor('UnidadeSugeridaId')).toBe('unidadeSugeridaId');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });
});
