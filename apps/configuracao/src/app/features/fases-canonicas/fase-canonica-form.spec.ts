import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  controleDoCampoDoServidor,
  criarFormularioDeFase,
  derivarMarcaDeIsencao,
  valoresDaFase,
} from './fase-canonica-form';

const fase = {
  id: 'f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: true,
  permiteComplementacao: true,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'NO_EDITAL',
  criadoEm: '',
} as const;

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

  it('zera o que o código da fase não admite', () => {
    const form = criarFormularioDeFase();
    form.reset(valoresDaFase({ ...fase, codigo: 'MATRICULA' }));
    expect(comandoDeAtualizacao('f1', form)).toMatchObject({
      agrupaEtapas: false,
      permiteComplementacao: false,
    });
    form.reset(valoresDaFase({ ...fase, codigo: 'RECURSOS' }));
    expect(comandoDeAtualizacao('f1', form)).toMatchObject({
      agrupaEtapas: false,
      permiteComplementacao: true,
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
